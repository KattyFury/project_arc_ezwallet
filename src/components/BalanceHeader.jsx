import { useState, useEffect } from 'react'
import { getDisplayCurrency, fmtDisplay } from '../data'
import { getDisplayRates, cachedRates } from '../chain'
import { useFitFontSize } from '../useFitFontSize'

// Shared balance block for HomeSend / HomeReceive / MenuScreen - takes 2 rows (row-1-2),
// the number being the big focal piece. Rendered in the DEFAULT CURRENCY (ez_currency).
export default function BalanceHeader({ totalUsd, loading }) {
  const cur = getDisplayCurrency()
  const [rates, setRates] = useState(cachedRates)   // seeded from cache → no "..." when switching screens

  useEffect(() => {
    getDisplayRates().then(setRates).catch(() => {})
  }, [])

  // BALANCE NOT KNOWN YET → '…', NEVER draw "$0.00" (that is inventing a balance - bug 07-16).
  // totalUsd == null = still loading / failed to read; only a REAL 0 may show as "$0.00".
  const unknown = loading || !rates || totalUsd == null || Number.isNaN(totalUsd)
  // fmtDisplay puts the symbol on the CORRECT side: "$127.66" but "1.250.000 ₫" (symbol trails the number).
  const str = unknown ? '…' : fmtDisplay(totalUsd, cur, rates)

  // MAX SIZE = 50 (user decision 2026-09-08, confirmed against Menu/Home send/Home receive's own Figma nodes): the balance is capped at 50px,
  // shrinking by REAL MEASURED WIDTH via canvas (useFitFontSize) - NOT amountFontSize (character counting)
  // any more: some currencies are twice as long as USD ("1.250.000 ₫" vs "$50.00"), so guessing by length
  // overflows. The fit budget itself is capped at 75% of the SCREEN width (not just the container minus a
  // little padding) so a long decimal amount (e.g. "$10,000.00") never draws past 3/4 of the screen, exactly
  // the overflow the user hit that prompted this rule.
  // MAX SIZE = 40 (2026-09-23 redesign, node 1:352 on Send/Receive/Menu - down from 50). Still fitted by
  // REAL MEASURED WIDTH on canvas rather than by counting characters: some currencies are twice as long as
  // USD ("1.250.000 ₫" vs "$50.00"), so a long amount has to shrink rather than run off the screen.
  const [fitRef, fitSize] = useFitFontSize(str, { max: 34, min: 22, weight: 400 })
  return (
    // ABSOLUTE, not the old `row-1-2` grid cell. Node 1:352 is a 340x70 block whose BOTTOM edge sits on
    // y=70 - the bottom of row 1 - with the number bottom-aligned inside it. A grid cell cannot express
    // "bottom edge at exactly 70px" without depending on whatever else lands in the same track.
    <div style={{
      position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)',
      width: 'var(--cw)', height: 'calc(70 * var(--u))',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', minWidth: 0,
    }}>
      <div ref={fitRef} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%' }}>
        {/* 40px REGULAR (weight 400), not the old Light 300 - the redesign draws the balance at the same
            weight as ordinary text, just much bigger. */}
        <span style={{ fontSize: fitSize, fontWeight: 'var(--fw-normal)', color: 'var(--color-content)', lineHeight: 1, whiteSpace: 'nowrap' }}>
          {str}
        </span>
      </div>
    </div>
  )
}
