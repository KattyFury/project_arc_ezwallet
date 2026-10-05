import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNav } from '../nav'
import Icon from '../components/Icon'
import PctSlider from '../components/PctSlider'
import Numpad from '../components/Numpad'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { estimateSwap, estimateSwapFee, executeSwap, getSDK, executeChallenge, refreshSession, ensureWalletAddress, circleErrorMessage } from '../circle'
import { getTokenBalances, getDisplayRates, cachedRates, cachedBalances } from '../chain'
import { spendableOf, floorTo, getDisplayCurrency, displaySymbol, fmtDisplay, decimalsOfCurrency, GAS_RESERVE_USDC } from '../data'
import { useFitFontSize } from '../useFitFontSize'
import { roundHints, fmtHint } from '../roundHint'
import { addNotif } from '../notif'
import { assertNetworkReady } from '../clientNet'
import { NET } from '../clientNet'
import { toAmountString } from '../money'
import { newAttempt, getPending, clearPending, lookup, classify, waitFinal } from '../txTracker'

// ✅ SWAP executes through ADAPTER.execute(a signed intent) - the correct path, and adapter settlement records
// the USDC arriving in the wallet (see the SWAP section of HANDOFF + functions/api/_swapCore.js). VERIFIED with eth_simulateV1
// (verify-swap.mjs, 2026-07-04): 2 EURC→USDC, the wallet's USDC balance rose +3.12254 = matching the Kit estimate.
// To switch it off again: set SWAP_ENABLED = false.
const SWAP_ENABLED = true

// ══ THE SWAP SCREEN - % slider + suggestion chips + a NUMPAD BOTTOM SHEET ══
// ezwallet's audience = newcomers and older people → by default they are NOT made to type digits: a SLIDER
// picks a % OF THE BALANCE ("how much of my money") + row 7 offers TAPPABLE ROUND NUMBERS.
// ADDED 07-20 (user request, overriding the earlier 07-17 "do not bring the numpad back"): tapping the AMOUNT on the
// "You pay" card → the numpad SLIDES UP FROM THE BOTTOM (like the PIN screen) for exact entry; as you type, the amount, the
// estimated output and the slider all follow; "Done"/the dim background closes it. The slider and chips are unchanged.
// ⚠️ Everything is computed in the TOKEN BEING PAID, not in USD (user decision 07-17c). The "~ $xx" line under the
// amount is only a convenience conversion - do NOT use it as the basis of any calculation.
// Row map (given by the user): 1 title · 2-6 You pay/You receive + Rate/Fee · 7 hints · 8 slider ·
// 9 the Swap button · 10 NavBar.
const SWAP_TOKENS = ['USDC', 'EURC', 'cirBTC']
const decimalsFor = sym => (sym === 'cirBTC' ? 6 : 2)

// 2026-09-10, node 1:72/13:149: height 42 (was uncapped), NO border (was 1.5px grey - the glow shadow
// alone is this app's "tappable" signal now), icon 24 (was 32), text 18 (was --fs-body 19).
function TokenRow({ sym, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 'calc(8 * var(--u))', border: 'none', borderRadius: 999, height: 'calc(42 * var(--u))', background: 'var(--btn-grad-white)', cursor: 'pointer', fontFamily: 'inherit', padding: '0 calc(12 * var(--u)) 0 calc(8 * var(--u))', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)', flexShrink: 0 }}>
      <img src={`/tokens/${sym.toLowerCase()}.png`} alt={sym} style={{ width: 'calc(24 * var(--u))', height: 'calc(24 * var(--u))', borderRadius: '50%' }} />
      <span className="num" style={{ fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-content)' }}>{sym}</span>
      <Icon name="down2" size="calc(15 * var(--u))" color="var(--color-brand)" />
    </button>
  )
}

// Token picker popup - the same popup style as SendAmount's currency picker (anchored to the top half).
// Shows ALL 3 tokens (user decision: do not hide the token selected on the other side - picking the other side's token
// simply swaps the two sides, which selectToken already handles).
function TokenPicker({ current, onSelect, onClose }) {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={e => e.stopPropagation()}>
        <div className="popup-title">Select token</div>
        {SWAP_TOKENS.map(sym => (
          <button key={sym} onClick={() => { onSelect(sym); onClose() }} className={`btn ${sym === current ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'calc(10 * var(--u))' }}>
            <img src={`/tokens/${sym.toLowerCase()}.png`} alt="" style={{ width: 'calc(24 * var(--u))', height: 'calc(24 * var(--u))', borderRadius: '50%' }} />
            {sym}
          </button>
        ))}
      </div>
    </div>
  )
}

// The CTA text: at most 2 centred lines. Text that needs more steps the font DOWN (owner 2026-10-05) through `sizes`
// (--fs-* tokens: 20/18/16/14); only past the smallest size does the 3rd line become "…". Keyed by the text by
// the caller, so every new message starts again from the biggest size.
function TwoLineFit({ sizes, children }) {
  const ref = useRef(null)
  const [i, setI] = useState(0)
  const fitSize = `var(--fs-${sizes[i]})`
  useLayoutEffect(() => {
    const el = ref.current
    if (el && el.scrollHeight > el.clientHeight + 1 && i < sizes.length - 1) setI(i + 1)
  }, [i, sizes.length])
  return (
    <span ref={ref} style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', lineHeight: 1.2, textAlign: 'center', minWidth: 0, fontSize: fitSize }}>
      {children}
    </span>
  )
}

export default function Swap() {
  const { navigate } = useNav()                  // the row 10 Exit button → back to Service Hub
  const [fromSym, setFromSym] = useState('EURC') // default: the "out of USDC" rescue → swap another token INTO USDC
  const [toSym, setToSym] = useState('USDC')
  const [pct, setPct] = useState(0)              // the selected % OF BALANCE (0-100) - the single source of truth for the amount
  const [snapAmt, setSnapAmt] = useState(null)   // the ROUND amount the user tapped in row 7 (token units) - overrides pct
  const [estAmt, setEstAmt] = useState(null)
  const [minOut, setMinOut] = useState(null)   // the estimate's minimum (50 bps) - sent on execute as the stopLimit (H2)
  // SEEDED FROM CACHE (07-31 - the user reported "swap loads slowly"): measured for real, a COLD Arc RPC call takes ~3.3s
  // (subsequent ones 130-360ms). The Swap screen used to start from {}, so "Available: …" sat frozen for
  // seconds on every open, even though the Send screen had just read the very same balances. It now reuses the module-level
  // cache (_balCache) like HomeSend/HomeReceive: show the previous number IMMEDIATELY, refresh in the background.
  const [balances, setBalances] = useState(() => {
    const c = cachedBalances(localStorage.getItem('ez_wallet_addr'))
    return c ? Object.fromEntries(c.map(tk => [tk.symbol, tk.amount])) : {}
  })
  const [rates, setRates] = useState(() => cachedRates())
  const [feeUsd, setFeeUsd] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [success, setSuccess] = useState(false)   // true = a swap just completed → the button turns green to confirm
  const [picker, setPicker] = useState(null)
  const [pad, setPad] = useState(false)      // the numpad bottom sheet is open
  const [typed, setTyped] = useState('')     // the string being typed on the numpad (shown live on the You pay card)
  const padPrev = useRef(null)               // the amount before the numpad opened - the sheet's Back button restores it
  const debounceRef = useRef(null)

  const cur = getDisplayCurrency()
  const curSym = displaySymbol(cur)

  // SAFE wallet address: seeded quickly from localStorage, restored from Circle if missing (same as HomeSend).
  // Reading localStorage directly, as before → on mobile PWA ez_wallet_addr can be absent → empty balances →
  // overBalance always true → the Swap button never lights up.
  const [walletAddress, setWalletAddress] = useState(() => localStorage.getItem('ez_wallet_addr'))
  useEffect(() => { if (!walletAddress) ensureWalletAddress().then(a => a && setWalletAddress(a)).catch(() => {}) }, [])
  const walletId = localStorage.getItem('ez_wallet_id')

  // Available: the network fee is paid in USDC (Arc gas = USDC), so a USDC swap holds back the MAXIMUM fee Circle quoted
  // for this swap (feeUsd, Circle estimateFee - owner 2026-10-04: no guessed numbers; ~0.04 measured, the old flat 0.01
  // was too little and a 100% USDC swap could be refused). Until a quote exists the app-wide GAS_RESERVE_USDC applies.
  const hasBal = balances[fromSym] !== undefined
  const feeReserve = Math.max(GAS_RESERVE_USDC, feeUsd ?? 0)
  const available = fromSym === 'USDC' ? Math.max(0, (balances.USDC || 0) - feeReserve) : spendableOf(fromSym, balances[fromSym])
  // Swapping EURC/cirBTC still needs USDC for the fee.
  const usdcShort = feeUsd !== null && fromSym !== 'USDC' && balances.USDC !== undefined && balances.USDC < feeUsd

  // ── AMOUNT = % × available, UNLESS a round number was just tapped (snapAmt) ──
  // floorTo (not toFixed): toFixed rounds UP → 100% can produce more than the balance → the Kit answers "over balance".
  // 100% = "swap everything" → the FULL available amount to the token's own decimals (6 USDC/EURC, 8 cirBTC). Flooring it
  // to the 2 display decimals left dust behind (owner 2026-10-04: "0.01 EURC left over" - 1.009 EURC swapped only 1.00).
  // USDC's fee reserve (feeReserve) is already out of `available`. Other percentages stay on round 2-decimal amounts.
  const amountNum = snapAmt !== null ? snapAmt : (!hasBal ? 0
    : pct >= 100 ? Number(toAmountString(available, NET.tokens[fromSym]?.decimals ?? 6))
    : floorTo(available * pct / 100, decimalsFor(fromSym)))

  // ── Converting to DISPLAY MONEY ($/€) ── rate = USD per token; display money = usd / rate[cur]
  const rateOf = sym => (rates && rates[sym]) || null
  const toDisplay = (tokenAmt, sym) => {
    const r = rateOf(sym), rc = rateOf(cur)
    return r && rc ? (tokenAmt * r) / rc : null
  }
  // v is currently a NUMBER OF DISPLAY-CURRENCY UNITS (already divided by the rate), while fmtDisplay expects a USD value → multiply
  // the rate back in and let fmtDisplay handle the symbol/decimals/separators per currency (VND differs completely).
  const fmtDisp = v => (v === null ? null : fmtDisplay(v * (rateOf(cur) || 1), cur, rates))

  const amountDisplay = toDisplay(amountNum, fromSym)

  // ── ROW 7: round-number suggestions - in the TOKEN BEING PAID (user decision 07-17c), NOT in USD ──
  // The chips are TAPPABLE (not "Release to use" - the user disliked that). Spec 07-17e "be generous with
  // hints": the TRIO floor·floor+0.5·ceil - 7.35 EURC → [7] [7.5] [8]. pct===100 = "swap everything" → no suggestions.
  const hints = (hasBal && pct < 100 && amountNum > 0 && !loading)
    ? roundHints(amountNum, available, decimalsFor(fromSym)) : []

  const overBalance = hasBal && amountNum > available + 1e-9
  const canSwap = SWAP_ENABLED && amountNum > 0 && !overBalance && !loading && feeUsd !== null && !usdcShort

  // ⚠️ A failed read writes NOTHING into balances (keeping "unknown" → showing "…"), never falling back to 0:
  // a fake 0 = "Available: 0" while the wallet has money (bug 07-17). Retry after 3s so it recovers once the RPC unclogs.
  function loadBalances() {
    if (!walletAddress) return
    let alive = true, retry
    const load = () => getTokenBalances(walletAddress)
      .then(ts => { if (!alive) return; const map = {}; ts.forEach(tk => { map[tk.symbol] = tk.amount }); setBalances(map) })
      .catch(() => { if (alive) retry = setTimeout(load, 3000) })
    load()
    return () => { alive = false; clearTimeout(retry) }
  }
  useEffect(loadBalances, [walletAddress])

  // Rate + fee (shown in the Rate/Fee block, which the spec requires to be ALWAYS visible)
  useEffect(() => { getDisplayRates().then(setRates).catch(() => {}) }, [])

  // Estimated output (debounced 600ms) - dragging the slider fires constantly, so it MUST be debounced or it floods the Kit API
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!amountNum || amountNum <= 0) { setEstAmt(null); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await estimateSwap({ walletAddress, tokenIn: fromSym, tokenOut: toSym, amountIn: toAmountString(amountNum, NET.tokens[fromSym]?.decimals ?? 6) })
        // amountOut = the real token decimal (the server already converted from base units - the raw estimatedAmount is base units, do NOT show it directly)
        if (res?.amountOut) {
          setEstAmt(res.amountOut); setMinOut(res.minOut || null); setError('')
          // The real fee of this swap, from Circle (not a guess). No fee → the Swap button stays off.
          estimateSwapFee({ walletId, walletAddress, tokenIn: fromSym, tokenOut: toSym, amountIn: toAmountString(amountNum, NET.tokens[fromSym]?.decimals ?? 6) })
            .then(f => setFeeUsd(Number(f.feeMax) > 0 ? Number(f.feeMax) : null))
            .catch(e => { setFeeUsd(null); setError(`Could not get the network fee: ${e.message}`) })
        }
        else if (res?.error) { setEstAmt(null); setMinOut(null); setError(res.error) }
        else { setEstAmt(null); setMinOut(null) }
      } catch (e) { setEstAmt(null); setMinOut(null); setError(e.message) }
    }, 600)
    return () => clearTimeout(debounceRef.current)
  }, [amountNum, fromSym, toSym])

  function resetAmount() { setPct(0); setSnapAmt(null); setEstAmt(null); setMinOut(null); setError(''); setTyped('') }
  // Not enough USDC left to pay the fee of an EURC/cirBTC swap → say so on the button instead of a refused transaction.
  useEffect(() => { if (usdcShort) setError(`Not enough USDC for the network fee (up to ${feeUsd.toFixed(3)})`) }, [usdcShort, feeUsd])

  // ── NUMPAD bottom sheet: tap the You pay amount → open it; whatever is typed applies immediately (snapAmt + the slider follows) ──
  function openPad() {
    if (!hasBal || loading) return
    if (success) { setSuccess(false); setStatus('') }
    padPrev.current = { snapAmt, pct }   // so the Back button can discard what was typed
    // Seed the typed string with the current amount (if any) so backspacing can edit it, instead of retyping from scratch
    setTyped(amountNum > 0 ? String(amountNum) : '')
    setPad(true)
  }
  function cancelPad() {   // Back: restore the amount as it was before the numpad opened
    const p = padPrev.current
    if (p) { setSnapAmt(p.snapAmt); setPct(p.pct) }
    setPad(false)
  }
  function applyTyped(s) {
    setTyped(s)
    const n = parseFloat(s)
    setSnapAmt(s === '' ? 0 : (isNaN(n) ? 0 : n))
    if (available > 0) setPct(Math.max(0, Math.min(100, ((isNaN(n) ? 0 : n) / available) * 100)))
  }
  function onPadKey(k) {
    if (k === 'BACK') { applyTyped(typed.slice(0, -1)); return }
    if (k === '.') {
      if (typed.includes('.')) return
      applyTyped(typed === '' ? '0.' : typed + '.')
      return
    }
    // Block absurdly long numbers: at most 9 integer digits, decimals per token (2 or 6)
    const [int = '', dec] = typed.split('.')
    if (dec !== undefined) { if (dec.length >= decimalsFor(fromSym)) return }
    else if (int.length >= 9) return
    applyTyped(typed === '0' ? k : typed + k)
  }

  // Dragging the slider → clear the old snap + clear the old success state
  function onPct(p) {
    if (success) { setSuccess(false); setStatus('') }
    setSnapAmt(null)
    setPct(p)
  }

  // Tapping a round-number chip → lock in that exact amount. The number is already in token units (roundHints works in tokens)
  // so NOTHING is converted - just clamp it for safety, then move pct so the thumb lines up.
  function pickHint(tokenAmt) {
    const final = Math.min(tokenAmt, floorTo(available, decimalsFor(fromSym)))
    if (!(final > 0)) return
    setSnapAmt(final)
    if (available > 0) setPct(Math.max(0, Math.min(100, (final / available) * 100)))
  }

  // Reverse direction: 180° for the button (spec) + reset the amount (the two token balances differ → keeping the old % is meaningless)
  const [flip, setFlip] = useState(0)
  function swapDir() { setFromSym(toSym); setToSym(fromSym); resetAmount(); setFlip(f => f + 180) }

  function selectToken(side, sym) {
    if (side === 'from') { if (sym === toSym) setToSym(fromSym); setFromSym(sym) }
    else { if (sym === fromSym) setFromSym(toSym); setToSym(sym) }
    resetAmount()
  }

  // MAINNET-AUDIT C3: the same refId tracking as Send (src/txTracker.js). "complete" is only announced once Circle
  // reports the transaction COMPLETE, and an error after the PIN is treated as UNKNOWN - never as "failed" - so
  // nobody swaps twice. Send and Swap share one pending slot: no new swap while any payment is unresolved.
  async function handleSwap() {
    setLoading(true); setError(''); setSuccess(false); setStatus('Preparing…')
    const blocked = (msg) => { setLoading(false); setStatus(''); setError(msg) }
    const STILL = 'Your last transaction is still being confirmed. Do NOT swap again yet - check Transaction history in a moment.'
    let attempt = null
    try {
      await assertNetworkReady()   // MAINNET-AUDIT C2 - no challenge unless the network self-check passed

      const prev = getPending()
      if (prev) {
        setStatus('Checking your last transaction…')
        let r
        try { r = classify(await lookup(prev)) } catch { return blocked(STILL) }
        if (r === 'pending') return blocked(STILL)
        clearPending(prev.refId)   // final (ok/failed) or never created → safe to go on
      }

      attempt = newAttempt('swap', { fromSym, toSym })
      // A 60' token may have expired mid-session → refresh it BEFORE creating a challenge that needs the PIN
      const { userToken, encryptionKey } = await refreshSession()
      const amountIn = toAmountString(amountNum, NET.tokens[fromSym]?.decimals ?? 6)
      // minOut from the SAME estimate whose amount is on screen - the swap can never deliver less (H2).
      if (!minOut) { clearPending(attempt.refId); throw new Error('Getting the price… try again in a second.') }
      const res = await executeSwap({ userToken, walletId, walletAddress, tokenIn: fromSym, tokenOut: toSym, amountIn, minOut, refId: attempt.refId })
      if (res.error) { clearPending(attempt.refId); throw new Error(res.error) }   // no challenge → nothing can exist

      setStatus('Enter PIN...')
      let signError = null
      try {
        await executeChallenge(await getSDK(), userToken, encryptionKey, res.challengeId)
      } catch (e) {
        if (e?.code === 155701) { clearPending(attempt.refId); setLoading(false); setStatus(''); return }   // user closed the PIN screen
        signError = e
      }

      setStatus('Confirming on the network…')
      const { outcome } = await waitFinal(attempt, { timeoutMs: signError ? 30000 : 90000 })
      if (outcome === 'failed' || (outcome === 'none' && signError)) {
        clearPending(attempt.refId)
        addNotif(`Swapped ${amountIn} ${fromSym} to ${toSym} (failed - nothing was swapped)`, 'error', null, `swap-fail-${Date.now()}`)
        setLoading(false); setStatus('')
        setError(signError && outcome === 'none' ? circleErrorMessage(signError) : 'The network rejected this swap - nothing left your wallet.')
        return
      }
      if (outcome !== 'ok') return blocked(STILL)   // exists but not final / could not ask - keep it blocked

      clearPending(attempt.refId)
      // ONE notification per swap (user decision 07-20) - now only after Circle says COMPLETE.
      const outTxt = res.amountOut ? ` to ~${parseFloat(res.amountOut).toFixed(decimalsFor(toSym))} ${toSym}` : ` to ${toSym}`
      addNotif(`Swapped ${amountIn} ${fromSym}${outTxt} (complete)`, 'sent', null, `swap-${Date.now()}`)
      resetAmount()
      setSuccess(true); setStatus('Swap successful')
      setLoading(false)
      try {
        const ts = await getTokenBalances(walletAddress)
        const map = {}; ts.forEach(tk => { map[tk.symbol] = tk.amount }); setBalances(map)
      } catch {}
      setTimeout(() => { setSuccess(false); setStatus('') }, 3500)   // auto-hide, back to the plain "Swap" button
    } catch (e) {
      // Unexpected error while an attempt is open → unknown, keep it blocked; otherwise a plain failure.
      if (attempt && getPending()?.refId === attempt.refId) return blocked(STILL)
      setLoading(false)
      const msg = circleErrorMessage(e)
      setError(msg); setStatus('')
    }
  }

  // The card = a PALE GREY BACKGROUND, NO BORDER, NO SHADOW (nodes 1:68/1:69, 2026-09-10: radius 16,
  // was 20 - the token chip inside stays WHITE so it stands out on the grey without needing a border).
  const CARD = { border: 'none', borderRadius: 16, background: 'var(--color-surface)', padding: 'calc(14 * var(--u)) calc(16 * var(--u))' }

  // ONE MINIMAL 3-row card (user decision 07-20 "strip it back so the text can be bigger for older users"):
  //   the You pay/receive label
  //   [token chip ▼]  ————————  THE BIG NUMBER (the token name after the number was dropped - the chip already says it)
  //   Available: xx TOKEN  ————  ~ $converted
  // Secondary text raised to --fs-item 17. The big number = base 52, shrinking by REAL WIDTH (useFitFontSize - user decision
  // 07-22c: guessing by character count (the old amountFontSize) was wrong because the card shares its row with the chip, so 7 characters
  // ("1000000") already overflowed into "100000…" without shrinking - measuring on canvas now shrinks it to fit exactly).
  // onAmount (the You pay card only): tapping the NUMBER AREA (including the empty space right of the chip) → opens the numpad.
  // typing: the string being typed on the numpad (null = numpad closed).
  function SideCard({ label, sym, onPick, amount, disp, onAmount, typing, balLabel, idle }) {
    const known = amount !== null
    const balKnown = balances[sym] !== undefined
    const isTyping = typing !== null && typing !== undefined
    // idle (You receive, user decision 07-23): NO amount entered → nothing to estimate → leave it COMPLETELY EMPTY.
    // "…" is reserved for "not readable yet / loading" (an amount was entered, waiting on the estimate) - it used to show
    // "…" while idle too, which looked like a load that never finished and sat oddly against the big caret on You pay.
    // Drop redundant trailing decimal zeros (user decision 07-28: "10.00" is silly for a whole number) - keep decimals ONLY WHEN PRESENT
    // ("10"→10, "10.50"→10.5, "10.25"→10.25). Only the part after the dot is trimmed, the integer is untouched.
    const trimZeros = s => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s)
    const amtStr = isTyping ? (typing || '0') : known ? trimZeros(amount.toFixed(decimalsFor(sym))) : idle ? '' : '…'
    const amtColor = overBalance ? 'var(--color-error)'
      : isTyping ? (typing ? 'var(--color-content)' : 'var(--color-faint)')
      : known && amount > 0 ? 'var(--color-content)' : 'var(--color-faint)'
    // A card WITH onAmount (You pay) but NO amount yet (nothing typed, or 0) → hide "0.00" and leave room
    // only for the caret (user decision 07-22b: "0.00" NEXT TO a blinking caret looks redundant and cluttered, pick one).
    // The "You receive" card has no onAmount → it always shows amtStr as-is (0.00 / … / a real number), unchanged.
    const hasValue = isTyping ? !!typing : known && amount > 0
    const showZero = onAmount && !hasValue
    // The _ caret appears ONLY WHILE TYPING (numpad open) or when the field is EMPTY (the tap hint) - once there is a number it is OFF
    // (user decision 07-28: "10.00_" with a caret blinking after a finished number looks nonsensical).
    const showCaret = onAmount && (isTyping || !hasValue)
    {/* 44px max (was 52), node 1:82's "_" caret - measured at 44 on this Figma pull */}
    const [fitRef, fitSize] = useFitFontSize((showZero ? '' : amtStr) + (showCaret ? '_' : ''), { max: 44, min: 18 })
    return (
      <div style={{ ...CARD, minWidth: 0, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'calc(10 * var(--u))' }}>
        {/* 2026-09-10: 18px semibold BLACK (was --fs-body 19 medium muted) - nodes 1:70/1:76 */}
        <span style={{ fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-content)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'calc(8 * var(--u))', minWidth: 0 }}>
          <TokenRow sym={sym} onClick={onPick} />
          {/* THE AMOUNT FIELD. The white box's COLOUR/BORDER around the number was REMOVED (user decision 07-22: a bordered box looks rigid and long
              numbers easily spill outside the frame = ugly) - BUT ITS DIMENSIONS ARE KEPT (minHeight 56 + padding
              2/12) so the card does NOT get shorter (bug 07-22d: removing minHeight/padding as well dropped the whole You
              pay/You receive block from 2 rows to ~1.5 - the user re-confirmed: 2 rows/2 rows/Rate 0.5
              rows must stay exactly as they were, only hide the background/border, never touch the sizing). The "tappable"
              signal is instead a BLINKING CARET after the number (the "You pay" card has onAmount). The "You
              receive" card has no onAmount → no caret, no box, completely bare (as before).
              ref={fitRef} measures the width actually left beside the chip so the text shrinks to fit; overflow:hidden is
              the last-resort net (it only kicks in when a number is longer than even the smallest size). */}
          <div ref={fitRef} onClick={onAmount} style={{
            flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
            cursor: onAmount ? 'pointer' : 'default',
            ...(onAmount ? { padding: 'calc(2 * var(--u)) calc(12 * var(--u))', minHeight: 'calc(56 * var(--u))' } : null),
          }}>
            <span className="num" style={{ fontSize: fitSize, fontWeight: 'var(--fw-light)', lineHeight: 1.05, color: amtColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {showZero ? null : amtStr}
              {showCaret && <span className="caret">_</span>}
            </span>
          </div>
        </div>
        {/* 2026-09-10: 16px (was --fs-item 17), label colour --color-muted-2 #667085 (was --color-muted) -
            node 1:71's "Available:" span. Available and ~$ share the same size. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'calc(8 * var(--u))', minWidth: 0 }}>
          <span style={{ fontSize: 'var(--fs-content-2)', color: 'var(--color-muted-2)', whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {/* balLabel: You receive = "Balance", You pay = null (hidden - user decision 07-22f: the Available line was
                dropped from You pay). A balance that cannot be read yet → "…", NEVER a drawn 0 (bug 07-17). */}
            {balLabel ? <>{balLabel}: <span className="num" style={{ color: 'var(--color-brand)', fontWeight: 'var(--fw-semibold)' }}>
              {balKnown ? `${(balances[sym] || 0).toFixed(decimalsFor(sym))} ${sym}` : '…'}
            </span></> : null}
          </span>
          <span className="num" style={{ fontSize: 'var(--fs-content-2)', color: 'var(--color-muted-2)', whiteSpace: 'nowrap' }}>{disp !== null ? `~ ${fmtDisp(disp)}` : ''}</span>
        </div>
      </div>
    )
  }

  // A real Arc gas fee is usually < 1 cent → .toFixed(2) renders "$0.00" = looks broken, or free.
  // A fee > 0 that rounds to 0 says "< $0.01" plainly instead (honest, and not alarming).
  // ⚠️ The "too small to show" threshold must follow EACH CURRENCY's decimals, do not hardcode 0.01: VND has no
  // decimals so its smallest unit is 1 ₫ - hardcoding 0.01 would treat a 13 ₫ fee as "showable" and print
  // "13,00 ₫" (nobody writes VND with decimals). The symbol is left to fmtDisplay too, because ₫ goes AFTER the number.
  const feeTxt = (() => {
    if (feeUsd === null) return '…'
    // The fee is paid in USDC (= $): no live rate for the display currency → show it in $, its real unit (no "|| 1" guess).
    const fc = cur === 'USDC' || rateOf(cur) ? cur : 'USDC'
    const rc = fc === 'USDC' ? 1 : rateOf(fc)
    const min = 10 ** -decimalsOfCurrency(fc)       // 0.01 for USD/EUR · 1 for VND
    const v = feeUsd / rc                            // the fee converted into the display currency
    // Circle's estimate is the MAXIMUM this swap can cost (networkFee) - the real charge is lower, so say "up to".
    if (v <= 0) return `up to ${fmtDisplay(0, fc, rates)}`
    return v < min ? `<${fmtDisplay(min * rc, fc, rates)}` : `up to ${fmtDisplay(feeUsd, fc, rates)}`
  })()

  const estNum = estAmt !== null ? parseFloat(estAmt) : null
  const rateTxt = (() => {
    // The REAL rate from the Kit quote once available (provider fees included); until then, the market rate
    if (estNum && amountNum > 0) return `1 ${fromSym} ~ ${(estNum / amountNum).toFixed(4)} ${toSym}`
    const rf = rateOf(fromSym), rt = rateOf(toSym)
    return rf && rt ? `1 ${fromSym} ~ ${(rf / rt).toFixed(4)} ${toSym}` : '…'
  })()

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      {picker && <TokenPicker current={picker === 'from' ? fromSym : toSym} onSelect={sym => selectToken(picker, sym)} onClose={() => setPicker(null)} />}

      {/* The numpad bottom sheet (user's layout 07-20): slides up TAKING half of row 6 + rows
          7-10, GREY background + WHITE keys, NO wasted space at the top, and it does NOT dim the main screen.
          Inside the sheet: numpad 30dvh + the Back/Done button row 10dvh (aligned with .row10-dual) + 5dvh of padding.
          Back = discard what was typed; Done / tapping outside = keep it. */}
      {pad && (
        <div className="sheet-overlay" onClick={() => setPad(false)}>
          <div className="sheet numpad-gray" onClick={e => e.stopPropagation()}>
            {/* 24px of grey padding on top + SHORTER keys (07-20c: numpad 5.5 parts instead of 6 - the old keys were too big),
                a 0.5 gap before the button row; Back/Done KEEP the row 9-10 edge (flex 2 = 85-95dvh). */}
            <div style={{ flex: 5.5, minHeight: 0, paddingTop: 'calc(24 * var(--u))' }}>
              <Numpad onKey={onPadKey} showComma />
            </div>
            <div style={{ flex: 0.5 }} />
            <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'calc(12 * var(--u))' }}>
              <button className="btn btn-secondary" style={{ width: '44%' }} onClick={cancelPad}>Back</button>
              <button className="btn btn-primary" style={{ width: '44%' }} onClick={() => setPad(false)}>Done</button>
            </div>
            <div style={{ flex: 1 }} />
          </div>
        </div>
      )}

      {/* .sheet-title (index.css) - the 2026-09-23 redesign's shared 24px title, node 1:67. */}
      <div className="sheet-title">Exchange</div>

      {/* 2026-09-10 REBUILD against the current Figma file (node 1:63): every zone below is placed on
          exact guideline-grid coordinates (see HANDOFF.md READ FIRST §1) instead of the old
          flex/space-between layout, which cannot be checked pixel-by-pixel the way absolute positions
          can. "You pay"/"You receive" occupy rows 2-3 and 4-5 (156px each, the same double-row height as
          the Service Hub cards); the reverse button straddles their shared gutter; Rate/Fee sits alone in
          row 6; the round-number chips + % slider fill rows 7-8 - this is the "row 8 and up is the
          slider's area" the user flagged; the CTA sits on row 9 at the width of the cards (NOT 3/4 of the
          screen - node 1:85 is 340px wide, edge to edge with the cards). */}

      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '10.19dvh', height: '18.48dvh' }}>
        <SideCard label={'You pay'} sym={fromSym} onPick={() => setPicker('from')} amount={hasBal ? amountNum : null} disp={amountDisplay}
          onAmount={openPad} typing={pad ? typed : null} balLabel="Available" />
      </div>

      {/* Reverse button - node 1:87: 50×50 (was 44), SOLID brand fill (the guideline forbids gradients -
          --grad-brand already aliases to the solid colour, so this needed no value change), glow shadow
          "0 0 8px rgba(0,0,0,.5)" (was a straight-down .35). 2026-09-10 CORRECTION: the previous pass
          used the raw Figma pixel (26.71dvh), which sits mostly INSIDE the "You pay" card rather than
          bridging the gap - the user's explicit call: this button belongs EXACTLY IN THE MIDDLE of the 2
          cards. Centre = the midpoint of the 16px gutter between them: card 1 bottom (10.19+18.48=28.67dvh)
          and card 2 top (30.57dvh) → (28.67+30.57)/2 = 29.62dvh. */}
      <button onClick={swapDir} aria-label={'Reverse direction'}
        style={{
          position: 'absolute', left: '50%', top: '29.62dvh', transform: `translate(-50%, -50%) rotate(${flip}deg)`, zIndex: 3,
          width: 'calc(50 * var(--u))', height: 'calc(50 * var(--u))', borderRadius: '50%', border: 'none', background: 'var(--btn-grad-brand)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'transform .3s ease',
        }}>
        <Icon name="trade" size="var(--is-num)" color="var(--color-white)" />
      </button>

      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '30.57dvh', height: '18.48dvh' }}>
        <SideCard label={'You receive'} sym={toSym} onPick={() => setPicker('to')} amount={estNum} disp={estNum !== null ? toDisplay(estNum, toSym) : null} balLabel="Balance" idle={!(amountNum > 0)} />
      </div>

      {/* Rate + Fee - node 1:83/10:123: raw Figma reading was 13px, rounded up to Chú thích (15px) - the
          new 5-tier scale (2026-09-10) has no tier below 15, absorbing the old --fs-tiny. Label colour
          --color-muted-2 #667085, figures BLACK semibold. Alone in row 6, centred at 51.4dvh. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '51.4dvh', transform: 'translateY(-50%)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 'calc(8 * var(--u))', rowGap: 'calc(2 * var(--u))', padding: '0 calc(11 * var(--u))' }}>
        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)', whiteSpace: 'nowrap' }}>
          Rate: <span className="num" style={{ color: 'var(--color-content)', fontWeight: 'var(--fw-semibold)' }}>{rateTxt}</span>
        </span>
        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)', whiteSpace: 'nowrap' }}>
          Fee: <span className="num" style={{ color: 'var(--color-content)', fontWeight: 'var(--fw-semibold)' }}>{feeTxt}</span>
        </span>
      </div>

      {/* Round-number chips + the % slider - "row 8 and up is the slider's area" (user, 2026-09-10):
          rows 7-8 (156px), the same double-row height used everywhere else in this rebuild.
          ⚠️ The chip row MUST have a FIXED HEIGHT (height 40, never sized by its content): when `hints.map` is
          empty the row collapses to 0, which used to reflow the slider below it (bug reported 07-21) -
          reserving the space keeps the slider still while the chips merely fade in and out. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '61.14dvh', height: '18.48dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1dvh', minWidth: 0 }}>
        {/* NO amount chosen → the row stays EMPTY (user decision 07-23: the "Slide to adjust…" hint pill was dropped, the
            instruction MOVED ONTO THE SWAP BUTTON as "Slide or tap here to enter", which opens the numpad). */}
        <div style={{ height: 'calc(40 * var(--u))', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'calc(8 * var(--u))', minWidth: 0 }}>
          {hints.length ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'calc(8 * var(--u))', minWidth: 0 }}>
              {hints.map(v => (
                // 2026-09-10 CORRECTION: this chip still carried the OLD --fs-item (17px) value,
                // unchanged from before today's rebuild since the Figma mockup has no live-typing state
                // to read a chip size from directly. 16px is not a guess - it is the SAME size confirmed
                // live from Figma on every other secondary/hint-class text this session ("Available: 20.00
                // EURC" node 1:71, "Hold to show tokens" node 1:337): that is the current standard this
                // chip should follow instead of the stale 17. Both spans now match (semibold, brand blue)
                // as one value, not a differently-weighted label:value pair.
                <button key={v} onClick={() => pickHint(v)}
                  style={{ border: '1.5px solid var(--color-brand)', background: 'var(--btn-grad-white)', borderRadius: 999, padding: 'calc(6 * var(--u)) calc(14 * var(--u))', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', minWidth: 0 }}>
                  <span className="num" style={{ fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)' }}>{fmtHint(v, decimalsFor(fromSym))}</span>
                  <span className="num" style={{ fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-brand)' }}> {fromSym}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ minWidth: 0 }}>
          <PctSlider pct={Math.round(pct)} onChange={onPct} disabled={!hasBal || loading} />
        </div>
      </div>

      {/* The Swap button - node 1:85: row 9 is 70px tall (top 81.52dvh / height 8.29dvh, centre
          85.66dvh) but the BUTTON ITSELF is 48.66≈48px (2026-09-10 CORRECTION: the previous pass set
          height:'100%' on the button, filling the whole 70px row - "mập" per the user, and off the
          guideline's spacing scale 8/16/24/32/40/48/56/64, which the standard button height MUST land
          on). The row stays 70px as the LAYOUT slot; the button is a fixed 48px, centred inside it via
          the row's own alignItems:center - do not stretch a button to fill its row again. Radius 38 on a
          48-tall button clamps to the same full pill CSS already renders for every other radius ≥ half
          the height, so this still reads identically to a stadium shape. SOLID brand fill, width = the
          SAME 340px as the cards above it (was 3/4 of the screen). The bigger glow
          "0 0 20px rgba(0,0,0,.32)" (was the standard button shadow) is this CTA's own value, not reused
          from elsewhere. Still the only place status is shown; priority error > status > hint/'Swap'. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '81.52dvh', height: '8.29dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {(() => {
          const needAmount = !error && !status && !(amountNum > 0)   // no amount chosen → the button becomes the hint that opens the numpad
          // 'Swap submitted' (sent, awaiting confirmation) = PALE green · 'Swap successful' (the received token balance has
          // risen) = SOLID green → telling the 2 steps apart avoids confusion (user decision 07-28, they used to share a colour).
          const confirmed = status === 'Swap successful'
          return (
        <button className={`btn ${error ? 'btn-secondary' : success ? 'btn-success' : 'btn-primary'}`}
          style={{
            width: '100%', height: 'var(--btn-h)', minHeight: 0, borderRadius: 38, overflow: 'hidden',
            boxShadow: error || success ? undefined : '0 2px 20px rgba(0, 0, 0, 0.32)',
            ...(error ? { color: 'var(--color-error)', borderColor: 'var(--color-error)' } : null),
            ...(success ? { opacity: confirmed ? 1 : 0.6 } : null),
          }}
          disabled={needAmount ? (!hasBal || loading) : (!canSwap && !error)}
          onClick={needAmount ? openPad : handleSwap}>
          {/* Hint text = fs-item 17 (the app-wide HINT SIZE rule - .btn's default 21 gets ellipsised).
              ⚠️ "enter", NOT "input": the Figma text reads "Slide or tap here to input", but the user
              explicitly decided (2026-09-08) to keep "enter" regardless of what Figma draws -
              this is a deliberate standing override, not an oversight, so it is NOT changed to match. */}
          {/* Long text (errors) WRAPS to at most 2 centred lines (owner 2026-10-05) - it used to be one nowrap line
              cut short, and line-height 1 + overflow:hidden clipped g/y/p even on a single line. 2 × 20 × 1.2 = 48
              design px fits the 58px button; only a 3rd line gets "…". */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'calc(6 * var(--u))', maxWidth: '100%', minWidth: 0, ...(needAmount ? { fontSize: 'var(--fs-content-2)' } : null) }}>
            {success && <Icon name="check" size="var(--ib-content-1)" color="var(--color-white)" />}
            {(() => { const text = error || status || (needAmount ? 'Slide or tap here to enter' : 'Swap')
              return <TwoLineFit key={text} sizes={needAmount ? ['content-2', 'caption', 'small'] : ['content-1', 'content-2', 'caption', 'small']}>{text}</TwoLineFit> })()}
          </span>
        </button>
          )
        })()}
      </div>

      {/* EXIT - node 1:65: white text on the gradient reveal zone below the sheet, same as every other
          Menu-reached sub-screen now (Security/About) - replaces the pre-redesign red-text .row-10 Exit,
          since the shell itself changed from plain-white to gradient+sheet. */}
      <ExitBar onClick={() => navigate('ServiceHub')} />
    </div>
  )
}
