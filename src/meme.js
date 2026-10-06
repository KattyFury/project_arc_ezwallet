// Client side of Memes (Service hub → Memes) - every call goes to /api/meme (functions/api/meme.js). The mock answers
// mirror real Arc mainnet measurements (2026-10-05: Argus STABLE, 1%/1% tax, buy→sell round trip -3.94%).
import { MOCK } from './mock'
import { isTokenExpiredError, forceFreshSession } from './circle'

const STABLE = {
  supported: true, launchpad: 'Argus', token: '0xC281dFF1A3eD6943123f53aEcCDc571DAB1Ce099', name: 'Stable', symbol: 'STABLE', decimals: 18,
  priceUsd: 0.0000029348, buyTaxBps: 100, sellTaxBps: 100, snipeTaxBps: 0, held: '1250000000000000000000000',
}
const MOCK_TOP = [
  ['0x229fd9847e4e0411d93ee579c1b7cb3108f8e893', 'arip', 0.0000024573, -50.9, 108699, 10011],
  ['0x7cd0be2c1d01b878ef7ce8cd77c92dc2c70769ac', 'Human', 0.0000024572, -50.9, 106581, 10090],
  ['0x4481d412772cf7156ba4684c058a213a2752fd58', 'Mochi', 0.0000024637, -50.8, 79031, 9818],
  ['0x6238d6f6e5e7eb2a1e8741781debb16a11057ed9', 'SCOUT', 0.0000024584, -50.9, 78279, 12019],
  ['0xC281dFF1A3eD6943123f53aEcCDc571DAB1Ce099', 'STABLE', 0.0000029348, 12.4, 41200, 15100],
].map(([token, symbol, priceUsd, change24h, volume24h, liquidityUsd]) => ({ token, symbol, name: symbol, priceUsd, change24h, volume24h, liquidityUsd, fdvUsd: priceUsd * 1e9 }))
function mock(action, body) {
  if (action === 'top') return { ts: Date.now(), source: 'GeckoTerminal (CoinGecko)', tokens: MOCK_TOP }
  if (action === 'inspect') return String(body.token).toLowerCase() === STABLE.token.toLowerCase()
    ? { ...STABLE, sellable: true, roundTripLossPct: 3.94 } : { supported: false, reason: 'not an Argus token' }
  if (action === 'portfolio') return { tokens: [
    { ...STABLE, hidden: false, sellValueUsdc: 3.52 },
    { token: '0x1111111111111111111111111111111111111111', hidden: true, reason: 'not an Argus token' },
  ] }
  if (action === 'quote') return body.side === 'buy'
    ? { out: String(BigInt(Math.round(Number(body.amount) * 333830)) * 10n ** 18n), minOut: '1', outDecimals: 18 }
    : { out: String(Math.round(Number(body.amount) * 0.0000028 * 1e6)), minOut: '1', outDecimals: 6 }
  if (action === 'fee') return { feeMax: '0.0124', feeNow: '0.011' }
  if (action === 'execute') return { challengeId: 'mock-challenge' }
  return { error: `mock: ${action}` }
}

// POST /api/meme → data, or throws Error(message). 'fee' carries the user token and retries once on an expired one.
export async function memeApi(action, body = {}) {
  if (MOCK) return mock(action, body)
  const ask = (userToken) => fetch('/api/meme', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body, ...(userToken ? { userToken } : {}) }),
  }).then(r => r.json())
  const withToken = action === 'fee'
  let data = await ask(withToken ? localStorage.getItem('ez_user_token') : null)
  if (withToken && data.error && isTokenExpiredError({ code: data.code, message: data.error })) data = await ask((await forceFreshSession()).userToken)
  if (data.error) throw new Error(data.error)
  return data
}

// A base-unit string → a short human number ("1.25M", "0.00000293").
export function fmtUnits(raw, decimals, maxFrac = 2) {
  const n = Number(BigInt(raw || 0)) / 10 ** decimals
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K'
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFrac })
}
export const fmtUsdShort = (n) => typeof n !== 'number' ? '…' : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`
export const fmtPrice = (p) => typeof p === 'number' && p > 0 ? `$${p < 0.01 ? p.toPrecision(3) : p.toFixed(4)}` : '…'
