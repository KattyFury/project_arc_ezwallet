import { useState, useEffect } from 'react'
import { useNav } from '../nav'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { getDisplayRates, cachedRates } from '../chain'
import { getDisplayCurrency, fmtDisplay } from '../data'
import { Card, smallBtn, fmtAmt, fmtApy, usdRateOf } from './Lending'
import ScrollBox from '../components/ScrollBox'

// MY DEPOSITS - every position as its own white card (owner 2026-10-05: the "My deposits" card on Lending has an Open
// button). Params: positions + vaults, already loaded by Lending. Row map: 1 title left · 2-9 ONE grey box of cards,
// scrolling inside · 10 Exit (back to Lending). Open on a card → that vault, Withdraw tab first (you came here to
// manage what you hold; the Deposit tab is one tap away).
export default function LendPositions() {
  const { navigate, params } = useNav()
  const positions = params?.positions || []
  const vaults = params?.vaults || []
  const [rates, setRates] = useState(() => cachedRates())
  const cur = getDisplayCurrency()
  useEffect(() => { getDisplayRates().then(setRates).catch(() => {}) }, [])

  // A position's value in the display currency; no live price → "…" (no guessed numbers).
  const value = (p) => { const r = usdRateOf(p.asset, rates); return r === null ? '…' : fmtDisplay(p.balance * r, cur, rates) }

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: 0, height: 'calc(70 * var(--u))', display: 'flex', alignItems: 'flex-end', fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-semibold)' }}>
        My deposits
      </div>

      <ScrollBox style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '10.19dvh', height: '69.43dvh', border: 'none', borderRadius: 16, background: 'var(--color-card)', overflow: 'hidden' }} listStyle={{ padding: 'calc(16 * var(--u))', gap: 'calc(16 * var(--u))' }}>
        {positions.length === 0 && <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>No deposit yet</span>}
        {positions.map(p => {
          const v = vaults.find(x => x.address === p.vault) || { address: p.vault, name: p.name, asset: p.asset, apy: p.apy }
          return (
            <Card key={p.vault} title={{ text: p.name }}
              lines={[
                <span key="b" className="num" style={{ color: 'var(--color-black)', fontWeight: 'var(--fw-semibold)' }}>{fmtAmt(p.balance)} {p.asset} <span style={{ color: 'var(--color-muted-2)', fontWeight: 'var(--fw-normal)' }}>· {value(p)}</span></span>,
                `APY ${fmtApy(p.apy)}${v.curator ? ` · ${v.curator}` : ''}`,
                ...(p.earned !== null ? [<span key="e">Earned: <span className="num" style={{ color: 'var(--color-primary)', fontWeight: 'var(--fw-semibold)' }}>+{fmtAmt(p.earned)} {p.asset}</span></span>] : []),
                typeof v.withdrawable === 'number'
                  ? (v.withdrawable >= 0.01 ? <>Withdrawable now: <span className="num">{fmtAmt(v.withdrawable)} {v.asset}</span></> : 'Temporarily cannot withdraw')
                  : null,
              ].filter(Boolean)}
              action={<button {...smallBtn('btn-primary')} onClick={() => navigate('LendAction', { kind: 'withdraw', vault: v, position: p })}>Open</button>} />
          )
        })}
      
      </ScrollBox>

      <ExitBar onClick={() => navigate('Lending')} />
    </div>
  )
}
