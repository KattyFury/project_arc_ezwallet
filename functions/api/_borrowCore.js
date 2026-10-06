// THE BORROW CORE (Service hub → Lending / Borrow, Borrow tab - owner 2026-10-06). Shared by functions/api/borrow.js.
// "_" prefix → not routed by Cloudflare Pages.
//
// HOW IT WORKS (read from @circle-fin/borrow-kit 1.0.0 + provider-borrow-service 1.0.0, measured on Arc mainnet 2026-10-06):
//   Circle Borrow Kit REST (`/v1/borrowKit/*`, chain `ARC`) on Morpho Blue `0x34CD…7fCD` (morpho.org API + eth_getCode).
//   It lends **USDC only** ("the only loan asset Borrow Service originates against") - our collateral = cirBTC.
//   Every write = a signed intent {loanId, execId, executionParams, signature} run by the same adapter as swap/earn.
//   Batch through Multicall3From (one PIN):
//     borrow / withdrawCollateral / close : [approve(pulled token → adapter)…] + Morpho.setAuthorization(adapter, true)
//                                           + adapter.execute(…) + Morpho.setAuthorization(adapter, false)
//     repay / addCollateral               : [approve(pulled token → adapter)] + adapter.execute(…)
//   Some Borrow Service calls refuse an API key (`credential: 'forbidden'` in the SDK) - `kit()` sends it only where allowed.
// THE 50% RULE (owner §10): the service sizes collateral for HF ≈ 1.236 (LTV ≈ 70%, measured: 10 USDC → 0.00016796 cirBTC,
//   liquidation ≈ $69.2k). We TOP UP the collateral in the SAME batch with a direct Morpho `supplyCollateral` (onBehalf = the
//   wallet) so the loan opens at LTV ≤ 50% (HF ≥ 0.86 / 0.5 = 1.72; `requiredCollateral/quote` at that HF).
import { encodeFunctionData, decodeFunctionResult, parseAbi } from 'viem'
import { CIRCLE_API, ADAPTER_ABI, ERC20_ABI, BALANCE_OF_ABI, encodeAggregate3 } from './_swapCore.js'

const KIT = `${CIRCLE_API}/v1/borrowKit`
export const BORROW_MAX_USD = 200          // owner §10: max 200 per loan
export const BORROW_MAX_LTV = 0.5          // owner §10: the app never lets a loan open above 50% LTV
export const MORPHO = '0x34CD04070dD72b14E241112F6d83812Df5Af7fCD'
export const MORPHO_ABI = parseAbi([
  'function setAuthorization(address authorized, bool newIsAuthorized)',
  'function isAuthorized(address authorizer, address authorized) view returns (bool)',
  'function supplyCollateral((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, bytes data)',
  'function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)',
  'function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)',
])
// Which writes wrap the execution in a Morpho grant/revoke pair (SDK: usesAuthorization).
const NEEDS_AUTH = { borrow: true, withdrawCollateral: true, close: true, repay: false, addCollateral: false }

const eq = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()
const dec = (a) => a ? Number(a.amount ?? (Number(a.raw) / 10 ** a.decimals)) : null

// Borrow Service REST. `apiKey` = null for the calls the SDK marks credential:'forbidden'.
export async function kit(method, path, body, apiKey = null) {
  const res = await fetch(`${KIT}${path}`, {
    method, headers: { ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data; try { data = await res.json() } catch { data = null }
  return { ok: res.ok, status: res.status, data: data?.data ?? data }
}

// The markets the app offers: cirBTC collateral, USDC loan, at our expected Morpho. Most free USDC first.
export async function listMarkets(net, apiKey) {
  const r = await kit('GET', `/markets?chain=${net.circleBlockchain}`, null, apiKey)
  if (!r.ok) return { error: r.data?.message || `Borrow Kit ${r.status}`, detail: r.data }
  const all = Array.isArray(r.data) ? r.data : (r.data?.markets || [])
  const markets = all
    .filter(m => eq(m.collateralAsset?.address, net.tokens.cirBTC.address) && eq(m.loanAsset?.address, net.tokens.USDC.address))
    .map(m => ({ marketId: m.marketId, name: m.marketName, lltv: m.lltv, borrowApy: m.borrowApy, free: dec(m.liquidity) ?? 0 }))
    .sort((a, b) => b.free - a.free)
  return { markets }
}

// The wallet's loans (active first) with what the screen needs.
export async function listLoans(net, wallet) {
  const r = await kit('GET', `/loans?walletAddress=${wallet}&chain=${net.circleBlockchain}`)
  if (!r.ok) return { error: r.data?.message || `Borrow Kit ${r.status}`, detail: r.data }
  return { loans: (r.data?.loans || []).map(publicLoan) }
}
export const publicLoan = (l) => ({
  loanId: l.loanId, marketId: l.marketId, status: l.status, ready: l.dataStatus === 'READY',
  collateral: dec(l.collateral), borrowed: dec(l.borrowed), interest: dec(l.accruedInterest), borrowApy: l.borrowApy,
  ltv: l.ltv, healthFactor: l.healthFactor, band: l.healthFactorBand, liquidationPrice: dec(l.liquidationPrice),
})

// The signed intent for a write. `amount` is a decimal string in the token the action moves (USDC for borrow/repay,
// cirBTC for add/withdraw collateral; ignored for close).
export async function fetchExecution(net, apiKey, kind, { wallet, marketId, loanId, amount }) {
  if (kind === 'borrow') {
    return kit('POST', '/loans/borrow', loanId ? { amount, loanId } : { amount, walletAddress: wallet, chain: net.circleBlockchain, marketId }, apiKey)
  }
  const path = { repay: 'repay', addCollateral: 'addCollateral', withdrawCollateral: 'withdrawCollateral', close: 'closeLoan' }[kind]
  const body = kind === 'repay' ? { repayAmount: amount } : kind === 'addCollateral' ? { collateralAmount: amount }
    : kind === 'withdrawCollateral' ? { collateralAmount: amount, slippageBps: 50 } : {}
  return kit('POST', `/loans/${encodeURIComponent(loanId)}/${path}`, body)
}

// C5 for Borrow: sign only what the user asked. → null or the reason.
//   - every sweep goes to this wallet; deadline in the future;
//   - only USDC (loan asset) or cirBTC (collateral) is ever pulled from the wallet, and never more than asked
//     (borrow: cirBTC only; repay: USDC ≤ amount (+ interest margin); addCollateral: cirBTC ≤ amount; withdraw/close: USDC
//     for the debt only);
//   - Morpho debits target OUR Morpho.
export function validateBorrowIntent(net, data, { kind, wallet, amountBase }) {
  const ep = data?.executionParams
  if (!ep || !data?.signature || !Array.isArray(ep.instructions) || !ep.instructions.length) return 'no executionParams/signature'
  if (!(Number(ep.deadline) * 1000 > Date.now())) return 'deadline passed'
  if (!(ep.tokens || []).every(t => eq(t.beneficiary, wallet))) return 'pays someone other than this wallet'
  const usdc = net.tokens.USDC.address, btc = net.tokens.cirBTC.address
  const MORPHO_SELECTORS = ['0x50d8cd4b', '0x238d6579', '0x20b76e81', '0x8720316d']   // borrow, supplyCollateral, repay, withdrawCollateral
  const morphoCalls = ep.instructions.filter(i => MORPHO_SELECTORS.includes(String(i.data).slice(0, 10).toLowerCase()))
  if (morphoCalls.some(i => !eq(i.target, MORPHO))) return 'debits a contract that is not Morpho'
  const pulls = ep.instructions.filter(i => BigInt(i.amountToApprove || 0) > 0n)
  const pulled = (tok) => pulls.filter(i => eq(i.tokenIn, tok)).reduce((a, i) => a + BigInt(i.amountToApprove), 0n)
  if (pulls.some(i => !eq(i.tokenIn, usdc) && !eq(i.tokenIn, btc))) return 'pulls a token that is not USDC or cirBTC'
  if (kind === 'borrow' && pulled(usdc) > 0n) return 'a borrow must not pull USDC'
  if (kind === 'addCollateral' && (pulled(usdc) > 0n || pulled(btc) > amountBase)) return 'pulls more than the collateral asked'
  if (kind === 'repay' && (pulled(btc) > 0n || pulled(usdc) > amountBase + amountBase / 100n + 1000n)) return 'repay pulls more than asked'
  if ((kind === 'withdrawCollateral' || kind === 'close') && pulled(btc) > 0n) return 'pulls collateral instead of returning it'
  return null
}

// The Multicall3From batch for an intent (+ optional extra collateral appended after a borrow - the 50% top-up).
export function buildBorrowBatch(net, kind, data, wallet, { marketParams = null, topUpBase = 0n } = {}) {
  const ADAPTER = net.contracts.swapAdapter
  const ep = data.executionParams
  const pulls = ep.instructions.filter(i => BigInt(i.amountToApprove || 0) > 0n)
  const totals = new Map()
  for (const i of pulls) totals.set(i.tokenIn.toLowerCase(), (totals.get(i.tokenIn.toLowerCase()) || 0n) + BigInt(i.amountToApprove))
  const executeParams = {
    instructions: ep.instructions.map(i => ({ target: i.target, data: i.data, value: BigInt(i.value || 0), tokenIn: i.tokenIn,
      amountToApprove: BigInt(i.amountToApprove || 0), tokenOut: i.tokenOut, minTokenOut: BigInt(i.minTokenOut || 0) })),
    tokens: ep.tokens.map(t => ({ token: t.token, beneficiary: t.beneficiary })),
    execId: BigInt(ep.execId), deadline: BigInt(ep.deadline), metadata: ep.metadata || '0x',
  }
  const tokenInputs = pulls.map(i => ({ permitType: 0, token: i.tokenIn, amount: BigInt(i.amountToApprove), permitCalldata: '0x' }))
  const call = (target, callData) => ({ target, allowFailure: false, callData })
  const calls = [...totals].map(([tok, amt]) => call(tok, encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [ADAPTER, amt] })))
  const exec = call(ADAPTER, encodeFunctionData({ abi: ADAPTER_ABI, functionName: 'execute', args: [executeParams, tokenInputs, data.signature] }))
  if (NEEDS_AUTH[kind]) {
    calls.push(call(MORPHO, encodeFunctionData({ abi: MORPHO_ABI, functionName: 'setAuthorization', args: [ADAPTER, true] })), exec,
      call(MORPHO, encodeFunctionData({ abi: MORPHO_ABI, functionName: 'setAuthorization', args: [ADAPTER, false] })))
  } else calls.push(exec)
  if (topUpBase > 0n && marketParams) {
    calls.push(call(net.tokens.cirBTC.address, encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [MORPHO, topUpBase] })),
      call(MORPHO, encodeFunctionData({ abi: MORPHO_ABI, functionName: 'supplyCollateral', args: [marketParams, topUpBase, wallet, '0x'] })))
  }
  return encodeAggregate3(calls)
}

async function ethCall(net, to, data) {
  const r = await fetch(net.simRpc, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }) })
  const j = await r.json()
  if (j.error) throw new Error(j.error.message)
  return j.result
}
export async function marketParamsOf(net, marketId) {
  const raw = await ethCall(net, MORPHO, encodeFunctionData({ abi: MORPHO_ABI, functionName: 'idToMarketParams', args: [marketId] }))
  const [loanToken, collateralToken, oracle, irm, lltv] = decodeFunctionResult({ abi: MORPHO_ABI, functionName: 'idToMarketParams', data: raw })
  return { loanToken, collateralToken, oracle, irm, lltv }
}
export async function hasStandingAuthorization(net, wallet) {
  const raw = await ethCall(net, MORPHO, encodeFunctionData({ abi: MORPHO_ABI, functionName: 'isAuthorized', args: [wallet, net.contracts.swapAdapter] }))
  return BigInt(raw) !== 0n
}

// eth_simulateV1 of the batch from the wallet: returns the wallet's USDC + cirBTC deltas, the Morpho position after,
// and whether the adapter's authorization is gone afterwards. Nothing is signed.
export async function simulateBorrowBatch(net, wallet, marketId, batchData) {
  const bal = (t) => ({ to: t, data: encodeFunctionData({ abi: BALANCE_OF_ABI, functionName: 'balanceOf', args: [wallet] }) })
  const pos = { to: MORPHO, data: encodeFunctionData({ abi: MORPHO_ABI, functionName: 'position', args: [marketId, wallet] }) }
  const auth = { to: MORPHO, data: encodeFunctionData({ abi: MORPHO_ABI, functionName: 'isAuthorized', args: [wallet, net.contracts.swapAdapter] }) }
  const U = net.tokens.USDC.address, B = net.tokens.cirBTC.address
  const calls = [bal(U), bal(B), pos, { from: wallet, to: net.contracts.multicall3From, data: batchData, value: '0x0' }, bal(U), bal(B), pos, auth]
  const r = await fetch(net.simRpc, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_simulateV1', params: [{ blockStateCalls: [{ calls }], validation: false }, 'latest'] }) })
  const j = await r.json()
  if (j.error) return { error: `eth_simulateV1: ${j.error.message}` }
  const c = j.result?.[0]?.calls
  if (!c || c.length < 8) return { error: 'simulation returned no calls' }
  const n = (x) => x?.returnData && x.returnData !== '0x' ? BigInt(x.returnData) : 0n
  const posOf = (x) => { try { const [, borrowShares, collateral] = decodeFunctionResult({ abi: MORPHO_ABI, functionName: 'position', data: x.returnData }); return { borrowShares, collateral } } catch { return null } }
  return {
    ok: c[3].status === '0x1', error: c[3].error?.message || null, gasUsed: c[3].gasUsed ? BigInt(c[3].gasUsed) : null,
    usdcDelta: n(c[4]) - n(c[0]), btcDelta: n(c[5]) - n(c[1]),
    before: posOf(c[2]), after: posOf(c[6]), authorizedAfter: n(c[7]) !== 0n,
  }
}

// The EIP-712 data the wallet signs to register a loan's health webhook (SDK buildWebhookRegistrationTypedData), in the
// JSON shape Circle's /user/sign/typedData expects (EIP712Domain listed in `types`).
export function webhookTypedData(net, { loanId, owner, webhookUrl, deadline }) {
  return {
    types: {
      EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }],
      WebhookRegistration: [{ name: 'loanId', type: 'string' }, { name: 'owner', type: 'address' }, { name: 'webhookUrl', type: 'string' }, { name: 'deadline', type: 'uint256' }],
    },
    primaryType: 'WebhookRegistration',
    domain: { name: 'BorrowKit Webhook Registration', version: '1', chainId: net.chainId },
    message: { loanId, owner, webhookUrl, deadline },
  }
}

// How much cirBTC (base units) the loan needs IN TOTAL so its LTV is ≤ BORROW_MAX_LTV for `totalDebt` USDC (decimal string):
// the Borrow Service's own sizing at HF = lltv / BORROW_MAX_LTV (0.86 / 0.5 = 1.72). → { needBase, liquidationPrice } or { error }.
export async function collateralFor50(net, marketId, totalDebt, lltv = 0.86) {
  const hf = (lltv / BORROW_MAX_LTV).toFixed(4)
  const r = await kit('POST', '/loans/requiredCollateral/quote', { chain: net.circleBlockchain, marketId, loanAssetAmount: String(totalDebt), targetHealthFactor: hf })
  if (!r.ok) return { error: r.data?.message || `Borrow Kit ${r.status}`, detail: r.data }
  const rc = r.data?.requiredCollateral
  if (!rc?.amount) return { error: 'no required collateral' }
  const [i, f = ''] = String(rc.amount).split('.')
  const needBase = BigInt(i) * 10n ** BigInt(rc.decimals) + BigInt((f + '0'.repeat(rc.decimals)).slice(0, rc.decimals) || '0')
  return { needBase, liquidationPrice: dec(r.data.liquidationPrice) }
}
