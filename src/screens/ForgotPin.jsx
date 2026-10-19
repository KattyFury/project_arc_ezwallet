import { useState, useEffect, useRef } from 'react'
import { useNav } from '../nav'
import { refreshSession, forceFreshSession, isTokenExpiredError, getSDK, executeChallenge, restorePinChallenge, circleErrorMessage } from '../circle'
import logoLong from '../../design/logo.svg'
import { GRADIENT } from '../brandBg'

// FORGOT PIN - reached from Circle's own "Forgot PIN" button inside the PIN-entry iframe (wired in
// PinGate.jsx via sdk.setOnForgotPin). Structured exactly like PinGate.jsx (open Circle's iframe
// immediately on mount, logo-only while busy, error + retry only if it fails) because it IS the same
// kind of screen - the only difference is which Circle challenge gets opened.
//
// One challenge does the whole recovery: Circle's hosted UI asks the security questions THEN the new
// PIN, back to back, inside the SAME iframe - there is no separate "now set a new PIN" step to build.
export default function ForgotPin() {
  const { navigate, params } = useNav()
  const next = params?.next || 'HomeSend'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const tried = useRef(false)

  async function attemptRestore(forceFresh) {
    const { userToken, encryptionKey } = forceFresh ? await forceFreshSession() : await refreshSession()
    const challengeId = await restorePinChallenge(userToken)
    await executeChallenge(await getSDK(), userToken, encryptionKey, challengeId)
    // A completed restore challenge already re-authenticates the user (new PIN set + verified in one step) -
    // no reason to send them back through PinGate to enter the PIN they just finished setting.
    sessionStorage.setItem('ez_pin_ok', '1')
    navigate(next)
  }

  async function restore() {
    setBusy(true); setError('')
    try {
      await attemptRestore(false)
    } catch (e) {
      if (e?.code === 155701) { setBusy(false); return }   // user cancelled Circle's own modal → show the retry button
      if (isTokenExpiredError(e)) {
        try {
          await attemptRestore(true)
        } catch (e2) {
          if (e2?.code === 155701) { setBusy(false); return }
          if (isTokenExpiredError(e2) || e2?.message === 'no-session') { navigate('Login'); return }
          setError(circleErrorMessage(e2)); setBusy(false)
        }
        return
      }
      // 155111 "no security questions set" and 155120 "too many incorrect answers, locked" both come back
      // through circleErrorMessage() already worded - nothing extra to special-case here.
      setError(circleErrorMessage(e))
      setBusy(false)
    }
  }

  useEffect(() => { if (!tried.current) { tried.current = true; restore() } }, [])

  // Shared `.logo-lockup` on both states - see THE LOGO RULE in index.css (this screen used to draw its
  // own centred, 56%-wide copy, the same drift PinGate had).
  if (busy) {
    return (
      <div className="screen" style={{ background: GRADIENT }}>
        <img className="logo-lockup" src={logoLong} alt="ezwallet" />
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <img className="logo-lockup" src={logoLong} alt="ezwallet" />
      {error && (
        <div style={{ position: 'absolute', top: '34.72dvh', left: 'var(--m)', right: 'var(--m)', fontSize: 'var(--fs-content-1)', color: 'var(--color-error)', textAlign: 'center' }}>{error}</div>
      )}
      <div className="row-10 row10-dual">
        <button className="btn btn-secondary" onClick={() => navigate('PinGate', { next })}>Cancel</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={restore}>Try again</button>
      </div>
    </div>
  )
}
