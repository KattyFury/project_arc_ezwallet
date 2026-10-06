import logoLong from '../design/logo.svg'
import { NET } from './clientNet'

// ══ BRANDED QR IMAGE - shared by EVERY place that shares a QR (user decision 08-13) ══
// Takes a bare QR canvas → returns a new canvas: QR + the words "Only <network>" (NET.label) + the ezwallet logo.
// Used by: the Receive screen (Share) and the ShowQR screen (a created QR / a QR from the library).
//
// ⚠️ DELIBERATELY does not draw the wallet address onto the image (user decision 08-13: "putting the address on the QR looks awful").
// The Receive screen sends the address as TEXT alongside the image; ShowQR sends no address at all (people
// scan the QR to get it, and what matters there is the AMOUNT, not the address).
//
// The network label MUST be on the image: this image leaves the app, and the recipient has nothing else
// telling them which chain it is. See also the network-lock rule in src/qr.js.
// `name` / `amount` (optional, owner 2026-10-06): a QR from the library or Create QR is shared WITH its name (black, above the
// QR) and the amount it asks for (brand blue, under the QR) - the image used to carry only the QR + logo. Receive passes
// neither and keeps the original layout.
export async function brandedQrCanvas(qrCanvas, { name = '', amount = '' } = {}) {
  const W = 620, QR = 420, PAD = 50
  const TOP = name ? 70 : 0, AMT = amount ? 70 : 0
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = 640 + TOP + AMT
  const x = cv.getContext('2d')
  x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, cv.height)
  x.textAlign = 'center'
  if (name) {
    x.fillStyle = '#000000'; x.font = '600 38px sans-serif'
    let t = name
    while (t.length > 1 && x.measureText(t).width > W - 2 * PAD) t = t.slice(0, -2) + '…'
    x.fillText(t, W / 2, PAD + 40)
  }
  x.drawImage(qrCanvas, (W - QR) / 2, PAD + TOP, QR, QR)
  if (amount) { x.fillStyle = '#0B53BF'; x.font = '700 48px sans-serif'; x.fillText(amount, W / 2, PAD + TOP + QR + 62) }

  x.fillStyle = '#0B53BF'; x.font = '600 30px sans-serif'
  x.fillText(`Only ${NET.label}`, W / 2, PAD + TOP + QR + AMT + 58)

  const lw = 168, lh = lw * 71 / 201   // logo.svg aspect ratio (viewBox 201×71), same as the receipt image
  const img = new Image()
  img.src = logoLong
  try { await img.decode() } catch {}
  x.drawImage(img, (W - lw) / 2, cv.height - 30 - lh, lw, lh)
  return cv
}

// Save a canvas image to the PHOTO LIBRARY (iOS: Web Share API → "Save Image" into Photos, not Files).
// Fallback (desktop / unsupported): download the file.
//
// ⚠️ THE `text` ARGUMENT (08-13): including text makes iOS FILTER the apps offered in the share sheet (Messages
// can disappear). The user KNOWS and ACCEPTED that trade-off for the Receive screen: "as long as it shares 2 things,
// not 1" - the wallet address has to travel with the image. Do NOT drop `text` to "fix" the app list.
// The ShowQR screen passes NO text (image only) - also the user's call.
// Phone or tablet (where the share sheet offers "Save Image" into Photos) vs a computer.
export function isMobileDevice() {
  const ua = navigator.userAgent || ''
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean' && navigator.userAgentData.mobile) return true
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)   // iPadOS says "Macintosh"
}

// SAVE an image (the receipt) - owner 2026-10-03: "PC = lưu về máy, mobile = lưu vào kho ảnh". On a computer the share
// path opened the OS share dialog (or nothing) instead of saving, so computers DOWNLOAD the PNG straight away; phones
// keep the share sheet (its "Save Image" puts it in Photos). Sharing a QR still uses saveImageToPhotos below.
export function saveImageFile(canvas, filename) {
  if (isMobileDevice()) return saveImageToPhotos(canvas, filename)
  canvas.toBlob(blob => { if (blob) downloadBlob(blob, filename) }, 'image/png')
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function saveImageToPhotos(canvas, filename, text) {
  canvas.toBlob(async (blob) => {
    if (!blob) return
    const file = new File([blob], filename, { type: 'image/png' })
    // Include the text (wallet address) so the share still carries the address; sharing a FILE → iOS offers "Save Image".
    const payload = text ? { files: [file], text } : { files: [file] }
    if (navigator.canShare && navigator.canShare(payload)) {
      try { await navigator.share(payload); return } catch (e) { if (e?.name === 'AbortError') return }
    }
    downloadBlob(blob, filename)
  }, 'image/png')
}
