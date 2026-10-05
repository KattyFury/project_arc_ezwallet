import { useState, useEffect } from 'react'
import { useNav } from '../nav'
import { getDisplayCurrency, displayNum, displaySymbol, shortenAddr } from '../data'
import { TOKENS, getTxMemo, getDisplayRates, EXPLORER, loadHistoryRows } from '../chain'
import Icon from '../components/Icon'
import { loadContacts } from '../store'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'

const ARCSCAN = EXPLORER
const TOKEN_MAP = Object.fromEntries(TOKENS.map(t => [t.address.toLowerCase(), t]))

function loadContactMap() {
  try {
    const m = {}
    loadContacts().forEach(c => { if (c.address) m[c.address.toLowerCase()] = c.name })
    return m
  } catch { return {} }
}

// DATE label for the group boundary (e.g. "28 Jun 2026") + the exact TIME on each row (e.g. "14:32").
function dateLabel(ts) {
  return new Date(parseInt(ts) * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function timeLabel(ts) {
  return new Date(parseInt(ts) * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// The date boundary between transaction groups (user decision: the boundary shows day, month and year).
function DateHeader({ date, first }) {
  return (
    <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-medium)', color: 'var(--color-muted)', padding: first ? '2px 2px 8px' : '18px 2px 8px' }}>
      {date}
    </div>
  )
}

// Compute the shared facts of one transaction. VND is converted from the SAME rates SOURCE as the display column
// (it used to use the cached token.vndRate from a different source → 1 USDC showed as $0.95 - user bug report).
function txInfo(tx, walletAddr, contacts, rates) {
  const token = TOKEN_MAP[tx.contractAddress?.toLowerCase()]
  const decimals = parseInt(tx.tokenDecimal || 6)
  const amount = parseFloat(tx.value) / Math.pow(10, decimals)
  const isSend = tx.from?.toLowerCase() === walletAddr?.toLowerCase()
  const symbol = tx.tokenSymbol || token?.symbol || '?'
  const rate = symbol === 'USDC' ? 1 : rates?.[symbol]
  const usd = rate > 0 ? amount * rate : null   // no live price → "…" (no offline fallback)
  const counter = isSend ? tx.to : tx.from
  const name = contacts[counter?.toLowerCase()] || null
  return { isSend, amount, symbol, usd, counter, name }
}

// Each transaction = one block, with NO grey separator line (user decision 2026-07-06). The "row" structure (small
// rows INSIDE the box, not screen rows):
//   [icon]  row 1: Received from <name/address>             | +$5.00     (display money, primary)
//   (r1-2)  row 2: At 14:32   [+ Add]  ← the Add button moved here | 5.00 USDC  (the real token, grey - r1-2)
//           rows 3-4: Note: <memo> (if any, wrapping when long)
// The icon (left) and the money block (right) are anchored to ROWS 1-2 (top-aligned). The DATE boundary lives in DateHeader.
function TxRow({ tx, walletAddr, contacts, onClick, cur, rates, memo, isSwap, swapInfo, onAdd }) {
  const { isSend, amount, symbol, usd, counter, name } = txInfo(tx, walletAddr, contacts, rates)
  // Swap: the title states the DIRECTION explicitly, "Swapped <amount> <token out> to <token in>" (user decision 07-20d - it
  // used to say just "Swapped", which told you nothing). It needs swapInfo (both legs) from TxHistory; without it, fall back to "Swapped".
  const swapTitle = swapInfo ? `Swapped ${swapInfo.outAmt.toFixed(swapInfo.outAmt < 0.01 ? 6 : 2)} ${swapInfo.outSym} to ${swapInfo.inSym}` : 'Swapped'
  // Sending to yourself → say "yourself" plainly, do not make an older person compare 0x1234…5678 against
  // their own wallet address (07-31, the same bug as swapHashes above).
  const isSelf = counter && walletAddr && counter.toLowerCase() === walletAddr.toLowerCase()
  const who = isSelf ? 'yourself' : name || shortenAddr(counter)
  // Font sizes REDUCED so the full information fits a phone screen (user decision 07-20): icon 40→34, the money on the right
  // fs-num 24→fs-md-lg 21, the secondary token fs-label→fs-tiny, vertical padding 14→11, gap 12→10.
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'flex-start', gap: 'calc(10 * var(--u))', width: '100%',
      padding: 'calc(11 * var(--u)) 0', border: 'none', background: 'none', cursor: 'pointer',
      fontFamily: 'inherit', textAlign: 'left',
    }}>
      {/* Sent/received icon - anchored to rows 1-2 (top-aligned) */}
      <div style={{
        width: 'calc(34 * var(--u))', height: 'calc(34 * var(--u))', borderRadius: '50%', flexShrink: 0, marginTop: 'calc(2 * var(--u))',
        background: isSend ? 'var(--color-info-soft)' : 'var(--color-primary-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={isSend ? 'up' : 'down'} size="var(--is-caption)" color={isSend ? 'var(--color-info)' : 'var(--color-primary)'} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* row 1: who - item size, bold. WRAPS like a notification (owner 2026-10-03: it was cut with "…" and lost
            words); break-word keeps a short address whole on the next line, only breaking one that cannot fit. */}
        <div style={{ fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-medium)', color: 'var(--color-content)', lineHeight: 1.3, overflowWrap: 'break-word' }}>
          {/* A shortened address stays in ONE piece (browsers may break right after its "…"); a contact name wraps freely. */}
          {isSwap ? swapTitle : <>{isSend ? 'Sent to' : 'Received from'} <span style={!name && !isSelf ? { whiteSpace: 'nowrap' } : undefined}>{who}</span></>}
        </div>
        {/* row 2: status/time + the [Add contacts] button. Swap → "Swap completed · <time>" (user decision 07-20d;
            "At" dropped 2026-10-03 - with the bigger type it wrapped the time onto 2 lines) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'calc(8 * var(--u))', marginTop: 'calc(2 * var(--u))' }}>
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
            {isSwap ? 'Swap completed · ' : ''}<span className="num">{timeLabel(tx.timeStamp)}</span>
          </span>
          {!isSwap && !name && counter && (
            <span onClick={e => { e.stopPropagation(); onAdd(counter) }}
              style={{ flexShrink: 0, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-medium)', color: 'var(--color-brand)', border: '1px solid var(--color-brand)', borderRadius: 16, padding: 'calc(1 * var(--u)) calc(8 * var(--u))', whiteSpace: 'nowrap', background: 'var(--btn-grad-white)' }}>
              Add contacts
            </span>
          )}
        </div>
        {/* rows 3-4: Note (if any) - free to wrap when long */}
        {memo && (
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted)', marginTop: 'calc(2 * var(--u))', lineHeight: 1.4, wordBreak: 'break-word' }}>
            Note: {memo}
          </div>
        )}
      </div>

      {/* The money block - anchored to rows 1-2 (top-aligned). Primary: display money ($). Secondary: the real token, grey */}
      <div style={{ textAlign: 'right', flexShrink: 0, marginTop: 'calc(2 * var(--u))' }}>
        <div className="num" style={{ fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: isSend ? 'var(--color-error)' : 'var(--color-primary)', whiteSpace: 'nowrap' }}>
          {isSend ? '-' : '+'}{rates ? `${displaySymbol(cur)}${displayNum(usd, cur, rates)}` : '…'}
        </div>
        <div className="num" style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted)', marginTop: 'calc(2 * var(--u))', whiteSpace: 'nowrap' }}>
          {amount.toFixed(amount < 0.01 ? 6 : 2)} {symbol}
        </div>
      </div>
    </button>
  )
}

function DetailRow({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'calc(12 * var(--u))', padding: 'calc(7 * var(--u)) 0' }}>
      <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-medium)', color: 'var(--color-content)', textAlign: 'right', wordBreak: 'break-word' }}>{children}</span>
    </div>
  )
}

export default function TxHistory() {
  const { navigate, params } = useNav()
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [memo, setMemo] = useState(null)
  const [memoLoading, setMemoLoading] = useState(false)
  const [memos, setMemos] = useState({})   // hash → memo text (the message shown inline in the list for reconciliation)
  const [copied, setCopied] = useState(false)
  const cur = getDisplayCurrency()
  const [rates, setRates] = useState(null)  // USD→display-currency rates (fetched), null until they arrive
  useEffect(() => { getDisplayRates().then(setRates).catch(() => setRates({ USDC: 1 })) }, [])

  function copyCounter(addr) {
    navigator.clipboard.writeText(addr)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  const walletAddr = localStorage.getItem('ez_wallet_addr')
  const contacts = loadContactMap()

  useEffect(() => {
    if (!selected?.hash) { setMemo(null); return }
    setMemo(null); setMemoLoading(true)
    getTxMemo(selected.hash).then(setMemo).catch(() => {}).finally(() => setMemoLoading(false))
  }, [selected])

  // The message for EACH ROW of the list (user request: show the memo right under the title for reconciliation).
  // Fetches the first 30 txs in the background, one RPC read of the Memo event each; errors are ignored silently.
  useEffect(() => {
    txs.slice(0, 30).forEach(tx => {
      if (memos[tx.hash] !== undefined) return
      getTxMemo(tx.hash)
        .then(m => setMemos(prev => ({ ...prev, [tx.hash]: m || null })))
        .catch(() => setMemos(prev => ({ ...prev, [tx.hash]: null })))
    })
  }, [txs])

  // HISTORY IS ALWAYS SHOWN IN FULL (user decision 07-20: only NOTIFICATIONS are limited to a day,
  // transaction history is the reconciliation ledger - no 24h cut-off, no hints).
  // Send/Receive filter tabs REMOVED (user decision 2026-09-24 - the 3-button row looked cluttered);
  // `filtered` is kept as a name (not renamed to `txs` everywhere below) to keep this diff small.
  const filtered = txs
  // A hash the wallet both SENT and RECEIVED (2 transfers in one tx) = a SWAP → the row says "Swapped", not "from [stranger]".
  const swapHashes = (() => {
    const dir = {}, lower = walletAddr?.toLowerCase()
    txs.forEach(tx => {
      const h = tx.hash; if (!dir[h]) dir[h] = { in: false, out: false }
      const out = tx.from?.toLowerCase() === lower
      const inc = tx.to?.toLowerCase() === lower
      // ⚠️ SENDING TO YOURSELF (from == to on the SAME ROW) IS NOT A SWAP - user bug report 07-31:
      // after accidentally sending to their own wallet, that row was labelled "Swapped 5.00 USDC to USDC", so searching for
      // "Sent" found nothing → it looked like the transaction had VANISHED from history. A REAL swap always has 2 SEPARATE ROWS
      // (one out leg + one in leg); a self-send row is skipped here and takes the normal "Sent to" branch.
      if (out && inc) return
      if (out) dir[h].out = true
      if (inc) dir[h].in = true
    })
    const s = new Set(); for (const h in dir) if (dir[h].in && dir[h].out) s.add(h)
    return s
  })()
  // Swap-pair info for the "Swapped <outAmt> <outSym> to <inSym>" title: each swap hash has an OUT leg
  // (from=wallet) + an IN leg (to=wallet). Both rows of one swap SHARE this string (only the ± amount on the
  // right differs). Derived from `txs` (not `filtered`) so the Sent/Received tabs still have both directions available.
  const swapPairs = (() => {
    const m = {}, lower = walletAddr?.toLowerCase()
    const amtOf = leg => parseFloat(leg.value) / Math.pow(10, parseInt(leg.tokenDecimal || 6))
    const symOf = leg => leg.tokenSymbol || TOKEN_MAP[leg.contractAddress?.toLowerCase()]?.symbol || '?'
    swapHashes.forEach(h => {
      const legs = txs.filter(t => t.hash === h)
      const outLeg = legs.find(t => t.from?.toLowerCase() === lower)
      const inLeg = legs.find(t => t.to?.toLowerCase() === lower)
      if (outLeg && inLeg) m[h] = { outAmt: amtOf(outLeg), outSym: symOf(outLeg), inSym: symOf(inLeg) }
    })
    return m
  })()
  const emptyMsg = 'No transactions yet'

  useEffect(() => {
    if (!walletAddr) { setLoading(false); return }
    // Up to 1000 transactions (functions/api/wallet.js 'history') - the rule "history is the ledger, never truncated"
    // (HANDOFF section 6): a real user's wallet has nowhere near 1000 transactions.
    //
    // RETRY, NEVER FALL BACK TO "empty" (bug fix 2026-09-11, same lesson HomeSend's balance fetch already
    // learned): a failed/errored request used to be swallowed by `.catch(() => {})` + `setLoading(false)`,
    // which looks EXACTLY like a real "no transactions yet" wallet - the user reported an old account's
    // history reading empty with no way to tell if that was real or a silently-failed fetch. On failure,
    // keep the loading state and retry every 3s until a REAL answer (success OR a genuinely empty result[])
    // arrives.
    // ⚠️ SOURCE CHANGED 2026-10-01: Circle's transaction list + each tx's on-chain receipt (src/chain.js
    // loadHistoryRows), NOT the explorer API - on mainnet that answers a Cloudflare bot challenge. Rows keep the
    // explorer's shape and arrive progressively (receipts are read 3 at a time, and remembered forever).
    // The rows come back sorted newest first (07-31 rule: never trust an API order - duplicate DateHeaders drop rows).
    let cancelled = false
    let timer = null
    // UNVERIFIED tokens stay out of History (owner 2026-10-03: view only) - they have no price, and txInfo would value
    // them at $1 each (1,000,000 meme tokens as "+$1,000,000"). They only get a yellow notification + the Home list.
    const verified = rows => rows.filter(r => !r.unverified)
    const load = () => loadHistoryRows({ onProgress: rows => { rows = verified(rows); if (!cancelled && rows.length) { setTxs(rows); setLoading(false) } } })
      .then(list => { if (!cancelled) { setTxs(verified(list)); setLoading(false) } })
      .catch(() => { if (!cancelled) timer = setTimeout(load, 3000) })
    load()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [walletAddr])

  // Open the detail popup straight away when arriving from a notification (openHash)
  useEffect(() => {
    if (params?.openHash && txs.length) {
      const tx = txs.find(t => t.hash === params.openHash)
      if (tx) setSelected(tx)
    }
  }, [txs, params?.openHash])

  const d = selected ? txInfo(selected, walletAddr, contacts, rates) : null

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <div className="sheet-title">Transaction history</div>

      {/* SHARED GREY BOX around the whole history (user decision 07-17f "mark the boundary"). The bottom fade mask lives on the
          INNER DIV - putting it on the box would fade the grey background too and smear it into the white.
          Card radius 16, colour #D2DCE6 (var(--color-card), was --color-surface) - node 58:445, RE-VERIFIED
          2026-09-24 against the redesign's own gradient+sheet shell (blank 340x586 placeholder, no example
          rows, so the row padding below has no Figma evidence and is left as-is). */}
      {/* ⚠️ ABSOLUTE card (fix 2026-09-27), not className="row-2-8": as a plain grid item it painted UNDER the
          absolutely-positioned ScreenSheet - the same bug SavedQRList had - so the grey box never showed. */}
      <div style={{ position: 'absolute', left: '6.41%', top: '10.19dvh', width: '87.18%', height: '69.43dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-card)', borderRadius: 16, padding: 'calc(4 * var(--u)) calc(14 * var(--u))', alignItems: 'stretch', justifyContent: 'flex-start', overflow: 'hidden' }}>
      <div className="scroll-hidden" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', height: '100%', overflowY: 'auto',
        WebkitMaskImage: 'linear-gradient(to top, transparent 0, black calc(100dvh / 30))',
        maskImage: 'linear-gradient(to top, transparent 0, black calc(100dvh / 30))',
      }}>
        {loading ? (
          <div style={{ width: '100%', textAlign: 'center', paddingTop: 'calc(40 * var(--u))', color: 'var(--color-muted)', fontSize: 'var(--fs-caption)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ width: '100%', textAlign: 'center', paddingTop: 'calc(40 * var(--u))' }}>
            <div style={{ fontSize: 'var(--fs-content-1)', color: 'var(--color-muted)' }}>{emptyMsg}</div>
          </div>
        ) : (() => {
          // Group by day: insert a DateHeader whenever the day changes. Swap pairs are NOT merged (user decision 07-20:
          // a swap stays 2 STEPS - the out leg "-1 EURC" + the in leg "+1.4 USDC"; merging would lose both numbers on
          // the right-hand side). Each swap leg still says "Swapped" in its title (isSwap), with its full amount on the right.
          let last = null
          const nodes = []
          filtered.forEach((tx, i) => {
            const dl = dateLabel(tx.timeStamp)
            // The key includes an INDEX: the same day can appear as several groups (if the data order is skewed) →
            // a bare `h-<day>` would COLLIDE, and React can drop the later group (a real warning was seen 07-31).
            if (dl !== last) { nodes.push(<DateHeader key={`h-${dl}-${i}`} date={dl} first={i === 0} />); last = dl }
            nodes.push(<TxRow key={`${tx.hash}-${tx.from}-${tx.to}-${i}`} tx={tx} walletAddr={walletAddr} contacts={contacts} onClick={() => setSelected(tx)} cur={cur} rates={rates} memo={memos[tx.hash]} isSwap={swapHashes.has(tx.hash)} swapInfo={swapPairs[tx.hash]} onAdd={a => navigate('Contacts', { addAddress: a })} />)
          })
          return nodes
        })()}
      </div>
      </div>

      {/* ONE full-width Done button (user decision 2026-09-24: the 3-button Send/Receive/Done row looked
          cluttered - the Send/Receive filter feature is removed entirely, not just visually). */}
      <div className="row10-single">
        <button className="btn btn-primary" onClick={() => navigate('MenuScreen')}>Done</button>
      </div>

      <ExitBar onClick={() => navigate('MenuScreen')} />

      {/* Transaction detail popup */}
      {selected && d && (
        <div className="popup-overlay" onClick={() => setSelected(null)}>
          {/* display:block - DetailRow brings its own padding+border, so the flex gap of .popup-card is NOT used */}
          <div className="popup-card" style={{ display: 'block' }} onClick={e => e.stopPropagation()}>
            <div className="popup-title" style={{ marginBottom: 'calc(8 * var(--u))' }}>Transaction details</div>
            <DetailRow label={'Type'}>{d.isSend ? 'Sent' : 'Received'} {d.symbol}</DetailRow>
            {d.name && <DetailRow label={d.isSend ? 'Recipient' : 'Sender'}>{d.name}</DetailRow>}
            <DetailRow label={'Wallet address'}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'calc(8 * var(--u))' }}>
                {shortenAddr(d.counter)}
                <button onClick={() => copyCounter(d.counter)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
                  <Icon name={copied ? 'check' : 'copy'} size="var(--is-content-2)" color={copied ? 'var(--color-primary)' : 'var(--color-muted)'} />
                </button>
              </span>
            </DetailRow>
            <DetailRow label={'Amount'}>
              <span className="num" style={{ color: d.isSend ? 'var(--color-error)' : 'var(--color-primary)' }}>
                {d.isSend ? '-' : '+'}{d.amount.toFixed(d.amount < 0.01 ? 6 : 2)} {d.symbol}
              </span>
            </DetailRow>
            <DetailRow label={'Converted'}><span className="num">{rates ? `${displaySymbol(cur)}${displayNum(d.usd, cur, rates)}` : '…'}</span></DetailRow>
            <DetailRow label={'Time'}>{new Date(selected.timeStamp * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</DetailRow>
            {memoLoading ? <DetailRow label={'Note'}>Loading...</DetailRow> : memo ? <DetailRow label={'Note'}>{memo}</DetailRow> : null}
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: 'calc(14 * var(--u))' }}
              onClick={() => window.open(`${ARCSCAN}/tx/${selected.hash}`, '_blank')}>
              View on ArcScan
            </button>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 'calc(8 * var(--u))' }} onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
