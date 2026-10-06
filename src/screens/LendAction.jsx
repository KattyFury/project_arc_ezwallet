import { useState, useEffect, useRef } from 'react'
import { useNav } from '../nav'
import Numpad from '../components/Numpad'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { earnApi } from '../earn'
import { getSDK, executeChallenge, refreshSession, circleErrorMessage } from '../circle'
import { getTokenBalances, cachedBalances, getDisplayRates, cachedRates } from '../chain'
import { floorTo, GAS_RESERVE_USDC } from '../data'
import { addNotif } from '../notif'
import { assertNetworkReady, NET } from '../clientNet'
import { toAmountString } from '../money'
import { newAttempt, getPending, clearPending, lookup, classify, waitFinal } from '../txTracker'
import { usdRateOf, Tabs } from './Lending'

// DEPOSIT / WITHDRAW one Earn vault (params: kind 'deposit'|'withdraw', vault, position). Same money path as Swap:
// /api/earn 'fee' (Circle's estimate for the exact batch) → 'execute' (intent checked + simulated on the server) → ONE PIN
// → txTracker (MAINNET-AUDIT C3: no second attempt while one is unresolved; Send/Swap/Earn share the slot).
// Row map (owner 2026-10-05): 1 tabs Deposit | Withdraw · 2-3 the vault · 4-5 the amount (tap → numpad) + [50%] [Max]
// hints · 6 fee + the note right under it · 9 the button · 10 Exit (back to Lending).
const MAX_USD = 200   // also enforced by the server (functions/api/_earnCore.js EARN_MAX_USD)
// DISPLAY ONLY (owner 2026-10-06): the amount field shows at most 2 decimals - "1.00000008 USDC" was noise. Max/50% still
// carry the EXACT amount (Max = everything, nothing left behind); the field shows "≈ 1.00" when digits are hidden.
const SHOW_DEC = 2
const shown = (s) => {
  const [i, f = ''] = s.split('.')
  if (f.length <= SHOW_DEC) return s
  return `${/[1-9]/.test(f.slice(SHOW_DEC)) ? '≈ ' : ''}${i}.${f.slice(0, SHOW_DEC)}`
}
const BOX = { border: 'none', borderRadius: 16, background: 'var(--color-card)' }
const at = (top, height) => ({ position: 'absolute', left: '6.41%', right: '6.41%', top, height })
const fmtAmt = (n, d = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const trim = (s) => s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s

export default function LendAction() {
  const { navigate, params } = useNav()
  const { vault = {}, position = null } = params || {}
  const [kind, setKind] = useState(params?.kind === 'withdraw' ? 'withdraw' : 'deposit')
  const asset = vault.asset || 'USDC'
  const dec = NET.tokens[asset]?.decimals ?? 6
  const deposit = kind === 'deposit'
  const walletAddress = localStorage.getItem('ez_wallet_addr')
  const walletId = localStorage.getItem('ez_wallet_id')

  const [balances, setBalances] = useState(() => {
    const c = cachedBalances(walletAddress)
    return c ? Object.fromEntries(c.map(t => [t.symbol, t.amount])) : {}
  })
  const [rates, setRates] = useState(() => cachedRates())
  const [maxOut, setMaxOut] = useState(null)        // withdraw: what the vault can pay right now (Circle quote)
  const [typed, setTyped] = useState('')
  const [pad, setPad] = useState(false)
  const [feeUsd, setFeeUsd] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const debounce = useRef(null)

  useEffect(() => {
    if (walletAddress) getTokenBalances(walletAddress).then(ts => setBalances(Object.fromEntries(ts.map(t => [t.symbol, t.amount])))).catch(() => {})
    getDisplayRates().then(setRates).catch(() => {})
  }, [])
  // Withdraw tab: what the vault can pay me right now (Circle quote). Nothing deposited → nothing to withdraw.
  useEffect(() => {
    if (deposit || maxOut !== null) return
    if (!position) { setMaxOut(0); return }
    earnApi('quote', { kind: 'withdraw', vault: vault.address, amount: toAmountString(Math.min(position.balance, 0.01), dec), walletAddress })
      .then(q => setMaxOut(q.maxWithdrawable)).catch(e => setError(e.message))
  }, [kind])
  function switchKind(k) { if (loading || done || k === kind) return; setKind(k); setTyped(''); setFeeUsd(null); setError(''); setStatus('') }
  // Swapping EURC still pays the fee in USDC → say so on the button (as Swap).
  const usdcShortMsg = (f) => `Not enough USDC for the network fee (up to $${f.toFixed(3)})`

  // The most this action can move. Deposit: wallet balance (USDC keeps the fee back) ∧ what the vault can pay out now
  // (owner rule) ∧ $200. Withdraw: my position ∧ what the vault can pay now. Unknown → null (button stays off).
  const rate = usdRateOf(asset, rates)
  const max = (() => {
    if (deposit) {
      const bal = balances[asset]
      if (bal === undefined || rate === null) return null
      const spendable = asset === 'USDC' ? bal - Math.max(GAS_RESERVE_USDC, feeUsd ?? 0) : bal
      return Math.max(0, floorTo(Math.min(spendable, vault.withdrawable ?? 0, MAX_USD / rate), dec))
    }
    if (maxOut === null) return null
    if (!position) return 0
    return Math.max(0, floorTo(Math.min(position.balance, maxOut), dec))
  })()
  const amount = parseFloat(typed) || 0
  const over = max !== null && amount > max + 1e-12
  const usdcShort = feeUsd !== null && asset !== 'USDC' && balances.USDC !== undefined && balances.USDC < feeUsd
  const can = amount > 0 && !over && feeUsd !== null && !usdcShort && !loading && !done

  // Circle's fee for this exact amount (debounced, like Swap).
  useEffect(() => {
    clearTimeout(debounce.current); setFeeUsd(null)
    if (!(amount > 0) || over) return
    debounce.current = setTimeout(() => {
      earnApi('fee', { kind, vault: vault.address, amount: toAmountString(amount, dec), walletId, walletAddress })
        .then(f => { setFeeUsd(Number(f.feeMax) > 0 ? Number(f.feeMax) : null); setError('') })
        .catch(e => setError(e.message))
    }, 600)
    return () => clearTimeout(debounce.current)
  }, [amount, over, kind])

  function setAmount(n) { setTyped(n > 0 ? trim(toAmountString(n, dec)) : ''); setError('') }
  function onPadKey(k) {
    if (k === 'BACK') return setTyped(t => t.slice(0, -1))
    if (k === '.') return setTyped(t => t.includes('.') ? t : (t || '0') + '.')
    const [i = '', d] = typed.split('.')
    if (d !== undefined ? d.length >= dec : i.length >= 9) return
    setTyped(typed === '0' ? k : typed + k)
  }

  async function run() {
    setLoading(true); setError(''); setStatus('Preparing…')
    const STILL = 'Your last transaction is still being confirmed. Do NOT try again yet - check Transaction history in a moment.'
    const blocked = (m) => { setLoading(false); setStatus(''); setError(m) }
    let attempt = null
    const amt = toAmountString(amount, dec)
    const verb = deposit ? 'Deposited' : 'Withdrew'
    try {
      await assertNetworkReady()
      const prev = getPending()
      if (prev) {
        let r
        try { r = classify(await lookup(prev)) } catch { return blocked(STILL) }
        if (r === 'pending') return blocked(STILL)
        clearPending(prev.refId)
      }
      attempt = newAttempt('earn', { kind, vault: vault.address })
      const { userToken, encryptionKey } = await refreshSession()
      const res = await earnApi('execute', { kind, vault: vault.address, amount: amt, userToken, walletId, walletAddress, refId: attempt.refId })
        .catch(e => { clearPending(attempt.refId); throw e })   // no challenge → nothing can exist
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
        addNotif(`${verb} ${amt} ${asset} - ${vault.name} (failed - nothing moved)`, 'error', null, `earn-fail-${Date.now()}`)
        return blocked(signError && outcome === 'none' ? circleErrorMessage(signError) : 'The network rejected this - nothing left your wallet.')
      }
      if (outcome !== 'ok') return blocked(STILL)
      clearPending(attempt.refId)
      addNotif(`${verb} ${amt} ${asset} ${deposit ? 'into' : 'from'} ${vault.name} (complete)`, 'sent', null, `earn-${Date.now()}`)
      setLoading(false); setDone(true); setStatus(deposit ? 'Deposit successful' : 'Withdrawal successful')
      setTimeout(() => navigate('Lending'), 2000)
    } catch (e) {
      if (attempt && getPending()?.refId === attempt.refId) return blocked(STILL)
      setLoading(false); setStatus(''); setError(circleErrorMessage(e))
    }
  }

  const avail = deposit ? balances[asset] : position?.balance
  const hint = (label, n) => (
    <button key={label} disabled={!(n > 0) || loading} onClick={() => setAmount(n)} style={{
      border: '1.5px solid var(--color-brand)', background: 'none', borderRadius: 999, padding: 'calc(6 * var(--u)) calc(14 * var(--u))',
      fontFamily: 'inherit', fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer',
      color: n > 0 ? 'var(--color-brand)' : 'var(--color-muted)', borderColor: n > 0 ? 'var(--color-brand)' : 'var(--color-muted)',
    }}>{label}</button>
  )
  const label = error || (usdcShort ? usdcShortMsg(feeUsd) : '') || status || (amount > 0 ? (deposit ? 'Deposit' : 'Withdraw') : 'Tap the amount to enter')

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <Tabs tabs={[['deposit', 'Deposit'], ['withdraw', 'Withdraw']]} tab={kind} setTab={switchKind} />

      {/* Rows 2-3: the vault. */}
      <div style={{ ...at('10.19dvh', '18.48dvh'), ...BOX, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'calc(6 * var(--u))', padding: 'calc(16 * var(--u))' }}>
        <span style={{ fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)' }}>{vault.name}</span>
        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>APY {typeof vault.apy === 'number' ? `${(vault.apy * 100).toFixed(2)}%` : '…'}{vault.curator ? ` · ${vault.curator}` : ''}</span>
        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>
          Withdrawable now: <span className="num" style={{ color: 'var(--color-black)', fontWeight: 'var(--fw-semibold)' }}>
            {deposit ? `${fmtAmt(vault.withdrawable)} ${asset}` : maxOut === null ? '…' : `${fmtAmt(maxOut)} ${asset}`}</span>
        </span>
      </div>

      {/* Rows 4-5: the amount. */}
      <div style={{ ...at('30.57dvh', '18.48dvh'), ...BOX, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'calc(10 * var(--u))', padding: 'calc(16 * var(--u))' }}>
        <span style={{ fontSize: 'var(--fs-content-2)', color: 'var(--color-muted-2)' }}>
          {deposit ? 'Available' : 'In this vault'}: <span className="num" style={{ color: 'var(--color-brand)', fontWeight: 'var(--fw-semibold)' }}>{avail === undefined || avail === null ? '…' : `${fmtAmt(avail)} ${asset}`}</span>
        </span>
        <button onClick={() => !loading && !done && setPad(true)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <span className="num" style={{ fontSize: 'var(--fs-hero)', fontWeight: 'var(--fw-light)', color: over ? 'var(--color-error)' : typed ? 'var(--color-black)' : 'var(--color-muted)' }}>
            {/* Empty → only the blinking caret (owner: "0_ USDC" made no sense). */}
            {pad ? typed : shown(typed)}<span className="caret">_</span>{typed ? <span style={{ fontSize: 'var(--fs-content-1)' }}> {asset}</span> : null}
          </span>
        </button>
        <div style={{ display: 'flex', gap: 'calc(8 * var(--u))' }}>
          {hint('50%', max === null ? 0 : floorTo(max / 2, dec))}
          {hint('Max', max ?? 0)}
        </div>
      </div>

      {/* Row 6: fee + the cap, the note RIGHT UNDER them (owner: an orphan note in row 7 looked odd). */}
      <div style={{ ...at('50.95dvh', 'auto'), display: 'flex', flexDirection: 'column', gap: 'calc(8 * var(--u))', padding: '0 calc(11 * var(--u))', fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'calc(8 * var(--u))' }}>
          <span>Fee: <span className="num" style={{ color: 'var(--color-black)', fontWeight: 'var(--fw-semibold)' }}>{amount > 0 && !over ? (feeUsd === null ? '…' : feeUsd < 0.01 ? '<$0.01' : `up to $${feeUsd.toFixed(3)}`) : '-'}</span></span>
          {deposit && <span>Max ${MAX_USD} per deposit</span>}
        </div>
        <span style={{ fontSize: 'var(--fs-small)', lineHeight: 1.4 }}>
          {deposit ? 'Vault funds are lent out. Withdrawals can be delayed. Value can fall in extreme markets. No app fee.'
            : 'You can withdraw up to what the vault has free right now. The rest stays in the vault and keeps earning.'}
        </span>
      </div>

      {/* Row 9: the button - the only place status/errors show (as Swap). */}
      <div style={{ ...at('81.52dvh', '8.29dvh'), display: 'flex', alignItems: 'center' }}>
        <button className={`btn ${error ? 'btn-secondary' : done ? 'btn-success' : 'btn-primary'}`}
          style={{ width: '100%', height: 'var(--btn-h)', minHeight: 0, borderRadius: 38, ...(error ? { color: 'var(--color-error)' } : null) }}
          disabled={amount > 0 ? !can && !error : loading || done}
          onClick={() => amount > 0 ? (error ? setError('') : run()) : setPad(true)}>
          <span style={{ fontSize: 'var(--fs-content-1)', lineHeight: 1.2, textAlign: 'center', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>
            {over ? `At most ${fmtAmt(max, Math.min(dec, 6))} ${asset}` : label}
          </span>
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

      <ExitBar onClick={() => navigate('Lending')} />
    </div>
  )
}
