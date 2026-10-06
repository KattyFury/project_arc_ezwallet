import { useRef, useEffect } from 'react'
import { useNav } from '../nav'
import { QRCodeCanvas } from 'qrcode.react'
import Icon from '../components/Icon'
import { saveImageToPhotos, brandedQrCanvas } from '../saveImage'
import { loadSavedQRs, saveSavedQRs } from '../store'
import { buildQR, qrAmountLabel } from '../qr'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { NET } from '../clientNet'

export default function ShowQR() {
  const { navigate, params } = useNav()
  const { amount, currency = 'USD', name = '', saveToLibrary, fromStorage, back = 'HomeReceive' } = params
  const walletAddr = localStorage.getItem('ez_wallet_addr') || ''
  // Arc chain lock - see src/qr.js. Do NOT hand-build `ezwallet:...` strings here any more.
  const qrValue = buildQR(walletAddr, { amount, currency })
  // ONE STRING, ONE STYLE, in the QR's OWN unit: "$2" for USD, "2 USDC" / "2 EURC" otherwise (owner 2026-10-06 - fmtMoney
  // turned USDC into "$").
  const amountText = qrAmountLabel(amount, currency)
  const wrapRef = useRef(null)

  // Only saved to the library when created FROM the library (saveToLibrary) - with a NAME. A QR created on the
  // Receive screen is only shown/shared, NOT saved (user decision: do not stuff every QR into the library, it becomes a chore to clean).
  useEffect(() => {
    if (!saveToLibrary) return
    const list = loadSavedQRs()
    if (!list.some(q => q.amount === amount && (q.currency || 'USD') === currency && (q.name || '') === name)) {
      list.push({ id: Date.now(), amount, currency, name, createdAt: new Date().toISOString() })
      saveSavedQRs(list)
    }
  }, [])

  // "Share": Web Share API → iOS/Android "Save image to Photos" + sending through social apps.
  // IMAGE ONLY, no address text attached (user decision 08-13) - unlike the Receive screen. Here what matters is the
  // AMOUNT in the QR, and scanning it yields the address anyway; attaching the address is both redundant and makes iOS
  // filter the share targets. The image still goes through brandedQrCanvas for the logo + the "Only Arc" label, like Receive.
  async function shareQR() {
    const canvas = wrapRef.current?.querySelector('canvas')
    if (!canvas) return
    saveImageToPhotos(await brandedQrCanvas(canvas, { name, amount: amountText }), `ezwallet-qr-${amount}.png`)
  }

  // Title, RE-VERIFIED 2026-09-24 against nodes 58:588/58:632: a newly created QR reads "QR created"
  // (was "Created receive QR" - the fresh redesign frame shortened it), a saved QR's title is the NAME
  // ITSELF, no "QR:" prefix at all (node 58:635 literally reads "QR: Arabica" in the LAYER name but its
  // own title TEXT is just "Arabica").
  const title = fromStorage ? (name || 'Item') : 'QR created'

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <div className="sheet-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 calc(8 * var(--u))' }}>
        {title}
      </div>

      {/* QR - node 58:541/58:640: fixed 258x258, top 11.81dvh, centred horizontally. A canvas is used so
          Share can export a PNG; rendered at size 512 then constrained in width for sharpness. */}
      <div ref={wrapRef} style={{ position: 'absolute', left: '50%', top: '11.81dvh', transform: 'translateX(-50%)', width: 'calc(258 * var(--u))', height: 'calc(258 * var(--u))' }}>
        <QRCodeCanvas value={qrValue} size={512} level="M" style={{ width: 'calc(258 * var(--u))', height: 'calc(258 * var(--u))' }} />
      </div>

      {/* Caption THEN amount, node 1:136/1:135 (RE-VERIFIED 2026-09-24, order swapped from the previous
          pass, ONE line only - "Have the sender scan this code" is gone, Figma draws just the network
          line): caption top-anchored 43.32dvh, amount centred 50dvh, 48px semibold brand blue. */}
      <div style={{ position: 'absolute', left: '50%', top: '43.32dvh', transform: 'translateX(-50%)', width: 'calc(340 * var(--u))', fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-semibold)', textAlign: 'center', color: 'var(--color-error)' }}>
        Current Available Network: {NET.label}
      </div>
      <span className="num" style={{ position: 'absolute', left: '50%', top: '50dvh', transform: 'translate(-50%, -50%)', fontSize: 'var(--fs-amount-2)', fontWeight: 'var(--fw-semibold)', lineHeight: 1, color: 'var(--color-brand)', whiteSpace: 'nowrap' }}>{amountText}</span>

      {/* Share/Done - node 58:599/58:598: white "Share" (left, was "Back" pre-2026-09-24 - Figma dropped
          the Back role from this row) + blue "Done" (right). Since the row lost its own Back, the QR
          library's "return to where I came from" need is covered by Exit below instead. */}
      <div className="row10-dual">
        <button className="btn btn-secondary" onClick={shareQR} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'calc(8 * var(--u))' }}>
          <Icon name="share" size="var(--ib-content-1)" />
          Share
        </button>
        {/* Done = navigate(back), not a hardcoded HomeReceive (user decision 2026-09-24: no separate Exit -
            "Done cũng là tắt, Exit cũng là tắt" - Done alone now covers both "finished" and "return to
            where I came from", library vs Receive alike). */}
        <button className="btn btn-primary" onClick={() => navigate(back)}>Done</button>
      </div>

      {/* Row 10 is the gradient strip → it carries Exit, like every other sheet screen (owner rule 2026-09-29:
          "hàng 10 màu xanh gradient nghĩa là nó phải có nút Exit"; the 09-24 "Done is enough" call left the
          strip empty). Exit and Done go to the same place. */}
      <ExitBar onClick={() => navigate(back)} />
    </div>
  )
}
