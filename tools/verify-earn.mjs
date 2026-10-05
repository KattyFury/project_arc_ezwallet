// THE EARN VERIFY GATE - a read-only dry run of an Earn deposit/withdraw. Costs nothing, needs no PIN, signs nothing.
// Lists the offered vaults, then (with a wallet) asks Circle for the signed intent, checks it (validateEarnIntent) and runs
// the batch in eth_simulateV1 (net.simRpc) to see whether the output ACTUALLY REACHES THE WALLET.
//
// Run from the repo root:
//   node tools/verify-earn.mjs                                       → the vaults the app offers
//   node tools/verify-earn.mjs <wallet> <vault> <amount> [deposit|withdraw]
// The wallet must hold the amount (Circle checks: error 380409). API_KEY (Circle LIVE key) is read from .env.txt.
import { readFileSync } from 'fs'
import { listVaults, fetchEarnIntent, validateEarnIntent, buildEarnBatch } from '../functions/api/_earnCore.js'
import { simulateBatch } from '../functions/api/_swapCore.js'
import { toBaseUnits } from '../src/money.js'
import { getNetwork } from '../src/network.js'

const net = getNetwork('mainnet')
const API_KEY = readFileSync('.env.txt', 'utf8').match(/^API_KEY=(.+)/m)?.[1]?.trim()
if (!API_KEY) { console.error('❌ API_KEY not found in .env.txt'); process.exit(1) }

const list = await listVaults(net, API_KEY)
if (list.error) { console.error('❌', list.error); process.exit(1) }
console.log('\nOffered vaults (curator rule; Deposit needs Withdrawable now ≥ amount):')
for (const v of list.vaults) console.log(`  ${v.address}  ${v.name.padEnd(26)} ${v.asset}  APY ${(v.apy * 100).toFixed(2)}%  withdrawable ${v.withdrawable.toFixed(2)}  ${v.status}`)

const [wallet, vaultAddr, amount, kind = 'deposit'] = process.argv.slice(2)
if (!wallet) process.exit(0)
const vault = list.vaults.find(v => v.address === String(vaultAddr).toLowerCase())
if (!vault) { console.error('❌ not an offered vault'); process.exit(1) }
const amountBase = toBaseUnits(amount, net.tokens[vault.asset].decimals)
console.log(`\nSimulating ${kind} of ${amount} ${vault.asset} - ${vault.name} - wallet ${wallet} ...`)
const intent = await fetchEarnIntent(net, API_KEY, kind, { vault: vault.address, amount, walletAddress: wallet })
if (!intent.ok) { console.error('❌ Earn Kit', intent.status, JSON.stringify(intent.data)); process.exit(1) }
const bad = validateEarnIntent(net, intent.data, { kind, vault: vault.address, asset: vault.asset, walletAddress: wallet, amountBase })
if (bad) { console.error('❌ intent rejected:', bad); process.exit(1) }
const built = buildEarnBatch(net, intent.data)
const sim = await simulateBatch(net, wallet, built.outToken, built.batchData)
if (sim.error) { console.error('❌', sim.error); process.exit(1) }
console.log(`  status ${sim.swapStatus}  received ${sim.delta}  (minimum ${built.minOut})  gas ${sim.gasUsed ? BigInt(sim.gasUsed) : 'n/a'}`)
const pass = sim.ok && sim.delta >= built.minOut
console.log(pass ? '\n✅ PASS' : '\n❌ FAIL')
if (!pass) process.exit(2)
