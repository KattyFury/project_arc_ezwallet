// Locks the Earn rules (Service hub → Lending, owner 2026-10-05): which vaults are offered, and that a deposit/withdraw
// intent is only signed when it is exactly what the user asked for (MAINNET-AUDIT C5, as swap).
// The deposit fixture is a real Arc mainnet /v1/earnKit/deposit response (2026-10-05), signature trimmed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getNetwork } from '../src/network.js'
import { offeredVault, validateEarnIntent, buildEarnBatch, EARN_MAX_USD } from '../functions/api/_earnCore.js'
import { isLabsHost } from '../src/labs.js'

const net = getNetwork('mainnet')
const W = '0xa00de397f0a86e31349cd7fb1a714f8dd84b4b7f'
const USDC = net.tokens.USDC.address
const VAULT = '0xbeef0016cb2fd5c352ea7ca08a9f54739dfa7298'
const NOW = 1791180000 * 1000

const deposit = () => ({
  execId: '01a10aa9-3918-768a-99ea-0474d921d402', signature: '0x06e6',
  executionParams: {
    execId: '0x01a10aa93918768a99ea0474d921d402', deadline: '1791180824', metadata: '0x',
    tokens: [{ token: USDC, beneficiary: W }, { token: VAULT, beneficiary: W }],
    instructions: [{ target: VAULT, data: '0x6e553f65', value: '0', tokenIn: USDC, amountToApprove: '1000000', tokenOut: VAULT, minTokenOut: '994941823404030265' }],
  },
})
const ask = { kind: 'deposit', vault: VAULT, asset: 'USDC', walletAddress: W, amountBase: 1000000n, now: NOW }

const vault = (o = {}) => ({ vaultAddress: VAULT, name: 'Steakhouse Prime USDC', protocol: 'MORPHO', assetAddress: USDC,
  currentApy: 0.0113, totalDeposits: { raw: '2584428000000', decimals: 6 }, liquidity: { raw: '62397000000', decimals: 6 },
  status: 'low_liquidity', manager: { name: 'Steakhouse Financial' }, ...o })

test('cap is $200 per deposit (owner 2026-10-05)', () => assert.equal(EARN_MAX_USD, 200))

test('labs = test site + local only; ezwallet.cash stays off', () => {
  assert.equal(isLabsHost('test.ezwallet.cash'), true)
  assert.equal(isLabsHost('localhost'), true)
  assert.equal(isLabsHost('ezwallet.cash'), false)
  assert.equal(isLabsHost('www.ezwallet.cash'), false)
})

test('offers whitelisted curators on our tokens only', () => {
  const v = offeredVault(net, vault())
  assert.equal(v.asset, 'USDC'); assert.equal(v.withdrawable, 62397); assert.equal(v.address, VAULT)
  assert.equal(offeredVault(net, vault({ manager: { name: 'Gauntlet' } })), null)
  assert.equal(offeredVault(net, vault({ manager: undefined })), null)                       // the 1-dollar test vaults
  assert.equal(offeredVault(net, vault({ assetAddress: '0x' + '1'.repeat(40) })), null)
  assert.equal(offeredVault(net, vault({ protocol: 'AAVE' })), null)
})

test('the real deposit intent passes and builds one batch', () => {
  assert.equal(validateEarnIntent(net, deposit(), ask), null)
  const b = buildEarnBatch(net, deposit())
  assert.equal(b.outToken, VAULT); assert.equal(b.minOut, 994941823404030265n)
  assert.match(b.batchData, /^0x82ad56cb/)   // aggregate3
})

test('rejects an intent that pays someone else', () => {
  const d = deposit(); d.executionParams.tokens[1].beneficiary = '0x' + '9'.repeat(40)
  assert.match(validateEarnIntent(net, d, ask), /someone other/)
})

test('rejects an intent that calls another contract', () => {
  const d = deposit(); d.executionParams.instructions[0].target = '0x' + '9'.repeat(40)
  assert.match(validateEarnIntent(net, d, ask), /other than the vault/)
})

test('rejects spending more than asked, or the wrong token', () => {
  const d = deposit(); d.executionParams.instructions[0].amountToApprove = '1000001'
  assert.match(validateEarnIntent(net, d, ask), /more than the request/)
  const e = deposit(); e.executionParams.instructions[0].tokenIn = net.tokens.EURC.address
  assert.match(validateEarnIntent(net, e, ask), /wrong token/)
})

test('rejects no minimum output and an expired deadline', () => {
  const d = deposit(); d.executionParams.instructions[0].minTokenOut = '0'
  assert.match(validateEarnIntent(net, d, ask), /no minimum/)
  assert.match(validateEarnIntent(net, deposit(), { ...ask, now: 1791181000 * 1000 }), /deadline/)
})

test('withdraw: pulls the vault shares, returns the asset, at most 50 bps under the request', () => {
  const w = deposit(); const i = w.executionParams.instructions[0]
  i.tokenIn = VAULT; i.amountToApprove = '999941502549557603'; i.tokenOut = USDC; i.minTokenOut = '1000000'
  const wask = { ...ask, kind: 'withdraw' }
  assert.equal(validateEarnIntent(net, w, wask), null)
  i.minTokenOut = '994000'
  assert.match(validateEarnIntent(net, w, wask), /less than the request/)
})
