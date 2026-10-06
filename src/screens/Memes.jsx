import { useState, useEffect } from 'react'
import { useNav } from '../nav'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { getUnverifiedTokens } from '../chain'
import { memeApi, fmtUnits, fmtPrice, fmtUsdShort } from '../meme'
import { Tabs, smallBtn } from './Lending'

// MEMES (Service hub, owner 2026-10-06 layout). M1 = Argus launch tokens on Arc's Uniswap v4 (plan §8 + §13).
// Row map: 1 "Memes" + menu · 2 paste a token address (CA) + [Paste] · 3-4 MY MEMES (scrolls, fades; Hidden at its end)
// · 5-8 TOP ARGUS MEMES by 24h volume (GeckoTerminal via /api/meme 'top', 5-min cache) · 9 the risk line · 10 Exit.
// Any row → MemeToken (Buy | Sell, with the honeypot check). LABS only (src/labs.js).
const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || '').trim())
const BOX = { position: 'absolute', left: '6.41%', right: '6.41%', border: 'none', borderRadius: 16, background: 'var(--color-card)', overflow: 'hidden' }
const LIST = { height: '100%', boxSizing: 'border-box', padding: 'calc(12 * var(--u))', display: 'flex', flexDirection: 'column', gap: 'calc(8 * var(--u))' }
const muted = { fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }

// One compact white row: name on the left, two short lines; a value block on the right. Tap = open the token.
function Row({ title, sub, right, rightSub, rightColor, onClick, faded }) {
  return (
    <button onClick={onClick} disabled={!onClick} style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'calc(8 * var(--u))', width: '100%', border: 'none', borderRadius: 16,
      background: 'var(--color-white)', padding: 'calc(10 * var(--u)) calc(12 * var(--u))', fontFamily: 'inherit', textAlign: 'left', cursor: onClick ? 'pointer' : 'default',
    }}>
      <span className="col" style={{ flex: 1, minWidth: 0, gap: 'calc(2 * var(--u))' }}>
        <span style={{ fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)', color: faded ? 'var(--color-muted)' : 'var(--color-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{ ...muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>
      </span>
      {right != null && (
        <span className="col" style={{ alignItems: 'flex-end', flexShrink: 0, gap: 'calc(2 * var(--u))' }}>
          <span className="num" style={{ fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-black)' }}>{right}</span>
          <span className="num" style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: rightColor || 'var(--color-muted-2)' }}>{rightSub}</span>
        </span>
      )}
    </button>
  )
}

export default function Memes() {
  const { navigate } = useNav()
  const [ca, setCa] = useState('')
  const [mine, setMine] = useState(null)      // null = loading
  const [top, setTop] = useState(null)        // null = loading
  const [showHidden, setShowHidden] = useState(false)
  const [menu, setMenu] = useState(false)
  const [error, setError] = useState('')
  const [topError, setTopError] = useState('')
  const walletAddress = localStorage.getItem('ez_wallet_addr')

  function load() {
    setError(''); setTopError(''); setMine(null); setTop(null)
    getUnverifiedTokens()
      .then(list => list.length ? memeApi('portfolio', { walletAddress, tokens: list.map(t => t.address) }) : { tokens: [] })
      .then(d => setMine(d.tokens))
      .catch(e => { setError(e.message); setMine([]) })
    memeApi('top').then(d => setTop(d)).catch(e => { setTopError(e.message); setTop({ tokens: [] }) })
  }
  useEffect(load, [])

  const open = (token) => navigate('MemeToken', { token })
  const go = (value) => { if (isAddr(value)) open(value.trim()); else setError('That is not a token address (0x… 42 characters).') }
  // [Paste] = read the clipboard; a valid address opens the token straight away (the field also takes typing).
  async function paste() {
    try { const t = (await navigator.clipboard.readText()).trim(); setCa(t); setError(''); if (t) go(t) }
    catch { setError('Could not read the clipboard - long-press the field and paste.') }
  }

  const shown = (mine || []).filter(t => !t.hidden)
  const hidden = (mine || []).filter(t => t.hidden)

  return (
    <div className="screen" style={{ background: GRADIENT }}>
      <ScreenSheet />
      <Tabs tabs={[['memes', 'Memes']]} tab="memes" setTab={() => {}} onMenu={() => setMenu(true)} />

      {menu && (
        <div className="popup-overlay" onClick={() => setMenu(false)}>
          <div className="popup-card" onClick={e => e.stopPropagation()}>
            <div className="popup-title">How Memes works</div>
            <span style={{ fontSize: 'var(--fs-caption)', lineHeight: 1.4 }}>
              Buy and sell tokens launched on Argus (Arc). Before every buy the app checks on the network that the token can
              be sold back. Max $20 per buy. No app fee. The top list is ranked by 24h trading volume from GeckoTerminal - a high
              volume is not a recommendation.
            </span>
            <div className="popup-actions">
              <button className="btn btn-secondary" onClick={() => { setMenu(false); load() }}>Refresh</button>
              <button className="btn btn-primary" onClick={() => setMenu(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Row 2: paste a contract address. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '10.19dvh', height: '8.29dvh', display: 'flex', alignItems: 'center', gap: 'calc(12 * var(--u))' }}>
        <input value={ca} onChange={e => { setCa(e.target.value); setError('') }} onKeyDown={e => e.key === 'Enter' && go(ca)}
          placeholder="Token address (CA)" spellCheck={false} autoCapitalize="off" autoCorrect="off"
          className="address-input" style={{ flex: 1, minWidth: 0 }} />
        <button {...smallBtn('btn-primary')} onClick={paste}>Paste</button>
      </div>

      {/* Rows 3-4: my memes (+ Hidden at the end). */}
      <div style={{ ...BOX, top: '20.38dvh', height: '18.48dvh' }}>
        <div className="scroll-hidden scroll-fade" style={LIST}>
          <span style={{ ...muted, fontWeight: 'var(--fw-semibold)', flexShrink: 0 }}>My memes</span>
          {error && <span style={{ ...muted, color: 'var(--color-error)', flexShrink: 0 }}>{error}</span>}
          {mine === null && <span style={muted}>Checking your tokens…</span>}
          {mine !== null && shown.length === 0 && <span style={muted}>None yet - paste an address or pick one below.</span>}
          {shown.map(t => (
            <Row key={t.token} title={t.symbol} sub={`${fmtUnits(t.held, t.decimals)} ${t.symbol} · ${t.launchpad}`}
              right={`$${(t.sellValueUsdc ?? 0).toFixed(2)}`} rightSub="if sold now" onClick={() => open(t.token)} />
          ))}
          {hidden.length > 0 && (
            <button onClick={() => setShowHidden(h => !h)} style={{ ...muted, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', flexShrink: 0 }}>
              {showHidden ? '▾' : '▸'} Hidden ({hidden.length}) - not supported or cannot be sold
            </button>
          )}
          {showHidden && hidden.map(t => (
            <Row key={t.token} faded title={t.symbol || `${t.token.slice(0, 6)}…${t.token.slice(-4)}`}
              sub={t.reason === 'cannot be sold' ? 'Cannot be sold - likely a scam. Do not touch it.' : t.unresolved ? 'Could not be checked right now.' : 'Not supported.'} />
          ))}
        </div>
      </div>

      {/* Rows 5-8: top Argus memes by 24h volume. */}
      <div style={{ ...BOX, top: '40.76dvh', height: '38.86dvh' }}>
        <div className="scroll-hidden scroll-fade" style={LIST}>
          <span style={{ ...muted, fontWeight: 'var(--fw-semibold)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', gap: 'calc(8 * var(--u))' }}>
            <span>Top on Argus · 24h volume</span><span style={{ fontWeight: 'var(--fw-normal)' }}>GeckoTerminal</span>
          </span>
          {topError && <span style={{ ...muted, color: 'var(--color-error)' }}>{topError}</span>}
          {top === null && <span style={muted}>Loading…</span>}
          {(top?.tokens || []).map((t, i) => {
            const ch = t.change24h
            return (
              <Row key={t.token} title={`${i + 1}. ${t.symbol}`} sub={`Vol ${fmtUsdShort(t.volume24h)} · Liq ${fmtUsdShort(t.liquidityUsd)}`}
                right={fmtPrice(t.priceUsd)} rightSub={typeof ch === 'number' ? `${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%` : '…'}
                rightColor={typeof ch === 'number' ? (ch >= 0 ? 'var(--color-primary)' : 'var(--color-error)') : undefined}
                onClick={() => open(t.token)} />
            )
          })}
        </div>
      </div>

      {/* Row 9: the risk line (owner 2026-10-06: plain words, what a member must know). */}
      <div className="warning-badge" style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '81.52dvh', height: '8.29dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 calc(12 * var(--u))', fontSize: 'var(--fs-small)', lineHeight: 1.3 }}>
        Memes can drop to zero in minutes. Copycat tokens use real names - check the address. Only use money you can lose.
      </div>

      <ExitBar onClick={() => navigate('ServiceHub')} />
    </div>
  )
}
