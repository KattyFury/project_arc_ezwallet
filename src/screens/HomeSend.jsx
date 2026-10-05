import { useState, useEffect } from 'react'
import NavBar from '../components/NavBar'
import ScreenSheet from '../components/ScreenSheet'
import BalanceHeader from '../components/BalanceHeader'
import Icon from '../components/Icon'
import { useNav } from '../nav'
import { getDisplayCurrency, fmtDisplay, GAS_RESERVE_USDC } from '../data'
import { getTokenBalances, getDisplayRates, cachedBalances, cachedRates, getUnverifiedTokens, sumUsd } from '../chain'
import { ensureWalletAddress } from '../circle'
import NotifArea, { NOTIF_FS } from '../components/NotifArea'
import { GRADIENT } from '../brandBg'

// USDC (left) and $98.59 (right) must share the SAME font and the SAME colour - one shared style object
// so they cannot drift apart (rather than two declarations where it is easy to change only one).
// Weight = Semibold, 18px (2026-09-10, up from Regular/24px 09-08) - the current Figma file draws each
// token as its OWN white card (not a shared divided list), name + amount both Semibold 18.
const TOKEN_TEXT_STYLE = { fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-content)' }

// Small solid triangle (▲/▼) signalling the token's 24h price move (user request 08-25) - a plain CSS/SVG
// shape rather than a shared Icon.jsx entry since it is only ever used here, right next to the amount.
// Green = up, red = down (the app's existing received/lost colours). Flat (<0.005%) → nothing to signal, hide it.
function TrendArrow({ pct }) {
  if (pct == null || Math.abs(pct) < 0.005) return null
  const up = pct > 0
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
      <path d={up ? 'M5 0 L10 10 L0 10 Z' : 'M0 0 L10 0 L5 10 Z'} fill={up ? 'var(--color-primary)' : 'var(--color-error)'} />
    </svg>
  )
}

function pctStr(pct) { return (pct > 0 ? '+' : '') + pct.toFixed(2) + '%' }

// The arrow is for VOLATILE tokens only (user correction 08-25: "stablecoin thì đâu có biến động" - USDC/EURC
// are pegged 1:1 and showing a jittery ±0.01% arrow on them is noise, not signal). Everything in TOKENS that
// is not a stablecoin gets it - today that is only cirBTC.
const STABLECOINS = ['USDC', 'EURC']
const isVolatile = symbol => !STABLECOINS.includes(symbol)

// Matches the "Send" button in Contacts.jsx (height 40, fs-item, Barlow medium - .btn) so both come from the same
// design system. The width is NOT fixed - it hugs its content.
// PRESS AND HOLD (not a sticky toggle): by default it shows $ (which everyday users understand);
// holding reveals the real token amounts; releasing returns to $ - so nobody flips it, forgets, and is left
// staring at "0.0001 cirBTC" with no idea what it means.
// SHAPE (2026-09-10, measured off the Figma render, not guessed): this is a HALF-oval, not a pill.
// Sampling the white run row by row gives width 183 at y=374 growing to 258 at y=412, then the shape is
// cut off at y=414 - which is exactly the grey box's bottom edge, below which the page is white so the
// rest of the shape is invisible. Fitting that curve gives a 258-wide box, top at 374, corner radius 38 on
// the TOP CORNERS ONLY, square at the bottom. It lives INSIDE the grey box (bottom: 0) with the box
// clipping it, so its shadow falls only on the grey and never onto the white page below.
export function ShowTokensButton({ onHoldStart, onHoldEnd }) {
  return (
    <button
      onMouseDown={onHoldStart}
      onMouseUp={onHoldEnd}
      onMouseLeave={onHoldEnd}
      onTouchStart={onHoldStart}
      onTouchEnd={onHoldEnd}
      onTouchCancel={onHoldEnd}
      onContextMenu={e => e.preventDefault()}
      style={HALF_OVAL_STYLE}
      aria-label={'Hold to show token amounts'}
    >
      Hold to show tokens
    </button>
  )
}

// Shared by "Hold to show tokens" (Send) and "Tap to copy your address" (Receive) - the Figma draws both
// at the identical 258×40 half-oval, so they stay one definition rather than two that can drift.
export const HALF_OVAL_STYLE = {
  position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', zIndex: 10,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 'min(66.15vw, calc(var(--screen-max) * 0.6615))', height: 'calc(40 * var(--u))',
  borderRadius: '38px 38px 0 0', border: 'none', background: 'var(--btn-grad-white)',
  boxShadow: '0 0 10px rgba(0, 0, 0, 0.4)',
  padding: '0 calc(18 * var(--u))', overflow: 'hidden', textOverflow: 'ellipsis',
  color: 'var(--color-content)', fontFamily: 'var(--font-condensed)', fontSize: 'var(--fs-content-2)',
  fontWeight: 'var(--fw-semibold)', cursor: 'pointer', whiteSpace: 'nowrap',
  WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none',
}

// ROW 9 ACTION BAND (fix 2026-09-27, user: "16px nha"): the notification card ends at 79.62dvh
// (50.95 + 28.67) and row 10 starts at 91.71dvh. The big pill fills the band with EXACTLY 16px to each
// side at every viewport (70px at 844); the old fixed 70px on a dvh top drifted to 17.8/24.9px on a
// 932px phone and overlapped the NavBar on a 667px one. The side pills stay 48px, centred in the band.
// Gaps: 16 design px, never below 8px on a very short screen (user rule 2026-09-27).
const GAP = 'max(8px, calc(16 * var(--u)))'
const BIG_BTN = { top: `calc(79.62dvh + ${GAP})`, height: `calc(12.09dvh - 2 * ${GAP})` }
const SIDE_BTN = { top: 'calc(85.665dvh - var(--btn-h) / 2)', height: 'var(--btn-h)' }

export default function HomeSend() {
  const { navigate } = useNav()
  // Seeded from the module-level cache → switching screens shows the number IMMEDIATELY (no "..." flash), with a background fetch updating it.
  const seedTokens = cachedBalances(localStorage.getItem('ez_wallet_addr'))
  const [tokens, setTokens] = useState(seedTokens || [])
  const [loading, setLoading] = useState(!seedTokens)
  const cur = getDisplayCurrency()
  const [rates, setRates] = useState(cachedRates)
  // ONE toggle for the whole list (no longer per token): false by default = show $; press and hold
  // ShowTokensButton → true = show the real token amounts; release → back to $.
  const [showToken, setShowToken] = useState(false)
  // Which token's 24h-change popup is open (holds the token so the popup keeps working even if the list refreshes)
  const [pctPopup, setPctPopup] = useState(null)
  // Tokens the wallet holds that this app does not list - view only, never in the total (src/chain.js).
  const [unverified, setUnverified] = useState([])
  const [showUnverified, setShowUnverified] = useState(false)   // collapsed by default - tap the row's arrow to open

  // Reading balances: on failure RETRY, and NEVER fall back to 0.
  // Bug 07-16: `.catch(console.error).finally(() => setLoading(false))` - a failed fetch with no cache yet
  // → tokens=[] + loading=false → totalUsd=0 → the screen confidently drew "$0.00" (an INVENTED balance). Now a failure
  // KEEPS the loading state ("…") and retries every 3s until a REAL number arrives.
  useEffect(() => {
    let cancelled = false
    let timer = null
    ensureWalletAddress().then(addr => {
      if (cancelled) return
      if (!addr) { setLoading(false); return }
      const load = () => getTokenBalances(addr)
        .then(ts => { if (!cancelled) { setTokens(ts); setLoading(false) } })
        .catch(() => { if (!cancelled) timer = setTimeout(load, 3000) })
      load()
      // Best effort: a failure just leaves the section hidden - it never touches the verified balances.
      getUnverifiedTokens().then(us => { if (!cancelled) setUnverified(us) }).catch(() => {})
    })
    getDisplayRates().then(setRates).catch(() => {})
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  const totalUsd = sumUsd(tokens)
  // Only tokens the user actually HOLDS are listed (owner 2026-09-29: an EURC row at 0 when you have no EURC
  // "looks odd"). Display only - totals, the low-USDC warning and other screens still use the full `tokens`.
  const heldTokens = tokens.filter(t => t.amount > 0)

  // SEND - Figma node 1:328, rebuilt 2026-09-23. Every coordinate is that node's own number in the
  // app's convention (x = px/390 as %, y = px/844 as dvh).
  //
  // What changed from the pre-redesign screen, so nobody "restores" it by accident:
  //   - the ground is the brand GRADIENT, not white;
  //   - the cards are #D2DCE6 (--color-card), darker than the old --color-surface;
  //   - each token is a 308x40 RADIUS-8 white row on a 48px step, not a 48-tall radius-16 card;
  //   - the action pills are radius-16 rectangles, not the old 28/32 ovals;
  //   - the NavBar has no bar at all any more (see NavBar.jsx).
  return (
    <div className="screen" style={{ background: GRADIENT }}>
      {/* The white sheet the whole screen sits on. FIRST child on purpose: it must paint
          behind every card, pill and label that follows. */}
      <ScreenSheet active="HomeSend" />

      <BalanceHeader totalUsd={totalUsd} loading={loading} />

      {/* TOKEN CARD - node 1:334: 340x328 at (25,86), i.e. rows 2-5 of the guideline grid.
          overflow:hidden so the "Hold to show tokens" pill is clipped at the card's bottom edge, which
          is what makes it read as a half-oval sitting on that edge rather than a floating button. */}
      <div style={{
        position: 'absolute', left: '6.41%', top: '10.19dvh', width: '87.18%', height: '38.86dvh',
        background: 'var(--color-card)', borderRadius: 16, padding: 'calc(15.94 * var(--u)) calc(16 * var(--u)) 0', minWidth: 0,
        overflow: 'hidden',
      }}>
        <div className="scroll-hidden" style={{
          display: 'flex', flexDirection: 'column', gap: 'calc(8 * var(--u))', overflowY: 'auto', height: '100%', paddingBottom: 'calc(44 * var(--u))',
          WebkitMaskImage: 'linear-gradient(to top, transparent 0, black calc(100dvh / 30))',
          maskImage: 'linear-gradient(to top, transparent 0, black calc(100dvh / 30))',
        }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-muted-2)', fontSize: 'var(--fs-content-1)', padding: '0 calc(2 * var(--u))' }}>Loading...</div>
        ) : heldTokens.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-muted-2)', fontSize: 'var(--fs-content-1)', padding: '0 calc(2 * var(--u))' }}>
            No tokens yet
          </div>
        ) : (
          <>
            {/* One row per token - nodes 1:357 / 56:17: 308x40, radius 8, white. Figma stacks two of them
                at y=101.9 and y=149.9, a 48px step = 40 tall plus the 8px gap declared above. */}
            {heldTokens.map(tk => (
              <div key={tk.symbol} style={{
                display: 'flex', alignItems: 'center', gap: 'calc(8 * var(--u))', flexShrink: 0,
                height: 'calc(40 * var(--u))', borderRadius: 16, background: 'var(--color-white)', padding: '0 calc(16 * var(--u))',
              }}>
                {/* Figma draws a flat 26.3px BLACK SQUARE here (nodes 1:364 / 56:20) - a placeholder for
                    the real token mark, per the user's rule about squares in this file. */}
                <img
                  src={`/tokens/${tk.symbol.toLowerCase()}.png`}
                  alt=""
                  style={{ width: 'calc(26.325 * var(--u))', height: 'calc(26.325 * var(--u))', borderRadius: '50%', flexShrink: 0 }}
                  onError={e => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
                <div className="token-icon" style={{ width: 'calc(26.325 * var(--u))', height: 'calc(26.325 * var(--u))', background: tk.color, flexShrink: 0, display: 'none' }}>{tk.symbol.slice(0, 2)}</div>

                <span style={TOKEN_TEXT_STYLE}>{tk.symbol}</span>

                {/* The amount is brand blue at the same size and weight as the name - node 1:363. The 24h
                    trend arrow is VOLATILE TOKENS ONLY (USDC/EURC are stablecoins, nothing to signal). */}
                <span style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                  <span style={{ ...TOKEN_TEXT_STYLE, color: 'var(--color-brand)' }}>
                    {showToken
                      ? tk.amount.toFixed(tk.symbol === 'cirBTC' ? 4 : 2)
                      : (rates ? fmtDisplay(tk.usd, cur, rates) : '…')}
                  </span>
                  {rates && isVolatile(tk.symbol) && tk.change24h != null && Math.abs(tk.change24h) >= 0.005 && (
                    <button onClick={() => setPctPopup(tk)} aria-label={`24h price change for ${tk.symbol}`}
                      style={{ background: 'none', border: 'none', padding: 'calc(6 * var(--u))', margin: 'calc(-6 * var(--u)) calc(-6 * var(--u)) calc(-6 * var(--u)) calc(9 * var(--u))', display: 'flex', cursor: 'pointer' }}>
                      <TrendArrow pct={tk.change24h} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </>
        )}
        {/* UNVERIFIED TOKENS (owner 2026-10-03) - ONE token-style row "Unverified tokens" with a down arrow; tapping it
            opens the list underneath. Amount + symbol, no $ value, no logo (the contract's own name/symbol is untrusted, so
            it is truncated and never linked). Tapping a token opens Exchange to SELL it (owner 2026-10-05: allowed with a
            yellow warning there, never blocked). */}
        {!loading && unverified.length > 0 && (
          <>
            <button onClick={() => setShowUnverified(v => !v)} aria-expanded={showUnverified} style={{
              display: 'flex', alignItems: 'center', gap: 'calc(8 * var(--u))', flexShrink: 0, width: '100%', cursor: 'pointer',
              height: 'calc(40 * var(--u))', borderRadius: 16, background: 'var(--color-white)', padding: '0 calc(16 * var(--u))', border: 'none', fontFamily: 'inherit',
            }}>
              <div className="token-icon" style={{ width: 'calc(26.325 * var(--u))', height: 'calc(26.325 * var(--u))', background: 'var(--color-muted-2)', flexShrink: 0, display: 'flex' }}>?</div>
              <span style={TOKEN_TEXT_STYLE}>Unverified tokens</span>
              <span style={{ ...TOKEN_TEXT_STYLE, color: 'var(--color-muted-2)', marginLeft: 'auto' }}>{unverified.length}</span>
              <span style={{ display: 'flex', transform: showUnverified ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <Icon name="down2" size="var(--is-content-1)" color="var(--color-brand)" />
              </span>
            </button>
            {showUnverified && unverified.map(tk => (
              <button key={tk.address} title={tk.address} onClick={() => navigate('Swap', { from: `u:${tk.address}` })} style={{
                display: 'flex', alignItems: 'center', gap: 'calc(8 * var(--u))', flexShrink: 0, width: '100%', cursor: 'pointer',
                height: 'calc(40 * var(--u))', borderRadius: 16, background: 'var(--color-white)', padding: '0 calc(16 * var(--u))', border: 'none', fontFamily: 'inherit',
              }}>
                <div className="token-icon" style={{ width: 'calc(26.325 * var(--u))', height: 'calc(26.325 * var(--u))', background: 'var(--color-muted-2)', flexShrink: 0, display: 'flex' }}>{tk.symbol.slice(0, 2)}</div>
                <span style={{ ...TOKEN_TEXT_STYLE, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>{tk.symbol.slice(0, 16)}</span>
                <span style={{ ...TOKEN_TEXT_STYLE, color: 'var(--color-muted-2)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  {tk.amount.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </span>
              </button>
            ))}
          </>
        )}
        </div>

        {heldTokens.length > 0 && (
          <ShowTokensButton onHoldStart={() => setShowToken(true)} onHoldEnd={() => setShowToken(false)} />
        )}
      </div>

      {/* NOTIFICATION CARD - node 1:335: 340x242 at (25,430), rows 6-8 of the grid.
          ⚠️ Figma draws ONE fixed hint box and ONE example notification inside it. The real screen has
          0..N live notifications plus the low-USDC warning, so the CONTAINER is matched exactly and its
          contents stay NotifArea, which is what actually knows about them. */}
      <div style={{
        position: 'absolute', left: '6.41%', top: '50.95dvh', width: '87.18%', height: '28.67dvh',
        background: 'var(--color-card)', borderRadius: 16, padding: 'calc(16 * var(--u))',
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <NotifArea
          hints={[
            { label: 'Paste', desc: 'Paste a wallet address to send' },
            { label: 'Scan QR', desc: 'Scan a QR code to send' },
            { label: 'Contacts', desc: 'Save people you send to often' },
          ]}
          warning={
            // Warn only when USDC is under the fee reserve itself (GAS_RESERVE_USDC, 0.01 since 2026-10-03) - above it
            // the wallet CAN still pay a fee (~0.002 measured), so "out of USDC for fees" would be false.
            !loading && (tokens.find(tk => tk.symbol === 'USDC')?.amount ?? 0) < GAS_RESERVE_USDC ? (
              <div
                style={{ width: '100%', background: 'var(--color-white)', borderRadius: 16, padding: 'calc(6 * var(--u)) calc(10 * var(--u))', display: 'flex', flexDirection: 'column', gap: 'calc(2 * var(--u))', fontSize: NOTIF_FS, color: 'var(--color-warning)', fontWeight: 'var(--fw-semibold)' }}>
                <span style={{ minWidth: 0, lineHeight: 1.35 }}>Out of USDC for transaction fees</span>
              </div>
            ) : null
          }
        />
      </div>

      {/* ACTION ROW - nodes 1:338-1:340. Three separate absolute boxes, NOT a grid: the centre pill is
          taller (124x70 at y=688) than its siblings (100x48 at y=699) and they share no baseline, so a
          flex row with align-items would only approximate what the node draws. Radius 16 on all three. */}
      <button onClick={() => navigate('PasteAddress')} style={{
        position: 'absolute', left: '6.41%', top: SIDE_BTN.top, width: '25.64%', height: SIDE_BTN.height,
        background: 'var(--btn-grad-white)', border: 'none', borderRadius: 16,
        boxShadow: '0 8px 8px rgba(0, 0, 0, 0.48)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'calc(2 * var(--u))',
        fontFamily: 'inherit', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}>
        <Icon name="copy" size="var(--ib-caption)" />
        <span>Paste</span>
      </button>

      <button onClick={() => navigate('QRScanner')} style={{
        position: 'absolute', left: '34.10%', top: BIG_BTN.top, width: '31.79%', height: BIG_BTN.height,
        background: 'var(--btn-grad-brand)', border: 'none', borderRadius: 16,
        boxShadow: '0 8px 8px rgba(0, 0, 0, 0.48)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'calc(2 * var(--u))',
        fontFamily: 'inherit', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-white)',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}>
        <Icon name="scan" size="var(--ib-content-1)" color="var(--color-white)" />
        <span>Scan QR</span>
      </button>

      <button onClick={() => navigate('Contacts')} style={{
        position: 'absolute', left: '67.95%', top: SIDE_BTN.top, width: '25.64%', height: SIDE_BTN.height,
        background: 'var(--btn-grad-white)', border: 'none', borderRadius: 16,
        boxShadow: '0 8px 8px rgba(0, 0, 0, 0.48)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'calc(2 * var(--u))',
        fontFamily: 'inherit', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}>
        <Icon name="human" size="var(--ib-caption)" />
        <span>Contacts</span>
      </button>

      <NavBar active="HomeSend" />

      {/* 24h price-change popup - unchanged, standard .popup-card. */}
      {pctPopup && rates && (
        <div className="popup-overlay" onClick={() => setPctPopup(null)}>
          <div className="popup-card" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
            <button onClick={() => setPctPopup(null)} aria-label="Close"
              style={{ position: 'absolute', top: 'calc(12 * var(--u))', right: 'calc(12 * var(--u))', background: 'none', border: 'none', cursor: 'pointer', padding: 'calc(4 * var(--u))' }}>
              <Icon name="x" size="calc(17 * var(--u))" color="var(--color-muted)" />
            </button>
            <div className="popup-title">{pctPopup.symbol}</div>
            <div style={{ fontSize: 'var(--fs-content-1)', color: 'var(--color-content)' }}>
              {'24h price change: '}
              <span style={{ fontWeight: 'var(--fw-medium)', color: pctPopup.change24h > 0 ? 'var(--color-primary)' : 'var(--color-error)' }}>
                {pctStr(pctPopup.change24h)}
              </span>
            </div>
            <div style={{ fontSize: 'var(--fs-content-1)', color: 'var(--color-content)' }}>
              {`Value changed from ${fmtDisplay(pctPopup.usd / (1 + pctPopup.change24h / 100), cur, rates)} to ${fmtDisplay(pctPopup.usd, cur, rates)}`}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
