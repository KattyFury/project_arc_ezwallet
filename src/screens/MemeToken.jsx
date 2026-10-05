import { useState, useEffect, useRef } from 'react'
import { useNav } from '../nav'
import Numpad from '../components/Numpad'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { memeApi, fmtUnits, fmtPrice } from '../meme'
import { getSDK, executeChallenge, refreshSession, circleErrorMessage } from '../circle'
import { getTokenBalances, cachedBalances } from '../chain'
import { floorTo, GAS_RESERVE_USDC } from '../data'
import { addNotif } from '../notif'
import { assertNetworkReady, NET } from '../clientNet'
import { newAttempt, getPending, clearPending, lookup, classify, waitFinal } from '../txTracker'
import { Tabs } from './Lending'

// ONE MEME TOKEN (params: token) - Buy | Sell tabs in row 1 (same pattern as Lending's Deposit | Withdraw).
// Row map: 2-3 the token + the honeypot check · 4-5 the amount (tap → numpad) + [50%] [Max] · 6 you get / fee / the note ·
// 9 the button · 10 Exit (back to Memes). Money path = Lending's: /api/meme quote → fee → execute (the server re-checks
// the minimum, re-runs the honeypot guard for a buy and simulates the exact batch) → ONE PIN → txTracker (C3).
const MAX_BUY = 20   // also enforced by the server (functions/api/_memeCore.js MEME_MAX_BUY_USD)
const BOX = { border: 'none', borderRadius: 16, background: 'var(--color-card)' }
const at = (top, height) => ({ position: 'absolute', left: '6.41%', right: '6.41%', top, height })
const trim = (s) => s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
// Exact base units → decimal string (never through a float - a meme balance has 18 decimals).
const rawToDec = (raw, dec) => { const s = BigInt(raw || 0).toString().padStart(dec + 1, '0'); return trim(`${s.slice(0, -dec)}.${s.slice(-dec)}`) }

export default function MemeToken() {
  const { navigate, params } = useNav()
  const token = params?.token
  const walletAddress = localStorage.getItem('ez_wallet_addr')
  const walletId = localStorage.getItem('ez_wallet_id')
  const [side, setSide] = useState('buy')
  const [info, setInfo] = useState(null)       // /api/meme inspect
  const [usdc, setUsdc] = useState(() => cachedBalances(walletAddress)?.find(t => t.symbol === 'USDC')?.amount)
  const [typed, setTyped] = useState('')
  const [pad, setPad] = useState(false)
  const [quote, setQuote] = useState(null)     // { out, minOut, outDecimals }
  const [feeUsd, setFeeUsd] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const debounce = useRef(null)
  const buy = side === 'buy'

  function loadInfo() { memeApi('inspect', { token, walletAddress }).then(setInfo).catch(e => setError(e.message)) }
  useEffect(() => {
    loadInfo()
    if (walletAddress) getTokenBalances(walletAddress).then(ts => setUsdc(ts.find(t => t.symbol === 'USDC')?.amount)).catch(() => {})
  }, [])

  const dec = buy ? NET.tokens.USDC.decimals : (info?.decimals ?? 18)
  const max = (() => {
    if (!info?.supported) return null
    if (buy) return usdc === undefined ? null : Math.max(0, floorTo(Math.min(usdc - Math.max(GAS_RESERVE_USDC, feeUsd ?? 0), MAX_BUY), 2))
    return null   // sell: exact base units below (maxSellRaw)
  })()
  const maxSellRaw = info?.held || '0'
  const amount = parseFloat(typed) || 0
  const over = buy ? (max !== null && amount > max + 1e-12) : (typed !== '' && (() => { try { return BigInt(toRaw(typed, dec)) > BigInt(maxSellRaw) } catch { return true } })())
  const blocked = info && info.supported && buy && (!info.sellable || info.snipeTaxBps > 0)
  const can = amount > 0 && !over && quote && feeUsd !== null && !loading && !done && !blocked

  // Quote + Circle's fee for this exact amount (debounced).
  useEffect(() => {
    clearTimeout(debounce.current); setQuote(null); setFeeUsd(null)
    if (!(amount > 0) || over || !info?.supported) return
    debounce.current = setTimeout(async () => {
      try {
        const q = await memeApi('quote', { side, token, amount: typed, walletAddress })
        setQuote(q); setError('')
        const f = await memeApi('fee', { side, token, amount: typed, walletAddress, walletId })
        setFeeUsd(Number(f.feeMax) > 0 ? Number(f.feeMax) : null)
      } catch (e) { setError(e.message) }
    }, 600)
    return () => clearTimeout(debounce.current)
  }, [typed, side, info])

  function switchSide(s) { if (loading || done || s === side) return; setSide(s); setTyped(''); setQuote(null); setFeeUsd(null); setError(''); setStatus('') }
  function onPadKey(k) {
    if (k === 'BACK') return setTyped(t => t.slice(0, -1))
    if (k === '.') return setTyped(t => t.includes('.') ? t : (t || '0') + '.')
    const [i = '', d] = typed.split('.')
    if (d !== undefined ? d.length >= dec : i.length >= 15) return
    setTyped(typed === '0' ? k : typed + k)
  }

  async function run() {
    setLoading(true); setError(''); setStatus('Preparing…')
    const STILL = 'Your last transaction is still being confirmed. Do NOT try again yet - check Transaction history in a moment.'
    const stop = (m) => { setLoading(false); setStatus(''); setError(m) }
    let attempt = null
    const what = buy ? `Bought ${info.symbol} for ${typed} USDC` : `Sold ${typed} ${info.symbol}`
    try {
      await assertNetworkReady()
      const prev = getPending()
      if (prev) {
        let r
        try { r = classify(await lookup(prev)) } catch { return stop(STILL) }
        if (r === 'pending') return stop(STILL)
        clearPending(prev.refId)
      }
      attempt = newAttempt('meme', { side, token })
      const { userToken, encryptionKey } = await refreshSession()
      const res = await memeApi('execute', { side, token, amount: typed, minOut: quote.minOut, userToken, walletId, walletAddress, refId: attempt.refId })
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
        addNotif(`${what} (failed - nothing moved)`, 'error', null, `meme-fail-${Date.now()}`)
        return stop(signError && outcome === 'none' ? circleErrorMessage(signError) : 'The network rejected this - nothing left your wallet.')
      }
      if (outcome !== 'ok') return stop(STILL)
      clearPending(attempt.refId)
      addNotif(`${what} (complete)`, 'sent', null, `meme-${Date.now()}`)
      setLoading(false); setDone(true); setStatus(buy ? 'Bought' : 'Sold')
      setTimeout(() => navigate('Memes'), 2000)
    } catch (e) {
      if (attempt && getPending()?.refId === attempt.refId) return stop(STILL)
      setLoading(false); setStatus(''); setError(circleErrorMessage(e))
    }
  }

  const hint = (label, val) => (
    <button key={label} disabled={!val || loading} onClick={() => { setTyped(val); setError('') }} style={{
      border: '1.5px solid', borderColor: val ? 'var(--color-brand)' : 'var(--color-muted)', background: 'none', borderRadius: 999,
      padding: 'calc(6 * var(--u)) calc(14 * var(--u))', fontFamily: 'inherit', fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)',
      cursor: 'pointer', color: val ? 'var(--color-brand)' : 'var(--color-muted)',
    }}>{label}</button>
  )
  const halfSell = maxSellRaw !== '0' ? rawToDec((BigInt(maxSellRaw) / 2n).toString(), info?.decimals ?? 18) : ''
  const sym = info?.symbol || '…'
  const outTxt = quote ? (buy ? `${fmtUnits(quote.out, quote.outDecimals)} ${sym}` : `$${(Number(quote.out) / 1e6).toFixed(2)}`) : amount > 0 && !over ? '…' : '-'
  const label = error || status || (blocked ? (info.snipeTaxBps > 0 ? 'Just launched - wait a few seconds' : 'Cannot be sold - buying blocked')
    : over ? (buy ? `At most $${max}` : 'More than you hold') : amount > 0 ? (buy ? `Buy ${sym}` : `Sell ${sym}`) : 'Tap the amount to enter')

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <Tabs tabs={[['buy', 'Buy'], ['sell', 'Sell']]} tab={side} setTab={switchSide} />

      {/* Rows 2-3: the token + the honeypot check. */}
      <div style={{ ...at('10.19dvh', '18.48dvh'), ...BOX, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'calc(6 * var(--u))', padding: 'calc(16 * var(--u))' }}>
        {info === null ? <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>Checking this token on the network…</span>
          : !info.supported ? <span style={{ fontSize: 'var(--fs-content-2)', color: 'var(--color-error)', lineHeight: 1.4 }}>Not supported: {info.reason}.</span>
          : (<>
            <span style={{ fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.symbol}{info.name && info.name !== info.symbol ? ` · ${info.name}` : ''}</span>
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>{info.launchpad} · price <span className="num" style={{ color: 'var(--color-black)' }}>{fmtPrice(info.priceUsd)}</span> · tax {info.buyTaxBps / 100}% buy / {info.sellTaxBps / 100}% sell</span>
            <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: info.sellable ? 'var(--color-primary)' : 'var(--color-error)' }}>
              {info.sellable ? `✓ Sell check passed (buy → sell now costs ${info.roundTripLossPct.toFixed(1)}%)` : '✕ Cannot be sold - likely a scam'}
            </span>
          </>)}
      </div>

      {/* Rows 4-5: the amount. */}
      <div style={{ ...at('30.57dvh', '18.48dvh'), ...BOX, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'calc(10 * var(--u))', padding: 'calc(16 * var(--u))' }}>
        <span style={{ fontSize: 'var(--fs-content-2)', color: 'var(--color-muted-2)' }}>
          {buy ? 'Available' : 'You hold'}: <span className="num" style={{ color: 'var(--color-brand)', fontWeight: 'var(--fw-semibold)' }}>
            {buy ? (usdc === undefined ? '…' : `${usdc.toFixed(2)} USDC`) : (info?.supported ? `${fmtUnits(maxSellRaw, info.decimals)} ${sym}` : '…')}</span>
        </span>
        <button onClick={() => !loading && !done && info?.supported && setPad(true)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <span className="num" style={{ fontSize: 'var(--fs-hero)', fontWeight: 'var(--fw-light)', color: over ? 'var(--color-error)' : 'var(--color-black)' }}>
            {typed}<span className="caret">_</span>{typed ? <span style={{ fontSize: 'var(--fs-content-1)' }}> {buy ? 'USDC' : sym}</span> : null}
          </span>
        </button>
        <div style={{ display: 'flex', gap: 'calc(8 * var(--u))' }}>
          {buy ? hint('50%', max ? String(floorTo(max / 2, 2)) : '') : hint('50%', halfSell)}
          {buy ? hint('Max', max ? String(max) : '') : hint('Max', maxSellRaw !== '0' ? rawToDec(maxSellRaw, info?.decimals ?? 18) : '')}
        </div>
      </div>

      {/* Row 6: what you get, the fee, and the note right under them. */}
      <div style={{ ...at('50.95dvh', 'auto'), display: 'flex', flexDirection: 'column', gap: 'calc(8 * var(--u))', padding: '0 calc(11 * var(--u))', fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'calc(8 * var(--u))' }}>
          <span>You get ≈ <span className="num" style={{ color: 'var(--color-black)', fontWeight: 'var(--fw-semibold)' }}>{outTxt}</span></span>
          <span>Fee: <span className="num" style={{ color: 'var(--color-black)', fontWeight: 'var(--fw-semibold)' }}>{amount > 0 && !over ? (feeUsd === null ? '…' : feeUsd < 0.01 ? '<$0.01' : `up to $${feeUsd.toFixed(3)}`) : '-'}</span></span>
        </div>
        <span style={{ fontSize: 'var(--fs-small)', lineHeight: 1.4 }}>
          {buy ? `Max $${MAX_BUY} per buy. You receive at least 3% under the amount shown, or nothing happens. Meme prices swing hard - you can lose most of it. No app fee.`
            : 'You receive at least 3% under the amount shown, or nothing happens. No app fee.'}
        </span>
      </div>

      {/* Row 9: the button. */}
      <div style={{ ...at('81.52dvh', '8.29dvh'), display: 'flex', alignItems: 'center' }}>
        <button className={`btn ${error ? 'btn-secondary' : done ? 'btn-success' : 'btn-primary'}`}
          style={{ width: '100%', height: 'var(--btn-h)', minHeight: 0, borderRadius: 38, ...(error ? { color: 'var(--color-error)' } : null) }}
          disabled={amount > 0 ? !can && !error : loading || done || !info?.supported || blocked}
          onClick={() => error ? setError('') : amount > 0 ? run() : setPad(true)}>
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

      <ExitBar onClick={() => navigate('Memes')} />
    </div>
  )
}

// Decimal string → base units string (the same rule as the server's toBaseUnits; used only to compare with the balance).
function toRaw(s, dec) {
  const [i, f = ''] = s.split('.')
  return (BigInt(i || '0') * 10n ** BigInt(dec) + BigInt((f + '0'.repeat(dec)).slice(0, dec) || '0')).toString()
}
