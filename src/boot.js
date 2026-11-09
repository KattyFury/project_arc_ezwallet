// WHERE THE APP STARTS. Extracted from App.jsx on 2026-09-23 because the "Add to home screen" screen
// also needs it: when the user taps Skip there, it has to continue to wherever boot WOULD have gone,
// and duplicating the session/PIN rules in two places is how they drift apart.

// Session exists → through the PIN GATE (wallet unlock) before HomeSend, unless this session is already
// unlocked (ez_pin_ok - set after verifying the PIN, or right after CREATING the PIN on first login).
// No session → Login.
export function bootTarget() {
  // Web3 wallet login: no Circle userToken, only an address. Skip PinGate entirely -
  // PIN is a Circle UCW feature and does not apply to external wallets.
  const isWeb3Wallet = localStorage.getItem('ez_login_method') === 'web3wallet'
  const walletAddr = localStorage.getItem('ez_wallet_addr')
  if (isWeb3Wallet && walletAddr) {
    sessionStorage.setItem('ez_pin_ok', '1')   // mark session unlocked so guards downstream pass
    return { screen: 'HomeSend', params: {} }
  }

  const hasSession = localStorage.getItem('ez_user_token')
  if (!hasSession) return { screen: 'Login', params: {} }
  const unlocked = sessionStorage.getItem('ez_pin_ok')
  return unlocked ? { screen: 'HomeSend', params: {} } : { screen: 'PinGate', params: { next: 'HomeSend' } }
}

export const A2HS_KEY = 'ez_a2hs_done'

// How long one Skip hides the offer. The key stores the Skip time (ms since epoch); once this much time
// has passed the screen comes back. User decision 2026-10-02: "ấn skip chỉ ẩn 2 ngày thôi" (it used to be
// permanent). A legacy value of '1' from the permanent era parses as 1 ms → already expired → shows again.
export const A2HS_SNOOZE_MS = 2 * 24 * 60 * 60 * 1000

// SHOULD THE "ADD TO HOME SCREEN" OFFER RUN? Two gates, both of which must pass:
//   1. not skipped in the last 2 days (A2HS_SNOOZE_MS) - a Skip only snoozes it,
//   2. NOT already installed - `display-mode: standalone` (Android/Chrome + the manifest) or
//      `navigator.standalone` (iOS Safari's own, non-standard flag). Offering to install an app that IS
//      installed is the most annoying version of this screen.
//
// ⚠️ DESKTOP IS DELIBERATELY INCLUDED (user decision 2026-09-23: "hiện luôn trên desktop đi, cho đẹp,
// show off"). There WAS a `pointer: coarse` gate here, on the reasoning that a desktop browser cannot
// add anything to a home screen so the offer is a dead end. The user overrode it: on desktop the whole
// app is drawn inside an iPhone handset (see the `min-width: 481px` block in index.css), so this screen
// reads as part of that presentation. Known trade-off, accepted: the two steps are worded for iOS
// Safari ("Tap Options, then tap Share"), so on a desktop browser they describe something that is not
// there. Do not re-add the gate without asking.
//
// Everything is wrapped: localStorage throws in private mode on some browsers, and matchMedia is absent
// in old WebViews - in either case the offer is simply skipped rather than blocking the whole boot.
export function shouldOfferInstall() {
  try {
    const skippedAt = Number(localStorage.getItem(A2HS_KEY))
    if (skippedAt && Date.now() - skippedAt < A2HS_SNOOZE_MS) return false
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return false
    if (window.navigator.standalone === true) return false
    return true
  } catch {
    return false
  }
}
