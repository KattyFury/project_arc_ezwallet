// ══════════════════════════════════════════════════════════
// MOCK MODE (2026-07-15) - runs LOCALLY to check UI/flow, WITHOUT touching the Circle SDK.
//   On:   npm run mock   (Vite --mode mock reads .env.mock, which sets VITE_MOCK=1)
//   Off:  npm run dev    (normal) - flag unset → MOCK=false.
// NEVER reaches production: a prod build (mode=production) has no VITE_MOCK.
// What it does: skips Login + PIN → straight into the app with a FAKE WALLET and FAKE BALANCES; every /api/* and
// ArcScan call is intercepted with fake data; Send/Swap pretend to SUCCEED (no Circle call, no real money).
// For building/checking the UI only - real money flows still have to be tested on a deploy (the Circle SDK needs https).
// ══════════════════════════════════════════════════════════
export const MOCK = import.meta.env.VITE_MOCK === '1'

// Fake wallet (demo address, not a real wallet)
export const MOCK_ADDR = '0x1234567890AbcdEF1234567890aBCDef12345678'
const OTHER_ADDR = '0x9AbCDef0123456789ABCdef0123456789abCDEf0'
const ADAPTER = '0xBBD70b01a1CAbc96d5b7b129Ae1AAabdf50dd40b'   // Swap Adapter (so swap txs are recognised correctly)

// Fake balances by symbol (in real token units). USD conversion uses MOCK_RATES.
export const MOCK_AMOUNTS = { USDC: 127.66, EURC: 84.20, cirBTC: 0.01542 }
// Fake UNVERIFIED tokens (meme/unknown) for the collapsible "Unverified tokens" row on Home.
export const MOCK_UNVERIFIED = [{ address: '0xcb92a075db3d4e965f37936da2100902344650e3', symbol: 'ARCADE', name: 'ARCADE', decimals: 18, amount: 1000000 }, { address: '0x1111111111111111111111111111111111111111', symbol: 'FREE-AIRDROP-CLAIM-NOW', name: 'spam', decimals: 18, amount: 42.5 }]
export const MOCK_RATES = { USDC: 1, EURC: 1.08, cirBTC: 65000 }
// Fake 24h % change (for the token-list arrow, user request 08-25) - stablecoins barely move, cirBTC does.
export const MOCK_CHANGE_24H = { USDC: 0.01, EURC: -0.02, cirBTC: 2.35 }

// Fake transaction history - SHAPED like ArcScan tokentx (from/to/value base units/tokenSymbol/tokenDecimal/
// contractAddress/timeStamp/hash). A swap = 2 rows with the SAME hash (1 out + 1 in) so TxHistory reads it as a swap.
const _now = Math.floor(Date.now() / 1000)
export const MOCK_TX = [
  // Received 25 USDC (1h ago)
  { hash: '0xmockrcv1', from: OTHER_ADDR, to: MOCK_ADDR, value: '25000000', tokenSymbol: 'USDC', tokenDecimal: '6', contractAddress: '0x3600000000000000000000000000000000000000', timeStamp: String(_now - 3600) },
  // Sent 10 EURC (yesterday)
  { hash: '0xmocksnd1', from: MOCK_ADDR, to: OTHER_ADDR, value: '10000000', tokenSymbol: 'EURC', tokenDecimal: '6', contractAddress: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', timeStamp: String(_now - 90000) },
  // SENDING TO YOURSELF: ONE SINGLE ROW with from == to (bug reported by the user 07-31 - it used to be labelled
  // "Swapped 5 USDC to USDC", so it looked like it had vanished from history). Keep this case in the mock so the
  // next person touching TxHistory can retest instantly: it must read "Sent to yourself", NOT Swapped.
  { hash: '0xmockself1', from: MOCK_ADDR, to: MOCK_ADDR, value: '5000000', tokenSymbol: 'USDC', tokenDecimal: '6', contractAddress: '0x3600000000000000000000000000000000000000', timeStamp: String(_now - 7200) },
  // Swap 20 USDC → ~18.5 EURC (2 days ago, same hash)
  { hash: '0xmockswp1', from: MOCK_ADDR, to: ADAPTER, value: '20000000', tokenSymbol: 'USDC', tokenDecimal: '6', contractAddress: '0x3600000000000000000000000000000000000000', timeStamp: String(_now - 180000) },
  { hash: '0xmockswp1', from: ADAPTER, to: MOCK_ADDR, value: '18500000', tokenSymbol: 'EURC', tokenDecimal: '6', contractAddress: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', timeStamp: String(_now - 180000) },
]

// Seed a fake session → App.jsx sees a session + an unlocked PIN → straight into HomeSend.
export function seedMockSession() {
  localStorage.setItem('ez_user_token', 'mock-token')
  localStorage.setItem('ez_wallet_addr', MOCK_ADDR)
  localStorage.setItem('ez_wallet_id', 'mock-wallet')
  localStorage.setItem('ez_email', 'demo@ezwallet.app')
  sessionStorage.setItem('ez_pin_ok', '1')
}

function jsonRes(obj) {
  return new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

// Block the network: /api/* (the Circle proxy) → fake data (history: chain.js loadHistoryRows returns MOCK_TX itself).
// Every other URL (viem RPC…) goes through the real fetch and fails gracefully (getTxMemo/gasPrice both have try/catch → no harm).
export function installMockFetch() {
  const orig = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input?.url || '')
    if (url.includes('/api/send'))    return jsonRes({ challengeId: 'mock-challenge' })
    if (url.includes('/api/session')) return jsonRes({ userToken: 'mock-token', encryptionKey: 'mock-key' })
    if (url.includes('/api/wallet'))  return jsonRes({ address: MOCK_ADDR, walletId: 'mock-wallet' })
    return orig(input, init)
  }
}
