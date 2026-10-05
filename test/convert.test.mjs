// Locks the auto-convert maths (docs/SWAP-PLAN.md section 6): the swaps must deliver at least what is missing, with
// the 1% buffer, sources in order EURC → cirBTC, and never more than a source's balance. Quotes are faked with the
// shape of a real mainnet Kit /quote (2026-10-05: { quote: { estimatedAmount, minAmount } }).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getNetwork } from '../src/network.js'
import { planConvert, usdcBaseCeil, baseToDecimal, convertSources, payCall, CONVERT_BUFFER_BPS } from '../functions/api/_convertCore.js'
import { SLIPPAGE_BPS } from '../functions/api/_swapCore.js'

const net = getNetwork('mainnet')
const W = '0xdfe251e8178f428a15c0d21688b9adb8dbd3b0ab'

// Fake Kit /quote: USD price per WHOLE token, minus 50 bps slippage for minAmount.
function withQuotes(prices, fn) {
  const real = globalThis.fetch
  globalThis.fetch = async (url) => {
    const u = new URL(url)
    const sym = Object.keys(net.tokens).find(s => net.tokens[s].address === u.searchParams.get('tokenInAddress'))
    const amt = BigInt(u.searchParams.get('amount'))
    const est = amt * BigInt(Math.round(prices[sym] * 1e6)) / 10n ** BigInt(net.tokens[sym].decimals)
    const min = est * (10000n - BigInt(SLIPPAGE_BPS)) / 10000n
    return { ok: true, json: async () => ({ quote: { estimatedAmount: String(est), minAmount: String(min) } }) }
  }
  return fn().finally(() => { globalThis.fetch = real })
}

test('buffer is above the slippage (0.5% = slippage was refused by the Kit, measured)', () => {
  assert.ok(CONVERT_BUFFER_BPS > BigInt(SLIPPAGE_BPS))
})

test('sources: EURC then cirBTC, never USDC', () => {
  assert.deepEqual(convertSources(net), ['EURC', 'cirBTC'])
})

test('one source covers the gap: swap gap × 1.01 at the quoted rate, stopLimit = the gap', () => withQuotes({ EURC: 1.123167 }, async () => {
  const missing = 997395n
  const { legs } = await planConvert({ net, apiKey: 'k', wallet: W, balances: { USDC: 4047605n, EURC: 2231785n, cirBTC: 0n }, missing })
  assert.equal(legs.length, 1)
  assert.equal(legs[0].token, 'EURC')
  assert.equal(legs[0].minOut, missing)
  // expected USDC out of the chosen amount ≈ missing × 1.01
  const out = Number(legs[0].amountIn) * 1.123167
  assert.ok(out >= Number(missing) * 1.0099 && out <= Number(missing) * 1.0102, `out ${out}`)
}))

test('EURC runs out: all of it, then cirBTC for the rest', () => withQuotes({ EURC: 1.12, cirBTC: 120000 }, async () => {
  const { legs } = await planConvert({ net, apiKey: 'k', wallet: W, balances: { USDC: 0n, EURC: 1000000n, cirBTC: 100000n }, missing: 3000000n })
  assert.deepEqual(legs.map(l => l.token), ['EURC', 'cirBTC'])
  assert.equal(legs[0].amountIn, 1000000n)                       // the whole EURC
  assert.equal(legs[0].minOut + legs[1].minOut, 3000000n)        // together exactly the gap as the minimum
  assert.ok(legs[1].amountIn <= 100000n)
}))

test('not enough in total → error, no legs', () => withQuotes({ EURC: 1.12 }, async () => {
  const r = await planConvert({ net, apiKey: 'k', wallet: W, balances: { USDC: 0n, EURC: 1000000n, cirBTC: 0n }, missing: 5000000n })
  assert.equal(r.error, 'not enough')
}))

test('a source with no route is skipped, not guessed', async () => {
  const real = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ message: 'No route found' }) })
  try {
    const r = await planConvert({ net, apiKey: 'k', wallet: W, balances: { USDC: 0n, EURC: 9000000n, cirBTC: 0n }, missing: 1000000n })
    assert.equal(r.error, 'not enough')
  } finally { globalThis.fetch = real }
})

test('fee string → base units rounded UP; base → decimal string', () => {
  assert.equal(usdcBaseCeil('0.0399'), 39900n)
  assert.equal(usdcBaseCeil('0.03990001'), 39901n)
  assert.equal(usdcBaseCeil('1'), 1000000n)
  assert.throws(() => usdcBaseCeil('-1'))
  assert.equal(baseToDecimal(865427n, 6), '0.865427')
  assert.equal(baseToDecimal(5000000n, 6), '5')
  assert.equal(baseToDecimal(1234n, 8), '0.00001234')
})

test('payCall: plain transfer to USDC, with a note through the Memo contract', () => {
  const to = '0xd1ee963321670c15cdfb13a86409138cbdb958ed'
  assert.equal(payCall(net, to, 5n).target, net.tokens.USDC.address)
  assert.equal(payCall(net, to, 5n, '0x6869', '0x' + '00'.repeat(32)).target, net.contracts.memo)
})
