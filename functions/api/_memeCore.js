// THE MEMES CORE (Service hub → Memes, owner 2026-10-05) - shared by functions/api/meme.js and tools/verify-meme.mjs.
// "_" prefix → not routed by Cloudflare Pages.
//
// HOW IT WORKS (Phase M0, measured 2026-10-05 - plan on the owner's Desktop, §13):
//   Arc's meme launchpads trade on ONE shared Uniswap v4 (docs.uniswap.org/contracts/v4/deployments → "Arc: 5042").
//   M1 supports ARGUSPAD (the biggest): every launch is a v4 pool USDC/token with its own tax hook, fee 10000, tick
//   spacing 200, recorded by one of Argus's "Portals" (github.com/arguspad/argus-world onchain/addresses.md).
//   A trade = Multicall3From.aggregate3([ERC20.approve(Permit2), Permit2.approve(token, UniversalRouter),
//   UniversalRouter.execute(V4_SWAP: SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL)]) = ONE PIN.
//   Measured: buy 1 USDC → 333,830 tokens, sell all → 0.9606 USDC back (1% + 1% tax + 2 × 1% pool fee), 0 left.
// ⚠️ The Arc UniversalRouter takes the NEW v4 ExactInputSingleParams (with `uint256 minHopPriceX36`) - the old
//   5-field struct reverts with no reason (measured).
// Every number comes from the chain: the price from StateView.getSlot0, the amounts from eth_simulateV1 (net.simRpc).
import { encodeFunctionData, encodeAbiParameters, parseAbiParameters, decodeFunctionResult, parseAbi, keccak256 } from 'viem'
import { encodeAggregate3 } from './_swapCore.js'

export const MEME = {
  poolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
  universalRouter: '0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1',
  stateView: '0xF3334192D15450CdD385c8B70e03f9A6bD9E673b',
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  // Argus Portals with the hooked-v4 USDC family (#7 newest … #3). #1-#2 are legacy v3 - not supported.
  argusPortals: [
    '0xB021Be536808f551b31789422Fd28a6c9c6e97Da', '0xA5628A11c412596E1f63b75a2C0284F843C549d6',
    '0x07a688a001f416cC433c68Ff56Aa26bC5131Cc6E', '0xa36c443A797771Df82533B8B4A86F0AFfd970862',
    '0x7A17Ab0106C46C0be30623F3EB7F299CC0058338',
  ],
  fee: 10000, tickSpacing: 200,
}
export const MEME_MAX_BUY_USD = 20       // owner 2026-10-05: max 20 USDC per buy
export const MEME_SLIPPAGE_BPS = 300     // memes move fast; the minimum out = the simulated amount - 3%

const ERC20 = parseAbi(['function approve(address,uint256)', 'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)', 'function symbol() view returns (string)', 'function name() view returns (string)'])
const PERMIT2 = parseAbi(['function approve(address token,address spender,uint160 amount,uint48 expiration)'])
const UR = parseAbi(['function execute(bytes commands, bytes[] inputs, uint256 deadline) payable'])
const HOOK = parseAbi(['function poolId() view returns (bytes32)', 'function currentSnipeTaxBps() view returns (uint256)'])
const SV = parseAbi(['function getSlot0(bytes32) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)'])

// keccak256("launches(address)")[0..4] - the Portal's launch record getter.
const LAUNCHES_SELECTOR = keccak256(new TextEncoder().encode('launches(address)')).slice(0, 10)
const eq = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()
const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || ''))

async function rpc(net, method, params) {
  const r = await fetch(net.simRpc, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const j = await r.json()
  if (j.error) throw new Error(`${method}: ${j.error.message}`)
  return j.result
}
const call = (net, to, data) => rpc(net, 'eth_call', [{ to, data }, 'latest'])
async function read(net, to, abi, functionName, args = []) {
  const raw = await call(net, to, encodeFunctionData({ abi, functionName, args }))
  return decodeFunctionResult({ abi, functionName, data: raw })
}

// Which Argus launch is this token? Reads `launches(token)` on every Portal (raw words: the layout differs by Portal,
// but words 0-7 are the same everywhere: creator, tickStart, tokenIsToken0, locker, hook, splitter, buyTax, sellTax;
// word 10 = quoteAsset on #6/#7, USDC on the older ones). → { portal, hook, buyTaxBps, sellTaxBps } or null.
// Argus docs: "a timeout is an unresolved lookup, not an absence" → an RPC error THROWS, it never returns null.
export async function findArgusLaunch(net, token) {
  for (const portal of MEME.argusPortals) {
    const raw = await call(net, portal, LAUNCHES_SELECTOR + token.slice(2).toLowerCase().padStart(64, '0'))
    if (!raw || raw.length < 2 + 64 * 9) continue
    const w = (i) => '0x' + raw.slice(2 + 64 * i, 2 + 64 * (i + 1))
    const creator = '0x' + w(0).slice(26)
    if (BigInt(creator) === 0n) continue
    const quote = raw.length >= 2 + 64 * 11 ? '0x' + w(10).slice(26) : net.tokens.USDC.address
    if (!eq(quote, net.tokens.USDC.address)) return { unsupported: 'not a USDC pool' }
    return { portal, hook: '0x' + w(4).slice(26), buyTaxBps: Number(BigInt(w(6))), sellTaxBps: Number(BigInt(w(7))) }
  }
  return null
}

// The v4 pool key of an Argus launch, CHECKED against the hook's own poolId() (the hook is part of the key - a pool
// cannot be derived from the pair alone). → { key, poolId, tokenIs0 } or { error }.
export async function poolOf(net, token, hook) {
  const usdc = net.tokens.USDC.address
  const tokenIs0 = BigInt(token) < BigInt(usdc)
  const [c0, c1] = tokenIs0 ? [token, usdc] : [usdc, token]
  const key = { currency0: c0, currency1: c1, fee: MEME.fee, tickSpacing: MEME.tickSpacing, hooks: hook }
  const poolId = keccak256(encodeAbiParameters(parseAbiParameters('address,address,uint24,int24,address'), [c0, c1, key.fee, key.tickSpacing, hook]))
  const fromHook = await read(net, hook, HOOK, 'poolId')
  if (!eq(fromHook, poolId)) return { error: 'pool key does not match the launch hook' }
  return { key, poolId, tokenIs0 }
}

// USDC per 1 whole token, from StateView.getSlot0 (Argus docs/08: r = sqrtP²/2^192, raw currency1 per raw currency0).
export async function priceOf(net, pool, tokenDecimals) {
  const [sqrtP] = await read(net, MEME.stateView, SV, 'getSlot0', [pool.poolId])
  if (!sqrtP) return null
  const r = (Number(sqrtP) / 2 ** 96) ** 2                       // raw currency1 per raw currency0
  const rawUsdcPerRawToken = pool.tokenIs0 ? r : 1 / r
  return rawUsdcPerRawToken * 10 ** (tokenDecimals - net.tokens.USDC.decimals)
}

export async function tokenMeta(net, token) {
  const [name, symbol, decimals] = await Promise.all([
    read(net, token, ERC20, 'name').catch(() => ''), read(net, token, ERC20, 'symbol').catch(() => '?'), read(net, token, ERC20, 'decimals'),
  ])
  return { name, symbol, decimals: Number(decimals) }
}

export const balanceOf = async (net, token, who) => BigInt(await read(net, token, ERC20, 'balanceOf', [who]))
export const snipeTaxBps = async (net, hook) => Number(await read(net, hook, HOOK, 'currentSnipeTaxBps').catch(() => 0n))

// The Multicall3From batch for one swap: [approve(tokenIn → Permit2), Permit2.approve(tokenIn → router), router.execute].
export function swapBatch(net, pool, tokenIn, amountIn, minOut, deadlineSec) {
  const tokenOut = eq(tokenIn, pool.key.currency0) ? pool.key.currency1 : pool.key.currency0
  const zeroForOne = eq(tokenIn, pool.key.currency0)
  const k = pool.key
  const swap = encodeAbiParameters(parseAbiParameters('((address,address,uint24,int24,address),bool,uint128,uint128,uint256,bytes)'),
    [[[k.currency0, k.currency1, k.fee, k.tickSpacing, k.hooks], zeroForOne, amountIn, minOut, 0n, '0x']])
  const settle = encodeAbiParameters(parseAbiParameters('address,uint256'), [tokenIn, amountIn])
  const take = encodeAbiParameters(parseAbiParameters('address,uint256'), [tokenOut, minOut])
  const input = encodeAbiParameters(parseAbiParameters('bytes,bytes[]'), ['0x060c0f', [swap, settle, take]])   // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL
  const deadline = BigInt(deadlineSec)
  return encodeAggregate3([
    { target: tokenIn, allowFailure: false, callData: encodeFunctionData({ abi: ERC20, functionName: 'approve', args: [MEME.permit2, amountIn] }) },
    { target: MEME.permit2, allowFailure: false, callData: encodeFunctionData({ abi: PERMIT2, functionName: 'approve', args: [tokenIn, MEME.universalRouter, amountIn, Number(deadline)] }) },
    { target: MEME.universalRouter, allowFailure: false, callData: encodeFunctionData({ abi: UR, functionName: 'execute', args: ['0x10', [input], deadline] }) },
  ])
}

// eth_simulateV1 of a list of batches from `wallet`, with the wallet's USDC topped up by `usdcTopUp` (base units) via a
// native-balance override (Arc: the ERC-20 USDC IS the native balance) so a quote works before the wallet is funded.
// Returns the token + USDC balance after each batch: [{ ok, token, usdc, gas }], index 0 = before.
export async function simulate(net, wallet, token, batches, usdcTopUp = 0n) {
  const bal = (t) => ({ to: t, data: encodeFunctionData({ abi: ERC20, functionName: 'balanceOf', args: [wallet] }) })
  const calls = [bal(token), bal(net.tokens.USDC.address)]
  for (const data of batches) calls.push({ from: wallet, to: net.contracts.multicall3From, data }, bal(token), bal(net.tokens.USDC.address))
  const overrides = {}
  if (usdcTopUp > 0n) {
    const native = BigInt(await rpc(net, 'eth_getBalance', [wallet, 'latest']))
    overrides[wallet] = { balance: '0x' + (native + usdcTopUp * 10n ** 12n).toString(16) }
  }
  const res = await rpc(net, 'eth_simulateV1', [{ blockStateCalls: [{ calls, stateOverrides: overrides }], validation: false }, 'latest'])
  const c = res?.[0]?.calls
  if (!c) throw new Error('simulation returned no calls')
  const n = (x) => x?.returnData && x.returnData !== '0x' ? BigInt(x.returnData) : 0n
  const out = [{ ok: true, token: n(c[0]), usdc: n(c[1]) }]
  for (let i = 0; i < batches.length; i++) {
    const s = c[2 + i * 3]
    out.push({ ok: s.status === '0x1', error: s.error?.message || null, gas: s.gasUsed ? BigInt(s.gasUsed) : null, token: n(c[3 + i * 3]), usdc: n(c[4 + i * 3]) })
  }
  return out
}

// THE HONEYPOT GUARD (owner 2026-10-05): buy `usdcIn`, then sell EVERYTHING bought, in one simulated block from this
// wallet. Sellable = both batches succeed and USDC comes back. → { ok, tokensOut, usdcBack, lossPct } or { ok:false, why }.
export async function buySellCheck(net, wallet, token, pool, usdcIn) {
  const usdc = net.tokens.USDC.address
  const dl = Math.floor(Date.now() / 1000) + 600
  const first = await simulate(net, wallet, token, [swapBatch(net, pool, usdc, usdcIn, 1n, dl)], usdcIn)
  if (!first[1].ok) return { ok: false, why: 'buy fails', error: first[1].error }
  const tokensOut = first[1].token - first[0].token
  if (tokensOut <= 0n) return { ok: false, why: 'buy returns nothing' }
  const both = await simulate(net, wallet, token, [swapBatch(net, pool, usdc, usdcIn, 1n, dl), swapBatch(net, pool, token, tokensOut, 1n, dl)], usdcIn)
  if (!both[2].ok) return { ok: false, why: 'cannot be sold', error: both[2].error }
  const usdcBack = both[2].usdc - both[1].usdc
  if (usdcBack <= 0n) return { ok: false, why: 'selling returns nothing' }
  return { ok: true, tokensOut, usdcBack, lossPct: Number(usdcIn - usdcBack) / Number(usdcIn) * 100, buyGas: both[1].gas, sellGas: both[2].gas }
}

// Everything the token screen needs, from the chain. → { supported:false, reason } or the full picture.
export async function inspect(net, token, wallet) {
  if (!isAddr(token)) return { supported: false, reason: 'not an address' }
  if (Object.values(net.tokens).some(t => eq(t.address, token))) return { supported: false, reason: 'a verified token - use Exchange' }
  const launch = await findArgusLaunch(net, token)
  if (!launch) return { supported: false, reason: 'not an Argus token' }
  if (launch.unsupported) return { supported: false, reason: launch.unsupported }
  const pool = await poolOf(net, token, launch.hook)
  if (pool.error) return { supported: false, reason: pool.error }
  const meta = await tokenMeta(net, token)
  const [price, snipe, held] = await Promise.all([priceOf(net, pool, meta.decimals), snipeTaxBps(net, launch.hook), wallet ? balanceOf(net, token, wallet) : 0n])
  return { supported: true, launchpad: 'Argus', token, ...meta, priceUsd: price, buyTaxBps: launch.buyTaxBps, sellTaxBps: launch.sellTaxBps,
    snipeTaxBps: snipe, held: held.toString(), hook: launch.hook, pool }
}
