// THE SWAP VERIFY GATE - a read-only dry run of a swap. Costs nothing, needs no PIN, signs nothing.
// It calls the real Kit /swap, checks the intent (validateIntent) and runs the batch in eth_simulateV1 (net.simRpc) to
// see whether tokenOut ACTUALLY REACHES THE WALLET (HANDOFF: never trust "tx status=1" - the balance must RISE).
//
// Run from the repo root:
//   node tools/verify-swap.mjs <wallet_address> [tokenIn] [tokenOut] [amount]
//   node tools/verify-swap.mjs 0xYourWallet USDC EURC 0.5
// The wallet must hold the tokenIn amount. API_KEY (the Circle LIVE key) is read from .env.txt.
import { readFileSync } from 'fs'
import { simulateSwap } from '../functions/api/_swapCore.js'
import { getNetwork } from '../src/network.js'

const net = getNetwork('mainnet')
const API_KEY = readFileSync('.env.txt', 'utf8').match(/^API_KEY=(.+)/m)?.[1]?.trim()
if (!API_KEY) { console.error('❌ API_KEY not found in .env.txt'); process.exit(1) }

const [walletAddress, tokenIn = 'USDC', tokenOut = 'EURC', amountIn = '0.5'] = process.argv.slice(2)
if (!walletAddress || !walletAddress.startsWith('0x')) {
  console.error('❌ Missing wallet address. Usage: node tools/verify-swap.mjs 0xYourWallet USDC EURC 0.5')
  process.exit(1)
}

console.log(`\nSimulating a swap of ${amountIn} ${tokenIn} → ${tokenOut} for wallet ${walletAddress} ...`)
const out = await simulateSwap({ net, apiKey: API_KEY, tokenIn, tokenOut, walletAddress, amountIn })

if (out.error) { console.error('\n❌ ERROR:', out.error, '\n', JSON.stringify(out.detail, null, 2)?.slice(0, 800)); process.exit(1) }

console.log('\n── Simulation result ────────────────────')
console.log(`  Swap on-chain:    ${out.swapStatus === '0x1' ? '✓ succeeded (no revert)' : '❌ REVERT ' + (out.swapError?.message || '')}`)
console.log(`  ${out.tokenOut} before:      ${out.before}`)
console.log(`  ${out.tokenOut} after:       ${out.after}`)
console.log(`  Delta (received): ${out.delta}   (Kit estimate: ${out.expected ?? 'n/a'})`)
console.log(`  Gas used:         ${out.gasUsed ? BigInt(out.gasUsed).toString() : 'n/a'}`)
console.log('─────────────────────────────────────────')
console.log(out.ok ? `\n✅ PASS - ${out.tokenOut} reached the wallet (+${out.delta}).` : `\n❌ FAIL - ${out.tokenOut} did NOT increase.`)
if (!out.ok) process.exit(2)
