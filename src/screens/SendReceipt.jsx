import { useEffect, useState } from 'react'
import { useNav } from '../nav'
import Icon from '../components/Icon'
import { fmtMoney, shortenAddr, fmtFee, getDisplayCurrency } from '../data'
import { addNotif } from '../notif'
import { saveImageFile } from '../saveImage'
import { getTxFeeUsd, getDisplayRates } from '../chain'
import logoLong from '../../design/logo.svg'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'

// Big GREEN check icon (success) - check.svg already includes the outlined circle and the tick.
// 70px (was 76) - node 1:238's exact placeholder size.
function CheckIcon() {
  return <Icon name="check" size="calc(70 * var(--u))" color="var(--color-primary)" />
}

function fmtTime(ts) {
  // en-GB, the same "27 Sept 2026, 14:05" style History uses (was vi-VN "27/09/2026" - an 08-25 leftover)
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SendReceipt() {
  const { navigate, params } = useNav()
  // Defaults to 'USD' (it used to be 'VND' - a leftover from when the app counted in VND). Since 08-04 VND is a REAL
  // currency, so a wrong default would render a receipt with a missing currency as Vietnamese money.
  // Reached ONLY after Circle reports the transaction COMPLETE (SendConfirm + txTracker, MAINNET-AUDIT C4).
  // amountStr = the exact string that was sent; txHash links the notification to History.
  const { address, name, amount, amountStr, memo, currency = 'USD', timestamp, txHash } = params
  const exact = amountStr ?? String(amount)
  const to = name || shortenAddr(address)
  // "$2" as one string in one style (NOT a bold "2" plus a regular "USD" - user decision)
  // An unverified token: its own symbol, never a $ (a spam token may call itself "USDC").
  const unv = typeof currency === 'string' && currency.startsWith('u:')
  const amountText = unv ? `${exact} ${params.tokenLabel || '?'}` : currency === 'VND' ? `${Number(amount).toLocaleString('vi-VN')} ₫` : fmtMoney(exact, currency)
  // The REAL token moved on-chain (USD = a label, USDC actually moves 1:1) - shown plainly on the receipt
  // so sender and recipient can reconcile the actual asset (nobody should read a label and assume another token).
  // ⚠️ VND is NOT a token: what actually moves is USDC, and the USDC figure ≠ the VND typed → you must use
  // params.tokenAmount (decided in SendAmount, forwarded by SendConfirm), never `amount`.
  const realToken = unv ? `${params.tokenLabel || '?'} (unverified)` : currency === 'USD' || currency === 'VND' ? 'USDC' : currency
  const realUnits = currency === 'VND' ? (params.tokenAmount ?? 0) : Number(amount)
  // The exact sent string (was toFixed(2): 0.004 showed as "0.00 USDC" - MAINNET-AUDIT H1). VND keeps its conversion.
  const realAmountText = `${currency === 'VND' ? realUnits.toFixed(2) : exact} ${realToken}`

  // Store the "sent" notification for HomeSend to show. dedupeKey is the timestamp (unique per real send)
  // → guards against duplication from React.StrictMode running the effect twice in dev mode.
  useEffect(() => {
    addNotif(`Sent ${amountText} to ${to}`, 'sent', txHash || null, `sent-${timestamp}`)
  }, [])

  // NETWORK FEE (owner 2026-10-03: the receipt had none) = what the transaction ACTUALLY paid (its on-chain receipt),
  // "…" until it is read - never SendConfirm's estimate, which is a maximum, not the charge (owner 2026-10-04).
  const [feeUsd, setFeeUsd] = useState(null)
  const [rates, setRates] = useState({})
  const displayCur = getDisplayCurrency()
  useEffect(() => {
    getDisplayRates().then(setRates).catch(() => {})
    getTxFeeUsd(txHash).then(f => { if (f != null) setFeeUsd(f) }).catch(() => {})
  }, [txHash])
  const feeText = feeUsd == null ? '…' : fmtFee(feeUsd, rates, displayCur)

  // Draw the receipt onto a canvas, then save it to the photo library
  async function saveReceipt() {
    // Height = bottom of the last row + 50 breathing space + logo + 22 margin (user decision 07-23: the logo used to
    // touch the last row's divider). 4 fixed rows (Send to, Amount, Network fee, Time) = 650; Address (only when
    // named) / Note add 60 each.
    const W = 620, H = 650 + (name && address ? 60 : 0) + (memo ? 60 : 0)
    const cv = document.createElement('canvas')
    cv.width = W; cv.height = H
    const x = cv.getContext('2d')
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H)
    // Big GREEN check icon (outlined circle + tick, same style as check.svg) - success
    x.strokeStyle = '#16A34A'; x.lineWidth = 8; x.lineCap = 'round'; x.lineJoin = 'round'
    x.beginPath(); x.arc(W / 2, 90, 44, 0, Math.PI * 2); x.stroke()
    x.beginPath(); x.moveTo(W / 2 - 20, 90); x.lineTo(W / 2 - 6, 105); x.lineTo(W / 2 + 22, 73); x.stroke()
    x.textAlign = 'center'
    x.fillStyle = '#000000'; x.font = '600 32px sans-serif'; x.fillText('Sent successfully', W / 2, 180)
    x.fillStyle = '#0B53BF'; x.font = '700 52px sans-serif'; x.fillText(amountText, W / 2, 245)
    // the rows
    let yy = 320
    const row = (label, val) => {
      x.textAlign = 'left'; x.fillStyle = '#667085'; x.font = '22px sans-serif'; x.fillText(label, 50, yy)
      x.textAlign = 'right'; x.fillStyle = '#000000'; x.font = '500 22px sans-serif'; x.fillText(val, W - 50, yy)
      x.strokeStyle = '#D2DCE6'; x.lineWidth = 1; x.beginPath(); x.moveTo(50, yy + 22); x.lineTo(W - 50, yy + 22); x.stroke()
      yy += 60
    }
    row('Send to', to)
    if (name && address) row('Address', shortenAddr(address))   // shortened; only when Send to = a contact name
    row('Amount', realAmountText)
    if (memo) row('Note', memo)
    row('Network fee', feeText)
    row('Time', fmtTime(timestamp))
    // The ezwallet logo (the standard branding - design/logo.svg, brand-blue EZ + black wallet) at the bottom -
    // anchored to the canvas BOTTOM, H already reserves 50px of breathing space after the last row (keep the logo off the divider)
    const lw = 168, lh = lw * 71 / 201   // aspect ratio of logo.svg (viewBox 201×71)
    const img = new Image()
    img.src = logoLong
    try { await img.decode() } catch {}
    x.drawImage(img, (W - lw) / 2, H - 22 - lh, lw, lh)
    saveImageFile(cv, `receipt-${timestamp}.png`)   // phone → share sheet (Save Image → Photos), computer → download
  }

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <div className="sheet-title">Transaction completed</div>

      {/* HEADER + CARD AS ONE COLUMN (owner 2026-10-03). The card used to be a FIXED 3-row box (28.67dvh = 242px,
          centre 55.09dvh) while a receipt has 4-6 rows → the first (Send to) and last (Time) rows were clipped, leaving
          their dividers as stray lines, and the fee was missing. Now: the card grows with its rows exactly like
          SendConfirm's (same .confirm-box/.confirm-row, same row ORDER: Send to, Address, Amount, Note, Network fee,
          + Time), and the header sits above it, so nothing can overlap. Starts at row 2 (86px = 10.19dvh, the same
          top every sheet card uses); the 6-row worst case still ends above the buttons. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '10.19dvh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <CheckIcon />
        <span style={{ marginTop: 'calc(8 * var(--u))', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-content)', lineHeight: 1.2 }}>
          Sent successfully
        </span>
        <span className="num" style={{ fontSize: 'var(--fs-amount-2)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)', lineHeight: 1.2 }}>
          {amountText}
        </span>
        <div className="confirm-box" style={{ marginTop: 'calc(16 * var(--u))' }}>
          <div className="confirm-row">
            <span className="confirm-label">Send to</span>
            <span className="confirm-value">{to}</span>
          </div>
          {/* SHORTENED address, only when Send to is a contact NAME (otherwise Send to already is the address). */}
          {name && address ? (
            <div className="confirm-row">
              <span className="confirm-label">Address</span>
              <span className="confirm-value num">{shortenAddr(address)}</span>
            </div>
          ) : null}
          <div className="confirm-row">
            <span className="confirm-label">Amount</span>
            <span className="confirm-value num" style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)' }}>{realAmountText}</span>
          </div>
          {memo ? (
            <div className="confirm-row">
              <span className="confirm-label">Note</span>
              <span className="confirm-value">{memo}</span>
            </div>
          ) : null}
          <div className="confirm-row">
            <span className="confirm-label">Network fee</span>
            <span className="confirm-value num">{feeText}</span>
          </div>
          <div className="confirm-row">
            <span className="confirm-label">Time</span>
            <span className="confirm-value">{fmtTime(timestamp)}</span>
          </div>
        </div>
      </div>

      {/* Save receipt/Done - node 1:230-1:233: both exactly 166px, i.e. (340 − 8) / 2 - flex:1 with an
          8px gap. Centre 85.63dvh, glow shadow. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '85.66dvh', transform: 'translateY(-50%)', display: 'flex', gap: 'calc(8 * var(--u))' }}>
        <button className="btn btn-secondary" style={{ flex: 1, boxShadow: '0 8px 8px rgba(0, 0, 0, 0.48)' }} onClick={saveReceipt}>Save receipt</button>
        <button className="btn btn-primary" style={{ flex: 1, boxShadow: '0 8px 8px rgba(0, 0, 0, 0.48)' }} onClick={() => navigate('HomeSend')}>Done</button>
      </div>

      <ExitBar onClick={() => navigate('HomeSend')} />
    </div>
  )
}
