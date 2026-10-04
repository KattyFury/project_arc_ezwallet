// The swap core SHARED by functions/api/swap.js (Cloudflare) + dev-server.js (local Node).
// The "_" filename prefix → Cloudflare Pages does NOT route it as an endpoint, but it can still be imported.
// One source of truth for the encode/verify part (the part where money gets lost) - no hand-syncing two copies.
//
// THE CORRECT WAY to call swap (S15, dissected from the source of @circle-fin/adapter-viem-v2 +
// provider-stablecoin-service-swap - NOT guessed):
//   /v1/stablecoinKits/swap returns a SIGNED INTENT (transaction.executionParams + .signature).
//   Submit it to the ADAPTER contract: execute(ExecutionParams params, TokenInput[] tokenInputs, bytes sig).
//   The adapter pulls the tokens in, runs the instructions, COLLECTS the output and CREDITS beneficiary=the wallet (settlement).
//   A PIN wallet → the 'approve' strategy: tokenInputs=[{permitType:0,token:tokenIn,amount,permitCalldata:'0x'}]
//   + approve(tokenIn→adapter, amount) FIRST. Batching [approve, execute] through Multicall3From = 1 PIN.
// ⚠️ Unpacking the instructions and running them by hand (the old S11-14 approach) SKIPS settlement → the USDC is stranded in the adapter, MONEY LOST.
import { encodeFunctionData } from 'viem'
import { toBaseUnits } from '../../src/money.js'

export const CIRCLE_API = 'https://api.circle.com'
// KEY: the Circle API key (API_KEY, the same LIVE key as the wallets), NOT the legacy Kit key - measured 2026-10-04:
// /v1/stablecoinKits/quote and /swap accept it, and docs.arc.io's App Kit examples pass CIRCLE_API_KEY. The old Kit
// key was committed to this public repo on 2026-06-25 (commits 6442d42, 33ea69e), so it is no longer used anywhere.

// Every chain-specific value (RPC, adapter, Multicall3From, token addresses/decimals, the Kit chain name) comes
// from the `net` object of src/network.js, passed in by the caller - nothing is hard-coded here any more
// (MAINNET-AUDIT.md C2: the testnet adapter address has NO code on mainnet, and a call to it "succeeds").

// NO APP FEE (owner 2026-10-03; the 0.1% customFee of 07-23 is gone). Only the swap provider's 2 bps remain
// (docs.arc.io /app-kit/concepts/swap-fees).
// Slippage 50 bps (MAINNET-AUDIT H2 - was the Kit default 300). On execute the server ALSO passes the exact minimum the
// screen showed as `stopLimit`: measured 2026-10-03, the REST /swap honours it (instruction minTokenOut >= stopLimit) and
// an unreachable one answers "No route found that satisfies the requested stop limit" - so the user never gets less
// than what was on screen; if the price moved, nothing is signed.
export const SLIPPAGE_BPS = 50

// ⚠️ The Kit expects amount = an INTEGER IN BASE UNITS (a decimal → 400; a small number → "No route"). The client sends
// decimals, the server converts to base units before calling the Kit, and converts estimatedAmount back on the way out.
export const tokenOf = (net, sym) => net.tokens[sym] || null
// Throws on a bad amount (too many decimals, zero, negative, exponent...) instead of rounding - MAINNET-AUDIT H1.
export const toBase = (net, decStr, sym) => toBaseUnits(decStr, net.tokens[sym].decimals)
export const fromBase = (net, baseStr, sym) => (Number(baseStr) / 10 ** net.tokens[sym].decimals).toString()

// IAdapter.execute - the ABI copied verbatim from @circle-fin/adapter-viem-v2 (adapterContractAbi).
const ADAPTER_ABI = [{
  type: 'function', name: 'execute', stateMutability: 'payable', outputs: [],
  inputs: [
    { name: 'params', type: 'tuple', components: [
      { name: 'instructions', type: 'tuple[]', components: [
        { name: 'target', type: 'address' }, { name: 'data', type: 'bytes' }, { name: 'value', type: 'uint256' },
        { name: 'tokenIn', type: 'address' }, { name: 'amountToApprove', type: 'uint256' },
        { name: 'tokenOut', type: 'address' }, { name: 'minTokenOut', type: 'uint256' },
      ] },
      { name: 'tokens', type: 'tuple[]', components: [
        { name: 'token', type: 'address' }, { name: 'beneficiary', type: 'address' },
      ] },
      { name: 'execId', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'metadata', type: 'bytes' },
    ] },
    { name: 'tokenInputs', type: 'tuple[]', components: [
      { name: 'permitType', type: 'uint8' }, { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' }, { name: 'permitCalldata', type: 'bytes' },
    ] },
    { name: 'signature', type: 'bytes' },
  ],
}]
const ERC20_ABI = [{ type: 'function', name: 'approve', stateMutability: 'nonpayable',
  inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] }]
const MULTICALL3_ABI = [{ type: 'function', name: 'aggregate3', stateMutability: 'payable',
  inputs: [{ name: 'calls', type: 'tuple[]', components: [
    { name: 'target', type: 'address' }, { name: 'allowFailure', type: 'bool' }, { name: 'callData', type: 'bytes' },
  ] }], outputs: [] }]
const BALANCE_OF_ABI = [{ type: 'function', name: 'balanceOf', stateMutability: 'view',
  inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }]

// Call the Stablecoin Kit /swap → { ok, status, data }. data.transaction holds executionParams + signature.
// minOutBase (optional, base units of tokenOut) → `stopLimit`.
export async function fetchSwapIntent(net, apiKey, fromAddr, toAddr, walletAddress, amountBase, minOutBase = null) {
  const res = await fetch(`${CIRCLE_API}/v1/stablecoinKits/swap`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tokenInAddress: fromAddr, tokenInChain: net.kitChain,
      tokenOutAddress: toAddr,  tokenOutChain: net.kitChain,
      fromAddress: walletAddress, toAddress: walletAddress,
      amount: amountBase.toString(), slippageBps: SLIPPAGE_BPS,
      ...(minOutBase ? { stopLimit: minOutBase.toString() } : {}),
    }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, data }
}

// MAINNET-AUDIT C5: never sign Circle's intent blindly. Checks it against what the USER asked for → null when fine, else
// the reason. Field names from a real mainnet /swap response (2026-10-03): top-level tokenIn/OutAddress, -Chain, amount,
// from/toAddress; transaction.executionParams { tokens[{token, beneficiary}], instructions[{tokenIn, amountToApprove,
// tokenOut, minTokenOut, value}], deadline (unix s) }. The adapter address is NOT taken from the intent (buildSwapBatch
// uses net.contracts.swapAdapter).
export function validateIntent(net, data, { fromAddr, toAddr, walletAddress, amountBase, minOutBase = 0n, now = Date.now() }) {
  const eq = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()
  const tx = data?.transaction
  const ep = tx?.executionParams
  if (!ep || !tx?.signature) return 'no executionParams/signature'
  if (!eq(data.tokenInAddress, fromAddr) || !eq(data.tokenOutAddress, toAddr)) return 'tokens differ from the request'
  if (data.tokenInChain !== net.kitChain || data.tokenOutChain !== net.kitChain) return 'another chain'
  if (String(data.amount) !== amountBase.toString()) return 'amount differs from the request'
  if (!eq(data.fromAddress, walletAddress) || !eq(data.toAddress, walletAddress)) return 'from/to is not this wallet'
  if (!ep.tokens?.length || ep.tokens.some(t => !eq(t.beneficiary, walletAddress))) return 'pays someone other than this wallet'
  if (!(Number(ep.deadline) * 1000 > now + 30000)) return 'expired'
  const ins = ep.instructions || []
  if (!ins.length) return 'no instructions'
  let approved = 0n
  for (const i of ins) {
    if (!eq(i.tokenIn, fromAddr)) return 'spends another token'
    if (BigInt(i.value || 0) !== 0n) return 'sends native value'
    approved += BigInt(i.amountToApprove || 0)
  }
  if (approved > amountBase) return 'spends more than the request'
  const outMin = ins.filter(i => eq(i.tokenOut, toAddr)).reduce((a, i) => a + BigInt(i.minTokenOut || 0), 0n)
  if (outMin <= 0n) return 'no minimum output'
  if (outMin < minOutBase) return 'minimum output below the amount shown'
  return null
}

// Build the callData for Multicall3From.aggregate3([approve(tokenIn→ADAPTER, amount), ADAPTER.execute(...)]).
// Returns { batchData, totalValue, estOut } or { error }.
export function buildSwapBatch(net, swapData, fromAddr, amountBase) {
  const ADAPTER = net.contracts.swapAdapter
  const tx = swapData?.transaction || swapData?.data?.transaction
  const ep = tx?.executionParams
  const signature = tx?.signature
  if (!ep || !signature) return { error: 'response missing executionParams/signature', swapData }

  const executeParams = {
    instructions: ep.instructions.map(i => ({
      target: i.target, data: i.data, value: BigInt(i.value || 0),
      tokenIn: i.tokenIn, amountToApprove: BigInt(i.amountToApprove || 0),
      tokenOut: i.tokenOut, minTokenOut: BigInt(i.minTokenOut || 0),
    })),
    tokens: ep.tokens.map(t => ({ token: t.token, beneficiary: t.beneficiary })),
    execId: BigInt(ep.execId), deadline: BigInt(ep.deadline), metadata: ep.metadata || '0x',
  }
  // Same-chain ERC20 (USDC/EURC/cirBTC): value is always 0 → adapter.execute needs no msg.value.
  const totalValue = executeParams.instructions.reduce((a, i) => a + i.value, 0n)
  const tokenInputs = [{ permitType: 0, token: fromAddr, amount: amountBase, permitCalldata: '0x' }]

  const approveData = encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [ADAPTER, amountBase] })
  const executeData = encodeFunctionData({ abi: ADAPTER_ABI, functionName: 'execute', args: [executeParams, tokenInputs, signature] })
  const batchData = encodeFunctionData({ abi: MULTICALL3_ABI, functionName: 'aggregate3', args: [[
    { target: fromAddr, allowFailure: false, callData: approveData },
    { target: ADAPTER,  allowFailure: false, callData: executeData },
  ]] })
  const estOut = swapData?.estimatedAmount || swapData?.data?.estimatedAmount
  return { batchData, totalValue, estOut }
}

// Run the batch in eth_simulateV1 (no PIN, no cost) and measure the wallet's tokenOut balance before/after.
// The public Arc RPC does NOT support eth_simulateV1 (measured 2026-10-03; QuickNode no, Blockdaemon filtered) → dRPC
// (`net.simRpc`). Returns { ok, delta (bigint), before, after, swapStatus, swapError, gasUsed } or { error } when the
// simulation itself could not run - the caller must then REFUSE, never sign unchecked.
export async function simulateBatch(net, walletAddress, toAddr, batchData) {
  if (!net.simRpc) return { error: 'no simulation RPC configured' }
  const balOf = (addr) => encodeFunctionData({ abi: BALANCE_OF_ABI, functionName: 'balanceOf', args: [addr] })
  const simBody = {
    jsonrpc: '2.0', id: 1, method: 'eth_simulateV1',
    params: [{
      blockStateCalls: [{ calls: [
        { to: toAddr, data: balOf(walletAddress) },                                                // [0] before
        { from: walletAddress, to: net.contracts.multicall3From, data: batchData, value: '0x0' },   // [1] the batch
        { to: toAddr, data: balOf(walletAddress) },                                                // [2] after
      ] }],
      validation: false, traceTransfers: true, returnFullTransactions: false,
    }, 'latest'],
  }
  let sim
  try {
    const r = await fetch(net.simRpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(simBody) })
    sim = await r.json()
  } catch (e) { return { error: `simulation RPC unreachable: ${e.message}` } }
  if (sim.error) return { error: `eth_simulateV1 error: ${sim.error?.message}`, detail: sim.error }
  const calls = sim?.result?.[0]?.calls
  if (!calls || calls.length < 3) return { error: 'sim: missing call results', detail: sim }
  const hexToBig = (r) => (r && r !== '0x') ? BigInt(r) : 0n   // returnData is empty when a call reverts
  const before = hexToBig(calls[0].returnData), after = hexToBig(calls[2].returnData)
  return { ok: calls[1].status === '0x1' && after > before, delta: after - before, before, after,
    swapStatus: calls[1].status, swapError: calls[1].error || null, gasUsed: calls[1].gasUsed || null }
}

// Quote → validate → build → simulate, without signing (the 'simulate' action and tools/verify-swap.mjs).
export async function simulateSwap({ net, apiKey, tokenIn, tokenOut, walletAddress, amountIn }) {
  const fromAddr = tokenOf(net, tokenIn)?.address
  const toAddr   = tokenOf(net, tokenOut)?.address
  if (!fromAddr || !toAddr || !walletAddress) return { error: 'missing params' }
  const amountBase = toBase(net, amountIn, tokenIn)
  const intent = await fetchSwapIntent(net, apiKey, fromAddr, toAddr, walletAddress, amountBase)
  if (!intent.ok) return { error: `Stablecoin Kit ${intent.status}: ${intent.data?.message || 'swap failed'}`, detail: intent.data }
  const bad = validateIntent(net, intent.data, { fromAddr, toAddr, walletAddress, amountBase })
  if (bad) return { error: `intent rejected: ${bad}` }
  const built = buildSwapBatch(net, intent.data, fromAddr, amountBase)
  if (built.error) return { error: built.error, detail: built.swapData }
  const sim = await simulateBatch(net, walletAddress, toAddr, built.batchData)
  if (sim.error) return sim
  return {
    ok: sim.ok, swapStatus: sim.swapStatus, swapError: sim.swapError, tokenOut, gasUsed: sim.gasUsed,
    before: fromBase(net, sim.before.toString(), tokenOut), after: fromBase(net, sim.after.toString(), tokenOut),
    delta: fromBase(net, sim.delta.toString(), tokenOut),
    expected: built.estOut ? fromBase(net, built.estOut, tokenOut) : null,
  }
}
