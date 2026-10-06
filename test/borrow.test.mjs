// Locks the Borrow rules (owner 2026-10-06, plan §10/§14): what an intent may do, and the batch shape read from
// @circle-fin/provider-borrow-service (grant/revoke Morpho authorization around borrow/withdraw/close; none for repay/add)
// plus our 50% top-up (direct Morpho supplyCollateral on behalf of the wallet, in the same batch).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeFunctionData, parseAbi } from 'viem'
import { getNetwork } from '../src/network.js'
import { validateBorrowIntent, buildBorrowBatch, MORPHO, MORPHO_ABI, BORROW_MAX_LTV, BORROW_MAX_USD, webhookTypedData } from '../functions/api/_borrowCore.js'

const net = getNetwork('mainnet')
const W = '0xa00de397f0a86e31349cd7fb1a714f8dd84b4b7f'
const USDC = net.tokens.USDC.address, BTC = net.tokens.cirBTC.address, ADAPTER = net.contracts.swapAdapter
const M3 = parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable'])
const intent = (instr, tokens = [{ token: USDC, beneficiary: W }, { token: BTC, beneficiary: W }]) => ({
  loanId: '11111111-1111-4111-8111-111111111111', signature: '0x' + '22'.repeat(65),
  executionParams: { execId: '1', deadline: String(Math.floor(Date.now() / 1000) + 600), metadata: '0x', tokens, instructions: instr },
})
const supply = { target: MORPHO, data: '0x238d6579' + '00'.repeat(32), value: '0', tokenIn: BTC, amountToApprove: '16796', tokenOut: '0x0000000000000000000000000000000000000000', minTokenOut: '0' }
const borrowI = { target: MORPHO, data: '0x50d8cd4b' + '00'.repeat(32), value: '0', tokenIn: '0x0000000000000000000000000000000000000000', amountToApprove: '0', tokenOut: USDC, minTokenOut: '10000000' }
const calls = (data) => decodeFunctionData({ abi: M3, data }).args[0]

test('rules: 50% LTV, $200 per loan', () => { assert.equal(BORROW_MAX_LTV, 0.5); assert.equal(BORROW_MAX_USD, 200) })

test('a borrow intent that pulls only cirBTC and pays the wallet passes', () => {
  assert.equal(validateBorrowIntent(net, intent([supply, borrowI]), { kind: 'borrow', wallet: W, amountBase: 10000000n }), null)
})

test('rejects: pays someone else, wrong Morpho, pulls USDC on a borrow, expired', () => {
  assert.match(validateBorrowIntent(net, intent([supply, borrowI], [{ token: USDC, beneficiary: '0x' + '9'.repeat(40) }]), { kind: 'borrow', wallet: W, amountBase: 1n }), /someone other/)
  assert.match(validateBorrowIntent(net, intent([{ ...supply, target: '0x' + '9'.repeat(40) }, borrowI]), { kind: 'borrow', wallet: W, amountBase: 1n }), /not Morpho/)
  assert.match(validateBorrowIntent(net, intent([{ ...supply, tokenIn: USDC }, borrowI]), { kind: 'borrow', wallet: W, amountBase: 1n }), /must not pull USDC/)
  const old = intent([supply, borrowI]); old.executionParams.deadline = '1'
  assert.match(validateBorrowIntent(net, old, { kind: 'borrow', wallet: W, amountBase: 1n }), /deadline/)
})

test('repay may not pull more than asked (+1% interest margin)', () => {
  const rep = (amt) => intent([{ target: MORPHO, data: '0x20b76e81' + '00'.repeat(32), value: '0', tokenIn: USDC, amountToApprove: String(amt), tokenOut: '0x0000000000000000000000000000000000000000', minTokenOut: '0' }])
  assert.equal(validateBorrowIntent(net, rep(10050000), { kind: 'repay', wallet: W, amountBase: 10000000n }), null)
  assert.match(validateBorrowIntent(net, rep(20000000), { kind: 'repay', wallet: W, amountBase: 10000000n }), /more than asked/)
})

test('borrow batch: approve cirBTC → grant → execute → revoke → 50% top-up (approve + supplyCollateral for the wallet)', () => {
  const mp = { loanToken: USDC, collateralToken: BTC, oracle: '0x2AA87fF48933Ce6aBA240BEE916Fc2e6Ec1e51Ab', irm: '0xF02615d094Fc02fC031C35fe705e175aA4653f20', lltv: 860000000000000000n }
  const c = calls(buildBorrowBatch(net, 'borrow', intent([supply, borrowI]), W, { marketParams: mp, topUpBase: 6576n }))
  assert.deepEqual(c.map(x => x.target.toLowerCase()), [BTC, MORPHO, ADAPTER, MORPHO, BTC, MORPHO].map(a => a.toLowerCase()))
  assert.ok(c.every(x => x.allowFailure === false))
  const grant = decodeFunctionData({ abi: MORPHO_ABI, data: c[1].callData }), revoke = decodeFunctionData({ abi: MORPHO_ABI, data: c[3].callData })
  assert.deepEqual([grant.functionName, grant.args[1]], ['setAuthorization', true])
  assert.deepEqual([revoke.functionName, revoke.args[1]], ['setAuthorization', false])
  const top = decodeFunctionData({ abi: MORPHO_ABI, data: c[5].callData })
  assert.equal(top.functionName, 'supplyCollateral'); assert.equal(top.args[1], 6576n); assert.equal(top.args[2].toLowerCase(), W)
})

test('repay / addCollateral batches carry no Morpho authorization', () => {
  const rep = intent([{ target: MORPHO, data: '0x20b76e81' + '00'.repeat(32), value: '0', tokenIn: USDC, amountToApprove: '5000000', tokenOut: '0x0000000000000000000000000000000000000000', minTokenOut: '0' }])
  const c = calls(buildBorrowBatch(net, 'repay', rep, W))
  assert.deepEqual(c.map(x => x.target.toLowerCase()), [USDC, ADAPTER].map(a => a.toLowerCase()))
})

test('webhook registration typed data = the SDK shape, chain id 5042', () => {
  const t = webhookTypedData(net, { loanId: 'x', owner: W, webhookUrl: 'https://test.ezwallet.cash/api/borrow-alert', deadline: 1 })
  assert.deepEqual(t.domain, { name: 'BorrowKit Webhook Registration', version: '1', chainId: 5042 })
  assert.equal(t.primaryType, 'WebhookRegistration')
  assert.deepEqual(t.types.WebhookRegistration.map(f => f.name), ['loanId', 'owner', 'webhookUrl', 'deadline'])
})
