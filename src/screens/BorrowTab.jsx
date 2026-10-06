import { useState, useEffect } from 'react'
import { useNav } from '../nav'
import ScrollBox, { BoxHeader } from '../components/ScrollBox'
import { borrowApi, BAND } from '../borrow'
import { Card, smallBtn, fmtAmt, fmtApy } from './Lending'

// THE BORROW TAB of Lending / Borrow (owner 2026-10-06, plan §10/§14). USDC loans against cirBTC (Circle Borrow Kit lends
// USDC only). Row map: 2-3 MY LOAN (borrowed, collateral, health, liquidation price, alerts) + Open · 4-8 ScrollBox of
// markets (Open) · 9 the risk line. Rules on the server (functions/api/borrow.js): LTV ≤ 50%, ≤ $200, free liquidity.
const BOX = { border: 'none', borderRadius: 16, background: 'var(--color-card)' }
const fmtBtc = (n) => typeof n === 'number' ? n.toFixed(8).replace(/0+$/, '').replace(/\.$/, '') : '…'

export default function BorrowTab() {
  const { navigate } = useNav()
  const [markets, setMarkets] = useState(null)
  const [loans, setLoans] = useState(null)
  const [error, setError] = useState('')
  const walletAddress = localStorage.getItem('ez_wallet_addr')

  useEffect(() => {
    borrowApi('markets').then(d => setMarkets(d.markets)).catch(e => { setError(e.message); setMarkets([]) })
    if (walletAddress) borrowApi('loans', { walletAddress }).then(d => setLoans(d.loans)).catch(e => { setError(e.message); setLoans([]) })
  }, [])

  const loan = (loans || []).find(l => l.status === 'active') || null
  const [bandColor, bandWord] = BAND[loan?.band] || ['var(--color-muted-2)', '…']
  const open = (params) => navigate('BorrowAction', params)

  return (<>
    {/* Rows 2-3: MY LOAN. */}
    <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '10.19dvh', height: '18.48dvh', ...BOX, display: 'flex', alignItems: 'center', gap: 'calc(12 * var(--u))', padding: 'calc(16 * var(--u))' }}>
      <div className="col" style={{ flex: 1, minWidth: 0, gap: 'calc(4 * var(--u))' }}>
        <span style={{ fontSize: 'var(--fs-content-2)', color: 'var(--color-muted-2)' }}>My loan</span>
        <span className="num" style={{ fontSize: 'var(--fs-hero)', fontWeight: 'var(--fw-light)', lineHeight: 1.1 }}>
          {loans === null ? '…' : loan ? `$${fmtAmt(loan.borrowed)}` : '$0.00'}
        </span>
        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)', lineHeight: 1.3 }}>
          {loans === null ? ' ' : !loan ? 'No loan yet' : <>
            <span style={{ color: bandColor, fontWeight: 'var(--fw-semibold)' }}>{bandWord}</span>
            {` · ${fmtBtc(loan.collateral)} cirBTC locked`}
            {loan.liquidationPrice ? ` · liquidation if BTC < $${Math.round(loan.liquidationPrice).toLocaleString('en-US')}` : ''}
            {!loan.alertsOn && <span style={{ color: 'var(--color-error)', fontWeight: 'var(--fw-semibold)' }}> · Alerts off</span>}
          </>}
        </span>
      </div>
      {loan && <button {...smallBtn('btn-primary')} onClick={() => open({ loan, kind: 'repay' })}>Open</button>}
    </div>

    {/* Rows 4-8: the markets. */}
    <ScrollBox header={<BoxHeader title="Borrow USDC" right="cirBTC as collateral" />}
      style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '30.57dvh', height: '49.05dvh' }}
      listStyle={{ padding: '0 calc(16 * var(--u)) calc(16 * var(--u))', gap: 'calc(16 * var(--u))' }}>
      {error && <div className="warning-badge" style={{ background: 'var(--color-error-soft)', flexShrink: 0 }}>{error}</div>}
      {markets === null && <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>Loading markets…</span>}
      {(markets || []).map(m => {
        const locked = !(m.free >= 1)
        return (
          <Card key={m.marketId} title={{ text: `${m.name} · Morpho`, color: locked ? 'var(--color-muted)' : undefined }}
            lines={[`Borrow APY ${fmtApy(m.borrowApy)} · max 50% of your cirBTC`,
              locked ? 'No USDC free to borrow right now' : <>Free to borrow: <span className="num">{fmtAmt(m.free)} USDC</span></>]}
            action={locked ? null : <button {...smallBtn('btn-primary')} onClick={() => open({ market: m, loan: loan && loan.marketId === m.marketId ? loan : null, kind: 'borrow' })}>Open</button>} />
        )
      })}
    </ScrollBox>

    {/* Row 9: the risk line. */}
    <div className="warning-badge" style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '81.52dvh', height: '8.29dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 calc(12 * var(--u))', fontSize: 'var(--fs-small)', lineHeight: 1.3 }}>
      If BTC falls far enough, part of your cirBTC is sold to repay the loan. Turn on alerts and repay early.
    </div>
  </>)
}
