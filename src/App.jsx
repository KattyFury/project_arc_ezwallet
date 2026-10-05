import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { NavContext } from './nav'
import { bootTarget, shouldOfferInstall } from './boot'
import ErrorBoundary from './components/ErrorBoundary'

// LAZY-LOAD EVERY SCREEN (2026-07-17) - the user: "why is this rubbish app so slow to load".
// Before: App.jsx imported all 22 screens STATICALLY → Vite bundled EVERYTHING into one 1,668 KB file, and the
// browser had to download + parse + run ALL of it before React drew the first character → a MEASURED 2.7s WHITE SCREEN on 4G.
// The heaviest parts were what the first screen does NOT need: jsQR 130KB (scanner only), qrcode.react (QR screens only).
// lazy() → one file per screen, downloaded only when the user actually opens it.
const AddToHome   = lazy(() => import('./screens/AddToHome'))
// Splash is imported EAGERLY (not lazy): it is the Suspense fallback while the FIRST screen loads (see below),
// so it must already be in the main bundle - a lazy fallback would itself suspend.
import Splash from './screens/Splash'
import { netHealth, NET } from './clientNet'
import { isLabsHost } from './labs'
const Login       = lazy(() => import('./screens/Login'))
const HomeSend    = lazy(() => import('./screens/HomeSend'))
const HomeReceive = lazy(() => import('./screens/HomeReceive'))
const Swap        = lazy(() => import('./screens/Swap'))
const ServiceHub  = lazy(() => import('./screens/ServiceHub'))
const Lending     = lazy(() => import('./screens/Lending'))      // LABS (src/labs.js)
const LendAction  = lazy(() => import('./screens/LendAction'))
const MenuScreen  = lazy(() => import('./screens/MenuScreen'))
const PasteAddress = lazy(() => import('./screens/PasteAddress'))
const SendAmount  = lazy(() => import('./screens/SendAmount'))
const SendConfirm = lazy(() => import('./screens/SendConfirm'))
const SendReceipt = lazy(() => import('./screens/SendReceipt'))
const CreateQR    = lazy(() => import('./screens/CreateQR'))
const ShowQR      = lazy(() => import('./screens/ShowQR'))
const SavedQRList = lazy(() => import('./screens/SavedQRList'))
const Contacts    = lazy(() => import('./screens/Contacts'))
const QRScanner   = lazy(() => import('./screens/QRScanner'))
const TxHistory   = lazy(() => import('./screens/TxHistory'))
const Security    = lazy(() => import('./screens/Security'))
const About       = lazy(() => import('./screens/About'))
const PinGate     = lazy(() => import('./screens/PinGate'))
const ForgotPin   = lazy(() => import('./screens/ForgotPin'))

const SCREENS = {
  AddToHome,
  Splash,
  Login,
  HomeSend, HomeReceive, Swap, ServiceHub, MenuScreen,
  Lending, LendAction,
  PasteAddress, SendAmount, SendConfirm, SendReceipt,
  CreateQR, ShowQR, SavedQRList,
  Contacts, QRScanner,
  TxHistory,
  Security,
  About,
  PinGate,
  ForgotPin,
}

export default function App() {
  const [nav, setNav] = useState(() => {
    // QA override for screenshotting a specific screen (e.g. ?screen=Splash) without touching the real
    // boot logic below - only takes effect when the name is a valid registered screen. `?params=` is an
    // optional URI-encoded JSON object for screens that read from nav params (SendConfirm/SendReceipt
    // need address/amount/etc - without this they'd crash on undefined.toFixed()).
    const qs = new URLSearchParams(window.location.search)
    const forced = qs.get('screen')
    if (forced && SCREENS[forced]) {
      let forcedParams = {}
      try { forcedParams = JSON.parse(decodeURIComponent(qs.get('params') || '{}')) } catch {}
      return { screen: forced, params: forcedParams }
    }
    // MOBILE BROWSER, NOT YET INSTALLED → offer the home-screen install FIRST (user's flow 2026-09-23).
    // Its Skip button continues to bootTarget() itself, so the rules below still decide where the user lands.
    if (shouldOfferInstall()) return { screen: 'AddToHome', params: {} }
    // Session exists → through the PIN GATE (wallet unlock) before HomeSend, unless this session is already
    // unlocked (ez_pin_ok). No session → Login. Lives in src/boot.js - AddToHome needs the same answer.
    return bootTarget()
  })

  // true until the user's first navigation: while the app is still booting, the loading fallback is the
  // Splash (matching the Splash index.html paints before any JS runs); afterwards it is the plain white frame.
  const booting = useRef(true)

  function navigate(screen, params = {}) {
    booting.current = false
    setNav({ screen, params })
  }

  // iOS/Android: when the keyboard opens, the browser SCROLLS the page to reveal the field → the screen/popup
  // "jumps up". Every input in this app is deliberately placed in the TOP HALF (above the keyboard area),
  // so we pin the page scroll at 0 → the field stays visible and the screen does not jump. (Only the PAGE
  // scroll is pinned; inner scrolling lists - overflow:auto in Contacts/History - are unaffected.)
  // Start the network self-check at boot so it is already answered by the time anyone sends (clientNet.js).
  useEffect(() => { netHealth() }, [])

  useEffect(() => {
    const lock = () => { if (window.scrollY !== 0) window.scrollTo(0, 0) }
    window.addEventListener('scroll', lock, { passive: true })
    return () => window.removeEventListener('scroll', lock)
  }, [])

  // PULL THE BACKUP of contacts/QR library once at startup (2026-07-29). Background, silent:
  // no KV binding / network error / MOCK → skipped, and the app never notices. It lives here (app startup) and
  // NOT in the Contacts screen: at this point the user certainly has no screen reading contacts open, so overwriting
  // local data cannot jolt the UI. Merge rules in detail: src/sync.js.
  // ⚠️ Since 08-06 (PIN-signature auth): the MAIN pull happens in PinGate, right after the user enters the PIN -
  // because the sync session token only exists after the signing step. This call now only covers a tab RELOAD
  // (sessionStorage survives → `ez_pin_ok` + `ez_sync_token` already exist, so PinGate is skipped).
  // With no token, `pullOnce` silently does nothing.
  useEffect(() => {
    if (!sessionStorage.getItem('ez_sync_token') || !localStorage.getItem('ez_wallet_addr')) return
    import('./sync').then(s => s.pullOnce()).catch(() => {})
  }, [])

  // PREFETCH while the browser is IDLE (2026-07-22g - the user: "the app is not smooth yet") → tab switching and the
  // PIN step feel SMOOTHER. No logic changes: it only warms the chunk cache (the dynamic import() still runs exactly the
  // same on real navigation). Frequently used screens are preloaded → switching tabs does NOT flash white (Suspense
  // fallback); the ~1MB Circle SDK (only needed for PIN signing) loads in the background → the PIN step does not stall
  // on a cold download. It runs when the browser is idle, so it does NOT compete for bandwidth at startup.
  useEffect(() => {
    const idle = window.requestIdleCallback ? window.requestIdleCallback.bind(window) : cb => setTimeout(cb, 1600)
    const cancel = window.cancelIdleCallback ? window.cancelIdleCallback.bind(window) : clearTimeout
    const id = idle(() => {
      import('./screens/HomeSend'); import('./screens/HomeReceive')
      import('./screens/ServiceHub'); if (NET.swap) import('./screens/Swap'); import('./screens/MenuScreen')
      import('./screens/SendAmount'); import('./screens/Contacts'); import('./screens/TxHistory')
      if (import.meta.env.VITE_MOCK !== '1') import('@circle-fin/w3s-pw-web-sdk').catch(() => {})
    })
    return () => cancel(id)
  }, [])

  // Swap is off on this network → no way into the screen at all (not even the ?screen= QA override); /api/swap
  // refuses too (503). See ServiceHub's "Coming soon" card.
  const labsOff = ['Lending', 'LendAction'].includes(nav.screen) && !isLabsHost(window.location.hostname)   // not even via ?screen=
  const Screen = labsOff ? SCREENS.ServiceHub : nav.screen === 'Swap' && !NET.swap ? SCREENS.ServiceHub : (SCREENS[nav.screen] || SCREENS['Login'])

  return (
    <NavContext.Provider value={{ navigate, params: nav.params }}>
      <ErrorBoundary>
        {/* fallback = an EMPTY WHITE SCREEN FRAME, deliberately WITHOUT a spinner or "loading" text: screens load in
            <100ms, and a spinner that blinks in and out is more annoying than nothing. Keeping the white background +
            the exact .screen frame → no layout jump when the real screen appears. */}
        {/* While BOOTING the fallback is <Splash/> instead (fix 2026-09-27, see `booting`). */}
        <Suspense fallback={booting.current ? <Splash /> : <div className="screen" />}>
          <Screen />
        </Suspense>
      </ErrorBoundary>
    </NavContext.Provider>
  )
}
