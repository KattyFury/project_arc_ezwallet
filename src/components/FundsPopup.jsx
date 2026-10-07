import { useState, useEffect } from 'react'
import { useNav } from '../nav'
import Icon from './Icon'
import { getTokenBalances, cachedBalances } from '../chain'
import { isOwnAddress } from '../data'
import { amountProblem, isValidAddress, normalizeTyped, fmtAmountShort } from '../money'
import { NET } from '../clientNet'

// DEPOSIT / WITHDRAW popups over the Menu (owner spec 2026-10-03). Same pattern as LoginEmailPopup: a white
// card, glow shadow, NO dark scrim - MenuScreen blurs itself behind it. Smaller than the login card (owner:
// "ko cần quá to"): same top edge as the login card, height sized to its content.
// Closes on the X (top-right) or a tap anywhere outside the card.
// No fiat on/off-ramp (owner decision 2026-10-03: no KYB → Onramp Kit dropped). Deposit = this wallet's own
// address; Withdraw = an ordinary send to another Arc address, handed to the existing SendConfirm (fee, PIN,
// tracking, receipt) exactly like the Send flow.

const field = {
  display: 'flex', alignItems: 'center', gap: 'calc(8 * var(--u))',
  height: 'var(--input-h)', padding: '0 calc(12 * var(--u))',
  background: 'var(--color-card)', borderRadius: 16,
}
const input = {
  flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'none', padding: 0,
  fontFamily: 'inherit', fontSize: 'var(--fs-content-1)', color: 'var(--color-black)',
}
const note = { margin: 0, fontSize: 'var(--fs-caption)', lineHeight: 1.4, color: 'var(--color-muted-2)' }
const iconBtn = { display: 'inline-flex', flexShrink: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }

function Deposit() {
  const addr = localStorage.getItem('ez_wallet_addr') || ''
  const [copied, setCopied] = useState(false)
  function copy() {
    if (!addr) return
    navigator.clipboard?.writeText(addr).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 1200)   // same check-mark feedback as the Menu card
  }
  return (
    <>
      {/* The FULL address (wrapped), never shortened: people copy it by eye too. */}
      <div style={{ ...field, height: 'auto', padding: 'calc(12 * var(--u))' }}>
        <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontSize: 'var(--fs-content-2)', lineHeight: 1.4, fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)' }}>
          {addr || '…'}
        </span>
        <button onClick={copy} aria-label="Copy wallet address" style={iconBtn}>
          <Icon name={copied ? 'check' : 'copy'} size="calc(22 * var(--u))" color={copied ? 'var(--color-primary)' : 'var(--color-brand)'} />
        </button>
      </div>
      <p style={note}>
        Send USDC, EURC or cirBTC on the <b>Arc network</b> to this address to add money to your wallet.
        Money sent from another network (Ethereum, Base…) will not arrive.
      </p>
    </>
  )
}

function Withdraw() {
  const { navigate } = useNav()
  const me = localStorage.getItem('ez_wallet_addr')
  const [tokens, setTokens] = useState(() => cachedBalances(me))
  useEffect(() => { if (me) getTokenBalances(me).then(setTokens).catch(() => {}) }, [me])

  // Only tokens actually held; USDC alone when the wallet is empty (balance 0 → Continue stays off).
  const held = (tokens || []).filter(t => t.amount > 0)
  const choices = held.length ? held : [{ symbol: 'USDC', amount: tokens ? 0 : null }]
  const [sym, setSym] = useState(null)
  const cur = choices.find(t => t.symbol === sym) || choices[0]

  const [address, setAddress] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const addr = address.trim()
  const amt = normalizeTyped(amountStr.trim())
  const decimals = NET.tokens[cur.symbol]?.decimals ?? 6

  const addrError = !addr ? '' : !isValidAddress(addr) ? 'This is not a valid wallet address'
    : isOwnAddress(addr) ? 'This is your own wallet' : ''
  const amtError = !amt ? '' : amountProblem(amt, decimals)
    || (cur.amount !== null && Number(amt) > cur.amount ? 'More than you have' : '')
  const ok = addr && amt && !addrError && !amtError && cur.amount !== null

  async function paste() {
    try { setAddress((await navigator.clipboard.readText()).trim()) } catch { /* clipboard refused - type it */ }
  }
  function go() {
    if (!ok) return
    navigate('SendConfirm', { address: addr, name: null, amount: Number(amt), amountStr: amt, memo: '', currency: cur.symbol, back: 'MenuScreen' })
  }

  return (
    <>
      <div style={field}>
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Wallet address (0x…)"
          autoComplete="off" autoCapitalize="off" spellCheck={false} style={input} />
        <button onClick={paste} aria-label="Paste wallet address" style={{ ...iconBtn, fontFamily: 'inherit', fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)' }}>
          Paste
        </button>
      </div>

      {/* Amount (left half) + token choice (right half). */}
      <div style={{ display: 'flex', gap: 'calc(8 * var(--u))' }}>
        <div style={{ ...field, flex: 1, minWidth: 0 }}>
          <input value={amountStr} inputMode="decimal" placeholder="Amount"
            onChange={e => setAmountStr(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))} style={input} />
        </div>
        {/* One button, tap = next held token (any verified token with a balance: USDC, EURC, cirBTC). */}
        <button onClick={() => setSym(choices[(choices.indexOf(cur) + 1) % choices.length].symbol)}
          disabled={choices.length < 2}
          style={{
            ...field, flex: 1, minWidth: 0, justifyContent: 'center', border: 'none',
            cursor: choices.length < 2 ? 'default' : 'pointer',
            fontFamily: 'inherit', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)',
          }}>
          <img src={`/tokens/${cur.symbol.toLowerCase()}.png`} alt="" style={{ width: 'calc(24 * var(--u))', height: 'calc(24 * var(--u))', borderRadius: '50%' }} />
          {cur.symbol}
          {choices.length > 1 && <Icon name="down2" size="calc(18 * var(--u))" color="var(--color-black)" />}
        </button>
      </div>

      <p style={{ ...note, color: 'var(--color-muted-2)' }}>
        Current balance: <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)' }}>
          {/* Same short form as Send (6 significant digits, "≈" when cut) - toFixed(2) showed a small cirBTC
              balance as 0.00 / 0.02. Display only. */}
          {cur.amount === null ? '…' : (({ text, cut }) => `${cut ? '≈ ' : ''}${text} ${cur.symbol}`)(fmtAmountShort(cur.amount.toFixed(decimals)))}
        </span>
      </p>

      {(addrError || amtError) && (
        <p style={{ ...note, color: 'var(--color-error)' }}>{addrError || amtError}</p>
      )}

      <p style={note}>
        Paste the wallet you want to send your money to, enter the amount, then tap the token to switch between the ones you hold.
        The wallet must be on the <b>Arc network</b>.
      </p>

      <button onClick={go} disabled={!ok} className="btn"
        style={{
          height: 'var(--btn-h)', border: 'none', borderRadius: 16,
          background: 'var(--btn-grad-brand)', color: 'var(--color-white)', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.48)',
          fontFamily: 'inherit', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)',
          opacity: ok ? 1 : 0.5, cursor: ok ? 'pointer' : 'not-allowed',
        }}>
        Continue
      </button>
    </>
  )
}

export default function FundsPopup({ mode, onClose }) {
  return (
    // Full-screen catcher: a tap outside the card closes the popup.
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      <div onClick={e => e.stopPropagation()} style={{
        // Same top edge / left / width as LoginEmailPopup's card (node 51:5: (25,86), 340 wide); the height follows the content.
        position: 'absolute', left: '6.41%', width: '87.18%', top: '10.19dvh',
        maxHeight: '85dvh', overflowY: 'auto', boxSizing: 'border-box',
        background: 'var(--color-white)', borderRadius: 16, boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
        padding: 'calc(20 * var(--u)) calc(16 * var(--u))',
        display: 'flex', flexDirection: 'column', gap: 'max(8px, calc(12 * var(--u)))',
      }}>
        <button onClick={onClose} aria-label="Close" style={{ ...iconBtn, position: 'absolute', top: 'calc(14 * var(--u))', right: 'calc(14 * var(--u))' }}>
          <Icon name="x" size="calc(24 * var(--u))" color="var(--color-black)" />
        </button>
        <div style={{ textAlign: 'center', fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-semibold)', lineHeight: 'calc(30 * var(--u))', color: 'var(--color-black)' }}>
          {mode === 'deposit' ? 'Deposit' : 'Withdraw'}
        </div>
        {mode === 'deposit' ? <Deposit /> : <Withdraw />}
      </div>
    </div>
  )
}
