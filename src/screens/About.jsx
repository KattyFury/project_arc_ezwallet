import { useNav } from '../nav'
import Icon from '../components/Icon'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { NET } from '../clientNet'
import { CONTACT_URL, SUPPORT_EMAIL } from '../legal'

const VERSION = '0.1.0'

// ABOUT - rebuilt 2026-10-06 (owner: "sơ sài và tùy tiện", Terms of use and Privacy policy both opened Circle's privacy
// page). Three groups, each a short header + rows on the SAME 64px step as Security (ROW_TOP's step - keep the two
// screens in sync): APP (facts) · LINKS · LEGAL. The list scrolls inside the grey card and fades at both edges.
// Terms / Privacy = in-app pages (src/legal.js), live everywhere (owner 2026-10-06: "áp dụng vào main luôn, duyệt sau"); Circle's own User Agreement and
// Privacy Policy are linked as Circle's (both URLs checked 2026-10-06, HTTP 200).
const GROUPS = [
  ['App', [
    { label: 'Version', value: VERSION },
    { label: 'Network', value: NET.label },
    { label: 'Wallet', value: 'Circle · non-custodial' },
  ]],
  ['Links', [
    { label: 'Website', link: 'https://ezwallet.cash' },
    { label: 'Source code (MIT)', link: 'https://github.com/KattyFury/project_arc_ezwallet' },
    { label: SUPPORT_EMAIL, link: CONTACT_URL },
  ]],
  ['Legal', [
    { label: 'Terms of Use', screen: ['Legal', { doc: 'terms' }] },
    { label: 'Privacy Policy', screen: ['Legal', { doc: 'privacy' }] },
    { label: 'Circle User Agreement', link: 'https://www.circle.com/legal/user-agreement' },
    { label: 'Circle Privacy Policy', link: 'https://www.circle.com/en/legal/privacy-policy' },
  ]],
]
const ROW = { height: 'calc(64 * var(--u))', flexShrink: 0, display: 'flex', alignItems: 'center' }

export default function About() {
  const { navigate } = useNav()

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <div className="sheet-title">About</div>

      <div style={{ position: 'absolute', left: '6.41%', top: '10.19dvh', width: '87.18%', height: '69.43dvh', background: 'var(--color-card)', borderRadius: 16, overflow: 'hidden' }}>
        <div className="scroll-hidden scroll-fade" style={{ height: '100%', boxSizing: 'border-box', padding: 'calc(8 * var(--u)) calc(16 * var(--u))', display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontSize: 'var(--fs-caption)', lineHeight: 1.45, color: 'var(--color-muted-2)', margin: 'calc(8 * var(--u)) 0', flexShrink: 0 }}>
            A free, open-source wallet for USDC and EURC on Arc. Your wallet is secured by Circle - only you can approve a
            transaction, with your PIN. No app fees, no ads.
          </p>
          {GROUPS.map(([title, rows]) => (
            <div key={title} className="col" style={{ flexShrink: 0 }}>
              <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-muted-2)', marginTop: 'calc(8 * var(--u))' }}>{title.toUpperCase()}</span>
              {rows.map(({ label, value, link, screen }) => (
                value !== undefined ? (
                  <div key={label} style={{ ...ROW, justifyContent: 'space-between', gap: 'calc(12 * var(--u))' }}>
                    <span style={{ fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 'var(--fs-content-2)', color: 'var(--color-muted-2)', textAlign: 'right' }}>{value}</span>
                  </div>
                ) : (
                  <button key={label} onClick={() => (screen ? navigate(...screen) : link.startsWith('mailto:') ? (window.location.href = link) : window.open(link, '_blank', 'noopener'))}
                    style={{ ...ROW, gap: 'calc(10 * var(--u))', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, width: '100%', textAlign: 'left' }}>
                    <Icon name="right2" size="calc(17 * var(--u))" color="var(--color-brand)" />
                    <span style={{ fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)' }}>{label}</span>
                  </button>
                )
              ))}
            </div>
          ))}
        </div>
      </div>

      <button className="btn btn-primary" onClick={() => navigate('MenuScreen')}
        style={{ position: 'absolute', left: '6.41%', width: '87.18%', top: 'calc(85.665dvh - var(--btn-h) / 2)', height: 'var(--btn-h)', minHeight: 0 }}>
        Done
      </button>

      <ExitBar onClick={() => navigate('MenuScreen')} />
    </div>
  )
}
