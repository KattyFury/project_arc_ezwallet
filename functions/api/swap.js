// Swap qua Circle Stablecoin Kit REST — endpoint Cloudflare Pages Function.
// The encode/verify core lives in ./_swapCore.js (shared with dev-server.js). See that file for THE CORRECT WAY
// to call the ADAPTER contract (do not unpack the instructions and run them by hand - the old way LOST MONEY).
// Actions: estimate (a quote), simulate (verify with eth_simulateV1, no PIN and no cost),
// execute (create a contractExecution challenge → the user signs with one PIN).
import {
  CIRCLE_API, tokenOf, toBase, fromBase, SLIPPAGE_BPS,
  fetchSwapIntent, validateIntent, buildSwapBatch, simulateBatch, simulateSwap,
} from './_swapCore.js'
import { netFrom, netError } from './_net.js'
import { amountProblem } from '../../src/money.js'

const W3S_API = 'https://api.circle.com/v1/w3s'
const JSON_HEADERS = { 'Content-Type': 'application/json' }
// The raw upstream payload (`detail`) goes to the server log only - never back to the browser (mainnet v1 plan item 7 (2026-09-27, deleted doc - git history)).
const err = (msg, detail, status = 500) => {
  if (detail) console.error('[swap]', msg, JSON.stringify(detail))
  return new Response(JSON.stringify({ error: msg }), { status, headers: JSON_HEADERS })
}

export async function onRequestPost(ctx) {
  let net
  try { net = netFrom(ctx) } catch (e) { return netError(e) }
  if (!net.swap) return err('Swap is not available on this network yet', null, 503)   // mainnet v1: send/receive only
  try {
    const apiKey = ctx.env.API_KEY || ctx.env.CIRCLE_API_KEY
    const body = await ctx.request.json()
    const { action, userToken, walletId, walletAddress, tokenIn, tokenOut, amountIn, refId } = body

    const fromAddr = tokenOf(net, tokenIn)?.address
    const toAddr   = tokenOf(net, tokenOut)?.address
    if (action === 'estimate' || action === 'simulate' || action === 'execute' || action === 'fee') {
      if (!fromAddr || !toAddr) return err('unknown token', null, 400)
      const problem = amountProblem(amountIn, net.tokens[tokenIn].decimals)
      if (problem) return err(problem, null, 400)
    }

    if (action === 'estimate') {
      if (!apiKey) return err('API_KEY not configured')
      if (!fromAddr || !toAddr) return err('unknown token', null, 400)
      const params = new URLSearchParams({
        tokenInAddress: fromAddr, tokenInChain: net.kitChain,
        tokenOutAddress: toAddr,  tokenOutChain: net.kitChain,
        fromAddress: walletAddress || '0x0000000000000000000000000000000000000001',
        amount: toBase(net, amountIn, tokenIn).toString(), slippageBps: String(SLIPPAGE_BPS),
      })
      const res = await fetch(`${CIRCLE_API}/v1/stablecoinKits/quote?${params}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      const data = await res.json()
      if (!res.ok) return err(data?.message || `Circle API ${res.status}`, data)
      const q = data?.data?.quote || data?.quote || data?.data || data
      const amountOut = q?.estimatedAmount ? fromBase(net, q.estimatedAmount, tokenOut) : null
      // minOut = the least the user can receive at SLIPPAGE_BPS; the screen sends it back on execute → stopLimit (H2).
      const minOut = q?.minAmount ? fromBase(net, q.minAmount, tokenOut) : null
      return new Response(JSON.stringify({ estimate: data?.data || data, amountOut, minOut }), { headers: JSON_HEADERS })
    }

    // THE NETWORK FEE OF THIS EXACT SWAP (owner 2026-10-04: no guessed numbers). Builds the same batch execute would
    // send and asks Circle POST /v1/w3s/transactions/contractExecution/estimateFee (user-controlled-wallets OpenAPI).
    // feeMax = medium.networkFee = "the maximum amount … you will pay" (gasLimit × maxFee) - the wallet must HOLD it in
    // USDC for Circle to accept the tx, so it is also the USDC reserve. Measured 2026-10-04 on the owner's wallet:
    // 0.5 USDC→EURC gasLimit 961922, networkFee 0.0399, networkFeeRaw 0.0207; real swaps paid 0.0155-0.0160.
    if (action === 'fee') {
      if (!apiKey) return err('API_KEY not configured')
      if (!userToken || !walletId || !walletAddress) return err('missing params', null, 400)
      const amountBase = toBase(net, amountIn, tokenIn)
      const intent = await fetchSwapIntent(net, apiKey, fromAddr, toAddr, walletAddress, amountBase)
      if (!intent.ok) return err(`Stablecoin Kit ${intent.status}: ${intent.data?.message || 'swap failed'}`, intent.data)
      const bad = validateIntent(net, intent.data, { fromAddr, toAddr, walletAddress, amountBase })
      if (bad) return err('This swap could not be verified.', { bad }, 502)
      const built = buildSwapBatch(net, intent.data, fromAddr, amountBase)
      if (built.error) return err(built.error, built.swapData)
      const r = await fetch(`${W3S_API}/transactions/contractExecution/estimateFee`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-User-Token': userToken },
        body: JSON.stringify({ walletId, contractAddress: net.contracts.multicall3From, callData: built.batchData }),
      })
      let fd; try { fd = await r.json() } catch { fd = {} }
      const m = fd?.data?.medium   // execute uses feeLevel MEDIUM
      if (!r.ok || !m?.networkFee) return err(fd?.message || `Circle estimateFee ${r.status}`, fd, r.status === 401 ? 401 : 502)
      return new Response(JSON.stringify({ feeMax: m.networkFee, feeNow: m.networkFeeRaw || null, code: fd?.code }), { headers: JSON_HEADERS })
    }

    // The verify gate: only allow a swap when the wallet's tokenOut balance RISES (HANDOFF: never trust tx status=1).
    if (action === 'simulate') {
      if (!apiKey) return err('API_KEY not configured')
      const out = await simulateSwap({ net, apiKey, tokenIn, tokenOut, walletAddress, amountIn })
      if (out.error) return err(out.error, out.detail, 400)
      return new Response(JSON.stringify(out), { headers: JSON_HEADERS })
    }

    if (action === 'execute') {
      if (!userToken || !walletId || !walletAddress || !fromAddr || !toAddr) {
        return err('missing params', null, 400)
      }
      if (!refId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refId)) return err('refId (uuid) required', null, 400)   // MAINNET-AUDIT C3
      // H2: the minimum the screen showed (from 'estimate') becomes the intent's stopLimit - never less than displayed.
      const { minOut } = body
      if (!minOut || amountProblem(String(minOut), net.tokens[tokenOut].decimals)) return err('minOut required', null, 400)
      const amountBase = toBase(net, amountIn, tokenIn)
      const minOutBase = toBase(net, String(minOut), tokenOut)
      const intent = await fetchSwapIntent(net, apiKey, fromAddr, toAddr, walletAddress, amountBase, minOutBase)
      if (!intent.ok) {
        if (/stop limit/i.test(intent.data?.message || '')) return err('The price moved. Check the new amount and try again.', intent.data, 409)
        return err(`Stablecoin Kit ${intent.status}: ${intent.data?.message || 'swap failed'}`, intent.data)
      }
      // C5: the intent must be exactly what the user asked for…
      const bad = validateIntent(net, intent.data, { fromAddr, toAddr, walletAddress, amountBase, minOutBase })
      if (bad) return err('This swap could not be verified - nothing was sent.', { bad, intent: intent.data }, 502)
      const built = buildSwapBatch(net, intent.data, fromAddr, amountBase)
      if (built.error) return err(built.error, built.swapData)
      // …and must deliver at least minOut when run against the chain (eth_simulateV1 via dRPC). If the simulation cannot
      // run, REFUSE - a swap is never signed unchecked.
      const sim = await simulateBatch(net, walletAddress, toAddr, built.batchData)
      if (sim.error) return err('Could not check this swap right now - nothing was sent. Please try again in a moment.', sim, 503)
      if (!sim.ok || sim.delta < minOutBase) {
        return err('This swap would not deliver the amount shown - nothing was sent.', { ...sim, delta: String(sim.delta), before: String(sim.before), after: String(sim.after) }, 502)
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
      if (!challengeId) {
        console.error('[swap] contractExecution returned no challengeId:', txRes.status, JSON.stringify(txData))
        const msg = `${txData?.message || txData?.error?.message || 'no challengeId'} (HTTP ${txRes.status}${txData?.code ? `, code ${txData.code}` : ''})`
        return err(msg, txData)
      }
      const amountOut = built.estOut ? fromBase(net, built.estOut, tokenOut) : null
      return new Response(JSON.stringify({ challengeId, batched: true, amountOut }), { headers: JSON_HEADERS })
    }

    return err('unknown action', null, 400)
  } catch (e) {
    return err('unhandled', { message: e.message, stack: e.stack?.slice(0, 300) })
  }
}

