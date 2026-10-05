// Locks the Memes rules (Service hub → Memes, owner 2026-10-05) and the batch shape measured on Arc mainnet (M0):
// [approve(Permit2), Permit2.approve(router), UniversalRouter.execute(V4_SWAP)] through Multicall3From, with the NEW v4
// ExactInputSingleParams (uint256 minHopPriceX36) - the old 5-field struct reverts on Arc with no reason.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeFunctionData, parseAbi, decodeAbiParameters, parseAbiParameters } from 'viem'
import { getNetwork } from '../src/network.js'
import { MEME, MEME_MAX_BUY_USD, MEME_SLIPPAGE_BPS, swapBatch } from '../functions/api/_memeCore.js'

const net = getNetwork('mainnet')
const USDC = net.tokens.USDC.address
const TOKEN = '0xC281dFF1A3eD6943123f53aEcCDc571DAB1Ce099', HOOK = '0xD56cf54244a8f7718AC70fdFBF7ce534ff0F2044'
const pool = { key: { currency0: USDC, currency1: TOKEN, fee: 10000, tickSpacing: 200, hooks: HOOK }, tokenIs0: false }
const M3 = parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable'])
const UR = parseAbi(['function execute(bytes commands, bytes[] inputs, uint256 deadline) payable'])

test('caps: $20 per buy, 3% minimum-out margin (owner 2026-10-05)', () => {
  assert.equal(MEME_MAX_BUY_USD, 20)
  assert.equal(MEME_SLIPPAGE_BPS, 300)
})

test('Arc v4 addresses = the ones in Uniswap docs (Arc: 5042)', () => {
  assert.equal(MEME.poolManager, '0x8366a39CC670B4001A1121B8F6A443A643e40951')
  assert.equal(MEME.universalRouter, '0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1')
  assert.equal(MEME.permit2, '0x000000000022D473030F116dDEE9F6B43aC78BA3')
})

test('a buy = approve(Permit2) → Permit2.approve(router) → router V4_SWAP, all must succeed', () => {
  const data = swapBatch(net, pool, USDC, 1000000n, 990n, 1791200000)
  const { args: [calls] } = decodeFunctionData({ abi: M3, data })
  assert.equal(calls.length, 3)
  assert.ok(calls.every(c => c.allowFailure === false))
  assert.equal(calls[0].target.toLowerCase(), USDC.toLowerCase())
  assert.equal(calls[1].target, MEME.permit2)
  assert.equal(calls[2].target, MEME.universalRouter)
  const ex = decodeFunctionData({ abi: UR, data: calls[2].callData })
  assert.equal(ex.args[0], '0x10')                                   // V4_SWAP
  const [actions, params] = decodeAbiParameters(parseAbiParameters('bytes,bytes[]'), ex.args[1][0])
  assert.equal(actions, '0x060c0f')                                  // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL
  const [[key, zeroForOne, amountIn, minOut, minHopPrice]] = decodeAbiParameters(
    parseAbiParameters('((address,address,uint24,int24,address),bool,uint128,uint128,uint256,bytes)'), params[0])
  assert.equal(key[4], HOOK); assert.equal(key[2], 10000); assert.equal(key[3], 200)
  assert.equal(zeroForOne, true); assert.equal(amountIn, 1000000n); assert.equal(minOut, 990n); assert.equal(minHopPrice, 0n)
  const [, take] = [decodeAbiParameters(parseAbiParameters('address,uint256'), params[1]), decodeAbiParameters(parseAbiParameters('address,uint256'), params[2])]
  assert.equal(take[0], TOKEN); assert.equal(take[1], 990n)          // TAKE_ALL enforces the minimum too
})

test('a sell goes the other way (token → USDC)', () => {
  const data = swapBatch(net, pool, TOKEN, 5n * 10n ** 18n, 1n, 1791200000)
  const { args: [calls] } = decodeFunctionData({ abi: M3, data })
  assert.equal(calls[0].target, TOKEN)
  const ex = decodeFunctionData({ abi: UR, data: calls[2].callData })
  const [, params] = decodeAbiParameters(parseAbiParameters('bytes,bytes[]'), ex.args[1][0])
  const [[, zeroForOne]] = decodeAbiParameters(parseAbiParameters('((address,address,uint24,int24,address),bool,uint128,uint128,uint256,bytes)'), params[0])
  assert.equal(zeroForOne, false)
})
