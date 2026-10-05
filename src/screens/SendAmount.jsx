import { useState, useEffect } from 'react'
import { useNav } from '../nav'
import Numpad from '../components/Numpad'
import Icon from '../components/Icon'
import ErrorToast from '../components/ErrorToast'
import { getTokenInfo, getTokenBalances, getDisplayRates, cachedRates, getUnverifiedTokens } from '../chain'
import { ensureWalletAddress } from '../circle'
import { findContactName } from '../store'
import { displaySymbol, spendableOf, floorTo, shortenAddr } from '../data'
import { useFitFontSize } from '../useFitFontSize'
import { amountHints, fmtAmountHint } from '../amountHint'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { NET } from '../clientNet'
import { amountProblem, normalizeTyped, toBaseUnits } from '../money'

// USD = the friendly label, what is sent = USDC (1:1). USDC/EURC/cirBTC send that exact token.
// ⛔ VND TURNED OFF 2026-08-12 (user decision): the app runs English/USD while a scanned QR produced VND → 'VND' was
// removed from this list so it CANNOT be selected and CANNOT arrive from a QR (params.currency='VND' falls back
// to USD on the line below). The VND maths further down (isVnd/vndRate/amount suggestions) is KEPT and not
// deleted - re-enabling only needs 'VND' back in this array + the locked flags removed in Security.jsx + data.js
// (the language/currency picker moved there when Currency.jsx was deleted 2026-09-24).
// The original reason (user decision 08-04): "type VND directly, let the app convert to USDC" for Vietnamese users.
// 'USD' + exactly the tokens THIS network lists (src/network.js) - a hard-coded list offered cirBTC on mainnet,
// where it does not exist (the server would refuse the send, but the app must not offer it at all).
const CURRENCIES = ['USD', ...Object.keys(NET.tokens)]
const effectiveToken = c => (c === 'USD' || c === 'VND' ? 'USDC' : c)
// UNVERIFIED tokens (owner 2026-10-05): can be SENT, picked only in this screen's currency popup (yellow section),
// keyed 'u:<address>'. No price, no auto-convert; Confirm shows a yellow warning line.
const isUnv = c => typeof c === 'string' && c.startsWith('u:')
// USD/VND are FIAT LABELS, not tokens - no coin logo for them (user decision 2026-09-24: "USD, EUR
// tụi mình k dùng logo, còn token thì mới dùng" - showing USDC's logo under "USD" implied the user had
// picked the token USDC, when they picked the fiat label). Only a real token (USDC/EURC/cirBTC) gets one.
const isFiatLabel = c => c === 'USD' || c === 'VND' || isUnv(c)
const tokenIconFor = c => (effectiveToken(c) === 'USDC' ? 'usdc' : effectiveToken(c).toLowerCase())

export default function SendAmount() {
  const { navigate, params } = useNav()
  const { address, back = 'HomeSend' } = params
  const name = params.name || findContactName(address)
  // WHAT YOU SCAN IS WHAT YOU GET: if the QR carries a valid currency → open in that currency (2 USDC shows as "2 USDC",
  // NOT converted to USD). An old/unclear QR (e.g. 'VND') → default to USD.
  const qrCurrency = CURRENCIES.includes(params.currency) ? params.currency : null
  // QR SAFETY (mainnet v1 plan item 2 (2026-09-27, deleted doc - git history)): a currency this build does not have (an old 'VND' QR, a testnet 'cirBTC' QR)
  // keeps NO amount - the number meant something else, and "500000" VND must never turn into $500,000.
  const badCurrency = !!params.currency && !qrCurrency
  const [cur, setCur] = useState(qrCurrency || (isUnv(params.currency) ? params.currency : 'USD'))
  // The unverified tokens the wallet holds: [{ key, address, symbol, decimals, amount }] (Circle's balance list).
  const [unvList, setUnvList] = useState([])
  useEffect(() => {
    getUnverifiedTokens().then(us => setUnvList(us.filter(u => Number.isInteger(u.decimals)).map(u => ({ ...u, key: `u:${u.address}` })))).catch(() => {})
  }, [])
  const unvOf = c => unvList.find(u => u.key === c)
  const labelOf = c => (isUnv(c) ? (unvOf(c)?.symbol || '…') : c)
  const decimalsOf = c => (isUnv(c) ? unvOf(c)?.decimals ?? 18 : NET.tokens[effectiveToken(c)]?.decimals ?? 6)
  // A prefilled amount (QR / back from Confirm) is only accepted if it is a clean decimal (qr.js already checks QRs).
  const [digits, setDigits] = useState(params.amount && !badCurrency && !amountProblem(String(params.amount), 8) ? String(params.amount) : '')
  // The amount was put there by a QR and the user has not changed it (amount AND currency) → SendConfirm asks for one
  // more "yes" above $100. Typing anything else makes it the user's own amount again. (No on-screen label: the owner
  // removed "Amount requested by this QR code" on 2026-09-29 as clutter - the >$100 popup stays.)
  const qrAmountStr = params.qrAmount && !badCurrency && params.amount ? String(params.amount) : null
  const qrActive = !!qrAmountStr && digits === qrAmountStr && cur === (qrCurrency || 'USD')
  // DEFAULT NOTE (user decision 07-20e): the user sets it once in the popup → every send prefills the memo with it
  // (as a real VALUE, not a faded placeholder). Tapping the field to type → the default note DISAPPEARS and typing is
  // free (noteTouched stops it being cleared again on later focus).
  const [defaultNote, setDefaultNote] = useState(() => localStorage.getItem('ez_default_note') || '')
  const [memo, setMemo] = useState(params.memo || localStorage.getItem('ez_default_note') || '')
  const [noteTouched, setNoteTouched] = useState(false)
  const [showNote, setShowNote] = useState(false)      // popup set default note
  const [draftNote, setDraftNote] = useState('')       // the value being typed in the popup
  const [showCur, setShowCur] = useState(false)
  // KEYBOARD RULE (user decision 07-23, option A): MONEY = the app numpad, TEXT = the iPhone keyboard, and NEVER
  // both at once. Typing in the note field (iPhone keyboard rising) → HIDE the numpad; blur → show it again.
  const [typingText, setTypingText] = useState(false)

  function openNotePopup() { setDraftNote(defaultNote); setShowNote(true) }
  function saveDefaultNote() {
    const v = draftNote.trim()
    localStorage.setItem('ez_default_note', v)
    // If the memo field is empty or still the old default (never hand-typed) → update the display to the new note right away
    if (!noteTouched || memo === '' || memo === defaultNote) { setMemo(v); setNoteTouched(false) }
    setDefaultNote(v); setShowNote(false)
  }
  // Tapping the note field for the first time while it holds the default note → clear it for fresh typing (user decision 07-20e)
  function onNoteFocus() {
    if (!noteTouched && defaultNote && memo === defaultNote) { setMemo(''); setNoteTouched(true) }
  }
  const [availableAmt, setAvailableAmt] = useState(null) // balance of the SELECTED token (in real token units)
  // AUTO-CONVERT (docs/SWAP-PLAN.md section 6, owner 2026-10-05): a USD/USDC send may also spend the OTHER verified
  // tokens (swapped to USDC in the same transaction). Their live USD value; a token without a live price is not counted.
  const [extraUsd, setExtraUsd] = useState(0)
  const [walletAddr, setWalletAddr] = useState(null)
  // Exchange rates (needed for VND). Seeded from the module-level cache → no waiting on the network before typing.
  const [rates, setRates] = useState(cachedRates)
  useEffect(() => { getDisplayRates().then(setRates).catch(() => {}) }, [])

  // SAFE wallet address: ensureWalletAddress restores it from Circle when localStorage is missing it - same as
  // HomeSend. It used to read localStorage directly: on mobile PWA (added to the home screen) ez_wallet_addr
  // can be absent → availableAmt=0 → the "Continue" button NEVER lit up despite having money. (Desktop had the key, so it worked.)
  useEffect(() => { ensureWalletAddress().then(a => setWalletAddr(a || null)).catch(() => setWalletAddr(null)) }, [])

  // Available balance: for the EXACT selected token (USD/USDC → USDC; EURC → EURC; cirBTC → cirBTC)
  useEffect(() => {
    if (!walletAddr) { setAvailableAmt(null); return }   // no address yet → treat as loading (null), do NOT force 0
    const tok = effectiveToken(cur)
    setAvailableAmt(null)
    // spendableOf: USDC holds GAS_RESERVE_USDC back for network fees (Arc gas is paid in USDC) - the customer cannot send every last cent
    // ⚠️ On a failed read KEEP null (showing "…"), NEVER setAvailableAmt(0): a fake 0 kills the button and
    // reports "Insufficient balance (available: 0.00)" WHILE THE WALLET HAS MONEY - bug 07-17, a 1000 USDC wallet could not
    // send. Retry after 3s so it recovers by itself once the RPC unclogs.
    let alive = true, retry
    setExtraUsd(0)
    if (isUnv(tok)) {   // Circle's balance list (the same read Home uses) - no on-chain multicall for unknown tokens
      const u = unvOf(tok)
      if (u) setAvailableAmt(u.amount)
      return
    }
    const load = () => (tok === 'USDC'
      ? getTokenBalances(walletAddr).then(list => {
          if (!alive) return
          setAvailableAmt(spendableOf('USDC', list.find(t => t.symbol === 'USDC')?.amount ?? 0))
          setExtraUsd(list.filter(t => t.symbol !== 'USDC' && t.usd != null).reduce((a, t) => a + t.usd, 0))
        })
      : getTokenInfo(walletAddr, tok).then(i => { if (alive) setAvailableAmt(spendableOf(tok, i.balance)) }))
      .catch(() => { if (alive) retry = setTimeout(load, 3000) })
    load()
    return () => { alive = false; clearTimeout(retry) }
  }, [cur, walletAddr, unvList])

  // ── VND: type in Vietnamese money, send USDC ──────────────────────────────────────────────
  // rates[cur] = USD per unit. rates.VND ≈ 0.000038 (1 dong ≈ 0.000038 dollars).
  const isVnd = cur === 'VND'
  const vndRate = rates?.VND || null                       // null = no rate yet → cannot send
  const amount = isVnd ? parseInt(digits || '0', 10) : parseFloat(digits || '0')
  // The USDC amount that ACTUALLY leaves the wallet. floorTo (not toFixed): toFixed rounds UP → it can exceed the
  // balance by exactly one cent and be rejected by Circle, the very trap already hit by the Max button on Swap.
  const tokenAmount = isVnd && vndRate ? floorTo(amount * vndRate, 2) : amount
  // The balance converted into the UNIT BEING TYPED for comparison: typing VND must compare against the balance in VND,
  // otherwise "50,000" is always > "19.5 USDC" and Continue never lights up.
  const availableInCur = availableAmt === null ? null
    : isVnd ? (vndRate ? availableAmt / vndRate : null) : availableAmt + extraUsd
  // More than the USDC itself → Confirm asks the server to convert the rest (it re-checks everything on chain).
  const needsConvert = !isVnd && effectiveToken(cur) === 'USDC' && availableAmt !== null && amount > availableAmt
  const overBalance = availableInCur !== null && amount > availableInCur
  // FINAL GUARD against sending to yourself (user decision 07-31). PasteAddress/QRScanner block it at the door,
  // but Contacts is another way in (a user can save their own wallet as a contact), so it must be blocked
  // here too. Use `walletAddr` (from Circle via ensureWalletAddress) and NOT
  // localStorage: on mobile PWA localStorage can be absent → the guard would miss.
  const selfSend = !!walletAddr && address?.trim().toLowerCase() === walletAddr.toLowerCase()
  // The button lights up as soon as the amount is valid; it is ONLY blocked when we KNOW it exceeds the balance. Do not disable
  // the button merely because the balance is still loading (requiring availableAmt!==null used to "kill" it while the balance/address were in flight).
  // VND with no rate yet → no going on (the USDC amount cannot be computed).
  const canContinue = amount > 0 && !overBalance && !selfSend && (!isVnd || !!vndRate)
  const decimalsFor = c => (effectiveToken(c) === 'cirBTC' ? 8 : isUnv(c) ? 4 : 2)
  // [50%] [Max] (owner 2026-10-05) - EXACT strings, never a float: Max = everything spendable of the token being sent
  // (USD/USDC = the USDC itself minus the 0.01 reserve - no auto-convert, owner's pick; typing more still converts);
  // an unverified token = Circle's own balance string. 50% = half of Max in base units.
  const maxStr = (() => {
    if (isVnd || availableAmt === null) return null
    const dec = decimalsOf(cur)
    if (isUnv(cur)) {
      const u = unvOf(cur); const str = u?.amountStr ?? (u ? String(u.amount) : null)
      if (!str) return null
      const [i, f = ''] = str.split('.'); return f ? `${i}.${f.slice(0, dec)}`.replace(/\.?0+$/, '') : i
    }
    // availableAmt sits within 1e-12 of an exact `dec`-decimal value (base units / 10^dec, minus 0.01) → toFixed(dec)
    // lands on it exactly; flooring instead turned 127.66 − 0.01 = 127.64999999999999 into 127.649999.
    return availableAmt > 0 ? availableAmt.toFixed(dec).replace(/\.?0+$/, '') : '0'
  })()
  const halfStr = (() => {
    if (!maxStr || maxStr === '0') return null
    const dec = decimalsOf(cur)
    const s = (toBaseUnits(maxStr, dec) / 2n).toString().padStart(dec + 1, '0')
    const out = `${s.slice(0, s.length - dec)}.${s.slice(s.length - dec)}`.replace(/\.?0+$/, '')
    return out === '0' ? null : out
  })()
  function pickAmount(v) { if (v) setDigits(v) }
  const availableStr = isVnd
    ? `${availableInCur !== null ? Math.floor(availableInCur).toLocaleString('vi-VN') : '…'} ₫`
    : availableInCur === null ? '…'
    : isUnv(cur) ? floorTo(availableInCur, 4).toLocaleString('en-US', { maximumFractionDigits: 4 })
    : floorTo(availableInCur, decimalsFor(cur)).toLocaleString('en-US', { minimumFractionDigits: decimalsFor(cur), maximumFractionDigits: decimalsFor(cur) })
  // AMOUNT SUGGESTIONS (user decision 08-04) - VND ONLY: typing "50" → [5,000] [50,000] [500,000].
  // Never for USD/EUR: typing "50" already means 50 dollars, and suggesting ×100 (5,000 dollars) would be a deadly trap.
  const hints = isVnd && !showCur ? amountHints(digits, availableInCur) : []

  // Numpad: '.' = the decimal separator (once only); BACK deletes one character at a time.
  function handleKey(key) {
    if (key === 'BACK') { setDigits(d => d.slice(0, -1)); return }
    // VND has NO decimals - block the dot entirely ("50.5 dong" is meaningless).
    if (key === '.') { if (isVnd) return; setDigits(d => (d.includes('.') ? d : (d === '' ? '0.' : d + '.'))); return }
    if (digits.length >= 12) return
    // No more decimal places than the token has (USDC/EURC 6, cirBTC 8) - the old keypad took any number and
    // Confirm then sent toFixed(2) of it (MAINNET-AUDIT H1).
    const frac = digits.split('.')[1]
    if (frac !== undefined && frac.length >= decimalsOf(cur)) return
    if (digits === '0') { setDigits(key); return }
    setDigits(d => d + key)
  }

  // The number being typed, formatted for READABILITY: VND groups thousands as you type (500000 → 500.000)
  // - older users typing 6 digits in a row cannot tell whether they are at 50 thousand or 500 thousand.
  const shownDigits = isVnd && digits ? parseInt(digits, 10).toLocaleString('vi-VN') : digits
  const amountStr = (cur === 'USD' ? displaySymbol('USDC') : '') + shownDigits + (isVnd && digits ? ' ₫' : '')
  // Font size shrinks by REAL WIDTH (VND numbers are twice as long as USD, so counting characters overflows) - the "_" caret
  // is included in the measurement, otherwise it comes up exactly one caret short and overflows at the longest numbers.
  // max 44 / weight 300 (was 52/600) - node 1:99, RE-VERIFIED 2026-09-10: 44px, and Light per the app's
  // standing "big numbers are always Light" rule (the node itself draws Regular, same override as everywhere else).
  const [fitRef, fitSize] = useFitFontSize(amountStr + '_', { max: 44, min: 18, weight: 300 })

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <ErrorToast message={params.sendError} />

      <div className="sheet-title">Send money</div>

      {/* ⚠️ 2026-09-10 ARCHITECTURE CHANGE (node 1:88, re-fetched fresh - the old SEND_MONEY_FIGMA_SPEC.md
          predicted a Swap-style % slider from a DIFFERENT, older Figma file key and was wrong; this file's
          actual frame keeps a numpad, just restyled). "Send to:" + the inline amount/chip row are GONE,
          replaced by two cards + a connector circle, the same shape Confirm transaction/Receipt use. */}

      {/* "You send" card - node 1:90: rows 2-3 (340x156, top 10.19dvh, radius 16). RE-VERIFIED 2026-09-10:
          every child below is placed at its OWN measured Figma coordinate (converted x/390→%, y/844→dvh),
          not approximated with flexbox space-between/flex-end like the first pass - that approximation is
          exactly what put the chip/icon/numbers at the wrong y and made them impossible to pixel-diff
          cleanly. Same per-element absolute placement Confirm transaction/Receipt already use. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '10.19dvh', height: '18.48dvh', background: 'var(--color-card)', borderRadius: 16 }} />

      <span style={{ position: 'absolute', left: '8.46%', top: '13.55dvh', transform: 'translateY(-50%)', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)' }}>You send</span>

      {/* Chip - node 1:94: centre 19.4dvh. Figma draws a flat 24x24 BLACK SQUARE placeholder (1:95, no
          real icon layer) - replaced with the real token logo for an actual token; USD (a fiat label,
          not a token) shows no logo at all. */}
      <button onClick={() => setShowCur(true)}
        style={{ position: 'absolute', left: '8.46%', top: '19.4dvh', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', gap: 'calc(6 * var(--u))', border: 'none', background: 'var(--btn-grad-white)', borderRadius: 999, height: 'calc(42 * var(--u))', padding: '0 calc(14 * var(--u)) 0 calc(8 * var(--u))', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)', cursor: 'pointer' }}>
        {!isFiatLabel(cur) && <img src={`/tokens/${tokenIconFor(cur)}.png`} alt="" style={{ width: 'calc(24 * var(--u))', height: 'calc(24 * var(--u))', borderRadius: '50%', flexShrink: 0 }} />}
        {isUnv(cur) ? <span style={{ maxWidth: 'calc(150 * var(--u))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelOf(cur)}</span> : cur}
        <Icon name="down2" size="var(--is-content-2)" color="var(--color-brand)" />
      </button>

      <span style={{ position: 'absolute', left: '8.46%', right: '8.46%', top: '25.28dvh', transform: 'translateY(-50%)', fontSize: 'var(--fs-content-2)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 'calc(6 * var(--u))', minWidth: 0 }}>
        <span style={{ color: 'var(--color-muted-2)' }}>Available:</span>
        <span className="num" style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{availableStr}</span>
        {!isVnd && [['50%', halfStr], ['Max', maxStr]].map(([label, v]) => (
          <button key={label} disabled={!v || v === '0'} onClick={() => pickAmount(v)}
            style={{ flexShrink: 0, border: 'none', borderRadius: 999, background: 'var(--btn-grad-white)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.48)', height: 'calc(28 * var(--u))', padding: '0 calc(10 * var(--u))', fontFamily: 'inherit', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: !v || v === '0' ? 'var(--color-muted)' : 'var(--color-brand)', cursor: !v || v === '0' ? 'default' : 'pointer' }}>
            {label}
          </button>
        ))}
      </span>

      {/* Amount - node 1:99: top-anchored (no y-centring in Figma) at 16.72dvh, right-aligned to the same
          8.46% inset as everything else in this card. Idle colour --color-content (was --color-faint,
          nearly invisible white-on-white - user decision 2026-09-24: "ít ra phải màu đen", the blinking
          caret already signals "not typed yet"). */}
      <div ref={fitRef} style={{ position: 'absolute', left: '51%', right: '8.46%', top: '16.72dvh', textAlign: 'right' }}>
        <span className="num" style={{ fontSize: fitSize, fontWeight: 'var(--fw-light)', lineHeight: 1, whiteSpace: 'nowrap', color: overBalance ? 'var(--color-error)' : 'var(--color-content)' }}>
          {amountStr}<span className="caret">_</span>
        </span>
      </div>

      {/* Connector circle - node 1:100: icon is "down" (down.svg) per the user directly - the raw Figma
          export shows this node with no icon layer (flattened out of the node list, the same class of
          miss HANDOFF §2.1 already documents for the Menu dividers/NavBar cell), not actually blank. NOT
          clickable (2026-09-08 decision: same component slot as Swap's reverse button, but nothing to
          reverse on a one-way send). Sits at the literal midpoint of the gutter between the two cards
          (29.62dvh) - the SAME value Swap's own reverse button uses for the identical rule. */}
      <div aria-hidden style={{ position: 'absolute', left: '50%', top: '29.62dvh', transform: 'translate(-50%, -50%)', zIndex: 3, width: 'calc(50 * var(--u))', height: 'calc(50 * var(--u))', borderRadius: '50%', background: 'var(--grad-brand)', boxShadow: '0 0 8px rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="down" size="var(--is-num)" color="var(--color-white)" />
      </div>

      {/* "To" card - node 1:91: row 4 (340x70, top 30.57dvh). "To:" 18px + the name 22px, both semibold. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '30.57dvh', height: '8.29dvh', background: 'var(--color-card)', borderRadius: 16, display: 'flex', alignItems: 'center', padding: '0 calc(8 * var(--u))', minWidth: 0 }}>
        <span style={{ fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {'To: '}<span style={{ fontSize: 'var(--fs-h2)' }}>{name || shortenAddr(address)}</span>
        </span>
      </div>

      {/* Status text - Figma draws none of these (it only shows the idle state); sit in the gap between
          the "To" card and the message row. VND is unreachable in practice (CURRENCIES above has no
          'VND' - see the file header comment) so this and the error message never actually coincide. */}
      {isVnd && digits && (
        <span className="num" style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '39.5dvh', fontSize: 'var(--fs-caption)', color: 'var(--color-muted)', textAlign: 'center' }}>
          {vndRate ? `≈ ${tokenAmount.toFixed(2)} USDC` : 'Getting exchange rate...'}
        </span>
      )}
      {selfSend ? (
        <span style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '39.5dvh', fontSize: 'var(--fs-caption)', color: 'var(--color-error)', textAlign: 'center' }}>
          That's your own wallet – you can't send to yourself
        </span>
      ) : overBalance && (
        <span style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '39.5dvh', fontSize: 'var(--fs-caption)', color: 'var(--color-error)', textAlign: 'center' }}>
          {'Insufficient balance (available:'} {availableStr} {labelOf(cur)})
        </span>
      )}

      {/* Message row - node 1:101/1:103: top 42.57dvh, input 40 tall / radius 8 (Figma-specific overrides
          on the shared .address-input class, which defaults to --color-surface/radius 10). Background
          overridden to #D2DCE6 (var(--color-card)) here - node 58:413 draws this exact colour, matching
          the "You send"/"To" cards above it (user decision 2026-09-24: all 4 grey boxes on this screen
          should read as ONE colour, they were drifting - surface/card/surface-2 are 3 different tokens). */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '42.57dvh', display: 'flex', alignItems: 'center', gap: 'calc(8 * var(--u))', minWidth: 0 }}>
        <input
          className="address-input"
          placeholder={'Message (optional)'}
          value={memo}
          onFocus={() => { onNoteFocus(); setTypingText(true) }}
          onBlur={() => setTypingText(false)}
          onChange={e => { setMemo(e.target.value); setNoteTouched(true) }}
          maxLength={100}
          style={{ flex: 1, minWidth: 0, height: 'var(--input-h)', borderRadius: 16, fontSize: 'var(--fs-content-1)', background: 'var(--color-card)' }}
        />
        <button onClick={openNotePopup} aria-label={'Set your default note'}
          style={{ flexShrink: 0, width: 'calc(33 * var(--u))', height: 'var(--input-h)', borderRadius: 16, border: 'none', background: 'var(--btn-grad-white)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="option" size="var(--is-caption)" color="var(--color-muted)" />
        </button>
      </div>

      {/* GREY numpad panel with WHITE keys (user decision 07-20, matching the Swap sheet): from half of row 6 to the bottom,
          full-bleed (negative margins cancelling .screen's padding), rounded top corners. Numpad flex 6 + button/padding area flex 3
          (the [Back][Continue] pair is .row10-dual, absolute, floating on the grey exactly over rows 9-10).
          HIDDEN while typing TEXT (note field focused / note popup open) - the iPhone keyboard rising on top of the
          numpad looks terrible (reported 07-23); blur / close the popup → the numpad returns. */}
      {/* position:relative - otherwise the ScreenSheet SVG (a sibling, position:absolute) paints on top of
          this panel and hides it: an absolutely-positioned sibling always wins over a plain grid-row child
          unless this one is explicitly positioned too (2026-09-24, found while screenshotting this screen
          after adding ScreenSheet - CreateQR.jsx has the identical pattern but no ScreenSheet, so it never
          hit this). */}
      {!typingText && !showNote && (
      <div className="numpad-gray" style={{ position: 'relative', gridRow: '6 / 11', margin: '0 calc(-20 * var(--u)) 0', padding: 'calc(27 * var(--u)) 20px 0', background: 'var(--color-card)', borderRadius: '16px 16px 0 0' }}>
        {/* AMOUNT SUGGESTIONS (VND only) - placed DIRECTLY ABOVE the numpad so the typing finger reaches them instantly, one tap
            instead of counting zeroes. Height only reserved WHILE hints are actually showing - VND is
            unreachable in practice (see the file header comment), so this never actually pushes the numpad
            down against the verified 27px offset below. */}
        <div style={{ height: hints.length ? 44 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'calc(8 * var(--u))', flexShrink: 0, overflow: 'hidden' }}>
          {hints.map(v => (
            <button key={v} onClick={() => setDigits(String(v))}
              style={{ border: '1.5px solid var(--color-gray)', background: 'var(--btn-grad-white)', borderRadius: 999, padding: 'calc(6 * var(--u)) calc(14 * var(--u))', cursor: 'pointer', fontFamily: 'var(--font-condensed)', fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-content)', whiteSpace: 'nowrap' }}>
              {fmtAmountHint(v)}
            </button>
          ))}
        </div>
        {/* Numpad - node 18:16 etc, RE-VERIFIED 2026-09-10 (the user flagged the previous flex-proportional
            sizing as fabricated): FIXED 48px key height, 8px gap, 4 rows = 4x48 + 3x8 = 216px exactly - not
            a fraction of whatever space is left. Panel padding-top 27px above + this 216px block put the
            last key row's bottom 27px above the Back/Continue row (699dvh, independently positioned via
            .row10-dual), matching Figma's own 27px gap on both sides of the numpad exactly. */}
        <div style={{ height: 'calc(216 * var(--u))' }}>
          <Numpad onKey={handleKey} showComma={!isVnd} />
        </div>
      </div>
      )}

      {/* The [Back][Continue] pair = the STANDARD row10-dual position (rows 9-10, centred on the 9/10 boundary).
          Back returns to wherever this screen was entered FROM (`back` param) - was hardcoded to HomeSend
          regardless of origin, so Contacts → pick a person → Send → Back landed on Home instead of
          Contacts (user report 2026-09-10). Entry points now pass their own screen name as `back`. */}
      <div className="row10-dual">
        <button className="btn btn-secondary" onClick={() => navigate(back)}>Back</button>
        <button className="btn btn-primary" disabled={!canContinue}
          onClick={() => navigate('SendConfirm', { address, name, amount, amountStr: normalizeTyped(digits), memo, currency: cur, tokenLabel: isUnv(cur) ? labelOf(cur) : null, tokenAmount, qrAmount: qrActive, convert: needsConvert, back })}>
          Continue
        </button>
      </div>

      {/* Exit - node 58:390: sits BEHIND the grey numpad panel in Figma's own z-order (58:423's group is
          drawn after it), so it only shows while the panel is hidden (typing text / the note popup). */}
      {(typingText || showNote) && <ExitBar onClick={() => navigate('HomeSend')} />}

      {/* SET DEFAULT NOTE popup - standard .popup-card (centred over rows 1-6). Set once → every send prefills
          the memo with this note (user decision 07-20e). */}
      {showNote && (
        <div className="popup-overlay" onClick={() => setShowNote(false)}>
          <div className="popup-card" onClick={e => e.stopPropagation()}>
            <div className="popup-title">Set your default note</div>
            <input className="address-input" placeholder={'Type here'} value={draftNote}
              onChange={e => setDraftNote(e.target.value)} maxLength={100} autoFocus
              style={{ width: '100%', height: 'calc(52 * var(--u))', fontSize: 'var(--fs-content-1)' }} />
            <div className="popup-actions">
              <button className="btn btn-secondary" onClick={() => setShowNote(false)}>Back</button>
              <button className="btn btn-primary" onClick={saveDefaultNote}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Currency picker popup - standard .popup-card (centred over rows 2-5, leaving the bottom half for the keyboard) */}
      {showCur && (
        <div className="popup-overlay" onClick={() => setShowCur(false)}>
          <div className="popup-card" onClick={e => e.stopPropagation()} style={{ maxHeight: '80dvh', overflowY: 'auto' }}>
            <div className="popup-title">Select currency</div>
            {[...CURRENCIES, ...(unvList.length ? ['__unv'] : []), ...unvList.map(u => u.key)].map(c => c === '__unv' ? (
              <div key={c} style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-warning)', textAlign: 'center' }}>Unverified tokens</div>
            ) : (
              // Changing currency → CLEAR what was typed. Whether "50" means 50 dollars or 50 dong are two entirely
              // different things; keeping the old number invites the user to send twenty thousand times too much.
              <button key={c} onClick={() => { if (c !== cur) setDigits(''); setCur(c); setShowCur(false) }}
                className={`btn ${c === cur ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', flexShrink: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{labelOf(c)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
