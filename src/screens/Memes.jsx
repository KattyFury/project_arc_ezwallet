import { useState, useEffect } from 'react'
import { useNav } from '../nav'
import ScreenSheet from '../components/ScreenSheet'
import ExitBar from '../components/ExitBar'
import { GRADIENT } from '../brandBg'
import { getUnverifiedTokens } from '../chain'
import { memeApi, fmtUnits, fmtPrice } from '../meme'
import { Tabs, Card, smallBtn } from './Lending'

// MEMES (Service hub, owner 2026-10-05 - plan on the owner's Desktop §8 + §13). M1 = Argus launch tokens on Arc's
// Uniswap v4. Row map: 1 "Memes" left + menu right · 2 paste a token address (CA) + Open · 3-9 ONE grey box: my memes
// first (white cards, Open), then "Hidden" (tokens that are not supported or cannot be sold - owner: scam tokens other
// people send in) · 10 Exit. Buy/Sell live on MemeToken. LABS only (src/labs.js).
const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a.trim())

export default function Memes() {
  const { navigate } = useNav()
  const [ca, setCa] = useState('')
  const [tokens, setTokens] = useState(null)   // null = loading
  const [showHidden, setShowHidden] = useState(false)
  const [menu, setMenu] = useState(false)
  const [error, setError] = useState('')
  const walletAddress = localStorage.getItem('ez_wallet_addr')

  function load() {
    setError(''); setTokens(null)
    getUnverifiedTokens()
      .then(list => list.length ? memeApi('portfolio', { walletAddress, tokens: list.map(t => t.address) }) : { tokens: [] })
      .then(d => setTokens(d.tokens))
      .catch(e => { setError(e.message); setTokens([]) })
  }
  useEffect(load, [])

  const shown = (tokens || []).filter(t => !t.hidden)
  const hidden = (tokens || []).filter(t => t.hidden)
  const open = (token) => navigate('MemeToken', { token })
  const go = () => { if (isAddr(ca)) open(ca.trim()); else setError('Paste a token contract address (0x… 42 characters).') }

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
              be sold back. Meme prices swing hard - you can lose most of what you put in. Max $20 per buy. No app fee.
            </span>
            <div className="popup-actions">
              <button className="btn btn-secondary" onClick={() => { setMenu(false); load() }}>Refresh</button>
              <button className="btn btn-primary" onClick={() => setMenu(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Row 2: buy by contract address. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '10.19dvh', height: '8.29dvh', display: 'flex', alignItems: 'center', gap: 'calc(12 * var(--u))' }}>
        <input value={ca} onChange={e => { setCa(e.target.value); setError('') }} onKeyDown={e => e.key === 'Enter' && go()}
          placeholder="Paste a token address (CA)" spellCheck={false} autoCapitalize="off" autoCorrect="off"
          className="address-input" style={{ flex: 1, minWidth: 0 }} />
        <button {...smallBtn('btn-primary')} disabled={!ca.trim()} onClick={go}>Open</button>
      </div>

      {/* Rows 3-9: one grey box - my memes, then Hidden. */}
      <div style={{ position: 'absolute', left: '6.41%', right: '6.41%', top: '20.38dvh', height: '69.43dvh', border: 'none', borderRadius: 16, background: 'var(--color-card)', overflow: 'hidden' }}>
      <div className="scroll-hidden scroll-fade" style={{ height: '100%', boxSizing: 'border-box', padding: 'calc(16 * var(--u))', display: 'flex', flexDirection: 'column', gap: 'calc(16 * var(--u))' }}>
        {error && <div className="warning-badge" style={{ background: 'var(--color-error-soft)', flexShrink: 0 }}>{error}</div>}
        {tokens === null && <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)' }}>Checking your tokens…</span>}
        {tokens !== null && shown.length === 0 && (
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)', lineHeight: 1.4 }}>No memes yet. Paste a token address above to buy one.</span>
        )}
        {shown.map(t => (
          <Card key={t.token} title={{ text: `${t.symbol}${t.name && t.name !== t.symbol ? ` · ${t.name}` : ''}` }}
            lines={[
              <span key="b" className="num" style={{ color: 'var(--color-black)', fontWeight: 'var(--fw-semibold)' }}>{fmtUnits(t.held, t.decimals)} {t.symbol}</span>,
              <span key="v">Sells for ≈ <span className="num" style={{ color: 'var(--color-black)' }}>${(t.sellValueUsdc ?? 0).toFixed(2)}</span> · {t.launchpad}</span>,
              `Price ${fmtPrice(t.priceUsd)}`,
            ]}
            action={<button {...smallBtn('btn-primary')} onClick={() => open(t.token)}>Open</button>} />
        ))}
        {hidden.length > 0 && (
          <button onClick={() => setShowHidden(h => !h)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: 'var(--fs-caption)', color: 'var(--color-muted-2)', flexShrink: 0 }}>
            {showHidden ? '▾' : '▸'} Hidden ({hidden.length}) - not supported or cannot be sold
          </button>
        )}
        {showHidden && hidden.map(t => (
          <Card key={t.token} title={{ text: t.symbol || `${t.token.slice(0, 6)}…${t.token.slice(-4)}`, color: 'var(--color-muted)' }}
            lines={[t.reason === 'cannot be sold' ? 'Cannot be sold - likely a scam token. Do not interact with it.' : t.unresolved ? 'Could not be checked right now.' : 'Not supported.']}
            action={null} />
        ))}
      </div>
      </div>

      <ExitBar onClick={() => navigate('ServiceHub')} />
    </div>
  )
}
