import { Component } from 'react'

// Catches EVERY render error (a throw inside a component) → instead of a white screen ("the app
// blew up"), show a recovery screen with a Reload button. An error boundary MUST be a class
// component (React still has no hook version).
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info) }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ height: '100dvh', maxWidth: 430, margin: '0 auto', background: 'var(--color-white)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'calc(16 * var(--u))', padding: 'calc(24 * var(--u))', textAlign: 'center' }}>
        <div className="screen-title" style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-medium)' }}>Something went wrong</div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted)', maxWidth: 'calc(300 * var(--u))' }}>
          The app hit an unexpected error. Your wallet and funds are safe. Please reload.
        </div>
        {/* A button standing alone = --btn-lone (296), like .row10-single (owner 2026-10-20). */}
        <button className="btn btn-primary" style={{ width: 'var(--btn-lone)' }} onClick={() => window.location.reload()}>Reload</button>
      </div>
    )
  }
}
