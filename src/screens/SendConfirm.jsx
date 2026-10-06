import { useState, useEffect, useRef } from 'react'
import { addNotif } from '../notif'
import { useNav } from '../nav'
import { getDisplayCurrency, displaySymbol, shortenAddr, fmtFee } from '../data'
import { getDisplayRates } from '../chain'
import { getSDK, executeChallenge, refreshSession, circleErrorMessage, estimateSendFee } from '../circle'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { assertNetworkReady } from '../clientNet'
import { newAttempt, getPending, clearPending, lookup, classify, waitFinal } from '../txTracker'
import { fmtAmountShort } from '../money'
// A token amount for display: 6 significant digits, "≈" when cut (owner 2026-10-06). The exact string is what gets sent.
const shortAmt = (str) => (({ text, cut }) => (cut ? '≈ ' : '') + text)(fmtAmountShort(str))

// Currency symbols / token names use Barlow (--font-condensed); numbers stay Barlow via .num
function Cur({ children }) {
  return <span style={{ fontFamily: 'var(--font-condensed)', fontWeight: 'var(--fw-medium)' }}>{children}</span>
}

export default function SendConfirm() {
  const { navigate, params } = useNav()
  // currency = 'USD' (the friendly label, USDC is sent) or a real token (USDC/EURC/cirBTC) - comes from SendAmount.
  const { address, name, amount, amountStr, memo, currency = 'USD' } = params
  const [feeUsd, setFeeUsd] = useState(null)      // Circle's MAXIMUM fee for this send (USD, null = still asking)
  const [feeFailed, setFeeFailed] = useState(false)
  // A separate rate for the FEE (USD per unit of the display currency - USDC:1, EURC:~1.08)
  const [feeRates, setFeeRates] = useState({ USDC: 1 })   // live rates only - no guessed EURC/VND
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)         // sent successfully → locked, no resending
  const [error, setError] = useState('')          // a terminal error (cancel/network...) shown in place
  const [qrCheck, setQrCheck] = useState(false)    // the extra "is this right?" popup for a big QR amount is open
  const [qrChecked, setQrChecked] = useState(false) // ...and the user said yes (asked once per payment)
  // AUTO-CONVERT (docs/SWAP-PLAN.md section 6): SendAmount found the USDC short → the server plans swaps from the other
  // tokens into THIS payment. convertLegs = what it will swap ([{ token, amountIn, minOut }]), shown as "Converted" and
  // sent back on Confirm exactly as shown. recheck bumps when the price/fee moved and the plan must be asked again.
  const allowConvert = !!params.convert
  const [convertLegs, setConvertLegs] = useState(null)
  const [recheck, setRecheck] = useState(0)

  // USD = USDC (1:1, only the label differs); USDC/EURC/cirBTC send exactly the amount entered, with NO conversion.
  // VND = fiat, which does NOT exist on-chain → USDC is sent.
  // An unverified token (owner 2026-10-05) arrives as 'u:<address>' + its symbol in tokenLabel; the server gets the address.
  const unv = typeof currency === 'string' && currency.startsWith('u:')
  const tokenLabel = unv ? `${params.tokenLabel || '?'}` : null
  const token = unv ? currency.slice(2) : currency === 'USD' || currency === 'VND' ? 'USDC' : currency
  // ⚠️⚠️ VND: REUSE the exact token amount SendAmount settled on (params.tokenAmount), NEVER re-convert
  // from the rate on this screen. Rates move constantly (CoinGecko refreshes every 60s) - converting a second
  // time makes the number the user just saw ("≈ 19.00 USDC") differ from the one that ACTUALLY leaves the wallet.
  // People must get exactly what they confirmed.
  const sendUnits = currency === 'VND' ? (params.tokenAmount ?? 0) : amount
  // MAINNET-AUDIT H1: send EXACTLY the string the user typed/confirmed (validated again by the server) - the old
  // toFixed(2) turned "0.004" into "0.00". VND is unreachable (see HANDOFF §4) and keeps its old conversion.
  const sendAmountStr = currency === 'VND' ? sendUnits.toFixed(2) : (amountStr ?? String(amount))

  useEffect(() => {
    // getDisplayRates (not the per-token getUsdRate) - it includes VND, and VND is not a token
    // so getUsdRate looking through TOKENS would not find it.
    getDisplayRates().then(setFeeRates).catch(() => {})
    // The fee of THIS send from Circle (estimateFee on the exact call /api/send will make). A failure says so - it used
    // to become a fee of 0 ("< $0.001"), a number nobody measured.
    setFeeFailed(false); setFeeUsd(null); setConvertLegs(null)
    estimateSendFee({ toAddress: address, token, amountDecimal: sendAmountStr, memo, allowConvert })
      .then(f => { const v = Number(f.feeMax); if (v > 0) setFeeUsd(v); else setFeeFailed(true); setConvertLegs(f.convert || null) })
      // A convert send cannot go ahead without its plan - say why (not enough money / no USDC for the fee).
      .catch(e => { setFeeFailed(true); if (allowConvert) setError(e.message) })
  }, [memo, token, address, sendAmountStr, allowConvert, recheck])
  // The plan arrives with the fee. A fee without a plan = the server found enough USDC after all (a plain send).
  const convertReady = !allowConvert || feeUsd !== null

  const mainEl = currency === 'USD' ? <>{displaySymbol('USDC')}{sendAmountStr}</>
    : currency === 'VND' ? <>{amount.toLocaleString('vi-VN')} <Cur>₫</Cur></>
    : <>{shortAmt(sendAmountStr)} <Cur>{unv ? tokenLabel : currency}</Cur></>

  // QR SAFETY (mainnet v1 plan item 2 (2026-09-27, deleted doc - git history)): an amount a QR put there (untouched - SendAmount's qrActive) worth more than
  // $100 needs one more explicit "yes" before the PIN. A forged or swapped QR is the easiest way to trick someone
  // into a big payment.
  const QR_CHECK_OVER_USD = 100
  // Unknown live price → treat as over the limit (one extra "yes"), never as $1 per token.
  const usdValue = token === 'USDC' ? Number(sendAmountStr) : feeRates[token] > 0 ? Number(sendAmountStr) * feeRates[token] : Infinity
  const needsQrCheck = !!params.qrAmount && usdValue > QR_CHECK_OVER_USD && !qrChecked

  // Network fee in the DEFAULT CURRENCY from Settings (USDC/EURC/VND)
  const displayCur = getDisplayCurrency()
  function feeEl() {
    if (feeUsd === null) return feeFailed ? 'Unavailable' : 'Calculating...'
    // Circle's figure is the MAXIMUM (networkFee) - the real charge is lower and the receipt shows it.
    return `up to ${fmtFee(feeUsd, feeRates, displayCur)}`   // ≤ 3 decimals - see fmtFee in src/data.js
  }

  // The attempt this screen created (refId + timestamps) - see src/txTracker.js.
  const attemptRef = useRef(null)
  const [status, setStatus] = useState('')        // the line under the card while working ("Checking…")

  // A final, successful payment → lock the screen and show the receipt (only now - MAINNET-AUDIT C4).
  function finishOk(tx) {
    clearPending(attemptRef.current?.refId)
    setDone(true)
    navigate('SendReceipt', { address, name, amount, amountStr: sendAmountStr, memo, currency, tokenLabel, tokenAmount: sendUnits, txHash: tx?.txHash || null, timestamp: Date.now() })
  }
  function fail(msg) {
    setLoading(false); setStatus(''); setError(msg); addNotif(msg, 'error')
  }
  // The payment exists but is not final yet (or we could not ask) → NEVER offer a plain resend (MAINNET-AUDIT C3).
  function stuck() {
    setLoading(false); setStatus('')
    setError('This payment is still being confirmed. Do NOT send it again - tap "Check again" in a moment, or look in Transaction history.')
  }

  async function handleConfirm() {
    if (loading || done) return   // block repeat taps / duplicate sends
    setLoading(true); setError('')
    try {
      // Refuse before any challenge exists if the server's network/contracts do not check out (MAINNET-AUDIT C2).
      await assertNetworkReady()

      // 1. Never start a payment while an earlier one's fate is unknown - this screen's retry, or one left
      //    unresolved when the app was closed (MAINNET-AUDIT C3).
      const prev = attemptRef.current || getPending()
      if (prev) {
        setStatus('Checking your previous payment…')
        let r
        try { r = classify(await lookup(prev)) } catch { return stuck() }
        if (r === 'pending') {
          const w = await waitFinal(prev, { timeoutMs: 30000 })
          r = w.outcome === 'ok' ? 'ok' : w.outcome === 'failed' ? 'failed' : 'pending'
          if (r === 'pending') return stuck()
        }
        if (r === 'ok' && prev === attemptRef.current) return finishOk(await lookup(prev).catch(() => null))
        if (r === 'ok') {   // an EARLIER payment (another screen/session) went through - make them look first
          clearPending(prev.refId)
          return fail('Your previous payment went through. Check Transaction history before sending again.')
        }
        clearPending(prev.refId)   // 'failed' or never created → nothing left the wallet, safe to go on
        attemptRef.current = null
      }

      // 2. A new attempt. Its refId is stored on the Circle transaction (server passes it through).
      const attempt = newAttempt('send', { address, amount: sendAmountStr, token })
      attemptRef.current = attempt
      setStatus('Opening PIN confirmation…')
      // Refresh the userToken before sending - avoids "userToken had expired" when
      // the app has been open a while (Circle userTokens live ~1 hour).
      const { userToken, encryptionKey } = await refreshSession()
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userToken, walletId: attempt.walletId,
          toAddress: address, token, amountDecimal: sendAmountStr, memo,
          idempotencyKey: crypto.randomUUID(), refId: attempt.refId,
          allowConvert, convert: convertLegs,
        }),
      })
      const data = await res.json()
      if (data.error) {
        // No challenge → no transaction can exist. Safe to retry.
        clearPending(attempt.refId); attemptRef.current = null
        if (data.code === 'RECHECK') { setRecheck(n => n + 1); return fail(data.error) }   // price/fee moved → new plan shown
        return fail(`Send failed: ${data.error}`)
      }

      // 3. The PIN. A wrong PIN is retried inside Circle's iframe and never rejects (circle.js).
      let signError = null
      try {
        await executeChallenge(await getSDK(), userToken, encryptionKey, data.challengeId)
      } catch (e) {
        if (e?.code === 155701) {   // the user closed the PIN screen → nothing was signed, back to Confirm silently
          clearPending(attempt.refId); attemptRef.current = null
          setLoading(false); setStatus('')
          return
        }
        signError = e   // may or may not have been signed - FIND OUT below, never assume "failed"
      }

      // 4. The real outcome, from Circle's record of THIS transaction.
      setStatus('Confirming on the network…')
      const { outcome, tx } = await waitFinal(attempt, { timeoutMs: signError ? 30000 : 90000 })
      if (outcome === 'ok') return finishOk(tx)
      if (outcome === 'failed') {
        clearPending(attempt.refId); attemptRef.current = null
        return fail('The network rejected this payment - no money left your wallet. You can try again.')
      }
      if (outcome === 'none' && signError) {
        // The PIN step broke before anything was signed (no transaction exists) → a genuine, retryable failure.
        clearPending(attempt.refId); attemptRef.current = null
        console.error('[SendConfirm] send failed:', signError)
        return fail(`Send failed: ${circleErrorMessage(signError)}`)
      }
      return stuck()   // exists but not final, or Circle could not be asked - keep it blocked
    } catch (e) {
      console.error('[SendConfirm] send failed:', e)
      // Anything unexpected while an attempt is open is treated as "unknown", not "failed".
      if (attemptRef.current) return stuck()
      fail(`Send failed: ${circleErrorMessage(e)}`)
    }
  }

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <div className="sheet-title">Confirm transaction</div>

      {/* Card - node 1:223, RE-VERIFIED 2026-09-10 (the user redrew this frame): rows 3-5 exactly
          (centre 34.72dvh, height 242px = 3×70+2×16, was 328px/4 rows - the frame shrank one row when
          the warning box below became a real, separately-positioned element instead of loose flow).
          Anchored by its CENTRE, not stretched to fill - `justify-content:center` inside lets the
          (rare) 4-row case grow past 242px slightly rather than clipping, while the common 3-row case
          matches the Figma box exactly. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '34.72dvh', transform: 'translateY(-50%)' }}>
        <div className="confirm-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="confirm-row">
            <span className="confirm-label">Send to</span>
            <span className="confirm-value">{name || shortenAddr(address)}</span>
          </div>
          {name && (
            <div className="confirm-row">
              <span className="confirm-label">Address</span>
              <span className="confirm-value">{shortenAddr(address)}</span>
            </div>
          )}
          <div className="confirm-row">
            <span className="confirm-label">Amount</span>
            <span className="confirm-value num" style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)' }}>
              {mainEl}
            </span>
          </div>
          {/* VND: spell out the real USDC amount leaving the wallet - the user types Vietnamese money but what moves
              on-chain is USDC, and hiding that is deceptive. This is the number settled on the previous screen, never recomputed. */}
          {currency === 'VND' && (
            <div className="confirm-row">
              <span className="confirm-label">Actually sent</span>
              <span className="confirm-value num">
                {sendAmountStr} USDC
              </span>
            </div>
          )}
          {convertLegs && (
            <div className="confirm-row">
              <span className="confirm-label">Converted</span>
              <span className="confirm-value num">
                {convertLegs.map(l => <span key={l.token} style={{ display: 'block' }}>{l.amountIn} <Cur>{l.token}</Cur></span>)}
              </span>
            </div>
          )}
          {unv && (
            // UNVERIFIED token (owner 2026-10-05): one yellow line, never blocks.
            <div className="confirm-row" style={{ justifyContent: 'center', color: 'var(--color-warning)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-caption)', textAlign: 'center' }}>
              Unverified token - make sure the receiver expects it
            </div>
          )}
          {memo && (
            <div className="confirm-row">
              <span className="confirm-label">Note</span>
              <span className="confirm-value">{memo}</span>
            </div>
          )}
          <div className="confirm-row">
            <span className="confirm-label">Network fee</span>
            <span className="confirm-value num">
              {feeEl()}
            </span>
          </div>
        </div>
        {/* Status / error line - ANCHORED TO THE CARD'S BOTTOM EDGE, 16px below it (owner 2026-10-03). It used to sit
            at a fixed top:52dvh, so a taller card (name + note rows) ran over it. Absolute inside the card wrapper so
            it never shifts the centred card. Working status = brand blue (was grey), errors stay red. */}
        {(loading || error) && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 'calc(16 * var(--u))', textAlign: 'center', fontSize: 'var(--fs-caption)' }}>
            {loading
              ? <span style={{ color: 'var(--color-brand)', fontWeight: 'var(--fw-medium)' }}>{status || 'Working…'}</span>
              : <span style={{ color: 'var(--color-error)' }}>{error}</span>}
          </div>
        )}
      </div>

      {/* The "cannot be undone" warning box is GONE - the user (2026-09-10) called it out as invented
          drama ("vẽ chuyện ra cho rắc rối") for a wallet with no bank-style reversal in the first place,
          and the re-fetched Figma (node 1:215) agrees: the frame no longer has ANY warning node at all,
          not just a redrawn one. Nothing replaces it - the card sits alone above the buttons now. */}

      {/* Back/Confirm PIN - node 58:298/58:294: ~166px each, i.e. (340 − 8) / 2 - flex:1 with an 8px gap.
          Centre 85.66dvh, glow shadow. "Back" (was "Edit") per the exact Figma label - functionally
          unchanged, still re-opens SendAmount with the same params to adjust the transaction. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '85.66dvh', transform: 'translateY(-50%)', display: 'flex', gap: 'calc(8 * var(--u))' }}>
        <button className="btn btn-secondary" style={{ flex: 1, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.48)' }} disabled={loading || done} onClick={() => navigate('SendAmount', params)}>Back</button>
        <button className="btn btn-primary" style={{ flex: 1, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.48)' }}
          disabled={loading || done || !convertReady} onClick={() => (needsQrCheck && !attemptRef.current ? setQrCheck(true) : handleConfirm())}>
          {loading ? 'Processing...' : (attemptRef.current ? 'Check again' : 'Confirm PIN')}
        </button>
      </div>

      {qrCheck && (
        <div className="popup-overlay" onClick={() => setQrCheck(false)}>
          <div className="popup-card" onClick={e => e.stopPropagation()}>
            <div className="popup-title">Check this amount</div>
            <p style={{ margin: 0, fontSize: 'var(--fs-content-2)', lineHeight: 1.4 }}>
              This QR code asks you to send <b className="num">{mainEl}</b> to <b>{name || shortenAddr(address)}</b>.
              Only continue if you know who this is and you expected to pay this amount.
            </p>
            <div className="popup-actions">
              <button className="btn btn-secondary" onClick={() => setQrCheck(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { setQrCheck(false); setQrChecked(true); handleConfirm() }}>Yes, continue</button>
            </div>
          </div>
        </div>
      )}

      <ExitBar onClick={() => navigate('HomeSend')} />
    </div>
  )
}
