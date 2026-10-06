import { useState, useEffect, useRef } from 'react'
import { useNav } from '../nav'
import Numpad from '../components/Numpad'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { borrowApi, BAND } from '../borrow'
import { getSDK, executeChallenge, refreshSession, circleErrorMessage } from '../circle'
import { getTokenBalances, cachedBalances, getDisplayRates, cachedRates } from '../chain'
import { floorTo, GAS_RESERVE_USDC } from '../data'
import { addNotif } from '../notif'
import { assertNetworkReady } from '../clientNet'
import { toAmountString } from '../money'
import { newAttempt, getPending, clearPending, lookup, classify, waitFinal } from '../txTracker'
import { Tabs, fmtAmt, fmtApy } from './Lending'

// ONE LOAN / ONE MARKET (params: kind, market?, loan?) - row 1 tabs Borrow | Repay | Collateral (owner 2026-10-06, §10/§14).
// Money path = Lending's: /api/borrow fee → execute (intent checked + the exact batch simulated, LTV ≤ 50%, no Morpho
// permission left open) → ONE PIN → txTracker. After a borrow: "Turn on liquidation alerts" = the 2nd PIN (owner's pick).
// Row map: 2-3 the loan/market · 4-5 the amount + [50%] [Max] (+ Collateral: Add | Withdraw, Repay: "Repay all & close") ·
// 6 what happens + fee + note · 9 the button · 10 Exit (back to the Borrow tab).
const MAX_USD = 200, MAX_LTV = 0.5
const BOX = { border: 'none', borderRadius: 16, background: 'var(--color-card)' }
const at = (top, height) => ({ position: 'absolute', left: '6.41%', right: '6.41%', top, height })
const fmtBtc = (n) => typeof n === 'number' ? n.toFixed(8).replace(/0+$/, '').replace(/\.$/, '') : '…'
// Display only: USDC shows 2 decimals ("≈" when digits are hidden); cirBTC up to 8. The exact string is what is sent.
const shown = (s, d) => { const [i, f = ''] = s.split('.'); return f.length <= d ? s : `${/[1-9]/.test(f.slice(d)) ? '≈ ' : ''}${i}.${f.slice(0, d)}` }

export default function BorrowAction() {
  const { navigate, params } = useNav()
  const { market = null } = params || {}
  const [loan, setLoan] = useState(params?.loan || null)
  const [tab, setTab] = useState(params?.kind === 'borrow' ? 'borrow' : 'repay')
  const [colMode, setColMode] = useState('add')            // Collateral tab: add | withdraw
  const [close, setClose] = useState(false)                // Repay tab: "Repay all & close"
  const walletAddress = localStorage.getItem('ez_wallet_addr')
  const walletId = localStorage.getItem('ez_wallet_id')
  const [bal, setBal] = useState(() => Object.fromEntries((cachedBalances(walletAddress) || []).map(t => [t.symbol, t.amount])))
  const [rates, setRates] = useState(() => cachedRates())
  const [typed, setTyped] = useState('')
  const [pad, setPad] = useState(false)
  const [info, setInfo] = useState(null)                   // { feeMax, cirbtcNeeded, liquidationPrice }
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [alertStep, setAlertStep] = useState(null)         // loanId waiting for the alert PIN
  const debounce = useRef(null)

  useEffect(() => {
    if (walletAddress) getTokenBalances(walletAddress).then(ts => setBal(Object.fromEntries(ts.map(t => [t.symbol, t.amount])))).catch(() => {})
    getDisplayRates().then(setRates).catch(() => {})
  }, [])

  const kind = tab === 'borrow' ? 'borrow' : tab === 'repay' ? (close ? 'close' : 'repay') : (colMode === 'add' ? 'addCollateral' : 'withdrawCollateral')
  const isBtc = kind === 'addCollateral' || kind === 'withdrawCollateral'
  const dec = isBtc ? 8 : 6
  const showDec = isBtc ? 8 : 2
  const btcUsd = rates?.cirBTC || null
  const borrowed = loan?.borrowed || 0, collateral = loan?.collateral || 0

  // The most this action can move (display + chips; the server enforces the real rules).
  const max = (() => {
    if (kind === 'borrow') {
      if (!market || btcUsd === null || bal.cirBTC === undefined) return null
      const byCollateral = ((bal.cirBTC || 0) + collateral) * btcUsd * MAX_LTV - borrowed
      return Math.max(0, floorTo(Math.min(market.free, MAX_USD - borrowed, byCollateral), dec))
    }
    if (kind === 'repay') return bal.USDC === undefined ? null : Math.max(0, floorTo(Math.min(borrowed, bal.USDC - GAS_RESERVE_USDC), dec))
    if (kind === 'addCollateral') return bal.cirBTC === undefined ? null : floorTo(bal.cirBTC, dec)
    if (kind === 'withdrawCollateral') return btcUsd === null ? null : Math.max(0, floorTo(collateral - borrowed / (MAX_LTV * btcUsd), dec))
    return null
  })()
  const amount = parseFloat(typed) || 0
  const over = kind !== 'close' && max !== null && amount > max + 1e-12
  const ready = kind === 'close' ? !!loan : amount > 0 && !over
  const can = ready && info?.feeMax && !loading && !done && !alertStep

  useEffect(() => {
    clearTimeout(debounce.current); setInfo(null)
    if (!ready) return
    debounce.current = setTimeout(() => {
      borrowApi('fee', { kind, marketId: market?.marketId, loanId: loan?.loanId, amount: kind === 'close' ? '0' : typed, walletAddress, walletId })
        .then(f => { setInfo(f); setError('') }).catch(e => setError(e.message))
    }, 600)
    return () => clearTimeout(debounce.current)
  }, [typed, kind])

  function switchTab(t) { if (loading || done || alertStep || t === tab) return; setTab(t); setTyped(''); setClose(false); setError(''); setStatus('') }
  function onPadKey(k) {
    if (k === 'BACK') return setTyped(t => t.slice(0, -1))
    if (k === '.') return setTyped(t => t.includes('.') ? t : (t || '0') + '.')
    const [i = '', d] = typed.split('.')
    if (d !== undefined ? d.length >= dec : i.length >= 9) return
    setTyped(typed === '0' ? k : typed + k)
  }
  const pick = (n) => { setClose(false); setTyped(n > 0 ? toAmountString(n, dec).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : ''); setError('') }

  async function reloadLoan() {
    try { const d = await borrowApi('loans', { walletAddress }); setLoan(d.loans.find(l => l.status === 'active') || null) } catch {}
  }

  async function run() {
    setLoading(true); setError(''); setStatus('Preparing…')
    const STILL = 'Your last transaction is still being confirmed. Do NOT try again yet - check Transaction history in a moment.'
    const stop = (m) => { setLoading(false); setStatus(''); setError(m) }
    const label = { borrow: `Borrowed ${typed} USDC`, repay: `Repaid ${typed} USDC`, close: 'Closed the loan', addCollateral: `Added ${typed} cirBTC`, withdrawCollateral: `Withdrew ${typed} cirBTC` }[kind]
    let attempt = null
    try {
      await assertNetworkReady()
      const prev = getPending()
      if (prev) {
        let r
        try { r = classify(await lookup(prev)) } catch { return stop(STILL) }
        if (r === 'pending') return stop(STILL)
        clearPending(prev.refId)
      }
      attempt = newAttempt('borrow', { kind })
      const { userToken, encryptionKey } = await refreshSession()
      const res = await borrowApi('execute', { kind, marketId: market?.marketId, loanId: loan?.loanId, amount: kind === 'close' ? '0' : typed, userToken, walletId, walletAddress, refId: attempt.refId })
        .catch(e => { clearPending(attempt.refId); throw e })
      setStatus('Enter PIN...')
      let signError = null
      try { await executeChallenge(await getSDK(), userToken, encryptionKey, res.challengeId) }
      catch (e) {
        if (e?.code === 155701) { clearPending(attempt.refId); setLoading(false); setStatus(''); return }
        signError = e
      }
      setStatus('Confirming on the network…')
      const { outcome } = await waitFinal(attempt, { timeoutMs: signError ? 30000 : 90000 })
      if (outcome === 'failed' || (outcome === 'none' && signError)) {
        clearPending(attempt.refId)
        addNotif(`${label} (failed - nothing moved)`, 'error', null, `borrow-fail-${Date.now()}`)
        return stop(signError && outcome === 'none' ? circleErrorMessage(signError) : 'The network rejected this - nothing left your wallet.')
      }
      if (outcome !== 'ok') return stop(STILL)
      clearPending(attempt.refId)
      addNotif(`${label} (complete)`, 'sent', null, `borrow-${Date.now()}`)
      setLoading(false); setTyped('')
      if (kind === 'borrow' && !loan?.alertsOn) { setAlertStep(res.loanId); setStatus('') }   // → the 2nd PIN
      else { setDone(true); setStatus('Done'); setTimeout(() => navigate('Lending', { tab: 'borrow' }), 2000) }
      reloadLoan()
    } catch (e) {
      if (attempt && getPending()?.refId === attempt.refId) return stop(STILL)
      setLoading(false); setStatus(''); setError(circleErrorMessage(e))
    }
  }

  // THE 2nd PIN (owner 2026-10-06): sign Circle's webhook registration → email alerts when the loan's health drops.
  async function turnOnAlerts(loanId) {
    setLoading(true); setError(''); setStatus('Preparing alerts…')
    try {
      const { userToken, encryptionKey } = await refreshSession()
      const start = await borrowApi('alertStart', { loanId, walletAddress, walletId, userToken })
      setStatus('Enter PIN to turn on alerts')
      const result = await executeChallenge(await getSDK(), userToken, encryptionKey, start.challengeId)
      const signature = result?.data?.signature || (MOCK_SIG)
      await borrowApi('alertFinish', { loanId, walletAddress, userToken, signature, deadline: start.deadline })
      setLoading(false); setAlertStep(null); setDone(true); setStatus('Alerts on')
      setTimeout(() => navigate('Lending', { tab: 'borrow' }), 2000)
    } catch (e) {
      setLoading(false); setStatus('')
      setError(e?.code === 155701 ? 'Alerts are still off - your loan has no warning before liquidation.' : circleErrorMessage(e))
    }
  }

  const [bandColor, bandWord] = BAND[loan?.band] || ['var(--color-muted-2)', '']
  const chip = (label, onClick, active) => (
    <button key={label} disabled={loading} onClick={onClick} style={{
      border: '1.5px solid var(--color-brand)', background: active ? 'var(--color-brand)' : 'none', borderRadius: 999, padding: 'calc(6 * var(--u)) calc(14 * var(--u))',
      fontFamily: 'inherit', fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer', color: active ? 'var(--color-white)' : 'var(--color-brand)',
    }}>{label}</button>
  )
  const unit = isBtc ? 'cirBTC' : 'USDC'
  const avail = { borrow: market ? `${fmtAmt(market.free)} USDC free` : '…', repay: `${fmtAmt(borrowed)} USDC owed`, close: `${fmtAmt(borrowed)} USDC owed`,
    addCollateral: `${fmtBtc(bal.cirBTC)} cirBTC in wallet`, withdrawCollateral: `${fmtBtc(collateral)} cirBTC locked` }[kind]
  const what = kind === 'borrow'
    ? (info ? `Locks ≈ ${fmtBtc(info.cirbtcNeeded)} cirBTC · liquidation if BTC < $${Math.round(info.liquidationPrice || 0).toLocaleString('en-US')}` : '')
    : kind === 'close' ? 'Repays everything and returns all your cirBTC.' : ''
  const label = alertStep ? 'Turn on liquidation alerts (PIN)' : error || status
    || (kind === 'close' ? 'Repay all & close' : over ? `At most ${shown(String(max), showDec)} ${unit}` : amount > 0
      ? { borrow: 'Borrow', repay: 'Repay', addCollateral: 'Add collateral', withdrawCollateral: 'Withdraw collateral' }[kind] : 'Tap the amount to enter')

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <Tabs tabs={[['borrow', 'Borrow'], ...(loan ? [['repay', 'Repay'], ['collateral', 'Collateral']] : [])]} tab={tab} setTab={switchTab} />

      {/* Rows 2-3: the loan (or the market for a first borrow). */}
      <div style={{ ...at('10.19dvh', '18.48dvh'), ...BOX, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'calc(6 * var(--u))', padding: 'calc(16 * var(--u))' }}>
        {loan ? (<>
          <span style={{ fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)' }}>Loan: {fmtAmt(borrowed)} USDC <span style={{ color: bandColor, fontSize: 'var(--fs-caption)' }}>· {bandWord}</span></span>
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>Collateral {fmtBtc(collateral)} cirBTC · APY {fmtApy(loan.borrowApy)}</span>
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>
            {loan.liquidationPrice ? `Liquidation if BTC < $${Math.round(loan.liquidationPrice).toLocaleString('en-US')}` : ''}
            {!loan.alertsOn && !alertStep && <> · <button onClick={() => turnOnAlerts(loan.loanId)} disabled={loading} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-caption)', color: 'var(--color-error)', fontWeight: 'var(--fw-semibold)', textDecoration: 'underline' }}>Alerts off - turn on</button></>}
          </span>
        </>) : (<>
          <span style={{ fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)' }}>{market?.name || 'cirBTC/USDC'} · Morpho</span>
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>Borrow APY {fmtApy(market?.borrowApy)} · Liquidation at {Math.round((market?.lltv || 0.86) * 100)}% LTV</span>
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>ezwallet keeps your loan at 50% of your cirBTC or less.</span>
        </>)}
      </div>

      {/* Rows 4-5: the amount. */}
      <div style={{ ...at('30.57dvh', '18.48dvh'), ...BOX, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'calc(10 * var(--u))', padding: 'calc(16 * var(--u))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'calc(8 * var(--u))' }}>
          <span style={{ fontSize: 'var(--fs-content-2)', color: 'var(--color-muted-2)' }}><span className="num" style={{ color: 'var(--color-brand)', fontWeight: 'var(--fw-semibold)' }}>{avail}</span></span>
          {tab === 'collateral' && <div style={{ display: 'flex', gap: 'calc(6 * var(--u))' }}>{chip('Add', () => { setColMode('add'); setTyped('') }, colMode === 'add')}{chip('Withdraw', () => { setColMode('withdraw'); setTyped('') }, colMode === 'withdraw')}</div>}
        </div>
        <button onClick={() => !loading && !done && kind !== 'close' && setPad(true)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <span className="num" style={{ fontSize: 'var(--fs-hero)', fontWeight: 'var(--fw-light)', color: over ? 'var(--color-error)' : 'var(--color-black)' }}>
            {kind === 'close' ? `${fmtAmt(borrowed)}` : pad ? typed : shown(typed, showDec)}{kind !== 'close' && <span className="caret">_</span>}{(typed || kind === 'close') ? <span style={{ fontSize: 'var(--fs-content-1)' }}> {unit}</span> : null}
          </span>
        </button>
        <div style={{ display: 'flex', gap: 'calc(8 * var(--u))', flexWrap: 'wrap' }}>
          {chip('50%', () => pick(max ? floorTo(max / 2, dec) : 0))}
          {chip('Max', () => pick(max || 0))}
          {tab === 'repay' && chip('Repay all & close', () => { setTyped(''); setClose(c => !c) }, close)}
        </div>
      </div>

      {/* Row 6: what happens, the fee, the note. */}
      <div style={{ ...at('50.95dvh', 'auto'), display: 'flex', flexDirection: 'column', gap: 'calc(8 * var(--u))', padding: '0 calc(11 * var(--u))', fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>
        {what && <span style={{ color: 'var(--color-black)' }}>{what}</span>}
        <span>Fee: <span className="num" style={{ color: 'var(--color-black)', fontWeight: 'var(--fw-semibold)' }}>{ready ? (info?.feeMax ? (Number(info.feeMax) < 0.01 ? '<$0.01' : `up to $${Number(info.feeMax).toFixed(3)}`) : '…') : '-'}</span>{kind === 'borrow' ? ` · max $${MAX_USD} per loan` : ''}</span>
        <span style={{ fontSize: 'var(--fs-small)', lineHeight: 1.4 }}>
          {kind === 'borrow' ? 'Your cirBTC is locked in Morpho until you repay. If BTC falls to the liquidation price, part of it is sold to repay the loan. No app fee.'
            : kind === 'withdrawCollateral' ? 'You can only take out cirBTC while the loan stays at 50% of the collateral or less.'
            : 'Repaying lowers the risk. Interest keeps adding up until the loan is repaid.'}
        </span>
      </div>

      {/* Row 9: the button. */}
      <div style={{ ...at('81.52dvh', '8.29dvh'), display: 'flex', alignItems: 'center' }}>
        <button className={`btn ${error ? 'btn-secondary' : done ? 'btn-success' : 'btn-primary'}`}
          style={{ width: '100%', height: 'var(--btn-h)', minHeight: 0, borderRadius: 38, ...(error ? { color: 'var(--color-error)' } : null) }}
          disabled={alertStep ? loading : ready ? (!can && !error) : (loading || done)}
          onClick={() => error ? setError('') : alertStep ? turnOnAlerts(alertStep) : ready ? run() : setPad(true)}>
          <span style={{ fontSize: 'var(--fs-content-1)', lineHeight: 1.2, textAlign: 'center', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{label}</span>
        </button>
      </div>

      {pad && (
        <div className="sheet-overlay" onClick={() => setPad(false)}>
          <div className="sheet numpad-gray" onClick={e => e.stopPropagation()}>
            <div style={{ flex: 5.5, minHeight: 0, paddingTop: 'calc(24 * var(--u))' }}><Numpad onKey={onPadKey} showComma /></div>
            <div style={{ flex: 0.5 }} />
            <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'calc(12 * var(--u))' }}>
              <button className="btn btn-secondary" style={{ width: '44%' }} onClick={() => { setTyped(''); setPad(false) }}>Clear</button>
              <button className="btn btn-primary" style={{ width: '44%' }} onClick={() => setPad(false)}>Done</button>
            </div>
            <div style={{ flex: 1 }} />
          </div>
        </div>
      )}

      <ExitBar onClick={() => navigate('Lending', { tab: 'borrow' })} />
    </div>
  )
}

// Mock mode skips the PIN and returns no signature; a well-formed placeholder lets the flow be rehearsed end to end.
const MOCK_SIG = import.meta.env.VITE_MOCK === '1' ? '0x' + '11'.repeat(65) : null
