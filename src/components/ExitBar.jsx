// EXIT BAR - the footer action on every ScreenSheet(no tab) sub-screen.
// Owner 2026-10-03: no more blue row 10 - the sheet now covers the whole screen (ScreenSheet), and Exit is RED text on
// white, filling row 10 exactly (774-844px = 91.71dvh / 8.29dvh) and centred both ways (flex + line-height 1).
export default function ExitBar({ onClick }) {
  return (
    <button onClick={onClick} style={{
      position: 'absolute', left: 0, right: 0, top: '91.71dvh', height: '8.29dvh',
      display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
      fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-error)',
    }}>
      Exit
    </button>
  )
}
