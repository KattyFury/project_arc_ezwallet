// AUTO-CONVERT VERIFY GATE - a read-only dry run of a USDC send that is short of USDC (docs/SWAP-PLAN.md section 6).
// Costs nothing, needs no PIN, signs nothing: reads the balances, plans the swaps, fetches + validates the real Kit
// intents, builds the ONE batch and runs it in eth_simulateV1 - same code as /api/send (functions/api/_convertCore.js).
// Circle's estimateFee needs a user token, so the fee is passed in (default 0.045 = the highest measured swap feeMax).
//
//   node tools/verify-convert.mjs <wallet> <recipient> <amountUSDC> [note] [feeMax]
//   node tools/verify-convert.mjs 0xYourWallet 0xSomeone 5 "lunch" 0.045
// API_KEY (the Circle LIVE key) is read from .env.txt.
import { readFileSync } from 'fs'
import { getNetwork } from '../src/network.js'
import { toBaseUnits } from '../src/money.js'
import {
  readBalances, planConvert, buildConvertBatch, payCall, simulateConvertSend, baseToDecimal, usdcBaseCeil, SEND_RESERVE_BASE,
} from '../functions/api/_convertCore.js'

const net = getNetwork('mainnet')
const API_KEY = readFileSync('.env.txt', 'utf8').match(/^API_KEY=(.+)/m)?.[1]?.trim()
if (!API_KEY) { console.error('❌ API_KEY not found in .env.txt'); process.exit(1) }
const [wallet, to, amountStr, note = '', feeStr = '0.045'] = process.argv.slice(2)
if (!wallet?.startsWith('0x') || !to?.startsWith('0x') || !amountStr) {
  console.error('Usage: node tools/verify-convert.mjs <wallet> <recipient> <amountUSDC> [note] [feeMax]'); process.exit(1)
}
const amount = toBaseUnits(amountStr, 6), feeMax = usdcBaseCeil(feeStr)
const usd = (b) => baseToDecimal(b, 6)

const bal = await readBalances(net, wallet)
console.log('\nBalances:', Object.entries(bal).map(([s, b]) => `${s} ${baseToDecimal(b, net.tokens[s].decimals)}`).join(' · '))
if (bal.USDC >= amount + SEND_RESERVE_BASE) { console.log('✅ Enough USDC - a plain send, nothing to convert.'); process.exit(0) }
if (bal.USDC < feeMax) { console.log(`❌ Holds ${usd(bal.USDC)} USDC < fee ${feeStr} - cannot auto-convert.`); process.exit(2) }

const missing = amount + 2n * feeMax - bal.USDC   // + one more fee kept as USDC, as /api/send
const plan = await planConvert({ net, apiKey: API_KEY, wallet, balances: bal, missing })
if (plan.error) { console.log(`❌ Plan: ${plan.error} (missing ${usd(missing)} USDC)`); process.exit(2) }
console.log(`Missing ${usd(missing)} USDC → legs:`)
for (const l of plan.legs) console.log(`  ${baseToDecimal(l.amountIn, net.tokens[l.token].decimals)} ${l.token} → ≥ ${usd(l.minOut)} USDC`)

const memoHex = note ? '0x' + Buffer.from(note, 'utf8').toString('hex') : null
const pay = payCall(net, to, amount, memoHex, memoHex ? '0x' + '00'.repeat(31) + '01' : null)
const built = await buildConvertBatch({ net, apiKey: API_KEY, wallet, legs: plan.legs, pay })
if (built.error) { console.log('❌ Build:', built.error, JSON.stringify(built.detail)?.slice(0, 400)); process.exit(2) }
const sim = await simulateConvertSend(net, wallet, to, built.batchData, amount, feeMax)
if (sim.error) { console.log('❌ Simulation could not run:', sim.error); process.exit(2) }
console.log(`\nSimulation: status ${sim.status}${sim.error ? ' ' + JSON.stringify(sim.error) : ''}`)
console.log(`  recipient +${usd(sim.delta)} USDC (expected ${amountStr}) · wallet USDC after ${usd(sim.walletAfter)} (must be ≥ fee ${feeStr})`)
console.log(sim.ok ? '\n✅ PASS' : '\n❌ FAIL')
process.exit(sim.ok ? 0 : 2)
