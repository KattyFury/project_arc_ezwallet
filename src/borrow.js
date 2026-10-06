// Client side of Borrow (Service hub → Lending / Borrow, Borrow tab) - every call goes to /api/borrow
// (functions/api/borrow.js). Mock answers mirror Arc mainnet measurements of 2026-10-06 (cirBTC/USDC, LLTV 86%,
// 10 USDC at LTV 50% needs 0.00023372 cirBTC, liquidation ≈ $49,751).
import { MOCK } from './mock'
import { isTokenExpiredError, forceFreshSession } from './circle'

const MARKET = { marketId: '0xc2db905f174e5defcce01d321b09f15f78856a36a21b90cc7e1abbc29225815d', name: 'cirBTC/USDC', lltv: 0.86, borrowApy: 0.013457, free: 50.749414 }
const LOAN = { loanId: '11111111-1111-4111-8111-111111111111', marketId: MARKET.marketId, status: 'active', ready: true, collateral: 0.00023372,
  borrowed: 10.0012, interest: 0.0012, borrowApy: 0.013457, ltv: 0.5, healthFactor: 1.72, band: 'SAFE', liquidationPrice: 49751.44, alertsOn: false }

function mock(action, body) {
  if (action === 'markets') return { markets: [MARKET], maxUsd: 200, maxLtv: 0.5 }
  if (action === 'loans') return { loans: localStorage.getItem('ez_mock_no_loan') ? [] : [LOAN] }
  if (action === 'quote') return { cirbtcNeeded: Number(body.amount) * 0.0000233720, liquidationPrice: 49751.44, topUp: Number(body.amount) * 0.0000066 }
  if (action === 'fee') return { feeMax: '0.0118', cirbtcNeeded: Number(body.amount) * 0.0000233720, liquidationPrice: 49751.44 }
  if (action === 'execute') return { challengeId: 'mock-challenge', loanId: LOAN.loanId }
  if (action === 'alertStart') return { challengeId: 'mock-challenge', deadline: Math.floor(Date.now() / 1000) + 240 }
  if (action === 'alertFinish') return { registered: true, email: true }
  return { error: `mock: ${action}` }
}

// POST /api/borrow → data, or throws Error(message). 'fee' retries once on an expired user token.
export async function borrowApi(action, body = {}) {
  if (MOCK) return mock(action, body)
  const ask = (userToken) => fetch('/api/borrow', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body, ...(userToken ? { userToken } : {}) }),
  }).then(r => r.json())
  const withToken = action === 'fee'
  let data = await ask(withToken ? localStorage.getItem('ez_user_token') : null)
  if (withToken && data.error && isTokenExpiredError({ code: data.code, message: data.error })) data = await ask((await forceFreshSession()).userToken)
  if (data.error) throw new Error(data.error)
  return data
}

// Health band → the app's colour + a plain word.
export const BAND = {
  SAFE: ['var(--color-primary)', 'Safe'], WARN: ['var(--color-warning)', 'Watch it'], URGENT: ['var(--color-error)', 'At risk'],
  IMMINENT: ['var(--color-error)', 'Near liquidation'], LIQUIDATABLE: ['var(--color-error)', 'Liquidating'],
}
