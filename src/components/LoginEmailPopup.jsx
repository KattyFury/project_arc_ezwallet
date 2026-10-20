import { useState } from 'react'
import { useNav } from '../nav'
import { NET } from '../clientNet'
import { createSession, startEmailCode, verifyEmailCode, createEmailToken, getSDK, initializeWallet, executeChallenge, getWalletAddress, circleErrorMessage } from '../circle'

// "LOG IN WITH EMAIL" - Figma node 1:193. A POPUP OVER THE LOGIN SCREEN, not a screen of its own; the
// user settled this on 2026-09-23: "nó là popup hiện ra ngay màn Login, là chặn cửa ko cho người khác
// vào app, nó k phải 1 màn riêng". It used to be src/screens/EnterEmail.jsx - that file is gone and all
// of its authentication logic moved here UNCHANGED. Only the layout was rewritten.
//
// Coordinates are node 1:193's own numbers in the app's usual convention (x = px/390 as %, y = px/844
// as dvh), measured against the SCREEN rather than the card, exactly like every other screen.

const DOMAINS = ['@gmail.com', '@icloud.com']   // @yahoo.com dropped (owner 2026-10-20)
const APP_ID = NET.circleAppId   // per network (src/network.js)
// ✅ Email OTP: signing in requires the CODE mailed to you → only the mailbox owner gets in (closing the "anyone who
// types your email is in" hole). Needs SMTP configured in Circle Console (done 2026-07-05). Flag off = back to the old
// direct-email flow (PIN, NO email verification) if OTP has problems.
// TESTED (2026-07-05): OTP users sign with the Confirmation UI and have NO PIN → losing the guard against family
// members + a "Contract Interaction" screen that baffles older users. → TURNED OFF, back to Email+PIN. Re-enable when
// Circle lets social/OTP use a PIN (or the confirm UI can be customised properly). The OTP code stays, only this flag flips.
const EMAIL_OTP_ENABLED = false

function getEmailHistory() {
  try { return JSON.parse(localStorage.getItem('ez_email_history') || '[]') } catch { return [] }
}

function saveEmailHistory(email) {
  const hist = getEmailHistory().filter(e => e !== email)
  hist.unshift(email)
  localStorage.setItem('ez_email_history', JSON.stringify(hist.slice(0, 5)))
}

// The suggestion chip - node 1:204 / 7:33: 32 tall, RADIUS 8 (not a pill: the exported path's corner is
// `a 8 8` and the shared app-wide hint chip's 999 would be visibly rounder), 1px brand border on white,
// 14px brand text.
// Owner 2026-10-05: the chips sit 16px under the field (they used to overlap it - the field is --input-h tall, not
// Figma's 40) and flow side by side, wrapping to a new line only when the row is full.
function Chip({ label, onClick }) {
  return (
    <button onClick={onClick} title={label}
      style={{
        flexShrink: 0, height: 'calc(32 * var(--u))', maxWidth: '100%',
        padding: '0 calc(16 * var(--u))', border: '1px solid var(--color-brand)', borderRadius: 16,
        background: 'var(--btn-grad-white)', cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 'var(--fs-small)', color: 'var(--color-brand)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
      {label}
    </button>
  )
}

export default function LoginEmailPopup({ onClose }) {
  const { navigate } = useNav()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // MAINNET-AUDIT C1 (2026-09-27): after the email, OUR server emails a 6-digit code and this same popup asks for
  // it (owner decision: reuse the email popup, no new screen). Only a correct code yields the auth token that
  // /api/session requires. This is NOT Circle's Email-OTP mode - the Circle PIN flow below is unchanged.
  const [step, setStep] = useState('email')       // 'email' → 'code'
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')        // "Code sent" after a resend

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const valid = step === 'email' ? validEmail : /^\d{6}$/.test(code)
  const showDomains = email.length > 0 && !email.includes('@')
  const history = getEmailHistory()
  const suggestions = email.length === 0
    ? history
    : history.filter(e => e.toLowerCase().startsWith(email.toLowerCase()) && e !== email)

  function applyDomain(d) { setEmail(e => e + d); setError('') }

  // Once a userToken exists (from OTP): create the wallet (if missing) → challenge (PIN or Approve, Circle's choice) →
  // fetch the address → into Home. OTP users refresh their token with refreshToken (like Google), and do NOT set ez_email.
  async function finishOtpLogin(result, emailStr, deviceId) {
    const { userToken, encryptionKey, refreshToken } = result
    localStorage.setItem('ez_user_token', userToken)
    localStorage.setItem('ez_encryption_key', encryptionKey)
    if (refreshToken) localStorage.setItem('ez_refresh_token', refreshToken)
    localStorage.setItem('ez_google_deviceId', deviceId)   // device fingerprint - used by refreshSocial
    localStorage.setItem('ez_google_email', emailStr)      // shown as "Login email"
    localStorage.setItem('ez_login_method', 'email')
    localStorage.removeItem('ez_email')                    // avoid the PIN-createSession branch (wrong for OTP users)
    localStorage.removeItem('ez_wallet_addr'); localStorage.removeItem('ez_wallet_id')

    const walletData = await initializeWallet(userToken)
    const challengeId = walletData?.data?.challengeId
    if (challengeId) await executeChallenge(await getSDK(), userToken, encryptionKey, challengeId)

    let info = null
    for (let i = 0; i < 3 && !info?.address; i++) {
      info = await getWalletAddress(userToken)
      if (!info?.address) await new Promise(r => setTimeout(r, 2000))
    }
    if (info?.address) localStorage.setItem('ez_wallet_addr', info.address)
    if (info?.walletId) localStorage.setItem('ez_wallet_id', info.walletId)
    saveEmailHistory(emailStr)
    sessionStorage.setItem('ez_pin_ok', '1')   // OTP users have no PIN → skip the PIN gate
    navigate('HomeSend')
  }

  async function handleSubmit() {
    if (!valid || loading) return
    setLoading(true); setError('')

    if (EMAIL_OTP_ENABLED) {
      const em = email.trim()
      try {
        const sdk = await getSDK()
        const deviceId = await sdk.getDeviceId()
        const { otpToken, deviceToken, deviceEncryptionKey } = await createEmailToken(deviceId, em)
        // Set the config + callback, then open Circle's hosted OTP screen.
        sdk.updateConfigs(
          { appSettings: { appId: APP_ID }, loginConfigs: { deviceToken, deviceEncryptionKey, otpToken } },
          async (error, result) => {
            if (error) {
              if (error?.code === 155701) { setLoading(false); return }   // user cancelled → stay silent
              setError(circleErrorMessage(error)); setLoading(false); return
            }
            if (!result?.userToken) { setLoading(false); return }
            try { await finishOtpLogin(result, em, deviceId) }
            catch (e) { setError(circleErrorMessage(e)); setLoading(false) }
          }
        )
        sdk.verifyOtp()   // keep loading=true; the callback above will navigate or raise the error
      } catch (e) {
        setError(circleErrorMessage(e)); setLoading(false)
      }
      return
    }

    // ── Step 1: email → our server emails a 6-digit code ──
    if (step === 'email') {
      try {
        await startEmailCode(email.trim())
        setStep('code'); setCode(''); setNotice('')
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
      return
    }

    // ── Step 2: the code → auth token → the unchanged email + PIN flow ──
    try {
      const { authToken } = await verifyEmailCode(email.trim(), code)
      localStorage.setItem('ez_auth_token', authToken)
      localStorage.removeItem('ez_wallet_addr')
      localStorage.removeItem('ez_wallet_id')
      const { userToken, encryptionKey } = await createSession(authToken)
      localStorage.setItem('ez_user_token', userToken)
      localStorage.setItem('ez_encryption_key', encryptionKey)
      localStorage.setItem('ez_email', email.trim())
      const sdk = await getSDK()
      const walletData = await initializeWallet(userToken)
      const challengeId = walletData?.data?.challengeId
      if (challengeId) await executeChallenge(sdk, userToken, encryptionKey, challengeId)

      const freshSession = await createSession(authToken)
      const freshToken = freshSession.userToken
      localStorage.setItem('ez_user_token', freshToken)
      localStorage.setItem('ez_encryption_key', freshSession.encryptionKey)

      let walletInfo = null
      for (let i = 0; i < 3; i++) {
        walletInfo = await getWalletAddress(freshToken)
        if (walletInfo?.address) break
        await new Promise(r => setTimeout(r, 2000))
      }
      if (walletInfo?.address) localStorage.setItem('ez_wallet_addr', walletInfo.address)
      if (walletInfo?.walletId) localStorage.setItem('ez_wallet_id', walletInfo.walletId)

      saveEmailHistory(email.trim())
      // First time = the PIN was just CREATED (challengeId present) → already authenticated → straight in. Second time on (no challengeId) → the PIN gate.
      if (challengeId) { sessionStorage.setItem('ez_pin_ok', '1'); navigate('HomeSend') }
      else navigate('PinGate', { next: 'HomeSend' })
    } catch (e) {
      setError(circleErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    if (loading) return
    setLoading(true); setError(''); setNotice('')
    try { await startEmailCode(email.trim()); setNotice('A new code is on its way') }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }
  function back() {
    if (step === 'code') { setStep('email'); setCode(''); setError(''); setNotice(''); return }
    onClose()
  }

  // Which chips to show (they flow in one wrapping row under the field - see Chip).
  const chips = step === 'code' ? [] : suggestions.length > 0
    ? suggestions.map(s => ({ label: s, onClick: () => { setEmail(s); setError('') } }))
    : showDomains
      ? DOMAINS.map(d => ({ label: d, onClick: () => applyDomain(d) }))
      : []

  return (
    // No dark scrim: node 1:193 draws none, and the Login screen behind is BLURRED instead (the user's
    // instruction). This layer only has to sit above that blurred content and catch its own taps.
    <div style={{ position: 'absolute', inset: 0, zIndex: 100 }}>

      {/* THE CARD IS ONE VERTICAL STACK (owner 2026-10-20: "sửa luôn chỗ chưa chuẩn guideline"). Fixed size
          (the old node 51:5 frame: --cw wide, 49.05dvh tall, from 10.19dvh) so it never jumps while chips come and
          go. Padding 24 top/bottom, 16 left/right. Title → 24 → field → 16 → chips / code note → flexible space
          → error → 16 → the button row (16 apart). Every gap is on the 8-grid. */}
      <div style={{
        position: 'absolute', left: 'var(--m)', top: '10.19dvh', width: 'var(--cw)', height: '49.05dvh',
        background: 'var(--color-white)', borderRadius: 16, boxShadow: 'var(--shadow-y2)',
        padding: 'calc(24 * var(--u)) calc(16 * var(--u))', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ textAlign: 'center', fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)' }}>
          {step === 'email' ? 'Log in with email' : 'Enter the code'}
        </div>

        <input
          key={step}
          type={step === 'email' ? 'email' : 'text'}
          inputMode={step === 'email' ? 'email' : 'numeric'}
          autoComplete={step === 'email' ? 'email' : 'one-time-code'}
          placeholder={step === 'email' ? 'example@gmail.com' : '6-digit code'}
          value={step === 'email' ? email : code}
          onChange={e => {
            if (step === 'email') setEmail(e.target.value)
            else setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            setError('')
          }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
          style={{
            marginTop: 'calc(24 * var(--u))', width: '100%', height: 'var(--input-h)', flexShrink: 0,
            background: 'var(--color-card)', border: 'none', borderRadius: 16,
            // The browser draws a BLACK FOCUS RING on an autofocused input. The design has no such line
            // anywhere, so it read as a drawing mistake rather than as focus. Killed here, not app-wide.
            outline: 'none',
            padding: '0 calc(16 * var(--u))', fontSize: 'var(--fs-content-1)', color: 'var(--color-black)',
          }} />

        {step === 'code' && (
          <div style={{ marginTop: 'calc(16 * var(--u))', fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>
            We sent a 6-digit code to <span style={{ color: 'var(--color-black)', fontWeight: 'var(--fw-semibold)', overflowWrap: 'anywhere' }}>{email.trim()}</span>. It expires in 10 minutes.
            <div style={{ marginTop: 'calc(8 * var(--u))' }}>
              <span onClick={resend} style={{ color: 'var(--color-brand)', fontWeight: 'var(--fw-semibold)', cursor: loading ? 'default' : 'pointer' }}>Resend code</span>
              {notice && <span style={{ marginLeft: 'calc(8 * var(--u))' }}>{notice}</span>}
            </div>
          </div>
        )}

        {chips.length > 0 && (
          <div style={{ marginTop: 'calc(16 * var(--u))', display: 'flex', flexWrap: 'wrap', gap: 'calc(8 * var(--u))' }}>
            {chips.map(c => <Chip key={c.label} label={c.label} onClick={c.onClick} />)}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {error && (
          <div style={{ marginBottom: 'calc(16 * var(--u))', fontSize: 'var(--fs-caption)', color: 'var(--color-error)' }}>
            {error}
          </div>
        )}

        {/* Back / Continue - radius 16, shadow Y2, App/Button 22. Back closes the popup (or returns to the email
            step) rather than navigating anywhere - the popup never was a screen. */}
        <div style={{ display: 'flex', gap: 'calc(16 * var(--u))', flexShrink: 0 }}>
          <button onClick={back}
            style={{
              flex: 1, height: 'var(--btn-h)',
              background: 'var(--btn-grad-white)', color: 'var(--color-black)', border: 'none', borderRadius: 16,
              boxShadow: 'var(--shadow-y2)',
              fontFamily: 'inherit', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer',
            }}>
            Back
          </button>
          <button onClick={handleSubmit} disabled={!valid || loading}
            style={{
              flex: 1, height: 'var(--btn-h)',
              background: valid && !loading ? 'var(--btn-grad-brand)' : 'var(--color-line)', color: valid && !loading ? 'var(--color-white)' : 'var(--color-muted)', border: 'none', borderRadius: 16,
              boxShadow: valid && !loading ? 'var(--shadow-y2)' : 'none',
              fontFamily: 'inherit', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)',
              cursor: valid && !loading ? 'pointer' : 'not-allowed',
            }}>
            {loading ? 'Processing...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
