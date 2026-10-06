// Borrow (Service hub → Lending / Borrow, Borrow tab) - USDC loans against cirBTC on Morpho via Circle Borrow Kit.
// Core + rules: ./_borrowCore.js. LABS feature (src/labs.js): answers only on the labs hosts.
// Actions: markets · loans · quote · fee · execute (one PIN) · alertStart (the 2nd PIN: sign the webhook registration)
// · alertFinish (register the webhook with Circle + remember the owner's email for the alert).
import {
  BORROW_MAX_USD, BORROW_MAX_LTV, listMarkets, listLoans, fetchExecution, validateBorrowIntent, buildBorrowBatch,
  collateralFor50, marketParamsOf, hasStandingAuthorization, simulateBorrowBatch, kit, webhookTypedData,
} from './_borrowCore.js'
import { netFrom, netError } from './_net.js'
import { amountProblem, toBaseUnits } from '../../src/money.js'
import { isLabsHost } from '../../src/labs.js'
import { emailFromUserToken } from './_securityMail.js'

const W3S_API = 'https://api.circle.com/v1/w3s'
const JSON_HEADERS = { 'Content-Type': 'application/json' }
const ok = (b) => new Response(JSON.stringify(b, (k, v) => typeof v === 'bigint' ? v.toString() : v), { headers: JSON_HEADERS })
const err = (msg, detail, status = 500) => {
  if (detail) console.error('[borrow]', msg, JSON.stringify(detail, (k, v) => typeof v === 'bigint' ? v.toString() : v))
  return new Response(JSON.stringify({ error: msg }), { status, headers: JSON_HEADERS })
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || ''))
const KINDS = ['borrow', 'repay', 'addCollateral', 'withdrawCollateral', 'close']
const fromBase = (b, d) => Number(b) / 10 ** d

export async function onRequestPost(ctx) {
  let net
  try { net = netFrom(ctx) } catch (e) { return netError(e) }
  const url = new URL(ctx.request.url)
  if (!isLabsHost(url.hostname)) return err('Borrow is not available yet', null, 503)
  try {
    const apiKey = ctx.env.API_KEY || ctx.env.CIRCLE_API_KEY
    if (!apiKey) return err('API_KEY not configured')
    const body = await ctx.request.json()
    const { action, kind, marketId, loanId, amount, walletAddress: wallet, walletId, userToken, refId } = body

    if (action === 'markets') {
      const m = await listMarkets(net, apiKey)
      if (m.error) return err('Could not load the markets right now.', m.detail, 502)
      return ok({ markets: m.markets, maxUsd: BORROW_MAX_USD, maxLtv: BORROW_MAX_LTV })
    }
    if (!isAddr(wallet)) return err('missing wallet', null, 400)
    if (action === 'loans') {
      const l = await listLoans(net, wallet)
      if (l.error) return err('Could not load your loans right now.', l.detail, 502)
      // alertsOn = this loan's liquidation alert was registered through ezwallet (KV `loan:` written by alertFinish).
      const kv = ctx.env.EZ_SYNC
      const loans = await Promise.all(l.loans.map(async x => ({ ...x, alertsOn: kv ? !!(await kv.get(`loan:${x.loanId}`)) : false })))
      return ok({ loans })
    }

    // ── the 2nd PIN: liquidation alerts (owner 2026-10-06) ──
    if (action === 'alertStart' || action === 'alertFinish') {
      if (!UUID.test(String(loanId || ''))) return err('loanId required', null, 400)
      const webhookUrl = `https://${url.hostname}/api/borrow-alert`
      if (action === 'alertStart') {
        if (!userToken || !walletId) return err('missing params', null, 400)
        const deadline = Math.floor(Date.now() / 1000) + 240   // the service accepts ≤ 300 s
        const typed = webhookTypedData(net, { loanId, owner: wallet, webhookUrl, deadline })
        const r = await fetch(`${W3S_API}/user/sign/typedData`, {
          method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-User-Token': userToken },
          body: JSON.stringify({ walletId, data: JSON.stringify(typed), memo: 'Turn on liquidation alerts for your ezwallet loan' }),
        })
        const d = await r.json().catch(() => ({}))
        const challengeId = d?.data?.challengeId
        if (!challengeId) return err(`${d?.message || 'no challengeId'} (HTTP ${r.status})`, d)
        return ok({ challengeId, deadline, webhookUrl })
      }
      const { signature, deadline } = body
      if (!/^0x[0-9a-fA-F]{130}$/.test(String(signature || '')) || !Number.isInteger(Number(deadline))) return err('signature + deadline required', null, 400)
      const r = await kit('POST', `/loans/${encodeURIComponent(loanId)}/webhookRegistration`, { webhookUrl, deadline: Number(deadline), walletSignature: signature })
      if (!r.ok) return err(r.data?.message || `Borrow Kit ${r.status}`, r.data, 502)
      // The alert mail goes to the address Circle has for this user (never one the browser claims).
      const email = userToken ? await emailFromUserToken(apiKey, userToken).catch(() => null) : null
      if (ctx.env.EZ_SYNC && email) await ctx.env.EZ_SYNC.put(`loan:${loanId}`, JSON.stringify({ wallet: wallet.toLowerCase(), email }))
      return ok({ registered: true, email: !!email })
    }

    // ── one write ──
    if (!KINDS.includes(kind)) return err('unknown kind', null, 400)
    const markets = await listMarkets(net, apiKey)
    if (markets.error) return err('Could not load the markets right now.', markets.detail, 502)
    const loans = await listLoans(net, wallet)
    if (loans.error) return err('Could not load your loans right now.', loans.detail, 502)
    const loan = loanId ? loans.loans.find(l => l.loanId === loanId) : null
    if (loanId && !loan) return err('Loan not found for this wallet.', null, 404)
    const mId = loan ? loan.marketId : marketId
    const market = markets.markets.find(m => m.marketId === mId)
    if (!market) return err('This market is not offered.', null, 400)
    // A wallet has ONE Morpho position per market → a 2nd borrow in the same market grows the existing loan.
    const existing = !loan && kind === 'borrow' ? loans.loans.find(l => l.marketId === mId && l.status === 'active') : null
    const target = loan || existing
    if (kind !== 'borrow' && !target) return err('loanId required', null, 400)

    const tokSym = (kind === 'addCollateral' || kind === 'withdrawCollateral') ? 'cirBTC' : 'USDC'
    const d = net.tokens[tokSym].decimals
    if (kind !== 'close') { const p = amountProblem(String(amount), d); if (p) return err(p, null, 400) }
    const amountBase = kind === 'close' ? 0n : toBaseUnits(String(amount), d)

    if (kind === 'borrow') {
      if (Number(amount) > market.free) return err('Not enough USDC free to borrow in this market right now.', null, 409)
      if (Number(amount) + (target?.borrowed || 0) > BORROW_MAX_USD) return err(`At most $${BORROW_MAX_USD} borrowed per loan.`, null, 400)
      if (await hasStandingAuthorization(net, wallet)) return err('Your wallet has an old Morpho permission still open - contact support.', null, 409)
    }

    const intent = await fetchExecution(net, apiKey, kind, { wallet, marketId: mId, loanId: target?.loanId, amount: String(amount) })
    if (!intent.ok) return err(intent.data?.message || `Borrow Kit ${intent.status}`, intent.data, intent.status === 400 ? 400 : 502)
    const bad = validateBorrowIntent(net, intent.data, { kind, wallet, amountBase })
    if (bad) return err('This request could not be verified - nothing was sent.', { bad, intent: intent.data }, 502)

    // THE 50% RULE for a borrow: top up cirBTC in the same batch so the loan's TOTAL collateral covers its TOTAL debt at
    // LTV ≤ 50%. needBase from the service's own sizing; what the intent already pulls + what is already posted counts.
    let topUpBase = 0n, needBase = 0n, liquidationPrice = null, marketParams = null
    if (kind === 'borrow') {
      const totalDebt = (target?.borrowed || 0) + Number(amount)
      const need = await collateralFor50(net, mId, totalDebt.toFixed(6), market.lltv)
      if (need.error) return err('Could not size the collateral right now.', need.detail, 502)
      needBase = need.needBase; liquidationPrice = need.liquidationPrice
      const pulled = intent.data.executionParams.instructions
        .filter(i => i.tokenIn.toLowerCase() === net.tokens.cirBTC.address.toLowerCase())
        .reduce((a, i) => a + BigInt(i.amountToApprove || 0), 0n)
      const posted = target?.collateral ? toBaseUnits(target.collateral.toFixed(8), 8) : 0n
      topUpBase = needBase > posted + pulled ? needBase - posted - pulled : 0n
      if (topUpBase > 0n) marketParams = await marketParamsOf(net, mId)
    }
    const batch = buildBorrowBatch(net, kind, intent.data, wallet, { marketParams, topUpBase })
    const cirbtcNeeded = kind === 'borrow' ? fromBase(needBase - (target?.collateral ? toBaseUnits(target.collateral.toFixed(8), 8) : 0n), 8) : null

    if (action === 'quote') return ok({ cirbtcNeeded, liquidationPrice, topUp: fromBase(topUpBase, 8) })

    if (action !== 'fee' && action !== 'execute') return err('unknown action', null, 400)
    if (!userToken || !walletId) return err('missing params', null, 400)
    if (action === 'fee') {
      const r = await fetch(`${W3S_API}/transactions/contractExecution/estimateFee`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-User-Token': userToken },
        body: JSON.stringify({ walletId, contractAddress: net.contracts.multicall3From, callData: batch }),
      })
      let fd; try { fd = await r.json() } catch { fd = {} }
      const m = fd?.data?.medium
      if (!r.ok || !m?.networkFee) return err(fd?.message || `Circle estimateFee ${r.status}`, fd, r.status === 401 ? 401 : 502)
      return ok({ feeMax: m.networkFee, cirbtcNeeded, liquidationPrice })
    }

    // execute: simulate the exact batch - it must do what was asked and leave no Morpho permission open - else no PIN.
    if (!UUID.test(String(refId || ''))) return err('refId (uuid) required', null, 400)
    const sim = await simulateBorrowBatch(net, wallet, mId, batch)
    if (sim.error && !('ok' in sim)) return err('Could not check this right now - nothing was sent. Please try again in a moment.', sim, 503)
    const why = !sim.ok ? `reverts: ${sim.error || ''}`
      : sim.authorizedAfter ? 'leaves Morpho permission open'
      : kind === 'borrow' && sim.usdcDelta < amountBase * 999n / 1000n ? 'does not deliver the USDC'
      : kind === 'borrow' && (sim.after?.collateral ?? 0n) < needBase ? 'collateral below the 50% rule'
      : kind === 'repay' && -sim.usdcDelta > amountBase + amountBase / 100n + 1000n ? 'repay takes more than asked'
      : kind === 'addCollateral' && -sim.btcDelta > amountBase ? 'takes more cirBTC than asked'
      : kind === 'withdrawCollateral' && sim.btcDelta <= 0n ? 'returns no cirBTC'
      : null
    if (why) return err('This would not do what was shown - nothing was sent.', { why, sim }, 502)
    const txRes = await fetch(`${W3S_API}/user/transactions/contractExecution`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-User-Token': userToken },
      body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), walletId, contractAddress: net.contracts.multicall3From, callData: batch, feeLevel: 'MEDIUM', refId }),
    })
    const txData = await txRes.json()
    const challengeId = txData?.data?.challengeId
    if (!challengeId) return err(`${txData?.message || 'no challengeId'} (HTTP ${txRes.status})`, txData)
    return ok({ challengeId, loanId: intent.data.loanId })
  } catch (e) {
    return err('unhandled', { message: e.message, stack: e.stack?.slice(0, 300) })
  }
}
