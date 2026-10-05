import NavBar from '../components/NavBar'
import ScreenSheet from '../components/ScreenSheet'
import BalanceHeader from '../components/BalanceHeader'
import Icon from '../components/Icon'
import FundsPopup from '../components/FundsPopup'
import { getTokenBalances, cachedBalances, sumUsd } from '../chain'
import { useState, useEffect } from 'react'
import { useNav } from '../nav'
import { GRADIENT } from '../brandBg'
import { NET } from '../clientNet'

// ⛔ 'Service Hub' NOT HERE - it is already TAB 1 of the NavBar (unchanged rule from before the redesign).
//
// MENU - Figma node 58:164, rebuilt 2026-09-23. Row centres/dividers below are that node's own numbers,
// converted the usual way (x = px/390 as %, y = px/844 as dvh).
// ⚠️ THE DIVIDER OFFSET (+34.5px below each row's centre) is NOT freshly re-measured for this file - the
// divider is baked into the frame's background image (`imgRectangle319`), same as the pre-redesign file,
// so there is no separate node to read its y from. It is INFERRED from the 86px row-to-row step, which
// IS re-measured and is unchanged from before the redesign (379→465→551→637, each +86) - the divider sits
// at a fixed offset within that repeating 70px-row + 16px-gutter unit, so the old +34.5px should still
// hold structurally even though the whole block shifted down. Flagged here so a future correction is easy
// to spot if it turns out wrong, rather than reading as an already-verified number.
const ITEMS = [
  { id: 'TxHistory', label: 'Transaction history',            top: '44.91dvh', rule: '48.99dvh', icon: 'clock' },
  // Figma merges the old separate Security/Currency rows into one: "Security, language & currency",
  // renamed "Security & Region" (user decision 2026-09-27).
  // Security.jsx (node 58:332, rebuilt 2026-09-24) now absorbs the language/currency chips inline -
  // Currency.jsx is deleted, this still navigates to 'Security'.
  { id: 'Security',  label: 'Security & Region',  top: '55.09dvh', rule: '59.18dvh', icon: 'shield' },
  // ⚠️ NEW ROW, NO DESTINATION YET. Figma draws it (node 58:220/58:221) but there is no corresponding
  // frame anywhere in the file and no existing screen/route for it. Disabled - same standard as
  // "Withdraw" below (drawn, not yet wired) - until the user gives it a real screen to open.
  { id: 'LearnBlockchain', label: 'Learn about blockchain',   top: '65.28dvh', rule: '69.37dvh', disabled: true, icon: 'book' },
  { id: 'About',      label: 'About ezwallet',                top: '75.47dvh', rule: '79.56dvh', icon: 'info' },
]

// Row geometry - left/right markers at the standard 6.41% inset (matches every other card's side margin
// in this file), label filling the space between them with an 8px gap on each side.
const ROW_STYLE = { position: 'absolute', left: '6.41%', right: '6.41%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 'calc(8 * var(--u))', padding: 0, minHeight: 'calc(44 * var(--u))' }

// The row's leading/trailing marker - nodes 58:215/58:217/58:220/58:223 (left) and 58:232-58:236
// (right). Figma still draws both as a flat 17.436px SQUARE (no icon layer to read), but the user
// resolved what they mean, 2026-09-23: LEFT = a per-row symbolic icon (different per row), RIGHT = one
// shared right-chevron icon on every row (tap-to-open). Built 2026-09-24. Sized to the marker's own
// footprint (18 ≈ 17.436) rather than a token, since nothing asked for a different size.
function RowIcon({ name, color, size = 'calc(18 * var(--u))' }) {
  return <Icon name={name} size={size} color={color} />
}

export default function MenuScreen() {
  const { navigate } = useNav()
  const [totalUsd, setTotalUsd] = useState(() => { const c = cachedBalances(localStorage.getItem('ez_wallet_addr')); return c ? sumUsd(c) : null })
  useEffect(() => {
    const addr = localStorage.getItem('ez_wallet_addr')
    if (addr) getTokenBalances(addr).then(ts => setTotalUsd(sumUsd(ts))).catch(() => {})
  }, [])

  // Same source + truncation Security.jsx already uses for this exact data - kept identical rather than
  // inventing a second convention for the same three facts.
  const email = localStorage.getItem('ez_email') || localStorage.getItem('ez_google_email') || '…'
  const walletAddr = localStorage.getItem('ez_wallet_addr') || '…'
  // 0xabcd...efgh (user decision 2026-09-27: the old 10+6 cut ran too long) - Figma's own placeholder
  // format: "0x" + 4 chars, "...", last 4 chars. The copy button next to it copies the FULL address.
  const shortAddr = walletAddr !== '…' ? walletAddr.slice(0, 6) + '...' + walletAddr.slice(-4) : '…'
  const [copied, setCopied] = useState(false)
  function copyAddr() {
    if (walletAddr === '…') return
    navigator.clipboard?.writeText(walletAddr).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 1200)   // same check-mark feedback as Contacts
  }
  const [popup, setPopup] = useState(null)   // 'deposit' | 'withdraw' | null - see FundsPopup

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      {/* Everything lives in this layer so the Deposit/Withdraw popup can blur it - same as Login + its email popup.
          inset:0 keeps every absolute coordinate below unchanged; taps are cut while a popup is open. */}
      <div style={{ position: 'absolute', inset: 0, filter: popup ? 'blur(6px)' : 'none', pointerEvents: popup ? 'none' : 'auto' }}>
      <ScreenSheet active="MenuScreen" />

      <BalanceHeader totalUsd={totalUsd} loading={totalUsd === null} />

      {/* INFO CARD - node 58:199: 340x156 at (25,86), radius 8 (NOT 16 - every other card in this
          redesign is 16; this one is genuinely 8 in the node, kept as measured). Figma's example text
          ("kattyfury1403@gmail.com" / "Arc" / "0xabcd...efgh") is placeholder DATA, same as Send's
          "$10,000.00" - replaced with the real values, sourced exactly like Security.jsx already does.
          The network is NET.label ("Arc"), the label used everywhere else in the app. */}
      <div style={{
        position: 'absolute', left: '6.41%', top: '10.19dvh', width: '87.18%', height: '18.48dvh',
        background: 'var(--color-card)', borderRadius: 16,
        display: 'flex', alignItems: 'center', padding: '0 calc(16 * var(--u))',
      }}>
        <p style={{ margin: 0, fontSize: 'var(--fs-content-1)', lineHeight: 'calc(32 * var(--u))', color: 'var(--color-black)' }}>
          Email: <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)' }}>{email}</span><br />
          Network: <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)' }}>{NET.label}</span><br />
          Wallet address: <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)' }}>{shortAddr}</span>
          <button onClick={copyAddr} aria-label="Copy wallet address"
            style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 'calc(8 * var(--u))', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>
            <Icon name={copied ? 'check' : 'copy'} size="calc(18 * var(--u))" color={copied ? 'var(--color-primary)' : 'var(--color-brand)'} />
          </button>
        </p>
      </div>

      {/* WITHDRAW / DEPOSIT - nodes 58:208-58:210 (left, white) and 58:204-58:206 (right, brand blue),
          both 166x70 at y=258 (30.57dvh), an 8px gap between them (25+166=191, right starts at 199).
          ⚠️ FIGMA LABELS BOTH BUTTONS "Deposit" - almost certainly a copy-paste slip in the file (the
          left one is white/inactive, the right one is blue/active, exactly the existing Withdraw/Deposit
          pair's visual states). Kept as "Withdraw" here, matching its own established, still-accurate
          behaviour rather than shipping two buttons that say the
          same word. Flagged to the user; revert to Figma's literal text if that duplication turns out to
          be intentional. Icons: `withdraw`/`deposit` (arrow leaving / landing on a line) - owner picked
          option B 2026-10-03 because the plain `up`/`down` used before were the SAME glyphs as the NavBar's
          Send/Receive, so Withdraw read as Send and Deposit as Receive. Size = 1.2x the label (--ib-content-1). */}
      <button className="btn" onClick={() => setPopup('withdraw')} style={{
        position: 'absolute', left: '6.41%', top: '30.57dvh', width: '42.56%', height: 'calc(70 * var(--u))',
        background: 'var(--btn-grad-white)', border: 'none', borderRadius: 16,
        boxShadow: '0 0 8px rgba(0, 0, 0, 0.48)', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'calc(2 * var(--u))',
        fontFamily: 'inherit', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)',
      }}>
        <Icon name="withdraw" size="var(--ib-content-1)" color="var(--color-black)" />
        Withdraw
      </button>
      {/* Deposit / Withdraw open FundsPopup (owner spec 2026-10-03): Deposit = this wallet's Arc address, Withdraw =
          a send to another Arc address. No fiat on/off-ramp (Onramp Kit needs a KYB the owner does not have). */}
      <button className="btn" onClick={() => setPopup('deposit')} style={{
        position: 'absolute', left: '51.03%', top: '30.57dvh', width: '42.56%', height: 'calc(70 * var(--u))',
        background: 'var(--btn-grad-brand)', border: 'none', borderRadius: 16,
        boxShadow: '0 0 8px rgba(0, 0, 0, 0.48)', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'calc(2 * var(--u))',
        fontFamily: 'inherit', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-white)',
      }}>
        <Icon name="deposit" size="var(--ib-content-1)" color="var(--color-white)" />
        Deposit
      </button>

      {ITEMS.map(({ id, label, top, rule, disabled, icon }) => (
        <div key={id}>
          <button style={{ ...ROW_STYLE, top, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', background: 'none' }}
            disabled={disabled} onClick={disabled ? undefined : () => navigate(id, { title: label })}>
            <RowIcon name={icon} size="var(--ib-content-1)" color="var(--color-black)" />
            <span style={{ flex: 1, fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)', textAlign: 'left' }}>{label}</span>
            <RowIcon name="right2" color="var(--color-black)" />
          </button>
          {/* 0.5px, #94A3B8 - the SAME hairline spec as AddToHome's share-sheet dividers (Figma bakes
              this exact stroke into that screen's own asset: stroke="#94A3B8" stroke-width="0.5"). Was
              `var(--color-gray)` (#E3E3E3, a different pre-redesign token) - the user approved having a
              divider here at all (it isn't in the Figma node, inferred - see the comment on ITEMS above)
              but corrected the colour to match the other one this redesign already draws. */}
          <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: rule, height: 0.5, background: 'var(--color-muted)' }} />
        </div>
      ))}

      {/* Sign out - node 58:226/58:227/58:236: same row shape, both markers AND the label in the danger
          red. No divider - it is the last row. */}
      <button style={{ ...ROW_STYLE, top: '85.66dvh', border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => {
        ;['ez_user_token','ez_wallet_addr','ez_wallet_id','ez_encryption_key','ez_email','ez_auth_token','ez_notifs','ez_last_recv_ts','ez_refresh_token','ez_google_email','ez_login_method'].forEach(k => localStorage.removeItem(k))
        sessionStorage.removeItem('ez_pin_ok')
        sessionStorage.removeItem('ez_sync_token')
        window.location.reload()
      }}>
        <RowIcon name="out" size="var(--ib-content-1)" color="var(--color-error)" />
        <span style={{ flex: 1, fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-error)', textAlign: 'left' }}>Sign out</span>
        <RowIcon name="right2" color="var(--color-error)" />
      </button>

      <NavBar active="MenuScreen" />
      </div>

      {popup && <FundsPopup mode={popup} onClose={() => setPopup(null)} />}
    </div>
  )
}
