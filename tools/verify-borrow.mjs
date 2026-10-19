// THE BORROW VERIFY GATE - a read-only dry run of a Borrow (B0). Costs nothing, needs no PIN, signs nothing.
// Follows functions/api/borrow.js for kind 'borrow' up to the PIN: markets → loans → the signed intent → validateBorrowIntent
// → the 50% top-up → buildBorrowBatch → simulateBorrowBatch, and applies the same refusal checks as `execute`.
//
// Run from the repo root:
//   node tools/verify-borrow.mjs                        → the markets the app offers
//   node tools/verify-borrow.mjs <wallet> [amount=2]    → simulate borrowing `amount` USDC from that wallet
// API_KEY (Circle LIVE key) is read from .env.txt.
import { readFileSync } from 'fs'
import {
  BORROW_MAX_USD, listMarkets, listLoans, fetchExecution, validateBorrowIntent, buildBorrowBatch,
  collateralFor50, marketParamsOf, hasStandingAuthorization, simulateBorrowBatch,
} from '../functions/api/_borrowCore.js'
import { toBaseUnits } from '../src/money.js'
import { getNetwork } from '../src/network.js'

const net = getNetwork('mainnet')
const API_KEY = readFileSync('.env.txt', 'utf8').match(/^API_KEY=(.+)/m)?.[1]?.trim()
if (!API_KEY) { console.error('❌ API_KEY not found in .env.txt'); process.exit(1) }
const fromBase = (b, d) => Number(b) / 10 ** d
const fail = (...m) => { console.error('❌', ...m); process.exit(1) }

const m = await listMarkets(net, API_KEY)
if (m.error) fail(m.error, JSON.stringify(m.detail))
console.log('\nOffered markets (cirBTC → USDC):')
for (const x of m.markets) console.log(`  ${x.marketId}  ${x.name}  lltv ${x.lltv}  borrow APY ${(x.borrowApy * 100).toFixed(2)}%  free ${x.free.toFixed(2)} USDC`)

const [wallet, amount = '2'] = process.argv.slice(2)
if (!wallet) process.exit(0)
const market = m.markets[0]
if (!market) fail('no market offered')
if (Number(amount) > market.free) fail('not enough free USDC in the market')
if (Number(amount) > BORROW_MAX_USD) fail(`max $${BORROW_MAX_USD}`)

const l = await listLoans(net, wallet)
if (l.error) fail(l.error, JSON.stringify(l.detail))
console.log(`\nLoans of ${wallet}: ${l.loans.length ? '' : 'none'}`)
for (const x of l.loans) console.log(`  ${x.loanId} ${x.status} borrowed ${x.borrowed} collateral ${x.collateral} HF ${x.healthFactor}`)
const target = l.loans.find(x => x.marketId === market.marketId && x.status === 'active') || null
if (await hasStandingAuthorization(net, wallet)) fail('wallet has a standing Morpho authorization')

console.log(`\nSimulating a borrow of ${amount} USDC in ${market.name} ...`)
const intent = await fetchExecution(net, API_KEY, 'borrow', { wallet, marketId: market.marketId, loanId: target?.loanId, amount: String(amount) })
if (!intent.ok) fail('Borrow Kit', intent.status, JSON.stringify(intent.data))
const amountBase = toBaseUnits(String(amount), net.tokens.USDC.decimals)
const bad = validateBorrowIntent(net, intent.data, { kind: 'borrow', wallet, amountBase })
if (bad) fail('intent rejected:', bad)

const totalDebt = (target?.borrowed || 0) + Number(amount)
const need = await collateralFor50(net, market.marketId, totalDebt.toFixed(6), market.lltv)
if (need.error) fail(need.error, JSON.stringify(need.detail))
const pulled = intent.data.executionParams.instructions
  .filter(i => i.tokenIn.toLowerCase() === net.tokens.cirBTC.address.toLowerCase())
  .reduce((a, i) => a + BigInt(i.amountToApprove || 0), 0n)
const posted = target?.collateral ? toBaseUnits(target.collateral.toFixed(8), 8) : 0n
const topUpBase = need.needBase > posted + pulled ? need.needBase - posted - pulled : 0n
const marketParams = topUpBase > 0n ? await marketParamsOf(net, market.marketId) : null
const batch = buildBorrowBatch(net, 'borrow', intent.data, wallet, { marketParams, topUpBase })
console.log(`  cirBTC: service pulls ${fromBase(pulled, 8)} + top-up ${fromBase(topUpBase, 8)} = need ${fromBase(need.needBase - posted, 8)}  ·  liquidation ≈ $${need.liquidationPrice}`)

const sim = await simulateBorrowBatch(net, wallet, market.marketId, batch)
if (sim.error && !('ok' in sim)) fail(sim.error)
console.log(`  status ${sim.ok ? 'ok' : 'REVERT ' + (sim.error || '')}  USDC ${fromBase(sim.usdcDelta, 6)}  cirBTC ${fromBase(sim.btcDelta, 8)}  gas ${sim.gasUsed ?? 'n/a'}`)
console.log(`  Morpho position after: collateral ${sim.after ? fromBase(sim.after.collateral, 8) : 'n/a'} cirBTC, borrowShares ${sim.after?.borrowShares ?? 'n/a'}  ·  adapter still authorized: ${sim.authorizedAfter}`)
const why = !sim.ok ? `reverts: ${sim.error || ''}`
  : sim.authorizedAfter ? 'leaves Morpho permission open'
  : sim.usdcDelta < amountBase * 999n / 1000n ? 'does not deliver the USDC'
  : (sim.after?.collateral ?? 0n) < need.needBase ? 'collateral below the 50% rule'
  : null
console.log(why ? `\n❌ FAIL: ${why}` : '\n✅ PASS')
if (why) process.exit(2)
