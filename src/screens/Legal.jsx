import { useNav } from '../nav'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { TERMS, PRIVACY, LEGAL_UPDATED } from '../legal'

// TERMS OF USE / PRIVACY POLICY (params: doc 'terms' | 'privacy') - opened from About. Text lives in src/legal.js.
// Row map: 1 title · 2-9 ONE grey box, the text scrolling inside (fades top/bottom) · 10 Exit (back to About).
export default function Legal() {
  const { navigate, params } = useNav()
  const doc = params?.doc === 'privacy' ? PRIVACY : TERMS
  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <div className="sheet-title">{doc.title}</div>
      <div style={{ position: 'absolute', left: '6.41%', top: '10.19dvh', width: '87.18%', height: '69.43dvh', background: 'var(--color-card)', borderRadius: 16, overflow: 'hidden' }}>
        <div className="scroll-hidden scroll-fade" style={{ height: '100%', boxSizing: 'border-box', padding: 'calc(20 * var(--u)) calc(16 * var(--u))', display: 'flex', flexDirection: 'column', gap: 'calc(16 * var(--u))' }}>
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)', flexShrink: 0 }}>Last updated: {LEGAL_UPDATED}</span>
          {doc.sections.map(([h, paras]) => (
            <section key={h} className="col" style={{ gap: 'calc(6 * var(--u))', flexShrink: 0 }}>
              <span style={{ fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)' }}>{h}</span>
              {paras.map((t, i) => <p key={i} style={{ fontSize: 'var(--fs-caption)', lineHeight: 1.45, color: 'var(--color-content)', margin: 0 }}>{t}</p>)}
            </section>
          ))}
        </div>
      </div>
      <ExitBar onClick={() => navigate('About')} />
    </div>
  )
}
