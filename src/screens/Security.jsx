import { useState } from 'react'
import { useNav } from '../nav'
import Icon from '../components/Icon'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { getSDK, executeChallenge, resetPinChallenge, refreshSession, circleErrorMessage } from '../circle'
import { getDisplayCurrency } from '../data'
import { NET } from '../clientNet'

// SECURITY - Figma node 58:332, rebuilt 2026-09-24 against the 2026-09-23 redesign's gradient+sheet
// shell (was the pre-redesign plain-white `.screen`/`.row-10` layout). Figma now merges the old separate
// "Language & currency" screen (Currency.jsx) into this one card - Network/Email/Wallet address as plain
// lines, then PIN/Language/Default currency as rows with a value chip - so Currency.jsx is deleted and
// its picker logic (and PIN reset logic, unchanged) both live here now. MenuScreen's "Security, language
// & currency" row already pointed at this screen id before this rebuild, so no nav.js change needed.
const CURRENCY_OPTIONS = [
  { code: 'USDC', short: 'USD', label: 'USD – US Dollar', locked: false },
  { code: 'EURC', short: 'EUR', label: 'EUR – Euro', locked: false },
]
const CUR_SHORT = { USDC: 'USD', EURC: 'EUR' }
// Locked to English-only since the whole i18n layer was deleted 2026-08-25 - kept from Currency.jsx as a
// disabled-option popup (never a real switch), not a fresh guess.
const LANGUAGE_OPTIONS = [{ code: 'en', label: 'English', locked: true }]

// Value chip - node 58:362/58:364/58:366: white pill, glow shadow, no border, 42px tall.
const CHIP = { border: 'none', background: 'var(--btn-grad-white)', boxShadow: '0 0 8px rgba(0, 0, 0, 0.5)', borderRadius: 999, height: 'calc(42 * var(--u))', padding: '0 calc(14 * var(--u))', fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 'calc(6 * var(--u))', fontFamily: 'inherit' }
const ROW = { position: 'absolute', left: '9.23%', right: '9.23%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'calc(12 * var(--u))' }
// Row centres - user decision 2026-09-27: EVERY item (Network, Email, Wallet address, PIN, Language,
// Default currency) is its own line on ONE even step, so Network→Email is the same gap as Wallet→PIN.
// First centre 14.34dvh (121px, the middle of grid row 2), step 7.58dvh (64px). About.jsx uses the SAME
// ROW_TOP so the two screens stay in sync - change both or neither.
export const ROW_TOP = i => `${(14.34 + i * 7.58).toFixed(2)}dvh`
// Info rows (Network/Email/Wallet address) use About.jsx's row style (user decision 2026-09-27): bold label
// on the left, value on the right in 17px --color-muted-2 - same look as PIN/Language/Currency's labels.
const LABEL = { fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)', flexShrink: 0 }
const VALUE = { fontSize: 'var(--fs-content-2)', color: 'var(--color-muted-2)', textAlign: 'right', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

function Picker({ title, options, active, onPick, onClose }) {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={e => e.stopPropagation()}>
        <div className="popup-title">{title}</div>
        {options.map(o => (
          <button key={o.code} disabled={o.locked}
            onClick={() => { if (!o.locked) onPick(o.code) }}
            className={`btn ${o.code === active ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: '100%', justifyContent: 'flex-start', paddingLeft: 'calc(18 * var(--u))' }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Security() {
  const { navigate } = useNav()
  const [pinStatus, setPinStatus] = useState('')
  const [pinErr, setPinErr] = useState(false)
  const [currency, setCurrency] = useState(getDisplayCurrency())
  const [curPicker, setCurPicker] = useState(false)
  const [langPicker, setLangPicker] = useState(false)
  function showStatus(msg, isErr = false) { setPinStatus(msg); setPinErr(isErr) }

  async function handleResetPin() {
    // Google users (SSO, no ez_email): Circle blocks PUT /user/pin at the platform layer
    // (403 code 3 even with a fresh token + an existing PIN - verified session 10). Skip the call, save a round trip.
    if (!localStorage.getItem('ez_email')) {
      showStatus('Not available for Google accounts', true)
      setTimeout(() => showStatus(''), 3000)
      return
    }
    showStatus('Preparing...')
    try {
      const { userToken, encryptionKey } = await refreshSession()
      const challengeId = await resetPinChallenge(userToken)
      showStatus('Enter PIN...')
      await executeChallenge(await getSDK(), userToken, encryptionKey, challengeId)
      showStatus('PIN changed!')
      setTimeout(() => showStatus(''), 2000)
    } catch (e) {
      showStatus(circleErrorMessage(e), true)
    }
  }

  function pickCur(code) { setCurrency(code); localStorage.setItem('ez_currency', code); setCurPicker(false) }

  const email = localStorage.getItem('ez_email') || localStorage.getItem('ez_google_email') || '…'
  const walletAddr = localStorage.getItem('ez_wallet_addr') || '…'
  const shortAddr = walletAddr !== '…' ? walletAddr.slice(0, 10) + '...' + walletAddr.slice(-6) : '…'

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <div className="sheet-title">Security & Region</div>

      {/* Card - node 1:265: 340x586 at (25,86), radius 16. Network/Email/Wallet address are plain
          "Label: value" lines (brand-blue value, same as MenuScreen's info card); PIN/Language/Default
          currency are rows with a value chip. */}
      <div style={{ position: 'absolute', left: '6.41%', top: '10.19dvh', width: '87.18%', height: '69.43dvh', background: 'var(--color-card)', borderRadius: 16 }} />

      <div style={{ ...ROW, top: ROW_TOP(0) }}><span style={LABEL}>Network</span><span style={VALUE}>{NET.label}</span></div>
      <div style={{ ...ROW, top: ROW_TOP(1) }}><span style={LABEL}>Email</span><span style={VALUE}>{email}</span></div>
      <div style={{ ...ROW, top: ROW_TOP(2) }}><span style={LABEL}>Wallet address</span><span style={VALUE}>{shortAddr}</span></div>

      <div style={{ ...ROW, top: ROW_TOP(3) }}>
        <span style={LABEL}>PIN</span>
        <button style={{ ...CHIP, color: pinStatus ? (pinErr ? 'var(--color-error)' : 'var(--color-primary)') : 'var(--color-black)' }} disabled={!!pinStatus} onClick={handleResetPin}>
          {pinStatus || 'Change PIN'}
        </button>
      </div>
      <div style={{ ...ROW, top: ROW_TOP(4) }}>
        <span style={LABEL}>Language</span>
        <button style={CHIP} onClick={() => setLangPicker(true)}>
          English<Icon name="down2" size="calc(17 * var(--u))" color="var(--color-brand)" />
        </button>
      </div>
      <div style={{ ...ROW, top: ROW_TOP(5) }}>
        <span style={LABEL}>Default currency</span>
        <button style={CHIP} onClick={() => setCurPicker(true)}>
          {CUR_SHORT[currency] || 'USD'}<Icon name="down2" size="calc(17 * var(--u))" color="var(--color-brand)" />
        </button>
      </div>

      {/* Done - node 58:334/58:337: brand-blue pill, full card width, 48px tall. */}
      <button className="btn btn-primary" onClick={() => navigate('MenuScreen')}
        style={{ position: 'absolute', left: '6.41%', width: '87.18%', top: 'calc(85.665dvh - var(--btn-h) / 2)', height: 'var(--btn-h)', minHeight: 0 }}>
        Done
      </button>

      <ExitBar onClick={() => navigate('MenuScreen')} />

      {curPicker && <Picker title="Select currency" options={CURRENCY_OPTIONS} active={currency} onPick={pickCur} onClose={() => setCurPicker(false)} />}
      {langPicker && <Picker title="Select language" options={LANGUAGE_OPTIONS} active="en" onPick={() => {}} onClose={() => setLangPicker(false)} />}
    </div>
  )
}
