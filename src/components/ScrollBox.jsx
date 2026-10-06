import { useRef, useState, useLayoutEffect, useEffect } from 'react'

// A GREY BOX WITH A SCROLLING LIST (owner 2026-10-06) - shared by Lending, My deposits, Memes, About, Legal.
// - `header`: the box's title row, FIXED at the top of the box (never scrolls with the content).
// - The list fades ONLY on a side where there is more to scroll to: at the top of the list only the bottom edge fades,
//   in the middle both, at the end only the top; a list that fits fades nowhere ("My memes đang trống sao lại bị làm mờ").
// `style` = the box's position/size (absolute, on the grid); `listStyle` = padding/gap of the list.
export default function ScrollBox({ header, style, listStyle, children }) {
  const ref = useRef(null)
  const [edges, setEdges] = useState({ top: false, bottom: false })

  const measure = () => {
    const el = ref.current
    if (!el) return
    const top = el.scrollTop > 1
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1
    setEdges(e => (e.top === top && e.bottom === bottom ? e : { top, bottom }))
  }
  useLayoutEffect(measure)                       // after every render: the content may have grown or shrunk
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const F = 'calc(100dvh / 30)'                  // the app's fade length (Home / History)
  const mask = edges.top || edges.bottom
    ? `linear-gradient(to bottom, ${edges.top ? `transparent 0, black ${F}` : 'black 0'}, ${edges.bottom ? `black calc(100% - ${F}), transparent 100%` : 'black 100%'})`
    : 'none'

  return (
    <div style={{ border: 'none', borderRadius: 16, background: 'var(--color-card)', overflow: 'hidden', display: 'flex', flexDirection: 'column', ...style }}>
      {header && <div style={{ flexShrink: 0 }}>{header}</div>}
      <div ref={ref} onScroll={measure} className="scroll-hidden"
        style={{ flex: 1, minHeight: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', WebkitMaskImage: mask, maskImage: mask, ...listStyle }}>
        {children}
      </div>
    </div>
  )
}

// The standard box header: a title on the left, optional small text on the right (e.g. the data source).
export function BoxHeader({ title, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'calc(8 * var(--u))', padding: 'calc(12 * var(--u)) calc(16 * var(--u)) calc(8 * var(--u))' }}>
      <span style={{ fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)' }}>{title}</span>
      {right && <span style={{ fontSize: 'var(--fs-small)', color: 'var(--color-muted-2)', whiteSpace: 'nowrap' }}>{right}</span>}
    </div>
  )
}
