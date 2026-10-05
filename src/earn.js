// Client side of Earn (Service hub → Lending) - every call goes to /api/earn (functions/api/earn.js), which holds the
// Circle key. The mock answers mirror the real shapes measured on Arc mainnet 2026-10-05 (plan §2/§12).
import { MOCK } from './mock'
import { isTokenExpiredError, forceFreshSession } from './circle'

const MOCK_VAULTS = [
  { address: '0xbeef00be37bde921bae06fad223125bab16c41d1', name: 'Steakhouse Prime EURC', asset: 'EURC', curator: 'Steakhouse Financial', apy: 0.0387, deposits: 9199, withdrawable: 8819.87, status: 'active', warnings: [] },
  { address: '0x389abdf4355e0cf4f19298179991705a98f21c18', name: 'Galaxy EURC', asset: 'EURC', curator: 'Galaxy Curation', apy: 0.0153, deposits: 502591, withdrawable: 309991.34, status: 'active', warnings: [] },
  { address: '0xbeef0016cb2fd5c352ea7ca08a9f54739dfa7298', name: 'Steakhouse Prime USDC', asset: 'USDC', curator: 'Steakhouse Financial', apy: 0.0113, deposits: 2584428, withdrawable: 62542.47, status: 'low_liquidity', warnings: ['low_liquidity'] },
  { address: '0x8e357432cc12ff425c36432f312968aeb16112af', name: 'Galaxy USDC', asset: 'USDC', curator: 'Galaxy Curation', apy: 0.0116, deposits: 89714508, withdrawable: 0, status: 'low_liquidity', warnings: ['low_liquidity'] },
]
const MOCK_POSITIONS = [
  { vault: '0xbeef0016cb2fd5c352ea7ca08a9f54739dfa7298', name: 'Steakhouse Prime USDC', asset: 'USDC', balance: 12.0431, apy: 0.0113, earned: 0.0431 },
]

function mock(action, body) {
  if (action === 'vaults') return { vaults: MOCK_VAULTS, maxUsd: 200 }
  if (action === 'positions') return { positions: localStorage.getItem('ez_mock_no_positions') ? [] : MOCK_POSITIONS }
  if (action === 'quote') return { maxWithdrawable: 12.0431, warnings: [] }
  if (action === 'fee') return { feeMax: '0.0091', feeNow: '0.0084' }
  if (action === 'execute') return { challengeId: 'mock-challenge' }
  return { error: `mock: ${action} ${JSON.stringify(body)}` }
}

// POST /api/earn → data, or throws Error(message). Calls that carry the user token retry once on an expired token.
export async function earnApi(action, body = {}) {
  if (MOCK) return mock(action, body)
  const ask = (userToken) => fetch('/api/earn', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body, ...(userToken ? { userToken } : {}) }),
  }).then(r => r.json())
  const withToken = action === 'fee'   // execute gets its token from refreshSession() by the caller
  let data = await ask(withToken ? localStorage.getItem('ez_user_token') : null)
  if (withToken && data.error && isTokenExpiredError({ code: data.code, message: data.error })) data = await ask((await forceFreshSession()).userToken)
  if (data.error) throw new Error(data.error)
  return data
}
