import { useState, useEffect } from 'react'
import { useNav } from '../nav'
import Numpad from '../components/Numpad'
import Icon from '../components/Icon'
import { displaySymbol } from '../data'
import { useFitFontSize } from '../useFitFontSize'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { NET } from '../clientNet'
import { getTokenInfo, getTokenBalances, sumUsd } from '../chain'
import { ensureWalletAddress } from '../circle'

// Consistent with the Send screen: USD (friendly label, backed by USDC) by default + this network's tokens.
// 'USD' + exactly the tokens this network lists (src/network.js) - never a hard-coded token list.
const CURRENCIES = ['USD', ...Object.keys(NET.tokens)]
// USD is a FIAT LABEL, not a token - no coin logo for it (same rule as SendAmount.jsx).
const isFiatLabel = c => c === 'USD'
const tokenIconFor = c => (c === 'USD' ? 'usdc' : c.toLowerCase())

export default function CreateQR() {
  const { navigate, params } = useNav()
  const [digits, setDigits] = useState('')
  const [cur, setCur] = useState('USD')
  const [showCur, setShowCur] = useState(false)
  const [name, setName] = useState('')
  // Keyboard rule 07-23 (same as SendAmount): typing TEXT (the QR name field) → hide the app numpad, blur → show it again
  const [typingText, setTypingText] = useState(false)
  // From the QR library → creating also SAVES it to the library (with a NAME); from Receive → only shown to share, NOT saved.
  const fromLibrary = params?.from === 'SavedQRList'

  // Real balance - was a hard-coded "20.00" copied from Figma. USD = the wallet's TOTAL value in dollars (USDC + EURC
  // at today's rate, the same sum as Home's balance header - owner 2026-10-03); a token = that token's full balance
  // (this screen receives, nothing is held back for fees). A failed read keeps null ("…") and retries after 3s -
  // never a fake 0 (bug 07-17).
  const [balance, setBalance] = useState(null)
  useEffect(() => {
    setBalance(null)
    let alive = true, retry
    const read = a => (cur === 'USD'
      ? getTokenBalances(a).then(ts => sumUsd(ts))
      : getTokenInfo(a, cur).then(i => i.balance))
    const load = () => ensureWalletAddress()
      .then(a => (a ? read(a) : Promise.reject(new Error('no wallet address'))))
      .then(b => { if (alive) setBalance(b) })
      .catch(() => { if (alive) retry = setTimeout(load, 3000) })
    load()
    return () => { alive = false; clearTimeout(retry) }
  }, [cur])
  // Written in the unit picked above (owner 2026-10-03): USD → "$16.23" (total), USDC → "5.00 USDC", EURC → "10.00 EURC".
  const balNum = balance !== null ? Number(balance).toFixed(cur === 'cirBTC' ? 8 : 2) : '…'
  const balanceStr = cur === 'USD' ? displaySymbol('USDC') + balNum : `${balNum} ${cur}`

  const amount = parseFloat(digits || '0')
  const amountStr = (cur === 'USD' ? displaySymbol('USDC') : '') + digits
  const [fitRef, fitSize] = useFitFontSize(amountStr + '_', { max: 44, min: 18, weight: 300 })

  function handleKey(key) {
    if (key === 'BACK') { setDigits(d => d.slice(0, -1)); return }
    if (key === '.') { setDigits(d => (d.includes('.') ? d : (d === '' ? '0.' : d + '.'))); return }
    if (digits.length >= 12) return
    if (digits === '0') { setDigits(key); return }
    setDigits(d => d + key)
  }

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <div className="sheet-title">Create QR</div>

      {/* "You receive" card - node 18:84: rows 3-4 (340x156, top 20.38dvh, radius 16 - ONE row lower than
          Send money's "You send" card). Colour #D2DCE6 (var(--color-card)), matching every other card in
          this redesign. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '20.38dvh', height: '18.48dvh', background: 'var(--color-card)', borderRadius: 16 }} />

      <span style={{ position: 'absolute', left: '8.46%', top: '23.74dvh', transform: 'translateY(-50%)', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)' }}>You receive</span>

      {/* Chip - node 18:88: centre 29.6dvh. Figma draws a flat 24x24 BLACK SQUARE placeholder (18:89, no
          real icon layer) - a real token logo is used instead, EXCEPT for USD (a fiat label, not a token
          - no coin logo, same rule as SendAmount.jsx). */}
      <button onClick={() => setShowCur(true)}
        style={{ position: 'absolute', left: '8.46%', top: '29.6dvh', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', gap: 'calc(6 * var(--u))', border: 'none', background: 'var(--btn-grad-white)', borderRadius: 999, height: 'calc(42 * var(--u))', padding: '0 calc(14 * var(--u)) 0 calc(8 * var(--u))', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)', cursor: 'pointer' }}>
        {!isFiatLabel(cur) && <img src={`/tokens/${tokenIconFor(cur)}.png`} alt="" style={{ width: 'calc(24 * var(--u))', height: 'calc(24 * var(--u))', borderRadius: '50%', flexShrink: 0 }} />}
        {cur}
        <Icon name="down2" size="var(--is-content-2)" color="var(--color-brand)" />
      </button>

      {/* node 18:87: "Balance:" (not "Available:" - Receive's own wording, verbatim from Figma). */}
      <span style={{ position: 'absolute', left: '8.46%', top: '35.47dvh', transform: 'translateY(-50%)', fontSize: 'var(--fs-content-2)', whiteSpace: 'nowrap' }}>
        <span style={{ color: 'var(--color-muted-2)' }}>Balance: </span>
        <span className="num" style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)' }}>{balanceStr}</span>
      </span>

      {/* Amount - node 18:93: top-anchored at 26.92dvh, right-aligned to the same 8.46% inset, 44px Light
          (Figma draws Regular - the app's standing "big numbers are always Light" rule, same override
          Send money's amount uses). */}
      {/* Idle colour is --color-content (was --color-faint, #F1F5F9 - nearly invisible against white,
          user decision 2026-09-24: "ít ra phải màu đen" - the caret already signals "not typed yet",
          the currency symbol/digits don't also need to fade to near-invisible). */}
      <div ref={fitRef} style={{ position: 'absolute', left: '51%', right: '8.46%', top: '26.92dvh', textAlign: 'right' }}>
        <span className="num" style={{ fontSize: fitSize, fontWeight: 'var(--fw-light)', lineHeight: 1, whiteSpace: 'nowrap', color: 'var(--color-content)' }}>
          {amountStr}<span className="caret">_</span>
        </span>
      </div>

      {/* QR name field - Figma draws no such row (this state only exists when arriving FROM the QR
          library, which has no dedicated Figma frame) - kept, placed in the blank space between the card
          and the numpad panel. */}
      {fromLibrary && (
        <div className="memo-row" style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '44.5dvh' }}>
          <Icon name="pencil" size="var(--is-content-1)" color="var(--color-muted)" />
          <input className="memo-input" value={name} onChange={e => setName(e.target.value)} placeholder={'Name your QR'} maxLength={30}
            onFocus={() => setTypingText(true)} onBlur={() => setTypingText(false)} />
        </div>
      )}

      {/* GREY numpad panel - node 18:107 etc, same fixed 48px-key/8px-gap/27px-offset geometry as Send
          money's numpad (2026-09-10 correction there applies identically here - same component, same file). */}
      {/* position:relative - the ScreenSheet SVG (sibling, position:absolute) otherwise paints over this
          plain grid-row panel (same fix as SendAmount.jsx). */}
      {!typingText && (
      <div className="numpad-gray" style={{ position: 'relative', gridRow: '6 / 11', margin: '0 calc(-20 * var(--u)) 0', padding: 'calc(27 * var(--u)) 20px 0', background: 'var(--color-card)', borderRadius: '16px 16px 0 0' }}>
        <div style={{ height: 'calc(216 * var(--u))' }}>
          <Numpad onKey={handleKey} showComma />
        </div>
      </div>
      )}

      {/* The [Back][Continue] buttons - node 18:103/18:104/18:105/18:106: "Back"/"Continue" (was
          "Cancel"/"Create QR" - the exact Figma labels). Standard row10-dual position. */}
      <div className="row10-dual">
        <button className="btn btn-secondary" onClick={() => navigate(fromLibrary ? 'SavedQRList' : 'HomeReceive')}>Back</button>
        <button className="btn btn-primary" disabled={amount <= 0}
          onClick={() => navigate('ShowQR', { amount, currency: cur, name: name.trim(), saveToLibrary: fromLibrary, back: fromLibrary ? 'SavedQRList' : 'HomeReceive' })}>
          Continue
        </button>
      </div>

      {(typingText) && <ExitBar onClick={() => navigate(fromLibrary ? 'SavedQRList' : 'HomeReceive')} />}

      {showCur && (
        <div className="popup-overlay" onClick={() => setShowCur(false)}>
          <div className="popup-card" onClick={e => e.stopPropagation()}>
            <div className="popup-title">Select currency</div>
            {CURRENCIES.map(c => (
              <button key={c} onClick={() => { setCur(c); setShowCur(false) }}
                className={`btn ${c === cur ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%' }}>{c}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
