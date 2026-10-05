// THE EARN CORE (Service hub → Lending, owner 2026-10-05) - shared by functions/api/earn.js and tools/verify-earn.mjs.
// "_" prefix → not routed by Cloudflare Pages.
//
// HOW IT WORKS (Phase L0, measured 2026-10-05 - plan on the owner's Desktop, §12):
//   Circle Earn Kit REST (`/v1/earnKit/*`, chain `ARC`, auth = the same LIVE `API_KEY` as swap) returns a SIGNED intent
//   {execId, executionParams, signature} in the SAME shape as the swap intent, run by the SAME adapter contract
//   (net.contracts.swapAdapter, read from @circle-fin/provider-earn-service). So the batch is the swap batch:
//   Multicall3From.aggregate3([approve(token → adapter), adapter.execute(params, tokenInputs, signature)]) = ONE PIN.
//   Deposit: token = the vault's asset (USDC/EURC), out = vault shares. Withdraw: token = the vault SHARES, out = asset.
//   A 1 USDC deposit into Steakhouse Prime USDC simulated → shares 0 → 0.99994 (= the quote), gas 418,782.
// ⚠️ Same rule as swap: never unpack the instructions and run them by hand - the adapter's settlement credits the wallet.
import { encodeFunctionData } from 'viem'
import { CIRCLE_API, ADAPTER_ABI, ERC20_ABI, BALANCE_OF_ABI, encodeAggregate3 } from './_swapCore.js'

// Which vaults the app offers (owner 2026-10-05, plan §6): a RULE, not a fixed list - Arc lending is new and moves.
// 1. Morpho vaults run by one of these curators (Circle's `manager.name`, e.g. "Galaxy Curation", "Steakhouse Financial").
// 2. Deposit only while the vault can pay out at least the amount being deposited ("Withdrawable now" ≥ amount).
// 3. At most EARN_MAX_USD per deposit.
export const EARN_CURATORS = ['Galaxy', 'Steakhouse', 'Keyrock', 'Bitwise']
export const EARN_MAX_USD = 200

const dec = (amt) => amt ? (Number(amt.raw) / 10 ** amt.decimals) : 0
const eq = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()

// The asset symbol of a vault, only when it is one of OUR verified tokens at the right address.
const assetOf = (net, v) => ['USDC', 'EURC'].find(s => net.tokens[s] && eq(net.tokens[s].address, v.assetAddress)) || null

// A Circle vault object → what the screen needs, or null when the vault is not offered.
export function offeredVault(net, v) {
  const asset = assetOf(net, v)
  const curator = v?.manager?.name || ''
  if (!asset || String(v.protocol).toUpperCase() !== 'MORPHO') return null
  if (!EARN_CURATORS.some(c => curator.toLowerCase().startsWith(c.toLowerCase()))) return null
  return {
    address: String(v.vaultAddress || v.address).toLowerCase(), name: v.name, asset, curator,
    apy: typeof v.currentApy === 'number' ? v.currentApy : null,
    deposits: dec(v.totalDeposits), withdrawable: dec(v.liquidity),
    status: v.status, warnings: (v.warnings || []).map(w => w.type),
  }
}

async function circle(apiKey, method, path, body) {
  const res = await fetch(`${CIRCLE_API}/v1/earnKit/${path}`, {
    method, headers: { 'Authorization': `Bearer ${apiKey}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data; try { data = await res.json() } catch { data = null }
  return { ok: res.ok, status: res.status, data }
}

// The offered vaults, best APY first.
export async function listVaults(net, apiKey) {
  const r = await circle(apiKey, 'GET', `vaults/explore?chain=${net.circleBlockchain}`)
  if (!r.ok) return { error: r.data?.message || `Earn Kit ${r.status}`, detail: r.data }
  const all = r.data?.data?.vaults || []
  return { vaults: all.map(v => offeredVault(net, v)).filter(Boolean).sort((a, b) => (b.apy || 0) - (a.apy || 0)) }
}

// The wallet's share balance in each vault, read on chain (net.simRpc reaches from Cloudflare) → only the vaults it holds.
export async function heldVaults(net, walletAddress, vaults) {
  const data = encodeFunctionData({ abi: BALANCE_OF_ABI, functionName: 'balanceOf', args: [walletAddress] })
  const out = await Promise.all(vaults.map(async v => {
    const r = await fetch(net.simRpc, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: v.address, data }, 'latest'] }) })
    const j = await r.json()
    if (j.error || !j.result) throw new Error(`share balance read failed: ${j.error?.message || 'no result'}`)
    return BigInt(j.result === '0x' ? 0 : j.result) > 0n ? v : null
  }))
  return out.filter(Boolean)
}

// Circle's position for one vault → { vault, balance, shares, apy, earned|null }. `earned` only when Circle reports a
// real number (pnl.status 'available') - the screen hides it otherwise (no guessed numbers).
export async function position(net, apiKey, walletAddress, vault) {
  const r = await circle(apiKey, 'GET', `position/${walletAddress}?chain=${net.circleBlockchain}&vaultAddress=${vault.address}`)
  if (!r.ok) return { error: r.data?.message || `Earn Kit ${r.status}`, detail: r.data }
  const p = r.data?.data
  return {
    vault: vault.address, name: vault.name, asset: vault.asset,
    balance: dec(p?.currentBalance), apy: typeof p?.currentApy === 'number' ? p.currentApy : vault.apy,
    earned: p?.pnl?.status === 'available' ? dec(p.pnl.totalYieldEarned) : null,
  }
}

// Quote → deposit: { expectedShares, gas[] } · withdraw: { maxWithdrawable, sharesToRedeem, warnings[] }.
export async function quote(net, apiKey, kind, { vault, amount, walletAddress }) {
  const path = kind === 'deposit' ? 'deposit/quote' : 'withdrawal/quote'
  return circle(apiKey, 'POST', path, { vaultAddress: vault, amount: String(amount), address: walletAddress, chain: net.circleBlockchain })
}

// The signed intent → { ok, status, data: {execId, executionParams, signature} }.
export async function fetchEarnIntent(net, apiKey, kind, { vault, amount, walletAddress }) {
  const r = await circle(apiKey, 'POST', kind === 'deposit' ? 'deposit' : 'withdraw',
    { vaultAddress: vault, amount: String(amount), address: walletAddress, chain: net.circleBlockchain })
  return { ok: r.ok, status: r.status, data: r.data?.data || r.data }
}

// MAINNET-AUDIT C5 for Earn: sign only an intent that does exactly what the user asked. → null, or the reason.
//   deposit: pulls ≤ amountBase of the asset, every instruction targets the vault, the output is vault shares.
//   withdraw: pulls only the vault's shares, the output is the asset.
//   Always: everything goes to this wallet, a minimum output is set, the deadline is in the future.
export function validateEarnIntent(net, data, { kind, vault, asset, walletAddress, amountBase, now = Date.now() }) {
  const ep = data?.executionParams
  if (!ep || !data?.signature || !Array.isArray(ep.instructions) || !ep.instructions.length) return 'no executionParams/signature'
  if (!(Number(ep.deadline) * 1000 > now)) return 'deadline passed'
  if (!(ep.tokens || []).every(t => eq(t.beneficiary, walletAddress))) return 'pays someone other than this wallet'
  if (!ep.instructions.every(i => eq(i.target, vault))) return 'calls something other than the vault'
  const assetAddr = net.tokens[asset].address
  const [pullTok, outTok] = kind === 'deposit' ? [assetAddr, vault] : [vault, assetAddr]
  const pulls = ep.instructions.filter(i => BigInt(i.amountToApprove || 0) > 0n)
  if (!pulls.length || !pulls.every(i => eq(i.tokenIn, pullTok))) return 'spends the wrong token'
  const pulled = pulls.reduce((a, i) => a + BigInt(i.amountToApprove), 0n)
  if (kind === 'deposit' && pulled > amountBase) return 'spends more than the request'
  const outs = ep.instructions.filter(i => eq(i.tokenOut, outTok))
  const minOut = outs.reduce((a, i) => a + BigInt(i.minTokenOut || 0), 0n)
  if (minOut <= 0n) return 'no minimum output'
  // Withdraw shape not measured yet (L0: no wallet with shares) → allow at most the swap's 50 bps under the request.
  if (kind === 'withdraw' && minOut * 10000n < amountBase * 9950n) return 'returns less than the request'
  return null
}

// [approve(pullToken → adapter, total), adapter.execute(...)] as Multicall3From calldata. Token inputs = one per positive
// instruction, like the SDK's buildEarnTokenInputs. → { batchData, outToken, minOut }.
export function buildEarnBatch(net, data) {
  const ADAPTER = net.contracts.swapAdapter
  const ep = data.executionParams
  const pulls = ep.instructions.filter(i => BigInt(i.amountToApprove || 0) > 0n)
  const token = pulls[0].tokenIn
  const total = pulls.reduce((a, i) => a + BigInt(i.amountToApprove), 0n)
  const executeParams = {
    instructions: ep.instructions.map(i => ({
      target: i.target, data: i.data, value: BigInt(i.value || 0),
      tokenIn: i.tokenIn, amountToApprove: BigInt(i.amountToApprove || 0),
      tokenOut: i.tokenOut, minTokenOut: BigInt(i.minTokenOut || 0),
    })),
    tokens: ep.tokens.map(t => ({ token: t.token, beneficiary: t.beneficiary })),
    execId: BigInt(ep.execId), deadline: BigInt(ep.deadline), metadata: ep.metadata || '0x',
  }
  const tokenInputs = pulls.map(i => ({ permitType: 0, token: i.tokenIn, amount: BigInt(i.amountToApprove), permitCalldata: '0x' }))
  const calls = [
    { target: token,   allowFailure: false, callData: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [ADAPTER, total] }) },
    { target: ADAPTER, allowFailure: false, callData: encodeFunctionData({ abi: ADAPTER_ABI, functionName: 'execute', args: [executeParams, tokenInputs, data.signature] }) },
  ]
  const outToken = ep.instructions.find(i => BigInt(i.minTokenOut || 0) > 0n)?.tokenOut
  const minOut = ep.instructions.reduce((a, i) => a + BigInt(i.minTokenOut || 0), 0n)
  return { batchData: encodeAggregate3(calls), outToken, minOut }
}
