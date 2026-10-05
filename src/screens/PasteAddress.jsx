import { useState } from 'react'
import { useNav } from '../nav'
import { isOwnAddress } from '../data'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { isValidAddress } from '../money'

// Format + EIP-55 checksum (MAINNET-AUDIT H6) - see src/money.js.
function isValid(addr) { return isValidAddress(addr) }

export default function PasteAddress() {
  const { navigate } = useNav()
  const [address, setAddress] = useState('')
  const [dirty, setDirty] = useState(false)

  const trimmed = address.trim()
  // BLOCK SENDING TO YOURSELF (user decision 07-31). A well-formed address that is the user's own wallet →
  // do NOT let it through: it only burns fees, the balance does not change, and history gains a confusing row.
  const self = isOwnAddress(trimmed)
  const valid = isValid(trimmed) && !self
  const showError = dirty && address && !valid

  // The "Paste" button: field ALREADY holds a valid address → go straight on, do NOT touch the clipboard
  // (user decision 07-23: it used to always readText → iOS popped the OS-level "Paste|Speak" confirmation
  // even when pointless - that popup is iOS 16+ clipboard security, the web CANNOT turn it off, it can only
  // be avoided by not reading when there is no need). Empty field → then read the clipboard (one OS popup, fine).
  const goNext = a => { if (isValid(a) && !isOwnAddress(a)) { navigate('SendAmount', { address: a, name: null, back: 'PasteAddress' }); return true } return false }

  async function handleDan() {
    let a = trimmed
    if (goNext(a)) return
    if (isOwnAddress(a)) { setDirty(true); return }   // own wallet → stop, do NOT overwrite from the clipboard
    try {
      const txt = await navigator.clipboard.readText()
      if (txt && txt.trim()) { a = txt.trim(); setAddress(a); setDirty(true) }
    } catch {}
    if (!goNext(a)) setDirty(true)
  }

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <div className="sheet-title">Paste address to send</div>

      {/* Input - node 58:286/58:287: card grey (#D2DCE6), centre 24.4dvh, height 40, radius 8. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '24.4dvh', transform: 'translateY(-50%)' }}>
        <input
          className={`address-input${showError ? ' error' : ''}`}
          placeholder="0x..."
          value={address}
          onChange={e => { setAddress(e.target.value); setDirty(true) }}
          style={{ width: '100%', height: 'var(--input-h)', fontSize: 'var(--fs-content-1)', borderRadius: 16, background: 'var(--color-card)' }}
        />
        {showError && (
          <span style={{ display: 'block', marginTop: 'calc(8 * var(--u))', fontSize: 'var(--fs-caption)', color: 'var(--color-error)' }}>
            {self ? "That's your own wallet – you can't send to yourself" : 'Invalid address – must start with 0x, 42 chars'}
          </span>
        )}
      </div>

      {/* Back/Paste - node 58:289/58:262: both 166px, glow shadow. Centre 85.66dvh (723/844 - the rect's
          own top is 699/82.82dvh, but this row uses translateY(-50%) so it needs the CENTRE, not the top
          edge - fixed 2026-09-24, an earlier pass here used 82.82dvh as if it were the centre, landing the
          row visibly higher than every other screen's button row). */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '85.66dvh', transform: 'translateY(-50%)', display: 'flex', gap: 'calc(8 * var(--u))' }}>
        <button className="btn btn-secondary" style={{ flex: 1, boxShadow: '0 4px 8px rgba(0, 0, 0, 0.48)' }} onClick={() => navigate('HomeSend')}>Back</button>
        {/* Field holds a valid EVM address → label flips "Paste" → "Confirm" (user decision 07-23: tapping goes
            straight on without reading the clipboard, so a "Paste" label would be confusing). handleDan covers both. */}
        <button className="btn btn-primary" style={{ flex: 1, boxShadow: '0 4px 8px rgba(0, 0, 0, 0.48)' }} onClick={handleDan}>{valid ? 'Confirm' : 'Paste'}</button>
      </div>

      <ExitBar onClick={() => navigate('HomeSend')} />
    </div>
  )
}
