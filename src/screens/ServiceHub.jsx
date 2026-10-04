import NavBar from '../components/NavBar'
import ScreenSheet from '../components/ScreenSheet'
import Icon from '../components/Icon'
import { useNav } from '../nav'
import { GRADIENT } from '../brandBg'
import { NET } from '../clientNet'

// SERVICE HUB - Figma node 58:119 ("Service"), rebuilt 2026-09-23. Same gradient/sheet/barless-NavBar
// frame as Send/Receive; this screen shows a TITLE instead of the balance (no BalanceHeader here -
// Figma draws none).
//
// ⚠️ ONE CARD ONLY. LuckyPot was removed 2026-09-23 - see the note this file already carried, still
// true: the user settled it directly, twice ("Exchange giờ sẽ là app duy nhất..." then "Figma là nguồn
// sự thật, Figma k có luckypot").
// Swap OFF on this network (mainnet v1 = send/receive only) → the card KEEPS ITS PLACE, dimmed,
// "Coming soon", not tappable (mainnet v1 plan item 1 (2026-09-27, deleted doc - git history) - the button layout the owner approved stays as it is).
// `screen: null` is what the existing `soon` state below keys on. v1.1 only has to flip NET.swap.
const SERVICES = [
  NET.swap
    ? { id: 'swap', icon: 'exchange', label: 'Exchange', desc: `Swap between ${Object.keys(NET.tokens).join(', ').replace(/, ([^,]+)$/, ' & $1')}`, screen: 'Swap' }
    : { id: 'swap', icon: 'exchange', label: 'Exchange', desc: 'Coming soon', screen: null },
]

export default function ServiceHub() {
  const { navigate } = useNav()

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet active="ServiceHub" />

      {/* TITLE - node 58:143. `.sheet-title` (index.css) is the shared 24px-tier title class for every
          gradient+ScreenSheet screen (promoted once Exchange/Security/About also needed it). */}
      <div className="sheet-title">Service hub</div>

      {SERVICES.map(({ id, icon, label, desc, screen }) => {
        const soon = !screen
        return (
          // Card - node 58:153: 340x156 at (25,86), radius 16, glow shadow. Figma draws a flat 75.906px
          // BLACK SQUARE for the icon (node 58:159) - a placeholder, per the rule the user set on the Add
          // screen ("tìm cái tương tự rồi add vào"). Unlike the token squares on Send/Receive (no real
          // brand mark exists for USDC/EURC/cirBTC yet), Exchange already HAS an established icon in this
          // app (Icon name="exchange" - the ArrowUpDown pair, used for this exact feature before the
          // redesign), so that real icon is used here rather than a literal square.
          <button key={id} disabled={soon} onClick={soon ? undefined : () => navigate(screen)}
            style={{
              position: 'absolute', left: '6.41%', top: '10.19dvh', width: '87.18%', height: '18.48dvh',
              border: 'none', borderRadius: 16, background: 'var(--color-white)', boxShadow: '0 0 8px rgba(0, 0, 0, 0.48)',
              display: 'flex', alignItems: 'center', padding: '0 calc(16 * var(--u)) 0 calc(8.5 * var(--u))', gap: 'calc(9 * var(--u))', minWidth: 0,
              fontFamily: 'inherit', textAlign: 'left', opacity: soon ? 0.4 : 1, cursor: soon ? 'not-allowed' : 'pointer',
            }}>
            <Icon name={icon} size="min(19.46vw, calc(var(--screen-max) * 0.1946))" color="var(--color-brand)" style={{ flexShrink: 0 }} />
            <span className="col" style={{ minWidth: 0, gap: 'calc(2 * var(--u))' }}>
              <span style={{ fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)', lineHeight: 1.2 }}>{label}:</span>
              <span style={{ fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-normal)', color: 'var(--color-black)', lineHeight: 1.3 }}>{desc}</span>
            </span>
          </button>
        )
      })}

      <NavBar active="ServiceHub" />
    </div>
  )
}
