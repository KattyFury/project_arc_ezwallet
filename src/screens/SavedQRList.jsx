import { useState } from 'react'
import { useNav } from '../nav'
import { QRCodeSVG } from 'qrcode.react'
import Icon from '../components/Icon'
import { loadSavedQRs, saveSavedQRs } from '../store'
import { buildQR, qrAmountLabel } from '../qr'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'

export default function SavedQRList() {
  const { navigate } = useNav()
  const [list, setList] = useState(loadSavedQRs)
  const [pendingDelete, setPendingDelete] = useState(null)   // the QR awaiting delete confirmation (user decision 07-20e)
  const walletAddr = localStorage.getItem('ez_wallet_addr') || ''
  // ADD = the Create QR screen with the currency picker + an optional name (owner 2026-10-06; the old popup had no
  // currency choice and always saved USD). ShowQR saves it to this library and Done/Exit come back here.
  const addQR = () => navigate('CreateQR', { from: 'SavedQRList' })

  // Tapping × → OPEN A CONFIRMATION POPUP (no instant delete - guards against mis-taps, like Delete contact)
  function askDelete(q, e) { e.stopPropagation(); setPendingDelete(q) }
  function confirmDelete() {
    const updated = list.filter(q => q.id !== pendingDelete.id)
    setList(updated); saveSavedQRs(updated); setPendingDelete(null)
  }

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <div className="sheet-title">QR storage</div>

      {/* The QR area = a large GREY BOX over rows 2-8 (user decision 07-23, matching the History box style) · a 2-COLUMN grid
          (3 columns made the QRs too small) → bigger QRs and bigger text for older eyes. Each QR = a WHITE box raised off the
          grey: 1.5 grey border (the "tappable inside a grey box" rule) + a DROP SHADOW like a button (07-22d,
          white = alpha .25). The delete X sits top-right. With many QRs the box scrolls. */}
      {/* OUTER grey box (padding 10 = the white boxes sit exactly 10px from the left/right/top edges, user decision 07-23b)
          + INNER scrolling via .scroll-hidden. ⚠️ Do NOT use .scroll-thin INSIDE a grey box: that class has
          margin-right -20px (a trick for full-bleed lists) → content overflows to the right; desktop has scrollbar-gutter
          to compensate so it looks fine, but iOS does NOT support it → broken layout (the mobile bug reported 07-23b). */}
      {/* Card radius 16 (was 20) - node 1:311, RE-VERIFIED 2026-09-10.
          ⚠️ ABSOLUTE, not gridRow '2 / 9' (fixed 2026-09-27): as a plain grid item it painted UNDER the
          absolutely-positioned ScreenSheet, so the grey box was invisible (user report). Same 340x586
          card at (25,86) as Security/About. padding 8 = QR tiles sit 8px from the box edge (user decision 2026-09-27). */}
      <div style={{ position: 'absolute', left: '6.41%', top: '10.19dvh', width: '87.18%', height: '69.43dvh', background: 'var(--color-card)', borderRadius: 16, padding: 'calc(8 * var(--u))', overflow: 'hidden' }}>
      <div className="scroll-hidden" style={{ height: '100%' }}>
        {/* ⚠️ RIGHT COLUMN minmax(0,1fr) - with a bare '1fr' the content dictates min-width, and one big box blows the column
            open (the same lesson as .screen, section 6). Bug the user screenshotted 07-23c: 3 QRs → row 2 = [Blend | + button],
            and the + button with aspectRatio 1 was stretched as tall as the Blend box → so it INFLATED SIDEWAYS → the 2 columns went badly uneven. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'calc(8 * var(--u))', alignContent: 'start' }}>
          {list.map(q => {
            const c = q.currency || 'USD'
            const label = qrAmountLabel(q.amount, c)   // in the QR's own unit - "5 USDC", not "$5" (owner 2026-10-06)
            return (
              // View a saved QR (it is not re-saved), Back returns to the QR library. Tile - node 18:171/
              // 18:181/18:186, RE-VERIFIED 2026-09-10: fixed 242px tall (was a dynamic minHeight:190), NO
              // border (was 1.5px grey), glow shadow matching the app's clickable-element rule (was the old
              // straight drop-shadow). Name is BLACK 16px semibold (was brand-blue 17px - that colour
              // belongs to the amount line only), amount stays brand-blue 18px semibold (was 15px).
              <button key={q.id} onClick={() => navigate('ShowQR', { amount: q.amount, currency: c, name: q.name, fromStorage: true, saveToLibrary: false, back: 'SavedQRList' })}
                style={{ position: 'relative', minWidth: 0, height: 'calc(242 * var(--u))', border: 'none', borderRadius: 16, background: 'var(--btn-grad-white)', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.48)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'calc(6 * var(--u))', padding: 'calc(16 * var(--u)) calc(10 * var(--u)) calc(12 * var(--u))', fontFamily: 'inherit' }}>
                <span onClick={e => askDelete(q, e)} style={{ position: 'absolute', top: 'calc(8 * var(--u))', right: 'calc(8 * var(--u))', display: 'flex' }}><Icon name="x" size="calc(16 * var(--u))" color="var(--color-muted)" /></span>
                {/* THE QR SCALES WITH THE BOX (user decision 07-23b "do not fix the size, follow the grey"): a square frame with
                    aspectRatio 1 taking the full box width (minus 20px of margin and room for the X, matching
                    Figma's 138px QR inside a 158px tile), svg fill 100% (the viewBox scales, no distortion);
                    flexShrink 0 stops the grid squashing it (the old distortion bug). */}
                {/* 118 DESIGN px square (was alignSelf:stretch = the tile's WIDTH): the tile height scales with the
                    viewport (--u) but its width does not, so a width-driven QR pushed the amount out of a short tile. */}
                <div style={{ width: 'calc(118 * var(--u))', flexShrink: 0 }}>
                  {/* height auto = the svg keeps itself square via the viewBox (forcing height 100% was 3px off) */}
                  <QRCodeSVG value={buildQR(walletAddr, { amount: q.amount, currency: c })} size={104} level="M" style={{ width: '100%', height: 'auto', display: 'block' }} />
                </div>
                {/* Name area ALWAYS reserves 2 lines (user decision 2026-09-27) so every tile lines up; a
                    short name is centred vertically inside it, a long one wraps to 2 lines then clamps with "…". */}
                <span style={{ height: 'calc(42 * var(--u))', width: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 'var(--fs-content-2)', lineHeight: 'calc(21 * var(--u))', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)', textAlign: 'center', overflowWrap: 'anywhere', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{q.name}</span>
                </span>
                <span className="num" style={{ fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)' }}>{label}</span>
              </button>
            )
          })}
          {/* The + tile → Create QR (from the library: currency picker + name). Node 18:191: SAME fixed 242px height as
              the QR tiles (was minHeight:190, an aspect-ratio approximation) - Do NOT use aspectRatio (bug
              07-23c: aspectRatio plus stretch inflated it sideways). */}
          <button onClick={addQR}
            style={{ minWidth: 0, height: 'calc(242 * var(--u))', border: '2px dashed var(--color-muted)', borderRadius: 16, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="add" size="calc(40 * var(--u))" color="var(--color-muted)" />
          </button>
        </div>
      </div>
      </div>

      {/* A WHITE Back (left) + BLUE Add (right) pair following the .row10-dual standard (user decision 07-29, replacing
          the old .row10-single blue Back): Add opens the same add-QR popup as the "+" tile in the grid - adding a QR is
          the main action of this screen, so it needs a button in row 9 rather than making people scroll to find "+". */}
      <div className="row10-dual">
        <button className="btn btn-secondary" onClick={() => navigate('HomeReceive')}>Back</button>
        <button className="btn btn-primary" onClick={addQR}>Add</button>
      </div>

      <ExitBar onClick={() => navigate('HomeReceive')} />

      {/* QR delete confirmation - standard popup (centred over rows 1-6). "Delete QR: <name>" (no name → the amount) */}
      {pendingDelete && (
        <div className="popup-overlay" onClick={() => setPendingDelete(null)}>
          <div className="popup-card" style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="popup-title">{'Delete QR:'} {pendingDelete.name || qrAmountLabel(pendingDelete.amount, pendingDelete.currency || 'USD')}</div>
            <div className="popup-actions" style={{ marginTop: 'calc(4 * var(--u))' }}>
              <button className="btn btn-secondary" onClick={() => setPendingDelete(null)}>Back</button>
              <button className="btn btn-error" onClick={confirmDelete}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
