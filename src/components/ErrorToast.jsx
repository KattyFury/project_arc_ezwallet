import { useState, useEffect } from 'react'
import Icon from './Icon'

// Temporary floating error banner - for screens WITHOUT a NotifArea (e.g. SendAmount) when the
// user is navigated back carrying an error (wrong PIN, send failed...). Without it, all they see
// is "I got kicked back" with no reason. Auto-hides after a few seconds, or tap X.
export default function ErrorToast({ message }) {
  const [visible, setVisible] = useState(!!message)

  useEffect(() => {
    setVisible(!!message)
    if (!message) return
    const timer = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(timer)
  }, [message])

  if (!visible || !message) return null

  return (
    <div style={{
      position: 'fixed', top: 'calc(14 * var(--u))', left: '50%', transform: 'translateX(-50%)',
      width: 'calc(100% - calc(30 * var(--u)))', maxWidth: 'calc(400 * var(--u))', zIndex: 200,
      background: 'var(--color-error-soft)', borderRadius: 16, padding: 'calc(16 * var(--u)) calc(16 * var(--u))',
      display: 'flex', alignItems: 'center', gap: 'calc(8 * var(--u))',
      /* NO shadow (2026-09-10 correction, was an old straight-down drop shadow) - this toast is not
         itself clickable, matching NotifArea's own notification cards, which carry no shadow either. */
    }}>
      <Icon name="warning" size="var(--is-content-1)" color="var(--color-error)" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 'var(--fs-caption)', color: 'var(--color-content)' }}>{message}</span>
      <button onClick={() => setVisible(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0, padding: 'calc(8 * var(--u))' }}>
        <Icon name="x" size="var(--is-caption)" color="var(--color-error)" />
      </button>
    </div>
  )
}
