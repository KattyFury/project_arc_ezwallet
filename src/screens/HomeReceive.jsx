import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import { saveImageToPhotos, brandedQrCanvas } from '../saveImage'
import NavBar from '../components/NavBar'
import ScreenSheet from '../components/ScreenSheet'
import BalanceHeader from '../components/BalanceHeader'
import Icon from '../components/Icon'
import NotifArea from '../components/NotifArea'
import { useNav } from '../nav'
import { getTokenBalances, cachedBalances, sumUsd } from '../chain'
import { ensureWalletAddress } from '../circle'
import { buildQR } from '../qr'
import { shortenAddr } from '../data'
import { HALF_OVAL_STYLE } from './HomeSend'
import { GRADIENT } from '../brandBg'

// ROW 9 ACTION BAND (fix 2026-09-27, user: "16px nha"): the notification card ends at 79.62dvh
// (50.95 + 28.67) and row 10 starts at 91.71dvh. The big pill fills the band with EXACTLY 16px to each
// side at every viewport (70px at 844); the old fixed 70px on a dvh top drifted to 17.8/24.9px on a
// 932px phone and overlapped the NavBar on a 667px one. The side pills stay 48px, centred in the band.
// Gaps: 16 design px, never below 8px on a very short screen (user rule 2026-09-27).
const GAP = 'max(8px, calc(16 * var(--u)))'
const BIG_BTN = { top: `calc(79.62dvh + ${GAP})`, height: `calc(12.09dvh - 2 * ${GAP})` }
const SIDE_BTN = { top: 'calc(85.665dvh - var(--btn-h) / 2)', height: 'var(--btn-h)' }

export default function HomeReceive() {
  const { navigate } = useNav()
  const [copied, setCopied] = useState(false)
  const [addrCopied, setAddrCopied] = useState(false)   // a copy state just for the button under the QR (separate from "Share")
  const qrRef = useRef(null)   // hidden canvas used to export the QR image for Share
  // Seed the total balance from cache → no "..." when switching screens. NO cache yet → null (NOT KNOWN YET),
  // NOT 0 - see the note about the same bug in MenuScreen (07-16: the screen drew "$0.00" while loading).
  const [totalUsd, setTotalUsd] = useState(() => { const c = cachedBalances(localStorage.getItem('ez_wallet_addr')); return c ? sumUsd(c) : null })
  const [walletAddr, setWalletAddr] = useState(localStorage.getItem('ez_wallet_addr') || '')

  // Re-fetch the wallet address if missing (wallet created but Circle provisioning is slow)
  useEffect(() => {
    if (walletAddr) return
    ensureWalletAddress().then(a => { if (a) setWalletAddr(a) })
  }, [])

  useEffect(() => {
    if (!walletAddr) return
    // catch: on a failed read KEEP the old number, never let it collapse to 0 (getTokenBalances now throws instead of inventing 0)
    getTokenBalances(walletAddr).then(ts => setTotalUsd(sumUsd(ts))).catch(() => {})
  }, [walletAddr])

  // Share = the QR IMAGE (with logo + the red network note) **PLUS the WALLET ADDRESS AS TEXT** - user decision
  // 08-13: "as long as it shares 2 things, not 1".
  //
  // ⚠️ A KNOWN, ACCEPTED TRADE-OFF: including `text` makes iOS FILTER the apps offered in the share sheet
  // (Messages can disappear - exactly the bug reported on the morning of 08-13). The first fix dropped the text and DREW the
  // address onto the image; the user disliked it ("putting the address on the QR looks awful") and chose the text back. Do NOT drop `text`
  // again to "fix" the app list - that is the user's decision, not a bug.
  async function handleShare() {
    const qrCanvas = qrRef.current?.querySelector('canvas')
    if (!qrCanvas || !navigator.canShare) {
      // Device cannot share images → copy the address so the tap still does something
      await navigator.clipboard.writeText(walletAddr)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      return
    }
    // The address QR has no name or amount → its title is the short wallet address (owner 2026-10-06).
    saveImageToPhotos(await brandedQrCanvas(qrCanvas, { name: shortenAddr(walletAddr) }), 'ezwallet-qr.png', walletAddr)
  }

  async function handleCopyAddr() {
    await navigator.clipboard.writeText(walletAddr)
    setAddrCopied(true)
    setTimeout(() => setAddrCopied(false), 1500)
  }

  // RECEIVE - Figma node 56:70, rebuilt 2026-09-23. Structurally the SAME frame as Send (1:328): same
  // gradient, same 340x328 card at y=86, same 340x242 card at y=430, same three-pill action row, same
  // barless NavBar. Only the contents of the top card and the three pills differ, which is why every
  // shared number below is identical to HomeSend's - if one moves, both move.
  return (
    <div className="screen" style={{ background: GRADIENT }}>
      {/* The white sheet the whole screen sits on. FIRST child on purpose: it must paint
          behind every card, pill and label that follows. */}
      <ScreenSheet active="HomeReceive" />

      <BalanceHeader totalUsd={totalUsd} loading={totalUsd == null} />

      {/* TOP CARD - node 56:72: 340x328 at (25,86). */}
      <div style={{
        position: 'absolute', left: '6.41%', top: '10.19dvh', width: '87.18%', height: '38.86dvh',
        background: 'var(--color-card)', borderRadius: 16, overflow: 'hidden',
      }}>
        {/* THE QR - node 56:110 draws a flat 258x258 BLACK SQUARE, the placeholder this file uses for
            "the real thing goes here".
            ⚠️ USER CORRECTION 2026-09-23: "QR khi màn hình nhỏ đang bị button Tap to copy your address chèm".
            The old fixed `top: 13.68` + a WIDTH-ONLY size (75.88% of the card, height only from
            aspect-ratio) sized the QR purely off the card's WIDTH. The card's HEIGHT is `38.86dvh` -
            it shrinks with the viewport on a short/landscape screen while the card's width barely does -
            so the square QR kept its full size and grew taller than the shrunk card, running under the
            "Tap to copy" pill instead of leaving room for it.
            THE FIX - two fixed rules plus a shrink budget, exactly as specified:
              - top edge ALWAYS 8px from the card's own top (not a Figma-derived offset any more);
              - bottom edge ALWAYS >= 8px above the pill (HALF_OVAL_STYLE, 40 tall, pinned to bottom:0);
              - on a normal screen the HORIZONTAL cap (66.15% of the screen, same ratio the old
                75.88%-of-card figure worked out to) still wins, so nothing changes from before;
              - on a short screen the VERTICAL budget - card height minus the 8+8+40 = 56px those two
                rules reserve - wins instead, and the QR shrinks to fit it. `min()` picks whichever is
                smaller, so this is one rule, not a media-query special case. */}
        {/* Owner 2026-10-06: the QR sits CENTRED in the space between the card's top edge and the pill's top edge, so
            the gap above the QR always equals the gap below it (≥ 8px each; the size rule above is unchanged). */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 'calc(40 * var(--u))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 'min(66.15vw, calc(var(--screen-max) * 0.6615), calc(38.86dvh - calc(56 * var(--u))))',
          aspectRatio: '1 / 1', flexShrink: 0,
          background: 'var(--color-white)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {walletAddr
            ? <QRCodeSVG value={buildQR(walletAddr)} size={256} level="M" style={{ width: '94%', height: '94%' }} />
            : <span style={{ fontSize: 'var(--fs-small)', color: 'var(--color-muted-2)' }}>Loading...</span>}
        </div>
        </div>

        {/* "Tap to copy your address" - nodes 56:74 / 56:75. IDENTICAL IN SHAPE to Send's "Hold to
            show tokens" (the user, 2026-09-23: "phải làm cho nó y chang"), so the two share ONE
            definition - HALF_OVAL_STYLE - instead of two that drift. They already had: this one was
            briefly radius 16 while Send's was the 38px half-oval. */}
        <button onClick={handleCopyAddr} style={HALF_OVAL_STYLE}>
          {addrCopied ? 'Address copied' : 'Tap to copy your address'}
        </button>
      </div>

      {/* NOTIFICATION CARD - node 56:73: 340x242 at (25,430), identical to Send's. Figma draws one fixed
          hint box and one example notification; the live screen has 0..N of them, so the container is
          matched exactly and NotifArea keeps owning what goes inside it. */}
      <div style={{
        position: 'absolute', left: '6.41%', top: '50.95dvh', width: '87.18%', height: '28.67dvh',
        background: 'var(--color-card)', borderRadius: 16, padding: 'calc(16 * var(--u))',
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <NotifArea
          hints={[
            { label: 'QR Storage', desc: 'Save your favorite QR codes' },
            { label: 'Create QR', desc: 'Create a QR to receive money' },
            { label: 'Share', desc: 'Share your QR + wallet address' },
          ]}
        />
      </div>

      {/* ACTION ROW - nodes 56:76-56:78, the same three boxes as Send at the same coordinates: the centre
          pill 124x70 at y=688, the two side pills 100x48 at y=699, radius 16 on all three. */}
      <button onClick={() => navigate('SavedQRList')} style={{
        position: 'absolute', left: '6.41%', top: SIDE_BTN.top, width: '25.64%', height: SIDE_BTN.height,
        background: 'var(--btn-grad-white)', border: 'none', borderRadius: 16,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.48)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'calc(2 * var(--u))',
        fontFamily: 'inherit', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}>
        <Icon name="download" size="var(--ib-caption)" />
        <span>QR storage</span>
      </button>

      <button onClick={() => navigate('CreateQR')} style={{
        position: 'absolute', left: '34.10%', top: BIG_BTN.top, width: '31.79%', height: BIG_BTN.height,
        background: 'var(--btn-grad-brand)', border: 'none', borderRadius: 16,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.48)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'calc(2 * var(--u))',
        fontFamily: 'inherit', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-white)',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}>
        <Icon name="qr" size="var(--ib-content-1)" color="var(--color-white)" />
        <span>Create QR</span>
      </button>

      <button onClick={handleShare} style={{
        position: 'absolute', left: '67.95%', top: SIDE_BTN.top, width: '25.64%', height: SIDE_BTN.height,
        background: 'var(--btn-grad-white)', border: 'none', borderRadius: 16,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.48)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'calc(2 * var(--u))',
        fontFamily: 'inherit', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}>
        <Icon name="share" size="var(--ib-caption)" />
        <span>{copied ? 'Copied' : 'Share'}</span>
      </button>

      <NavBar active="HomeReceive" />

      {/* OFF-SCREEN CANVAS - Share needs a raster QR to hand to the OS share sheet, and the visible one
          above is an SVG. Kept out of the layout rather than hidden with display:none, which would stop
          the canvas from painting at all. */}
      <div ref={qrRef} style={{ position: 'absolute', left: -9999, top: -9999 }} aria-hidden="true">
        {walletAddr && <QRCodeCanvas value={buildQR(walletAddr)} size={512} level="M" />}
      </div>
    </div>
  )
}
