import { useLayoutEffect, useRef, useState } from 'react'

let _measureCtx = null
function measureWidth(text, font) {
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d')
  _measureCtx.font = font
  return _measureCtx.measureText(text).width
}

// Amount font size AUTO-SHRINKS by REAL WIDTH measured with canvas.measureText - replacing the guess
// "N characters fit at size X" (the old amountFontSize): counting characters is wrong when the container is
// narrower than assumed (e.g. the Swap card shares a row with the token chip) → the number still overflows or
// gets cut with "…" even at an allowed character count (user 07-22: typing 1000000 still showed "100000…").
// ref goes on the container (the width the number is ALLOWED to take); returns the LARGEST size `text` fits at.
// The CSS design-pixel --u (index.css) as a plain factor: 1 on a >=844px-tall viewport, smaller below.
// Read off a probe element so JS and CSS can never disagree about it.
function designScale() {
  const el = document.createElement('div')
  el.style.cssText = 'position:absolute;visibility:hidden;width:calc(1000 * var(--u))'
  document.body.appendChild(el)
  const f = el.getBoundingClientRect().width / 1000
  el.remove()
  return f > 0 && f <= 1 ? f : 1
}

// 2026-10-20 (owner): the size STEPS through the design-system scale instead of any pixel value in between, and
// the paired line height comes back with it (same pairs as the --fs-*/--lh-* tokens in index.css).
export const FIT_SCALE = [14, 16, 18, 22, 28, 34, 48]
const FIT_LINE = { 14: 20, 16: 24, 18: 24, 22: 28, 28: 36, 34: 40, 48: 56 }

export function useFitFontSize(text, { max = 52, min = 16, weight = 300, family = 'Barlow, sans-serif', buffer = 4 } = {}) {
  const ref = useRef(null)
  const [fit, setFit] = useState({ step: max, f: 1 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      // clientWidth INCLUDES left/right padding (CSS: clientWidth = content + padding) - subtract it to get
      // the REAL width the text may occupy, otherwise the budget is too generous (the number still overflows /
      // gets ellipsised though it "fits" - bug 07-22e, a div with padding 2/12 for the touch area was not subtracted).
      // - buffer (default 4px): safety net for measurement error (e.g. the "_" caret has margin-left 2px in
      //   CSS but canvas.measureText knows nothing about it → the measurement comes up short, the real text is
      //   wider than computed → overflow/ellipsis though it "fits", bug 07-22f where 2px triggered the ellipsis
      //   for nothing). Subtract a little extra rather than accounting for every stray pixel of every child.
      const cs = getComputedStyle(el)
      const width = el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0) - buffer
      if (!width) return
      // max/min are DESIGN px - scale them with the viewport like every CSS size (--u)
      const f = designScale()
      const steps = FIT_SCALE.filter(s => s >= min && s <= max).reverse()
      const best = steps.find(s => measureWidth(text || '', `${weight} ${Math.round(s * f)}px ${family}`) <= width)
      setFit({ step: best ?? steps[steps.length - 1], f })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    window.addEventListener('resize', fit)   // a height-only change resizes nothing observed, but changes --u
    // Barlow loads through an ASYNC Google Fonts <link> (index.html) - if canvas measures BEFORE the font
    // finishes loading, it silently falls back to a system font (different widths) → the computed size is wrong.
    // Measure once more when the font is ready to self-correct (only affects the very first measurement on entry).
    if (document.fonts && !document.fonts.check(`${weight} 16px ${family}`)) {
      document.fonts.ready.then(fit)
    }
    return () => { ro.disconnect(); window.removeEventListener('resize', fit) }
  }, [text, max, min, weight, family])

  return [ref, Math.round(fit.step * fit.f), `${Math.round(FIT_LINE[fit.step] * fit.f)}px`]   // a px string: a bare number would be a multiplier
}
