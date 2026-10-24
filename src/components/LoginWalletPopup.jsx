import { useState } from 'react'
import { useNav } from '../nav'

// Chain ID of Arc mainnet (decimal). The wallet must be on this chain to log in.
const ARC_CHAIN_ID = 5042
const ARC_CHAIN_HEX = '0x13B2'   // 5042 in hex

// A subset of well-known wallet deeplink / download URLs shown when window.ethereum is absent.
const WALLET_OPTIONS = [
  { name: 'MetaMask', url: 'https://metamask.io/download/', icon: '🦊' },
  { name: 'Rainbow',  url: 'https://rainbow.me/download',   icon: '🌈' },
  { name: 'Coinbase Wallet', url: 'https://www.coinbase.com/wallet/downloads', icon: '🔵' },
]

// Ask the injected provider to switch to (or add) Arc mainnet.
async function switchToArc() {
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: ARC_CHAIN_HEX }],
  }).catch(async (err) => {
    // 4902 = chain not added yet → add it first
    if (err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: ARC_CHAIN_HEX,
          chainName: 'Arc',
          nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
          rpcUrls: ['https://rpc.mainnet.arc.io'],
          blockExplorerUrls: ['https://explorer.arc.io'],
        }],
      })
    } else {
      throw err
    }
  })
}

// ── LOG IN WITH WALLET ──
// Opens as a popup over the Login screen (same pattern as LoginEmailPopup). The user taps their injected
// browser wallet, we request accounts, switch to Arc, then store the address and navigate to HomeSend.
// No Circle UCW is created or used here: this is a pure read-your-own-key flow (read-only for now;
// sending will sign via the provider the same way other Web3 apps do).
export default function LoginWalletPopup({ onClose }) {
  const { navigate } = useNav()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const hasProvider = typeof window !== 'undefined' && !!window.ethereum

  async function handleConnect() {
    if (!window.ethereum) return
    setLoading(true)
    setError('')
    try {
      // 1. Request accounts (triggers the wallet's connect prompt)
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (!accounts || accounts.length === 0) throw new Error('No account returned by wallet.')
      const address = accounts[0].toLowerCase()

      // 2. Ensure we are on Arc mainnet
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' })
      if (parseInt(chainIdHex, 16) !== ARC_CHAIN_ID) {
        await switchToArc()
      }

      // 3. Persist the address so the rest of the app can read it (same keys as email login)
      localStorage.setItem('ez_wallet_addr', address)
      localStorage.setItem('ez_login_method', 'web3wallet')
      // Mark session as unlocked so PinGate is skipped (Web3 wallets sign at transaction time)
      sessionStorage.setItem('ez_pin_ok', '1')

      navigate('HomeSend')
    } catch (e) {
      // User rejected the request (code 4001) or another provider error
      if (e.code === 4001) {
        setError('Connection rejected. Please approve the request in your wallet.')
      } else {
        setError(e.message || 'Could not connect wallet. Please try again.')
      }
      setLoading(false)
    }
  }

  // The popup sits above the blurred Login content with the same card style used by LoginEmailPopup.
  // --m / --u / --cw / --btn-h / --shadow-y2 are all declared globally in index.css.
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
        aria-hidden="true"
      />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 440,
        background: 'var(--color-white)',
        borderRadius: '24px 24px 0 0',
        padding: 'calc(24 * var(--u)) var(--m) calc(40 * var(--u))',
        display: 'flex', flexDirection: 'column', gap: 'calc(16 * var(--u))',
      }}>
        {/* Drag handle */}
        <div style={{
          width: 'calc(40 * var(--u))', height: 4, borderRadius: 2,
          background: 'var(--color-line)', margin: '0 auto calc(8 * var(--u))',
        }} />

        <h2 style={{
          margin: 0,
          fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)',
          color: 'var(--color-black)', textAlign: 'center',
        }}>
          Log in with Wallet
        </h2>

        <p style={{
          margin: 0, fontSize: 'var(--fs-caption)',
          color: 'var(--color-muted)', textAlign: 'center',
        }}>
          Connect your browser wallet (MetaMask, Rainbow, etc.) to Arc mainnet.
        </p>

        {/* Error */}
        {error && (
          <p style={{
            margin: 0, padding: 'calc(16 * var(--u))',
            background: 'var(--color-error-soft)', borderRadius: 12,
            fontSize: 'var(--fs-caption)', color: 'var(--color-error)',
          }}>
            {error}
          </p>
        )}

        {hasProvider ? (
          // Wallet detected: show the connect button
          <button
            onClick={handleConnect}
            disabled={loading}
            style={{
              height: 'var(--btn-h)', border: 'none', borderRadius: 16,
              background: loading ? 'var(--color-line)' : 'var(--color-brand)',
              color: loading ? 'var(--color-muted)' : 'var(--color-white)',
              fontSize: 'var(--fs-content-1)', fontWeight: 'var(--fw-semibold)',
              cursor: loading ? 'default' : 'pointer',
              boxShadow: loading ? 'none' : 'var(--shadow-y2)',
              WebkitTapHighlightColor: 'transparent',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Connecting…' : 'Connect Wallet'}
          </button>
        ) : (
          // No injected provider: show download links
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(8 * var(--u))' }}>
            <p style={{
              margin: 0, fontSize: 'var(--fs-caption)',
              color: 'var(--color-muted-2)', textAlign: 'center',
            }}>
              No wallet detected. Install one to continue:
            </p>
            {WALLET_OPTIONS.map(w => (
              <a
                key={w.name}
                href={w.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 'calc(16 * var(--u))',
                  height: 'var(--btn-h)', padding: '0 calc(16 * var(--u))',
                  background: 'var(--color-card)', borderRadius: 16, textDecoration: 'none',
                  fontSize: 'var(--fs-content-2)', fontWeight: 'var(--fw-semibold)',
                  color: 'var(--color-black)',
                }}
              >
                <span style={{ fontSize: 'var(--fs-content-1)' }}>{w.icon}</span>
                {w.name}
                <span style={{ marginLeft: 'auto', color: 'var(--color-brand)', fontSize: 'var(--fs-caption)' }}>Install →</span>
              </a>
            ))}
          </div>
        )}

        {/* Cancel */}
        <button
          onClick={onClose}
          style={{
            height: 'calc(44 * var(--u))', border: 'none', borderRadius: 16,
            background: 'transparent',
            fontSize: 'var(--fs-caption)', color: 'var(--color-muted)',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
