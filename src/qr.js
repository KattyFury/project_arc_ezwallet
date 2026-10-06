// ══ THE EZWALLET QR FORMAT - SINGLE SOURCE OF TRUTH ══
// Every place that DRAWS a QR (HomeReceive · ShowQR · SavedQRList) and the place that READS one (QRScanner)
// goes through this file. Do NOT hand-build QR strings in a screen: it used to live in 3 places, and fixing one left the others wrong.
//
// FORMAT = EIP-681 `ethereum:` URIs since 2026-10-03 (owner: "sửa QR thành chuẩn EVM" - MetaMask could not scan
// the old private `ezwallet:` scheme). The format and the reader live in src/qrFormat.js (pure, unit-tested);
// this file binds them to this build's network.
//
// HISTORY: from 08-13 the QR used a private `ezwallet:0x…@<chainId>` scheme ON PURPOSE so other wallets could NOT
// scan it (an EVM address is the same on every chain; money sent on the wrong chain is gone, and some wallets ignore
// EIP-681's @chainId). The owner reversed that on 2026-10-03; the "send on Arc only" warning is in the app's
// notifications. Old `ezwallet:` QRs are still READ (src/qrFormat.js).
import { NET } from './clientNet'
import { isValidAddress, toAmountString } from './money'
import { buildQRFor, parseQRFor } from './qrFormat'

// The chain id of THIS build's network (5042, Arc mainnet) - src/network.js.
export const ARC_CHAIN_ID = NET.chainId

// A valid EVM address (shared by both the drawing and the reading side)
// Format + EIP-55 checksum (MAINNET-AUDIT H6) - see src/money.js.
export const isEvmAddress = a => isValidAddress(a)

// buildQR(addr)                                → 'ethereum:0x…@5042'
// buildQR(addr, { amount: 25, currency: 'USD' }) → 'ethereum:<USDC>@5042/transfer?address=0x…&uint256=25000000'
// amount missing/invalid → the plain address QR.
export const buildQR = (addr, opts) => buildQRFor(NET, addr, opts)

// Returns { address, amount, currency } · null if unreadable · { wrongChain: <id> } - see src/qrFormat.js.
export const parseQR = text => parseQRFor(NET, text)

// The amount a QR asks for, IN ITS OWN UNIT (owner 2026-10-06: "không gom tất cả về $"): 'USD' → "$5",
// USDC/EURC/cirBTC → "5 USDC" / "5 EURC" / "0.0015 cirBTC" (legacy 'EUR' = EURC). Display only.
export function qrAmountLabel(amount, currency = 'USD') {
  const sym = currency === 'EUR' ? 'EURC' : currency
  const dec = NET.tokens[sym === 'USD' ? 'USDC' : sym]?.decimals ?? 6
  const n = Number(amount)
  const txt = n > 0 ? toAmountString(n, dec).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : '0'
  return sym === 'USD' ? `$${txt}` : `${txt} ${sym}`
}
