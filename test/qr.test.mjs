// Locks the QR format: EIP-681 out (MetaMask-scannable), old `ezwallet:` QRs still readable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getNetwork } from '../src/network.js'
import { buildQRFor, parseQRFor } from '../src/qrFormat.js'

const net = getNetwork('mainnet')
const ME = '0x0Ea0C3D5a2c5a1E1f3d5Bd0b9C3C6F1a6E2b11C9'.toLowerCase()   // lower case = no checksum needed
const USDC = net.tokens.USDC.address
const EURC = net.tokens.EURC.address

test('plain address QR = ethereum:<addr>@<chainId>', () => {
  assert.equal(buildQRFor(net, ME), `ethereum:${ME}@5042`)
  assert.equal(buildQRFor(net, ME, { amount: 0 }), `ethereum:${ME}@5042`)
})

test('amount QR = ERC-20 transfer of the right token in exact base units', () => {
  assert.equal(buildQRFor(net, ME, { amount: 25, currency: 'USD' }),
    `ethereum:${USDC}@5042/transfer?address=${ME}&uint256=25000000`)
  assert.equal(buildQRFor(net, ME, { amount: '0.1', currency: 'EUR' }),
    `ethereum:${EURC}@5042/transfer?address=${ME}&uint256=100000`)
})

test('what we draw, we read back', () => {
  assert.deepEqual(parseQRFor(net, buildQRFor(net, ME)), { address: ME, amount: null, currency: 'USD' })
  assert.deepEqual(parseQRFor(net, buildQRFor(net, ME, { amount: 12.5, currency: 'EUR' })), { address: ME, amount: '12.5', currency: 'EURC' })
  assert.deepEqual(parseQRFor(net, buildQRFor(net, ME, { amount: 0.004 })), { address: ME, amount: '0.004', currency: 'USD' })
})

test('other wallets\' EIP-681 forms', () => {
  assert.deepEqual(parseQRFor(net, `ethereum:pay-${ME}@5042?value=1e18`), { address: ME, amount: null, currency: 'USD' })
  assert.deepEqual(parseQRFor(net, `ethereum:${ME}`), { address: ME, amount: null, currency: 'USD' })
  assert.deepEqual(parseQRFor(net, `ethereum:${ME}@1`), { wrongChain: 1 })
  assert.equal(parseQRFor(net, `ethereum:${'0x' + '1'.repeat(40)}@5042/transfer?address=${ME}&uint256=1`), null)   // unknown token
  assert.equal(parseQRFor(net, `ethereum:${USDC}@5042/approve?address=${ME}&uint256=1`), null)
})

test('old ezwallet: QRs and bare addresses still work', () => {
  assert.deepEqual(parseQRFor(net, `ezwallet:${ME}@5042?amount=25&cur=EUR`), { address: ME, amount: '25', currency: 'EURC' })
  assert.deepEqual(parseQRFor(net, `ezwallet:${ME}`), { address: ME, amount: null, currency: 'USD' })
  assert.deepEqual(parseQRFor(net, `ezwallet:${ME}@5042002`), { wrongChain: 5042002 })
  assert.deepEqual(parseQRFor(net, ME), { address: ME, amount: null, currency: 'USD' })
  assert.equal(parseQRFor(net, 'hello'), null)
})

test('a QR made in USDC / EURC / cirBTC carries its amount and reads back as that token (bug 2026-10-06)', () => {
  const CIRBTC = net.tokens.cirBTC.address
  assert.equal(buildQRFor(net, ME, { amount: 5, currency: 'USDC' }), `ethereum:${USDC}@5042/transfer?address=${ME}&uint256=5000000`)
  assert.equal(buildQRFor(net, ME, { amount: 5, currency: 'EURC' }), `ethereum:${EURC}@5042/transfer?address=${ME}&uint256=5000000`)
  assert.equal(buildQRFor(net, ME, { amount: '0.0015', currency: 'cirBTC' }), `ethereum:${CIRBTC}@5042/transfer?address=${ME}&uint256=150000`)
  assert.deepEqual(parseQRFor(net, buildQRFor(net, ME, { amount: 5, currency: 'EURC' })), { address: ME, amount: '5', currency: 'EURC' })
  assert.deepEqual(parseQRFor(net, buildQRFor(net, ME, { amount: '0.0015', currency: 'cirBTC' })), { address: ME, amount: '0.0015', currency: 'cirBTC' })
  assert.deepEqual(parseQRFor(net, buildQRFor(net, ME, { amount: 5, currency: 'USDC' })), { address: ME, amount: '5', currency: 'USD' })
})
