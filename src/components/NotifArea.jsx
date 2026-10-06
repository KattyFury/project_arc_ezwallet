import { useState, useEffect, useRef } from 'react'
import Icon from './Icon'
import { useNav } from '../nav'
import { getNotifs, dismissNotif, addNotif } from '../notif'
import { loadHistoryRows, getTxMemo } from '../chain'
import { findContactName, acct } from '../store'
import { fmtTokenAmount, shortenAddr } from '../data'
import { NETWORK_NOTE } from '../clientNet'
import { pollInbox } from '../inbox'

// Detect incoming money (poll Circle's list + on-chain receipts) → create a "received" notification (shared by every screen with a NotifArea)
// Duplicate guard: each tx hash is announced ONCE (a set of announced hashes is stored).
// SPLIT PER WALLET (bug fix 2026-09-11, same fix as notif.js's own notification list, right above) -
// these were global keys too, so a hash "already announced" on one account silently suppressed the
// SAME hash's notification on a different account signed into afterward, and ez_last_recv_ts made an
// old account look like it had no new activity when really it had just never been checked from here.
function notifiedHashes() {
  try { return new Set(JSON.parse(localStorage.getItem(`ez_notified_hashes_${acct()}`) || '[]')) } catch { return new Set() }
}
function markNotified(hash) {
  const s = notifiedHashes(); s.add(hash)
  localStorage.setItem(`ez_notified_hashes_${acct()}`, JSON.stringify([...s].slice(-100)))
}

// Overlap guard: if the network is slow when the next tick arrives, skip that tick - never fire 2 requests in parallel.
let polling = false

function pollIncoming(after) {
  const addr = localStorage.getItem('ez_wallet_addr')
  if (!addr || polling) return
  polling = true
  // The newest 20 of Circle's list + their on-chain receipts (src/chain.js loadHistoryRows) - NOT the explorer API,
  // which answers a Cloudflare bot challenge on mainnet (2026-10-01). Receipts are remembered, so a poll only reads
  // the chain for a transaction it has not seen before.
  loadHistoryRows({ limit: 20 })
    .then(async all => {
      const lower = addr.toLowerCase()
      // A hash the wallet just SENT (from = wallet) AND also received = a SWAP (token exchange, one single tx).
      // → the incoming notification for a swap must say "swap complete", NOT "received from a stranger"
      // (a market vendor seeing an unknown contract address would panic). The two notifications stay separate.
      const outHashes = new Set(all.filter(tx => tx.from?.toLowerCase() === lower).map(tx => tx.hash))
      const recv = all.filter(tx => tx.to?.toLowerCase() === lower)
      const lastSeen = parseInt(localStorage.getItem(`ez_last_recv_ts_${acct()}`) || '0')
      if (recv[0]) localStorage.setItem(`ez_last_recv_ts_${acct()}`, recv[0].timeStamp)
      if (lastSeen) {
        const seen = notifiedHashes()
        for (const tx of recv.filter(tx => parseInt(tx.timeStamp) > lastSeen && !seen.has(tx.hash)).reverse()) {
          const symbol = tx.tokenSymbol || 'USDC'
          const amt = fmtTokenAmount(parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal || 6)), symbol)
          if (outHashes.has(tx.hash)) {
            // The INCOMING leg of a swap: do NOT add a separate received notification (user decision 07-20, the two swap
            // notifications were merged) - the Swap screen already fired "Swapped X to ~Y (complete)". Still markNotified so it does not repeat.
          } else if (tx.unverified) {
            // An UNVERIFIED token (meme / airdrop / spam) - YELLOW, says so in words, not tappable (it is not in History).
            addNotif(`Received ${amt} ${symbol} (unverified token) from ${findContactName(tx.from) || shortenAddr(tx.from)}`, 'unverified', tx.hash, `recv-${tx.hash}-${tx.contractAddress}`, null, parseInt(tx.timeStamp) * 1000)
          } else {
            // Show the CONTACT NAME if the sender's address is saved (matching the "Sent to <name>" notification)
            const fromName = findContactName(tx.from) || shortenAddr(tx.from)
            // The sender's NOTE goes into the notification, bold, full length (owner 2026-10-03). Free: the receipt was
            // already read for this row by loadHistoryRows and its memo cached, so getTxMemo does not hit the chain again.
            const memo = await getTxMemo(tx.hash).catch(() => null)
            addNotif(`Received ${amt} ${symbol} from ${fromName}`, 'received', tx.hash, `recv-${tx.hash}`, memo, parseInt(tx.timeStamp) * 1000)
          }
          markNotified(tx.hash)
        }
        after()
      }
    }).catch(() => {}).finally(() => { polling = false })
}

// Notification style: a WHITE pill (2026-09-10, matching the current Figma file's notification row -
// node 1:355/1:360: bg-white, radius 16, height 40, 13px text tinted with the type colour + a 19.5px
// icon at each end). It used to be a PALE COLOURED background with black text; the colour now lives in
// the icon and the text instead.
const STYLE = {
  received: { color: 'var(--color-primary)', icon: 'down' },    // received = green
  sent:     { color: 'var(--color-info)',    icon: 'up' },      // sent = blue
  error:    { color: 'var(--color-error)',   icon: 'warning' }, // error = red
  announce: { color: 'var(--color-brand)',   icon: 'info' },    // from the ezwallet team (src/inbox.js) - owner decision 2026-09-29
  unverified: { color: 'var(--color-warning)', icon: 'down' },  // an UNVERIFIED token arrived = yellow (owner 2026-10-03)
}

// ⚠️ CHANGED 2026-08-25 (user bug report): rows used to be forced onto ONE LINE + "…" for compactness, but the swap
// sentence is wider than the phone so its tail was cut off - "Swapped 0.000549 cirBTC to ~262.80 U…" hid the very
// token being received. A notification that loses words is worse than one that is a line taller: rows now WRAP and
// grow with their content (minHeight 40 keeps the one-line look), and the area already scrolls so nothing breaks.
// minWidth:0 IS STILL REQUIRED: this is a flex item, and min-width:auto means it will not shrink below its text
// → long text would WIDEN the row, inflate the grid column and skew the whole screen.
// overflowWrap:anywhere so a long unbroken string (a 0x… address) can break too.
const ROW_TEXT = { minWidth: 0, lineHeight: 1.3, overflowWrap: 'anywhere' }

// ONE SINGLE FONT SIZE for the whole notification area (hint / warning / real notifications) - hints and warnings
// used to be --fs-label (15) while notifications used --fs-body (19) → one spot, two sizes.
// --fs-item 17 was chosen (user decision 2026-07-16): big enough for older eyes, while a long notification (e.g.
// "Faucet successful · received 20.00 EURC") still nearly fits one line - at 19px the "…" ate the AMOUNT.
// Icons in this area use the matching --is-item.
// ⚠️ 13px since 2026-09-10 (was --fs-item 17): the current Figma file sets every line in this area to
// 13px, and at 17 the hint block's 4 lines wrap and overflow the card the design gives them.
// 14px since 2026-10-03: the owner's type scale makes 14 the smallest allowed size (--fs-small).
export const NOTIF_FS = 'var(--fs-small)'

// The hint = ONE multi-line notification (not several separate ones), the LOWEST priority, with NO X button and
// not tappable - always present, pushed up by real notifications and fading out (as one block) when it runs out
// of room. THE APP-WIDE HINT STANDARD (user decision 07-22d): WHITE background + brand BLUE border + BLUE text
// (matching the Swap amount chips + the sign-in chips) - NO yellow background,
// NO lightbulb icon (user decision 07-22e: hint.svg was dropped so it looks like every other hint - text + border only).
// Format (user decision 07-21): each line is a COMPLETE SENTENCE whose leading keyword is medium weight and TAPPABLE
// (going exactly where the button of the same name in row 9 goes). Long sentences WRAP
// (no nowrap/ellipsis like real notifications, which would cut the meaning off).
// THE FIRST LINE = THE NETWORK LIMIT (user decision 08-13). HARDCODED here, NOT passed as a prop from the 2 screens:
// HomeSend and HomeReceive must say exactly the same thing, and two copies drift apart sooner or later.
// ⚠️ WORDING, settled 08-25 after two passes: "This wallet supports Arc Testnet only" → the user asked for
// "currently" so the sentence leaves room for more networks → that pushed it onto 2 lines at <=390px, so the
// user cut it to the current "Available Network: Arc Testnet" - one line everywhere, and it reads as a fact
// about today rather than a permanent limit. Keep it SHORT: this line shares a fixed-height block with 3 hint
// lines, and every extra line eats into the notification area.
// ⚠️ COLOUR: use --color-error (#DC2626, red) and NOT --color-warning (#F59E0B, yellow) -
// yellow on WHITE only reaches ~2.1:1 contrast, which older users cannot read (the same lesson recorded in
// section 5 of HANDOFF about white text on yellow). Red on white is ~4.8:1 and is still the app's "important" colour.
function HintBlock({ lines }) {
  return (
    // padding/gap TIGHTENED 08-13 (from '8px 14px' + gap 4): adding the warning line made the block 4 lines,
    // measured at 122px while the notification area (rows 7-8) is only 120px → the fade mask licked into the top
    // line. Tightened to 6px/12px + gap 3 so 4 lines fit. Do NOT loosen it again without removing a line.
    // 2026-09-10: WHITE card with NO border, radius 16, 13px, BLACK body text with semibold keywords -
    // node 1:356/1:361. The blue border + all-blue 17px text was the older design.
    <div style={{ background: 'var(--color-white)', border: 'none', borderRadius: 16, padding: 'calc(6 * var(--u)) calc(10 * var(--u))', display: 'flex', flexDirection: 'column', gap: 'calc(2 * var(--u))', fontSize: NOTIF_FS, color: 'var(--color-content)', textAlign: 'left', flexShrink: 0 }}>
      <div style={{ minWidth: 0, lineHeight: 1.35, color: 'var(--color-error)', fontWeight: 'var(--fw-semibold)' }}>
        {NETWORK_NOTE}
      </div>
      {lines.map((h, i) => (
        <div key={i} style={{ minWidth: 0, lineHeight: 1.35 }}>
          <span
            onClick={h.onClick ? e => { e.stopPropagation(); h.onClick() } : undefined}
            style={{ fontWeight: 'var(--fw-semibold)', cursor: h.onClick ? 'pointer' : 'default' }}
          >{h.label}:</span>{h.desc ? ` ${h.desc}` : ''}
        </div>
      ))}
    </div>
  )
}

// hints: [{label, desc}] - rendered TOGETHER as one block. warning: JSX | null - a warning (e.g. out of
// USDC for fees). Both are now ITEMS in the SAME stack as real notifications (no early-return replacement
// any more) - so scrolling, bottom alignment and fading all stay in sync, and a warning cannot bury the hint.
// pollMs = how often we ask for incoming money, BASED ON WHAT THE USER IS DOING (user decision 08-13):
//   · RECEIVE screen → 5s  (the QR is being held out to someone, the user is STANDING THERE WAITING)
//   · SEND screen    → 15s (nobody is waiting for money here)
// Fast where someone is waiting, sparse where nobody is - do not put the whole app on one dense interval.
export default function NotifArea({ hints = [], warning = null, pollMs = 15000 }) {
  const { navigate } = useNav()
  const [notifs, setNotifs] = useState(getNotifs())
  const scrollRef = useRef(null)
  // ⚠️ USER BUG REPORT 08-13: "the money-received notification takes forever to appear".
  // ROOT CAUSE: a function named `pollIncoming` (poll = ask REPEATEDLY) that was in fact called EXACTLY ONCE on mount
  // (`useEffect(..., [])`), and the WHOLE APP had no setInterval anywhere. Sitting still on Send/Receive meant nobody
  // ever asked again → the notification only appeared when the user happened to switch tabs (a remount).
  // Sending showed instantly because the Receipt screen calls `addNotif` itself with no network involved - so only the
  // RECEIVING direction was slow, exactly as the user described.
  // WHY IT MATTERS: this app is for older people. Being told "I sent you the money" and then opening the app to nothing
  // makes them WORRY, then call to ask, then tap randomly. Silence here is not a small bug.
  //
  // The interval comes from the `pollMs` prop (5s on Receive · 15s on Send) - see the note where it is declared.
  // Arc finalises blocks in under 1s; the rest of the delay is ArcScan indexing.
  // ⚠️ Do NOT drop the default to a few seconds for EVERY screen: each tick is a request, multiplied by every device
  // with the app open. If one screen needs to be faster, pass pollMs to THAT screen only.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      setNotifs(getNotifs())                   // drops anything that passed 24h while the app stayed open (owner 2026-10-05)
      pollIncoming(() => setNotifs(getNotifs()))
      pollInbox(() => setNotifs(getNotifs()))   // announcements - throttled to 5 minutes inside
    }
    tick()                                   // ask immediately on mount (keeps the old behaviour)
    const id = setInterval(tick, pollMs)
    // Returning to the app asks IMMEDIATELY instead of waiting out the interval: the most common scenario is "I was told
    // the money was sent" → open the app → it must be there. It is also why tick() skips while the tab is hidden:
    // running in the background only costs battery/data, since nobody is looking.
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
    // [pollMs] and not []: the effect USES pollMs, and with [] a changed interval would leave the old one running.
    // Today every screen mounts NotifArea with a fixed value so it never shows, but leaving [] plants a bug
    // for whoever comes next.
  }, [pollMs])
  // Scroll to the BOTTOM (newest notification) whenever the list changes - older ones need scrolling up.
  // FIXED BUG: `warning` was missing from the dependencies → when a warning appeared LATER (e.g. after token balances
  // finished loading, async, after the first render) the effect did not re-run, leaving the scroll "stuck" halfway
  // instead of dropping to the new bottom - so neither notification was fully visible.
  // Use !!warning (boolean) + hints.length (number) - NOT the object/array itself (warning/hints are a NEW JSX/array
  // on every parent re-render, e.g. while holding "Show tokens" - by reference it would yank the scroll to the
  // bottom on EVERY unrelated re-render, interrupting anyone reading an older notification).
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [notifs, !!warning, hints.length])
  function clear(id, e) { e.stopPropagation(); dismissNotif(id); setNotifs(getNotifs()) }
  // Only transactions (received/sent) have anything to open in History - an error notification leads nowhere.
  function open(n) {
    if (n.type !== 'received' && n.type !== 'sent') return
    navigate('TxHistory', n.hash ? { openHash: n.hash } : {})
  }

  // notifs stores the NEWEST FIRST (unshift in notif.js). Rendered in timeline order, ALL IN ONE
  // STACK (no early-return replacement any more - that was the bug that flung the warning to the top of the box
  // and buried the hint): OLDEST/lowest priority at the TOP (fades/disappears first) → NEWEST/highest priority at the
  // BOTTOM (next to the button row, always seen first). Priority order: hint (lowest) → warning (e.g. out of
  // USDC) → real notifications (received/sent/error), newest at the very bottom.
  const items = [
    ...(hints.length ? [{ id: 'hint', type: 'hint', hints }] : []),
    ...(warning ? [{ id: 'warning', type: 'warning', node: warning }] : []),
    ...[...notifs].reverse(),
  ]

  return (
    // SCROLLABLE (overflowY:auto, not hidden) - when it fills up, drag to see more. A 1/3-row fade
    // (calc(100dvh/30)) at the TOP edge (the row 6/7 boundary) as content approaches the "Show tokens" button above,
    // and NOT more than that or there is nowhere left to read. Scrollbar hidden (.scroll-hidden) - a
    // visible one here would overlap/offset the coloured notification boxes, the fade mask already hints.
    <div ref={scrollRef} className="scroll-hidden" style={{
      flex: 1, minHeight: 0, width: '100%',
      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black calc(100dvh / 30))',
      maskImage: 'linear-gradient(to bottom, transparent 0, black calc(100dvh / 30))',
    }}>
      {/* gap 10 = the spacing the Figma card uses between the hint block and the notification pill */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(10 * var(--u))', minHeight: '100%', justifyContent: 'flex-end' }}>
        {items.map(n => {
          if (n.type === 'hint') return <HintBlock key={n.id} lines={n.hints} />
          if (n.type === 'warning') return <div key={n.id}>{n.node}</div>
          const s = STYLE[n.type] || STYLE.sent
          const clickable = n.type === 'received' || n.type === 'sent'
          return (
            // MINIMUM height 40 = exactly the "Send" button in Contacts.jsx; a long sentence makes the row taller
            // (the hardcoded `height: 40` was dropped 08-25, see the ROW_TEXT note). 8px vertical padding keeps a single
            // line at exactly 40px as before.
            <div key={n.id} onClick={() => open(n)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'calc(10 * var(--u))', background: 'var(--color-white)', borderRadius: 16, minHeight: 'calc(40 * var(--u))', padding: 'calc(3 * var(--u)) calc(10 * var(--u))', flexShrink: 0, cursor: clickable ? 'pointer' : 'default' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'calc(8 * var(--u))', fontSize: NOTIF_FS, color: s.color, ...ROW_TEXT }}>
                <Icon name={s.icon} size="calc(19.5 * var(--u))" color={s.color} style={{ flexShrink: 0 }} />
                <span style={ROW_TEXT}>
                  {n.text}
                  {n.memo ? <> · <b style={{ fontWeight: 'var(--fw-bold)' }}>{n.memo}</b></> : null}
                </span>
              </span>
              <button onClick={e => clear(n.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0, padding: 'calc(2 * var(--u))' }}><Icon name="x" size="calc(19.5 * var(--u))" color={s.color} /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
