// AUTO-CONVERT ON SEND (docs/SWAP-PLAN.md section 6, owner decisions 2026-10-05). Used by functions/api/send.js.
// A USD/USDC send for more than the USDC the wallet holds swaps the shortfall from the other verified tokens
// (EURC first, then cirBTC) and pays - all in ONE Multicall3From batch = ONE PIN:
//   [approve(src→adapter), adapter.execute(src→USDC, stopLimit) , …per source…, USDC.transfer(to, amount) | Memo.memo(…)]
// Atomic: a swap that fills short makes the payment revert and nothing moves (measured 2026-10-05, section 6).
//
// ⚠️ The network fee is paid in USDC from the SAME balance and is held up front (gasLimit × maxFee), so the USDC the
// swaps must deliver is `amount + feeMax − USDC held`, and the wallet must already hold feeMax USDC.
// "_" prefix → not routed by Cloudflare Pages, only imported.
import { encodeFunctionData } from 'viem'
import { CIRCLE_API, SLIPPAGE_BPS, fetchSwapIntent, validateIntent, buildSwapBatch, encodeAggregate3 } from './_swapCore.js'

// 1% (owner 2026-10-05). It must be above SLIPPAGE_BPS: at 0.5% (= the slippage) the Kit answered "No route found that
// satisfies the requested stop limit" (measured). Whatever it over-converts stays in the wallet as USDC.
export const CONVERT_BUFFER_BPS = 100n
// The send reserve in USDC base units - the same 0.01 as GAS_RESERVE_USDC in src/data.js.
export const SEND_RESERVE_BASE = 10000n
// Source order (owner 2026-10-03): other stablecoins, then cirBTC, then ETH "if there is one". Only tokens this
// network lists are used; USDC is the target, never a source.
const SOURCE_ORDER = ['EURC', 'cirBTC', 'ETH']
export const convertSources = (net) => SOURCE_ORDER.filter(s => s !== 'USDC' && net.tokens[s])

const ceilDiv = (a, b) => (a + b - 1n) / b

const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
]
// Arc Memo contract: memo(address target, bytes data, bytes32 memoId, bytes memo) (docs.arc.io transaction-memos).
const MEMO_ABI = [{ type: 'function', name: 'memo', stateMutability: 'nonpayable', outputs: [], inputs: [
  { name: 'target', type: 'address' }, { name: 'data', type: 'bytes' }, { name: 'memoId', type: 'bytes32' }, { name: 'memo', type: 'bytes' },
] }]
const balOf = (addr) => encodeFunctionData({ abi: ERC20_ABI, functionName: 'balanceOf', args: [addr] })

async function rpc(url, method, params) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const j = await r.json()
  if (j.error) throw new Error(`${method}: ${j.error.message}`)
  return j.result
}

// USDC + every source token, in base units, read on chain through net.simRpc (dRPC: reachable from Cloudflare, the
// public Arc RPC rate-limits Functions). Throws when any read fails - never a made-up 0.
export async function readBalances(net, wallet) {
  const syms = ['USDC', ...convertSources(net)]
  const vals = await Promise.all(syms.map(s => rpc(net.simRpc, 'eth_call', [{ to: net.tokens[s].address, data: balOf(wallet) }, 'latest'])))
  return Object.fromEntries(syms.map((s, i) => [s, BigInt(vals[i])]))
}

// Kit quote sym → USDC for amountBase → { est, min } (base units of USDC), or null when there is no route.
async function quoteToUsdc(net, apiKey, sym, amountBase, wallet) {
  const params = new URLSearchParams({
    tokenInAddress: net.tokens[sym].address, tokenInChain: net.kitChain,
    tokenOutAddress: net.tokens.USDC.address, tokenOutChain: net.kitChain,
    fromAddress: wallet, amount: amountBase.toString(), slippageBps: String(SLIPPAGE_BPS),
  })
  const r = await fetch(`${CIRCLE_API}/v1/stablecoinKits/quote?${params}`, { headers: { Authorization: `Bearer ${apiKey}` } })
  let d; try { d = await r.json() } catch { return null }
  const q = d?.quote || d?.data?.quote   // measured 2026-10-05: top-level { quote: { estimatedAmount, minAmount } }
  if (!r.ok || !q?.estimatedAmount || !q?.minAmount) return null
  return { est: BigInt(q.estimatedAmount), min: BigInt(q.minAmount) }
}

// Which source tokens to swap, and how much, so the swaps deliver at least `missing` USDC (base units).
// → { legs: [{ token, amountIn, minOut }] } (bigints; minOut becomes that swap's stopLimit) or { error: 'not enough' }.
// A source whose whole balance covers what is still missing is swapped for missing × (1 + buffer) at the quoted rate;
// otherwise it is swapped completely (stopLimit = its quoted minimum) and the next source covers the rest.
export async function planConvert({ net, apiKey, wallet, balances, missing }) {
  let left = missing
  const legs = []
  for (const token of convertSources(net)) {
    if (left <= 0n) break
    const bal = balances[token] || 0n
    if (bal <= 0n) continue
    const q = await quoteToUsdc(net, apiKey, token, bal, wallet)
    if (!q || q.min <= 0n || q.est <= 0n) continue
    if (q.min >= left) {
      let amountIn = ceilDiv(bal * left * (10000n + CONVERT_BUFFER_BPS), q.est * 10000n)
      if (amountIn > bal) amountIn = bal
      legs.push({ token, amountIn, minOut: left })
      left = 0n
    } else {
      legs.push({ token, amountIn: bal, minOut: q.min })
      left -= q.min
    }
  }
  return left > 0n ? { error: 'not enough' } : { legs }
}

// The payment itself as a Multicall3From subcall: USDC.transfer, or through the Memo contract when there is a note
// (measured 2026-10-05: Memo works inside Multicall3From). memoHex = the note as 0x-hex, memoId = a bytes32.
export function payCall(net, to, amountBase, memoHex = null, memoId = null) {
  const usdc = net.tokens.USDC.address
  const transferData = encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [to, amountBase] })
  if (!memoHex) return { target: usdc, allowFailure: false, callData: transferData }
  return { target: net.contracts.memo, allowFailure: false,
    callData: encodeFunctionData({ abi: MEMO_ABI, functionName: 'memo', args: [usdc, transferData, memoId, memoHex] }) }
}

// Fetch + validate (MAINNET-AUDIT C5) one Kit intent per leg, then batch [swaps…, pay].
// → { batchData } or { error: 'moved' | 'kit' | 'invalid', detail }.
export async function buildConvertBatch({ net, apiKey, wallet, legs, pay }) {
  const calls = []
  const toAddr = net.tokens.USDC.address
  for (const leg of legs) {
    const fromAddr = net.tokens[leg.token].address
    const it = await fetchSwapIntent(net, apiKey, fromAddr, toAddr, wallet, leg.amountIn, leg.minOut)
    if (!it.ok) return { error: /stop limit/i.test(it.data?.message || '') ? 'moved' : 'kit', detail: it.data }
    const bad = validateIntent(net, it.data, { fromAddr, toAddr, walletAddress: wallet, amountBase: leg.amountIn, minOutBase: leg.minOut })
    if (bad) return { error: 'invalid', detail: { bad, token: leg.token } }
    const b = buildSwapBatch(net, it.data, fromAddr, leg.amountIn)
    if (b.error) return { error: 'invalid', detail: b.error }
    calls.push(...b.calls)
  }
  calls.push(pay)
  return { batchData: encodeAggregate3(calls) }
}

// Run the batch in eth_simulateV1 (no PIN, no cost). ok = the batch succeeded, the recipient's USDC rose by EXACTLY
// amount, and the wallet keeps at least feeMax USDC (the simulation charges no gas; on chain the fee is held up front).
// { error } when the simulation itself could not run - the caller must then refuse.
export async function simulateConvertSend(net, wallet, to, batchData, amountBase, feeMaxBase) {
  const usdc = net.tokens.USDC.address
  let res
  try {
    res = await rpc(net.simRpc, 'eth_simulateV1', [{
      blockStateCalls: [{ calls: [
        { to: usdc, data: balOf(to) },
        { from: wallet, to: net.contracts.multicall3From, data: batchData, value: '0x0' },
        { to: usdc, data: balOf(to) },
        { to: usdc, data: balOf(wallet) },
      ] }],
      validation: false, traceTransfers: true, returnFullTransactions: false,
    }, 'latest'])
  } catch (e) { return { error: `simulation failed: ${e.message}` } }
  const c = res?.[0]?.calls
  if (!c || c.length < 4) return { error: 'simulation: missing call results' }
  const v = (x) => (x?.returnData && x.returnData !== '0x') ? BigInt(x.returnData) : 0n
  const delta = v(c[2]) - v(c[0]), walletAfter = v(c[3])
  return { ok: c[1].status === '0x1' && delta === amountBase && walletAfter >= feeMaxBase,
    status: c[1].status, error: c[1].error || null, delta, walletAfter }
}

// Circle's networkFee ("0.0399…" USDC) → USDC base units, rounded UP.
export function usdcBaseCeil(feeStr) {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(String(feeStr || '').trim())
  if (!m) throw new Error(`bad fee "${feeStr}"`)
  const frac = (m[2] || '').padEnd(7, '0')
  const base = BigInt(m[1]) * 1000000n + BigInt(frac.slice(0, 6))
  return /[1-9]/.test(frac.slice(6)) ? base + 1n : base
}

// Base units → a plain decimal string ("0.865427", "0.00001234"), no float rounding.
export function baseToDecimal(base, decimals) {
  const s = base.toString().padStart(decimals + 1, '0')
  const int = s.slice(0, s.length - decimals), frac = s.slice(s.length - decimals).replace(/0+$/, '')
  return frac ? `${int}.${frac}` : int
}
