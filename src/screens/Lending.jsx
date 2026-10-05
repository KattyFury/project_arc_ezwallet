import { useState, useEffect } from 'react'
import { useNav } from '../nav'
import Icon from '../components/Icon'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { earnApi } from '../earn'
import { getDisplayRates, cachedRates } from '../chain'
import { getDisplayCurrency, fmtDisplay } from '../data'

// LENDING / BORROW - one Service hub card, two tabs in row 1 (owner 2026-10-05, plan on the owner's Desktop §6-§11).
// No Figma for Service hub screens any more: built from the design system + the 10-row grid, the owner adjusts after.
// Row map: 1 tabs (left) + menu (right) · 2-3 MY DEPOSITS (always first - owner) · 4-8 ONE scroll area: my vaults, then
// the vaults open to deposit right under them · 9 the yellow risk line · 10 Exit.
// Vaults = Circle Earn Kit on Morpho, filtered by RULE on the server (functions/api/_earnCore.js): curator whitelist,
// Deposit only while "Withdrawable now" covers the amount, $200 per deposit.
// LABS: reachable only where src/labs.js allows it (ServiceHub hides the card elsewhere, /api/earn answers 503).

const ROW1 = { position: 'absolute', left: '6.41%', right: '6.41%', top: 0, height: 'calc(70 * var(--u))' }
const BOX = { border: 'none', borderRadius: 16, background: 'var(--color-card)' }
const fmtAmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtApy = (a) => typeof a === 'number' ? `${(a * 100).toFixed(2)}%` : '…'
export const usdRateOf = (asset, rates) => asset === 'USDC' ? 1 : (rates?.[asset] || null)

function Tabs({ tab, setTab, onMenu }) {
  const t = (id, label) => (
    <button key={id} onClick={() => setTab(id)} style={{
      border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.2,
      fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-semibold)',
      color: tab === id ? 'var(--color-black)' : 'var(--color-muted)',
    }}>{label}</button>
  )
  return (
    <div style={{ ...ROW1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: 'calc(24 * var(--u))' }}>{t('lend', 'Lending')}{t('borrow', 'Borrow')}</div>
      <button onClick={onMenu} aria-label="Menu" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}>
        <Icon name="menu" size="calc(28 * var(--u))" color="var(--color-black)" />
      </button>
    </div>
  )
}

function Card({ title, lines, action }) {
  return (
    <div style={{ ...BOX, display: 'flex', alignItems: 'center', gap: 'calc(12 * var(--u))', padding: 'calc(16 * var(--u))', minWidth: 0, flexShrink: 0 }}>
      <div className="col" style={{ flex: 1, minWidth: 0, gap: 'calc(4 * var(--u))' }}>
        <span style={{ fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)', color: title.color || 'var(--color-black)', lineHeight: 1.2, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{title.text}</span>
        {lines.map((l, i) => (
          <span key={i} style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)', lineHeight: 1.3 }}>{l}</span>
        ))}
      </div>
      {action}
    </div>
  )
}

const smallBtn = (cls) => ({ className: `btn ${cls}`, style: { height: 'calc(40 * var(--u))', minHeight: 0, flexShrink: 0, fontSize: 'var(--fs-content-2)', padding: '0 calc(16 * var(--u))', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.48)' } })

export default function Lending() {
  const { navigate, params } = useNav()
  const [tab, setTab] = useState(params?.tab || 'lend')
  const [menu, setMenu] = useState(false)
  const [vaults, setVaults] = useState(null)        // null = loading
  const [positions, setPositions] = useState(null)  // null = loading
  const [error, setError] = useState('')
  const [rates, setRates] = useState(() => cachedRates())
  const cur = getDisplayCurrency()
  const walletAddress = localStorage.getItem('ez_wallet_addr')

  function load() {
    setError('')
    earnApi('vaults').then(d => setVaults(d.vaults)).catch(e => setError(e.message))
    if (walletAddress) earnApi('positions', { walletAddress }).then(d => setPositions(d.positions)).catch(e => setError(e.message))
  }
  useEffect(load, [walletAddress])
  useEffect(() => { getDisplayRates().then(setRates).catch(() => {}) }, [])

  // MY DEPOSITS in the display currency. Any asset without a live price → "…" (no guessed numbers).
  const total = positions === null ? null : positions.reduce((a, p) => {
    const r = usdRateOf(p.asset, rates)
    return a === null || r === null ? null : a + p.balance * r
  }, 0)
  const earned = positions?.length && positions.every(p => p.earned !== null)
    ? positions.reduce((a, p) => { const r = usdRateOf(p.asset, rates); return a === null || r === null ? null : a + p.earned * r }, 0) : null

  const open = (kind, vault, position) => navigate('LendAction', { kind, vault, position })

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <Tabs tab={tab} setTab={setTab} onMenu={() => setMenu(true)} />

      {menu && (
        <div className="popup-overlay" onClick={() => setMenu(false)}>
          <div className="popup-card" onClick={e => e.stopPropagation()}>
            <div className="popup-title">How Lending works</div>
            <span style={{ fontSize: 'var(--fs-caption)', lineHeight: 1.4 }}>
              Your USDC or EURC goes into a Morpho vault run by a known curator. The vault lends it out and pays you
              interest (APY). Withdraw any time the vault has cash free ("Withdrawable now"). No app fee; the network fee is shown before you confirm.
            </span>
            <div className="popup-actions">
              <button className="btn btn-secondary" onClick={() => { setMenu(false); load() }}>Refresh</button>
              <button className="btn btn-primary" onClick={() => setMenu(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'borrow' ? (
        <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '10.19dvh', height: '18.48dvh', ...BOX, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16 * var(--u))', textAlign: 'center' }}>
          <span style={{ fontSize: 'var(--fs-content-2)', color: 'var(--color-muted-2)', lineHeight: 1.4 }}>Borrow is coming next: borrow EURC with cirBTC as collateral.</span>
        </div>
      ) : (<>
        {/* MY DEPOSITS - rows 2-3, always first (owner). */}
        <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '10.19dvh', height: '18.48dvh', ...BOX, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'calc(6 * var(--u))', padding: 'calc(16 * var(--u))' }}>
          <span style={{ fontSize: 'var(--fs-content-2)', color: 'var(--color-muted-2)' }}>My deposits</span>
          <span className="num" style={{ fontSize: 'var(--fs-hero)', fontWeight: 'var(--fw-light)', lineHeight: 1.1, color: 'var(--color-black)' }}>
            {positions === null ? '…' : positions.length === 0 ? fmtDisplay(0, cur, rates) : total === null ? '…' : fmtDisplay(total, cur, rates)}
          </span>
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>
            {positions?.length === 0 ? 'No deposit yet' : earned !== null ? <>Earned so far: <span className="num" style={{ color: 'var(--color-primary)', fontWeight: 'var(--fw-semibold)' }}>+{fmtDisplay(earned, cur, rates)}</span></> : ' '}
          </span>
        </div>

        {/* Rows 4-8: ONE scroll area - my vaults first, the open vaults right under them (owner, round 2). */}
        <div className="scroll-hidden" style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '30.57dvh', height: '49.05dvh', display: 'flex', flexDirection: 'column', gap: 'calc(16 * var(--u))' }}>
          {error && <div className="warning-badge" style={{ background: 'var(--color-error-soft)', flexShrink: 0 }}>{error}</div>}
          {(positions || []).map(p => (
            <Card key={p.vault} title={{ text: p.name }}
              lines={[<span key="a" className="num" style={{ color: 'var(--color-black)', fontWeight: 'var(--fw-semibold)' }}>{fmtAmt(p.balance)} {p.asset}</span>, `APY ${fmtApy(p.apy)}`]}
              action={<button {...smallBtn('btn-secondary')} onClick={() => open('withdraw', vaults?.find(v => v.address === p.vault) || { address: p.vault, name: p.name, asset: p.asset, apy: p.apy }, p)}>Withdraw</button>} />
          ))}
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)', flexShrink: 0 }}>{vaults === null ? 'Loading vaults…' : 'Vaults you can deposit into'}</span>
          {(vaults || []).map(v => {
            // Nothing free to pay out → greyed (paler colour, never opacity - owner) and no Deposit button.
            const locked = !(v.withdrawable >= 0.01)
            return (
              <Card key={v.address} title={{ text: v.name, color: locked ? 'var(--color-muted)' : undefined }}
                lines={[`APY ${fmtApy(v.apy)} · ${v.curator}`,
                  locked ? 'Temporarily cannot withdraw' : <>Withdrawable now: <span className="num">{fmtAmt(v.withdrawable)} {v.asset}</span></>]}
                action={locked ? null : <button {...smallBtn('btn-primary')} onClick={() => open('deposit', v)}>Deposit</button>} />
            )
          })}
        </div>

        {/* Row 9: the always-visible risk line (plan §7). */}
        <div className="warning-badge" style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '81.52dvh', height: '8.29dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 calc(12 * var(--u))', fontSize: 'var(--fs-small)', lineHeight: 1.3 }}>
          Vault funds are lent out. Withdrawals can be delayed. Value can fall in extreme markets.
        </div>
      </>)}

      <ExitBar onClick={() => navigate('ServiceHub')} />
    </div>
  )
}
