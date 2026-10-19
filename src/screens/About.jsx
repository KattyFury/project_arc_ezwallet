import { useNav } from '../nav'
import Icon from '../components/Icon'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { CONTACT_URL, SUPPORT_EMAIL } from '../legal'
import ScrollBox from '../components/ScrollBox'

const VERSION = '0.1.0'

// ABOUT - rebuilt 2026-10-06, rows on the SAME 64px step as Security (ROW_TOP's step - keep the two screens in sync).
// Terms / Privacy = in-app pages (src/legal.js), live everywhere (owner 2026-10-06: "áp dụng vào main luôn, duyệt sau").
// Owner 2026-10-19 ("loạn vì đủ thứ thông tin"): only the essentials, one list, no group headers - the intro text,
// Network, Wallet, Website, Source code and Circle's two legal links are gone.
const ROWS = [
  { label: 'Version', value: VERSION },
  { label: SUPPORT_EMAIL, link: CONTACT_URL },
  { label: 'Terms of Use', screen: ['Legal', { doc: 'terms' }] },
  { label: 'Privacy Policy', screen: ['Legal', { doc: 'privacy' }] },
]
const ROW = { height: 'calc(64 * var(--u))', flexShrink: 0, display: 'flex', alignItems: 'center' }

export default function About() {
  const { navigate } = useNav()

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <div className="sheet-title">About</div>

      <ScrollBox style={{ position: 'absolute', left: '6.41%', top: '10.19dvh', width: '87.18%', height: '69.43dvh', background: 'var(--color-card)', borderRadius: 16, overflow: 'hidden' }} listStyle={{ padding: 'calc(8 * var(--u)) calc(16 * var(--u))' }}>
          <div className="col" style={{ flexShrink: 0 }}>
              {ROWS.map(({ label, value, link, screen }) => (
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
      </ScrollBox>

      {/* Owner 2026-10-19: Done = 2/3 of the card width, centred (same as History / Security). */}
      <button className="btn btn-primary" onClick={() => navigate('MenuScreen')}
        style={{ position: 'absolute', left: 'calc(6.41% + 87.18% / 6)', width: 'calc(87.18% * 2 / 3)', top: 'calc(85.665dvh - var(--btn-h) / 2)', height: 'var(--btn-h)', minHeight: 0 }}>
        Done
      </button>

      <ExitBar onClick={() => navigate('MenuScreen')} />
    </div>
  )
}
