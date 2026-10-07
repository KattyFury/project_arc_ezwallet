import { MOCK, MOCK_RATES } from './mock'
import { NET } from './clientNet'

let sdk = null

// ⚡ LAZY-LOAD the Circle SDK (2026-07-17) - do NOT turn this back into `import { W3SSdk } from '...'` at the top.
// Measured (vite build splits chunks per package): w3s-pw-web-sdk ITSELF is only 31 KB, but it DRAGS IN
// firebase 262 KB + crypto-browserify 480 KB (elliptic/asn1/bn.js/diffie-hellman…, do polyfill
// `crypto` in vite.config.js) = ~740 KB ≈ 60% of the bundle. A STATIC import here means any screen that imports
// circle.js (HomeSend only needs ensureWalletAddress!) pulls all 740 KB into the first paint → a 2.7s white
// screen on 4G. A dynamic import() → those 740 KB load only when a PIN signature is ACTUALLY needed.
async function loadW3SSdk() {
  const m = await import('@circle-fin/w3s-pw-web-sdk')
  return m.W3SSdk
}

// ⚠️ Circle SDK localization: setLocalizations is no longer called (dropped 2026-08-25 along with the i18n layer).
// The app is English-only, and English is Circle's OWN DEFAULT → calling nothing is both correct and simplest
// (the PIN screen + security questions come out in English). To do multi-language again: see circleLocalizations.js
// in git history (the commit before the i18n removal) for both the translations and the correct positional-argument call.
// ⚠️ ASYNC (changed 2026-07-17 when the SDK became lazy) - EVERY call site MUST `await getSDK()`.
// Forgetting the await → a Promise is passed where the real SDK is expected → the PIN dies silently. All 6 call sites were fixed:
// EnterEmail(×3), PinGate, Security, SendConfirm, Swap.
// The PROMISE is shared, so two overlapping callers (PinGate now starts it early, 2026-10-07) get ONE W3SSdk
// instance, never two. A failed download is forgotten so the next call tries again.
let sdkP = null
export async function getSDK() {
  if (MOCK) return {}   // mock: do not init the real SDK
  if (sdk) return sdk
  if (!sdkP) sdkP = loadW3SSdk()
    .then(W3SSdk => (sdk = new W3SSdk({ appSettings: { appId: NET.circleAppId } })))
    .catch(e => { sdkP = null; throw e })
  return sdkP
}

export const GOOGLE_CLIENT_ID = '51031114717-f9chve1ge9bbo8j3kspj82qrga40342n.apps.googleusercontent.com'

export async function createSocialToken(deviceId) {
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'socialToken', deviceId }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

// MAINNET-AUDIT C1: the server mints a Circle token only for the email inside a valid auth token - the proof
// that this person received the 6-digit code at that address (/api/auth). A bare email is refused.
export async function createSession(authToken) {
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authToken }),
  })
  const data = await res.json()
  if (data.error) throw Object.assign(new Error(data.error), { code: data.code })
  return data
}

// Our own email code (NOT Circle's Email-OTP mode, which would remove the PIN). start → the code is emailed.
export async function startEmailCode(email) {
  const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', email }) })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}
// verify → { authToken } (30 days), kept in localStorage.ez_auth_token.
export async function verifyEmailCode(email, code) {
  const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', email, code }) })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

// Every session key a sign-out removes. One list, shared by every sign-out path.
export const SESSION_KEYS = ['ez_user_token', 'ez_user_token_at', 'ez_wallet_addr', 'ez_wallet_id', 'ez_encryption_key', 'ez_email', 'ez_auth_token', 'ez_refresh_token', 'ez_google_email', 'ez_login_method']

// The auth token is missing/expired (30 days, or a session from before the email code existed) → back to Login.
function expireToLogin() {
  SESSION_KEYS.forEach(k => localStorage.removeItem(k))
  sessionStorage.removeItem('ez_pin_ok'); sessionStorage.removeItem('ez_sync_token')
  location.replace('/')
}

// Verify the PIN to UNLOCK THE WALLET (access is gated by the Circle PIN itself - no second code invented). Create a challenge
// signing an empty message; executeChallenge then opens the PIN screen. A successful signature = correct PIN = wallet unlocked.
export async function signMessageChallenge(userToken, walletId, message = 'Unlock ezwallet') {
  const res = await fetch('/api/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'signMessage', userToken, walletId, message }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.challengeId
}

// Email OTP: mails the code + returns { otpToken, deviceToken, deviceEncryptionKey } for sdk.verifyOtp().
export async function createEmailToken(deviceId, email) {
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'emailToken', deviceId, email }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

export async function initializeWallet(userToken) {
  const res = await fetch('/api/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'initialize', userToken }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

// Guarantee a wallet address: if localStorage is missing it (Circle provisioning lags at wallet creation),
// fetch it again from the userToken and store it. A wallet needs NO USDC to have an address for receiving.
export async function ensureWalletAddress() {
  let addr = localStorage.getItem('ez_wallet_addr')
  if (addr) return addr
  const userToken = localStorage.getItem('ez_user_token')
  if (!userToken) return null
  try {
    const info = await getWalletAddress(userToken)
    if (info?.address) {
      localStorage.setItem('ez_wallet_addr', info.address)
      if (info.walletId) localStorage.setItem('ez_wallet_id', info.walletId)
      return info.address
    }
  } catch {}
  return null
}

export async function getWalletAddress(userToken) {
  try {
    const res = await fetch('/api/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAddress', userToken }),
    })
    const data = await res.json()
    return data || null
  } catch (e) {
    console.error('[getWalletAddress error]', e)
    return null
  }
}

// This wallet's transactions from Circle → [{ hash, type, state, date }], newest first (functions/api/wallet.js
// 'history'). The userToken lives 60' and History can be opened hours after sign-in → on an expired token, mint a
// fresh one once and retry.
export async function fetchHistory(walletId, limit) {
  const ask = userToken => fetch('/api/wallet', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'history', userToken, walletId, limit }),
  }).then(r => r.json())
  let data = await ask(localStorage.getItem('ez_user_token'))
  if (data.error && isTokenExpiredError({ code: data.code, message: data.error })) data = await ask((await forceFreshSession()).userToken)
  if (data.error) throw new Error(data.error)
  return data.txs
}

// ONE page (≤50, newest first) of the same list → { txs, next } (functions/api/wallet.js 'historyPage'); pass `next`
// back as `cursor` for the following page, null = no more pages. Same expired-token retry as fetchHistory.
export async function fetchHistoryPage(walletId, cursor = null) {
  const ask = userToken => fetch('/api/wallet', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'historyPage', userToken, walletId, cursor }),
  }).then(r => r.json())
  let data = await ask(localStorage.getItem('ez_user_token'))
  if (data.error && isTokenExpiredError({ code: data.code, message: data.error })) data = await ask((await forceFreshSession()).userToken)
  if (data.error) throw new Error(data.error)
  return { txs: data.txs, next: data.next }
}

// Every token balance Circle sees for this wallet, listed or not (functions/api/wallet.js 'balances') →
// [{ address, symbol, name, decimals, isNative, amount }]. Same expired-token retry as fetchHistory.
export async function fetchAllBalances(walletId) {
  const ask = userToken => fetch('/api/wallet', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'balances', userToken, walletId }),
  }).then(r => r.json())
  let data = await ask(localStorage.getItem('ez_user_token'))
  if (data.error && isTokenExpiredError({ code: data.code, message: data.error })) data = await ask((await forceFreshSession()).userToken)
  if (data.error) throw new Error(data.error)
  return data.tokens
}

// A Circle userToken only lives ~1 hour - far shorter than a real usage session for an
// older user (open the app, go do something else, come back and send money). An expired token
// makes the W3S SDK refuse RIGHT BEFORE showing the PIN screen → "userToken had expired",
// and the user just gets thrown out with no idea why. Call this before ANY action
// that needs a PIN signature (sending, changing the PIN) so the token is always fresh - Circle allows minting
// a new one at any time given only the userId (= email), no password required.
// Trade the refreshToken (returned by Circle at social login) for a new userToken. Used for Google users -
// they have no userId=email, so they cannot mint a token with createSession.
export async function refreshSocialToken(userToken, refreshToken, deviceId) {
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'refreshSocial', userToken, refreshToken, deviceId }),
  })
  const data = await res.json()
  if (data.error) { console.error('[refreshSocialToken]', data.error, data.detail); throw new Error(data.error) }
  return data   // { userToken, encryptionKey, refreshToken }
}

// A token THIS module minted less than 50' ago is reused as is (Circle OpenAPI: "The token will expire after 60
// minutes"). Lag fix 2026-10-07: every PIN action (unlock, send, swap, the post-send status poll) used to mint a new
// token first = a server round trip + Circle calls (~1-1.5s measured) even with a fresh token in hand. 10' of margin;
// a token that dies anyway is still caught by the 155104 → forceFreshSession() retry every caller already has.
const TOKEN_REUSE_MS = 50 * 60 * 1000
function storeUserToken(userToken) {
  localStorage.setItem('ez_user_token', userToken)
  localStorage.setItem('ez_user_token_at', String(Date.now()))
}

export async function refreshSession() {
  if (MOCK) return { userToken: 'mock-token', encryptionKey: 'mock-key' }
  const email = localStorage.getItem('ez_email')
  const fallback = { userToken: localStorage.getItem('ez_user_token'), encryptionKey: localStorage.getItem('ez_encryption_key') }
  const mintedAt = Number(localStorage.getItem('ez_user_token_at') || 0)
  if (fallback.userToken && fallback.encryptionKey && Date.now() - mintedAt < TOKEN_REUSE_MS) return fallback

  // EMAIL flow: mint a new token with the stored auth token (proof of email ownership, 30 days).
  if (email) {
    const authToken = localStorage.getItem('ez_auth_token')
    if (!authToken) { expireToLogin(); return fallback }   // a session from before the email code existed
    try {
      const { userToken, encryptionKey } = await createSession(authToken)
      storeUserToken(userToken)
      localStorage.setItem('ez_encryption_key', encryptionKey)
      return { userToken, encryptionKey }
    } catch (e) {
      if (e?.code === 'AUTH_REQUIRED') { expireToLogin(); return fallback }
      return fallback
    }
  }

  // GOOGLE flow (no email → use the refreshToken + the deviceId saved at login).
  // This is the root fix for the "Change PIN: Forbidden" error: the PIN userToken lives 60', and Google users
  // previously had no way to refresh it → expiry → 403. Now the refreshToken buys a new token before PIN signing.
  const refreshToken = localStorage.getItem('ez_refresh_token')
  const deviceId = localStorage.getItem('ez_google_deviceId')
  if (refreshToken && deviceId) {
    try {
      const r = await refreshSocialToken(fallback.userToken, refreshToken, deviceId)
      if (r?.userToken) {
        storeUserToken(r.userToken)
        if (r.encryptionKey) localStorage.setItem('ez_encryption_key', r.encryptionKey)
        if (r.refreshToken) localStorage.setItem('ez_refresh_token', r.refreshToken)  // Circle rotates it → store the new one
        return { userToken: r.userToken, encryptionKey: r.encryptionKey || fallback.encryptionKey }
      }
    } catch {
      // refreshToken expired (14 days) / network error → keep the old token and let the real error surface at execute
    }
  }
  return fallback
}

// GUARANTEED fresh token - UNLIKE refreshSession (which silently returns the old token when createSession
// fails → the root of error 155104). Used to RETRY when Circle reports an expired token. A failed mint throws out
// (so the caller can send the user back to login) and is NOT swallowed.
export async function forceFreshSession() {
  if (MOCK) return { userToken: 'mock-token', encryptionKey: 'mock-key' }
  const email = localStorage.getItem('ez_email')
  let s
  if (email) {
    const authToken = localStorage.getItem('ez_auth_token')
    if (!authToken) throw new Error('no-session')   // → the caller sends the user back to Login
    try { s = await createSession(authToken) }      // { userToken, encryptionKey } - throws on error
    catch (e) { if (e?.code === 'AUTH_REQUIRED') throw new Error('no-session'); throw e }
  } else {
    const refreshToken = localStorage.getItem('ez_refresh_token')
    const deviceId = localStorage.getItem('ez_google_deviceId')
    if (!refreshToken || !deviceId) throw new Error('no-session')   // not enough to mint → back to login
    const r = await refreshSocialToken(localStorage.getItem('ez_user_token'), refreshToken, deviceId)
    if (r.refreshToken) localStorage.setItem('ez_refresh_token', r.refreshToken)
    s = { userToken: r.userToken, encryptionKey: r.encryptionKey }
  }
  storeUserToken(s.userToken)
  localStorage.setItem('ez_encryption_key', s.encryptionKey)
  return s
}

// Circle reporting an expired/invalid session token: 155103 (token not found), 155104 (expired),
// 155105 (invalid). SDK errors carry a numeric .code; errors from /api/* throw new Error(message) → match the text.
export function isTokenExpiredError(e) {
  const code = e?.code ?? e?.error?.code
  if ([155103, 155104, 155105].includes(code)) return true
  const msg = (e?.message || e?.error?.message || (typeof e === 'string' ? e : '')).toLowerCase()
  return /155103|155104|155105|token had expired|usertoken is invalid/.test(msg)
}

// Swap runs server-side (/api/swap) with the Circle API key - no key in the browser
// The browser only calls /api/swap, and the Worker talks to the Circle Stablecoin Kit API

// MOCK: estimate the conversion from MOCK_RATES (USD per unit): amountOut = amountIn·rateIn/rateOut
function mockSwapOut(tokenIn, tokenOut, amountIn) {
  const rIn = MOCK_RATES[tokenIn] ?? 1, rOut = MOCK_RATES[tokenOut] ?? 1
  return String((Number(amountIn) * rIn / rOut).toFixed(6))
}

export async function estimateSwap({ walletAddress, tokenIn, tokenOut, amountIn }) {
  if (MOCK) { const amountOut = mockSwapOut(tokenIn, tokenOut, amountIn); return { amountOut, minOut: amountOut } }
  const res = await fetch('/api/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'estimate', walletAddress, tokenIn, tokenOut, amountIn }),
  })
  return res.json()
}

// Circle's fee estimate for THIS send (functions/api/send.js action 'fee') → { feeMax, feeNow } in USDC (= USD).
// allowConvert (a USD/USDC send short of USDC) → the server may answer with `convert: [{ token, amountIn, minOut }]`, the
// swaps it will put in front of the payment (docs/SWAP-PLAN.md section 6); Confirm shows them and sends them back.
export async function estimateSendFee({ toAddress, token, amountDecimal, memo, allowConvert = false }) {
  if (MOCK) return allowConvert
    ? { feeMax: '0.0412', feeNow: '0.02', convert: [{ token: 'EURC', amountIn: '0.897667', minOut: '0.997395' }] }
    : { feeMax: '0.004', feeNow: '0.002' }
  const walletId = localStorage.getItem('ez_wallet_id')
  const ask = userToken => fetch('/api/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'fee', userToken, walletId, toAddress, token, amountDecimal, memo, allowConvert }),
  }).then(r => r.json())
  let data = await ask(localStorage.getItem('ez_user_token'))
  if (data.error && isTokenExpiredError({ code: data.code, message: data.error })) data = await ask((await forceFreshSession()).userToken)
  if (data.error) throw new Error(data.error)
  return data
}

// Circle's fee estimate for THIS swap (functions/api/swap.js 'fee') → { feeMax, feeNow } in USDC (= USD).
// Same expired-token retry as fetchHistory.
export async function estimateSwapFee({ walletId, walletAddress, tokenIn, tokenOut, amountIn }) {
  if (MOCK) return { feeMax: '0.04', feeNow: '0.02' }
  const ask = userToken => fetch('/api/swap', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'fee', userToken, walletId, walletAddress, tokenIn, tokenOut, amountIn }),
  }).then(r => r.json())
  let data = await ask(localStorage.getItem('ez_user_token'))
  if (data.error && isTokenExpiredError({ code: data.code, message: data.error })) data = await ask((await forceFreshSession()).userToken)
  if (data.error) throw new Error(data.error)
  return data
}

// The userToken is passed in from refreshSession() (do not read localStorage directly - a 60' token may be dead)
// minOut = the 'estimate' minimum the screen showed → the server makes it the swap's stopLimit (MAINNET-AUDIT H2).
export async function executeSwap({ userToken, walletId, walletAddress, tokenIn, tokenOut, amountIn, minOut, refId }) {
  if (MOCK) return { challengeId: 'mock-challenge', amountOut: mockSwapOut(tokenIn, tokenOut, amountIn) }
  const res = await fetch('/api/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'execute', userToken, walletId, walletAddress, tokenIn, tokenOut, amountIn, minOut, refId }),
  })
  return res.json()
}


export async function resetPinChallenge(userToken) {
  const res = await fetch('/api/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'resetPin', userToken }),
  })
  const data = await res.json()
  if (data.error) {
    console.error('[resetPinChallenge]', data.error, data.detail)
    throw new Error(data.error)
  }
  return data.challengeId
}

// FORGOT PIN - skips the old PIN, Circle verifies the security questions instead (see resetPinChallenge
// above for the "3 PIN endpoints" comment in functions/api/wallet.js - this is the 3rd one).
export async function restorePinChallenge(userToken) {
  const res = await fetch('/api/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'restorePin', userToken }),
  })
  const data = await res.json()
  if (data.error) {
    console.error('[restorePinChallenge]', data.error, data.detail)
    throw new Error(data.error)
  }
  return data.challengeId
}

// ⚠️ Circle error codes where the iframe KEEPS the modal open for the user to correct themselves (it does NOT close).
// If we reject the promise on these and navigate away → when the user then enters the RIGHT value,
// the iframe (still on top) fires onComplete success BUT the promise is already rejected → the result is lost
// → the user is "thrown out" despite entering it correctly. This IS the root cause of the PIN bug.
// → Ignore these errors (let the iframe handle the retry); ONLY settle on SUCCESS or a TERMINAL error.
// (Source: reading @circle-fin/w3s-pw-web-sdk messageHandler - onError does NOT remove the iframe.)
const RETRYABLE_CODES = new Set([
  155112, // incorrectUserPin - wrong PIN, the iframe allows a retry
  155703, // pinCodeNotMatched - the 2 PIN entries (when creating one) do not match
  155704, // insecurePinCode - PIN too weak, pick another
  155115, // incorrectSecurityAnswers - wrong security answers
  155705, // hintsMatchAnswers - the hint matches the answer
])

// ⚠️⚠️ THE CIRCLE ERROR BOUNDARY - READ BEFORE CHANGING ANYTHING (established 2026-08-04 by reading the SDK source):
// Circle errors come in TWO KINDS, and only one of them is ours to word:
//
//   (a) Errors DRAWN INSIDE THE IFRAME (RETRYABLE_CODES above: wrong PIN, wrong answers...) - the
//       `pw-auth.circle.com` iframe shows its own red text and allows a retry, does NOT close and does NOT surface anything.
//       That text is Circle's, in ENGLISH, and CANNOT BE CHANGED: the `Localizations` interface has EXACTLY 16
//       fields (see `node_modules/@circle-fin/w3s-pw-web-sdk/dist/src/types.d.ts:498`), none of them for error
//       text; the only thing named "error" is `errorInfo` in `Resources`, and that is an image ICON. This is a REAL
//       Circle limitation - stop looking for a way to reword it.
//
//   (b) TERMINAL errors (PIN locked, token expired...) - the iframe CLOSES, the error surfaces here, and WE draw it
//       on screen. These we CAN word → mapped by `err.code` below.
//
// Mapped by NUMERIC CODE, never by matching English text (`/lock/i` as the old version did): if Circle localises the
// message or rewords it, text matching goes silent, whereas the codes are stable.
const ERROR_BY_CODE = {
  155119: 'Too many incorrect PIN attempts. Your wallet is temporarily locked – please try again in a few minutes.',
  155120: 'Too many incorrect answers. Temporarily locked – please try again in a few minutes.',
  155109: 'This account has been disabled.',
  155102: 'Account not found.',
  155110: 'This account has no PIN set.',
  155111: 'This account has no security questions set.',
  155103: 'Your session has expired. Please sign in again.',
  155104: 'Your session has expired. Please sign in again.',
  155105: 'Your session has expired. Please sign in again.',
  155130: 'The code has expired. Please request a new one.',
  155131: 'Invalid code.',
  155133: 'Incorrect code.',
  155134: 'The code does not match.',
  155706: 'Network error. Check your connection and try again.',
}

// A Circle error → the sentence shown to the user. An unknown code (not in the table) → fall back to Circle's own
// message rather than swallowing the information; failing that, a generic sentence.
// USE THIS FUNCTION everywhere a Circle error is caught, never read `e.message` directly.
export function circleErrorMessage(e) {
  const known = ERROR_BY_CODE[e?.code ?? e?.error?.code]
  if (known) return known
  return e?.message || e?.error?.message || (typeof e === 'string' ? e : '') || 'Something went wrong'
}

export function executeChallenge(sdk, userToken, encryptionKey, challengeId) {
  if (MOCK) return Promise.resolve()   // mock: skip PIN signing, treat it as a success
  return new Promise((resolve, reject) => {
    sdk.setAuthentication({ userToken, encryptionKey })
    sdk.execute(challengeId, (err, result) => {
      if (err) {
        // Log EVERY Circle error WITH ITS CODE. Without this line, retryable errors (wrong PIN) are swallowed
        // silently below → there is no way to know which code Circle actually sends, leaving you guessing
        // (3 deploy cycles were lost to guessing, 08-04). Keep it forever: it is cheap, and it is the only
        // window into a cross-origin iframe.
        console.error('[Circle challenge]', 'code=', err?.code, '| retryable=', RETRYABLE_CODES.has(err?.code), '|', err?.message || err?.error?.message, err)
        if (RETRYABLE_CODES.has(err.code)) return   // let the iframe offer a retry, do not settle
        // A terminal error → attach the human sentence to .message (callers keep showing .message as before).
        // 155119 = PIN locked: keep the .locked flag for callers that need to tell it apart.
        return reject(Object.assign(new Error(circleErrorMessage(err)), {
          code: err.code,
          locked: err.code === 155119 || err.code === 155120,
        }))
      }
      resolve(result)
    })
  })
}
