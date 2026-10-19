import { useRef, useState } from 'react'

// The % OF BALANCE slider (replacing the numeric keypad on the Swap screen - user decision 07-17: older/new users
// should not have to type digits, only drag "what share of my money").
//
// Behaviour (user spec):
// - FREE dragging, 1% precision.
// - MAGNET SNAP to the 5 marks 0/25/50/75/100 when the thumb falls within ±SNAP_ZONE% (user decision 07-17f -
//   it used to be 6 marks in steps of 20) → it feels like it "clicks" onto the mark.
// - Tapping/clicking anywhere on the track (marks included) → jumps straight there, no dragging needed.
// - % ONLY - no money labels ($0/$15/$29…) under the marks (user decision: redundant, cluttered).
//
// ⚠️ Built on POINTER EVENTS + setPointerCapture, NOT <input type=range>: range cannot be customised for marks or
// the bubble, and iOS requires dragging the thumb itself (tapping the track does not move it).
const MARKERS = [0, 25, 50, 75, 100]
// 2 DIFFERENT snap strengths by gesture (user decision 07-20d): CLICK/TAP = STRONG snap (±9%) to hit marks easily;
// WHILE DRAGGING = LIGHT snap (±2%) so it does not fight the drag (a strong magnet mid-drag pulls you off your value).
const SNAP_TAP = 9
const SNAP_DRAG = 2

// ⚠️ THE SLIDER INSET - DO NOT REMOVE (user decision 07-17c: "it has to respect the margin standard we defined").
// `.screen` leaves a 20px margin each side. If the track ran the full row width, everything ANCHORED AT 0%/100%
// (thumb, % bubble, the "0%"/"100%" labels) would be centred on the end points → HALF of each would stick out over
// the 20px margin and touch the screen edge (exactly the bug the user caught). Inset the track by EDGE px and the
// overhang stays inside those 20px: the "100%" label is ~40px wide → half = 20px = exactly the margin, thumb 26px → half = 13px < 20px.
const EDGE = 22

export default function PctSlider({ pct, onChange, onDragStart, onDragEnd, disabled }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  // screen x → % (0-100, rounded to 1%), with magnet snapping around the marks. snapZone = snap strength:
  // large (SNAP_TAP) on click, small (SNAP_DRAG) while dragging.
  function pctFromEvent(e, snapZone) {
    const r = trackRef.current.getBoundingClientRect()
    const raw = ((e.clientX - r.left) / r.width) * 100
    const clamped = Math.max(0, Math.min(100, raw))
    const snapped = MARKERS.find(m => Math.abs(clamped - m) <= snapZone)
    return snapped !== undefined ? snapped : Math.round(clamped)
  }

  function down(e) {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true); onDragStart?.()
    onChange(pctFromEvent(e, SNAP_TAP))   // the first touch counts as a click → strong snap
  }
  function move(e) { if (dragging && !disabled) onChange(pctFromEvent(e, SNAP_DRAG)) }   // dragging → light snap
  function up() { if (!dragging) return; setDragging(false); onDragEnd?.() }

  const dim = disabled ? 'var(--color-gray)' : 'var(--color-brand)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', userSelect: 'none', padding: `0 ${EDGE}px` }}>
      {/* The % bubble - follows the thumb. translateX(-50%) keeps the bubble centred on the thumb at EVERY position. */}
      <div style={{ position: 'relative', height: 'calc(30 * var(--u))', marginBottom: 'calc(2 * var(--u))' }}>
        <div style={{
          position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)',
          background: disabled ? 'var(--color-gray)' : 'var(--grad-brand)', color: 'var(--color-white)',
          borderRadius: 16, padding: 'calc(2 * var(--u)) calc(10 * var(--u))', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)',
          whiteSpace: 'nowrap', transition: dragging ? 'none' : 'left .15s ease',
        }}>
          {pct}%
        </div>
      </div>

      {/* The TOUCH area is 44px tall (fingers) while the drawn bar is thin - big hitbox, slim look */}
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ position: 'relative', height: 'calc(44 * var(--u))', display: 'flex', alignItems: 'center', cursor: disabled ? 'default' : 'pointer', touchAction: 'none' }}>
        <div ref={trackRef} style={{ position: 'relative', width: '100%', height: 'calc(4 * var(--u))', borderRadius: 2, background: 'var(--color-gray)' }}>
          {/* The selected portion */}
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: dim, borderRadius: 2, transition: dragging ? 'none' : 'width .15s ease' }} />
          {/* The 5 marks - bigger (07-20: 8→14) so older users can aim at them */}
          {MARKERS.map(m => (
            <div key={m} style={{
              position: 'absolute', left: `${m}%`, top: '50%', transform: 'translate(-50%,-50%)',
              width: 'calc(14 * var(--u))', height: 'calc(14 * var(--u))', borderRadius: '50%', background: pct >= m ? dim : 'var(--color-gray)',
            }} />
          ))}
          {/* Thumb */}
          <div style={{
            position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)',
            width: 'calc(26 * var(--u))', height: 'calc(26 * var(--u))', borderRadius: '50%', background: 'var(--color-white)',
            border: `3px solid ${dim}`, boxShadow: 'var(--shadow-y2)',   /* centred glow (was offset 0 1px) - the thumb IS draggable/clickable */
            transition: dragging ? 'none' : 'left .15s ease',
          }} />
        </div>
      </div>

      {/* % labels - bigger (07-20: fs-label 15 → fs-item 17) and TAPPABLE (tapping a label jumps to that mark,
          hitbox widened with 6px padding for older fingers). No money labels (user decision). */}
      <div style={{ position: 'relative', height: 'calc(26 * var(--u))', marginTop: 'calc(4 * var(--u))' }}>
        {MARKERS.map(m => (
          <span key={m} onClick={() => !disabled && onChange(m)} style={{
            position: 'absolute', left: `${m}%`, transform: 'translateX(-50%)', padding: 'calc(4 * var(--u)) calc(6 * var(--u))',
            fontSize: 'var(--fs-content-2)', color: pct === m ? 'var(--color-brand)' : 'var(--color-muted)',
            fontWeight: pct === m ? 'var(--fw-semibold)' : 'var(--fw-normal)', whiteSpace: 'nowrap',
            cursor: disabled ? 'default' : 'pointer', WebkitUserSelect: 'none', userSelect: 'none',
          }}>
            {m}%
          </span>
        ))}
      </div>
    </div>
  )
}
