// Earn (Service hub → Lending tab) - Circle Earn Kit REST on Morpho vaults. Core + rules: ./_earnCore.js.
// LABS feature (src/labs.js): answers only on the labs hosts until the owner turns it on for ezwallet.cash.
// Actions: vaults · positions · quote · fee · execute (a contractExecution challenge → one PIN).
import {
  EARN_MAX_USD, listVaults, heldVaults, position, quote, fetchEarnIntent, validateEarnIntent, buildEarnBatch,
} from './_earnCore.js'
import { simulateBatch } from './_swapCore.js'
import { netFrom, netError } from './_net.js'
import { amountProblem, toBaseUnits } from '../../src/money.js'
import { isLabsHost } from '../../src/labs.js'

const W3S_API = 'https://api.circle.com/v1/w3s'
const JSON_HEADERS = { 'Content-Type': 'application/json' }
const ok = (body) => new Response(JSON.stringify(body), { headers: JSON_HEADERS })
// The raw upstream payload (`detail`) goes to the server log only - never back to the browser.
const err = (msg, detail, status = 500) => {
  if (detail) console.error('[earn]', msg, JSON.stringify(detail))
  return new Response(JSON.stringify({ error: msg }), { status, headers: JSON_HEADERS })
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// USD value of `amount` of a vault asset, from the shared live price (KV `prices:v1`, written by /api/prices).
// USDC = $1. No live price → null → the deposit is refused (owner 2026-10-05: caps in USD, no price = locked).
async function usdValue(ctx, asset, amount) {
  if (asset === 'USDC') return Number(amount)
  try {
    const p = JSON.parse(await ctx.env.EZ_SYNC?.get('prices:v1') || 'null')?.prices?.[asset]
    return typeof p === 'number' && p > 0 ? Number(amount) * p : null
  } catch { return null }
}

export async function onRequestPost(ctx) {
  let net
  try { net = netFrom(ctx) } catch (e) { return netError(e) }
  if (!isLabsHost(new URL(ctx.request.url).hostname)) return err('Lending is not available yet', null, 503)
  try {
    const apiKey = ctx.env.API_KEY || ctx.env.CIRCLE_API_KEY
    if (!apiKey) return err('API_KEY not configured')
    const body = await ctx.request.json()
    const { action, kind, vault: vaultAddr, amount, userToken, walletId, walletAddress, refId } = body

    const list = await listVaults(net, apiKey)
    if (list.error) return err('Could not load the vaults right now.', list.detail, 502)
    if (action === 'vaults') return ok({ vaults: list.vaults, maxUsd: EARN_MAX_USD })

    if (!/^0x[0-9a-fA-F]{40}$/.test(String(walletAddress || ''))) return err('missing wallet', null, 400)
    if (action === 'positions') {
      const held = await heldVaults(net, walletAddress, list.vaults)
      const positions = await Promise.all(held.map(v => position(net, apiKey, walletAddress, v)))
      const bad = positions.find(p => p.error)
      if (bad) return err('Could not load your deposits right now.', bad.detail, 502)
      return ok({ positions })
    }

    // Everything below acts on ONE offered vault.
    if (kind !== 'deposit' && kind !== 'withdraw') return err('unknown kind', null, 400)
    const vault = list.vaults.find(v => v.address === String(vaultAddr || '').toLowerCase())
    if (!vault) return err('This vault is not offered.', null, 400)
    const decimals = net.tokens[vault.asset].decimals
    const problem = amountProblem(String(amount), decimals)
    if (problem) return err(problem, null, 400)
    const amountBase = toBaseUnits(String(amount), decimals)

    if (kind === 'deposit') {
      // Rule 2: the vault must be able to pay this amount back right now.
      if (Number(amount) > vault.withdrawable) return err('This vault cannot pay out that much right now.', null, 409)
      // Rule 3: at most EARN_MAX_USD per deposit, in USD from a live price.
      const usd = await usdValue(ctx, vault.asset, amount)
      if (usd === null) return err('No live price right now - try again in a moment.', null, 503)
      if (usd > EARN_MAX_USD) return err(`At most $${EARN_MAX_USD} per deposit for now.`, null, 400)
    }

    if (action === 'quote') {
      const q = await quote(net, apiKey, kind, { vault: vault.address, amount, walletAddress })
      if (!q.ok) return err(q.data?.message || `Earn Kit ${q.status}`, q.data, q.status === 400 ? 400 : 502)
      const d = q.data?.data || {}
      const n = (a) => a ? (Number(a.raw) / 10 ** a.decimals) : null
      return ok({ maxWithdrawable: n(d.maxWithdrawable), warnings: d.warnings || [] })
    }

    // fee + execute share the same intent → validate → batch path.
    if (action !== 'fee' && action !== 'execute') return err('unknown action', null, 400)
    if (!userToken || !walletId) return err('missing params', null, 400)
    if (action === 'execute' && !UUID.test(String(refId || ''))) return err('refId (uuid) required', null, 400)   // MAINNET-AUDIT C3

    const intent = await fetchEarnIntent(net, apiKey, kind, { vault: vault.address, amount, walletAddress })
    if (!intent.ok) return err(intent.data?.message || `Earn Kit ${intent.status}`, intent.data, intent.status === 400 ? 400 : 502)
    const bad = validateEarnIntent(net, intent.data, { kind, vault: vault.address, asset: vault.asset, walletAddress, amountBase })
    if (bad) return err('This request could not be verified - nothing was sent.', { bad, intent: intent.data }, 502)
    const built = buildEarnBatch(net, intent.data)

    if (action === 'fee') {
      // Circle's own estimate for this exact batch (as swap): medium.networkFee = the most it can cost.
      const r = await fetch(`${W3S_API}/transactions/contractExecution/estimateFee`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-User-Token': userToken },
        body: JSON.stringify({ walletId, contractAddress: net.contracts.multicall3From, callData: built.batchData }),
      })
      let fd; try { fd = await r.json() } catch { fd = {} }
      const m = fd?.data?.medium
      if (!r.ok || !m?.networkFee) return err(fd?.message || `Circle estimateFee ${r.status}`, fd, r.status === 401 ? 401 : 502)
      return ok({ feeMax: m.networkFee, feeNow: m.networkFeeRaw || null })
    }

    // execute: the batch must deliver at least its minimum output when run against the chain - else nothing is signed.
    const sim = await simulateBatch(net, walletAddress, built.outToken, built.batchData)
    if (sim.error) return err('Could not check this right now - nothing was sent. Please try again in a moment.', sim, 503)
    if (!sim.ok || sim.delta < built.minOut) {
      return err('This would not deliver the amount shown - nothing was sent.', { ...sim, delta: String(sim.delta), before: String(sim.before), after: String(sim.after) }, 502)
    }
    const txRes = await fetch(`${W3S_API}/user/transactions/contractExecution`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-User-Token': userToken },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        walletId, contractAddress: net.contracts.multicall3From, callData: built.batchData,
        feeLevel: 'MEDIUM', refId,
      }),
    })
    const txData = await txRes.json()
    const challengeId = txData?.data?.challengeId
    if (!challengeId) return err(`${txData?.message || 'no challengeId'} (HTTP ${txRes.status})`, txData)
    return ok({ challengeId })
  } catch (e) {
    return err('unhandled', { message: e.message, stack: e.stack?.slice(0, 300) })
  }
}
