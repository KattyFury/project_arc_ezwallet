import { useNav } from '../nav'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { TERMS, PRIVACY, LEGAL_UPDATED } from '../legal'
import ScrollBox from '../components/ScrollBox'

// TERMS OF USE / PRIVACY POLICY (params: doc 'terms' | 'privacy') - opened from About. Text lives in src/legal.js.
// Row map: 1 title · 2-9 ONE grey box, the text scrolling inside (fades top/bottom) · 10 Exit (back to About).
export default function Legal() {
  const { navigate, params } = useNav()
  const doc = params?.doc === 'privacy' ? PRIVACY : TERMS
  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <div className="sheet-title">{doc.title}</div>
      <ScrollBox style={{ position: 'absolute', left: 'var(--m)', top: '10.19dvh', width: 'var(--cw)', height: '69.43dvh', background: 'var(--color-card)', borderRadius: 16, overflow: 'hidden' }} listStyle={{ padding: 'calc(24 * var(--u)) calc(16 * var(--u))', gap: 'calc(16 * var(--u))' }}>
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)', flexShrink: 0 }}>Last updated: {LEGAL_UPDATED}</span>
          {doc.sections.map(([h, paras]) => (
            <section key={h} className="col" style={{ gap: 'calc(8 * var(--u))', flexShrink: 0 }}>
              <span style={{ fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)' }}>{h}</span>
              {paras.map((t, i) => <p key={i} style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-content)', margin: 0 }}>{t}</p>)}
            </section>
          ))}
        
      </ScrollBox>
      <ExitBar onClick={() => navigate('About')} />
    </div>
  )
}
