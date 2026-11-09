# Security Audit — project_arc_ezwallet

**Audited by:** Arc Studio  
**Date:** 2026-10-24  
**Scope:** Full codebase — frontend (`src/`), backend (`functions/api/`), web3 wallet additions  
**Severity scale:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low · 🔵 Info

---

## Summary

| Severity | Count |
|---|---|
| 🔴 Critical | 1 |
| 🟠 High | 3 |
| 🟡 Medium | 4 |
| 🟢 Low | 3 |
| 🔵 Info | 4 |

The core Circle UCW email flow is well-hardened (MAINNET-AUDIT notes in the code show the team already fixed the major issues: token auth, address validation, idempotency, double-send protection). The primary new risks come from the **web3 wallet feature** added in the latest commits.

---

## 🔴 Critical

### C1 — Web3 send bypasses ALL server-side safety checks

**File:** `src/screens/SendConfirm.jsx` — `sendViaWeb3Wallet()`

**Issue:** When `ez_login_method === 'web3wallet'`, the send goes directly to `window.ethereum.request({ method: 'eth_sendTransaction' })` with no:
- `assertNetworkReady()` check (server verifies contract addresses are live)
- Chain ID check at send time (user could have switched chains after login)
- Duplicate-send guard (no `attemptRef` / `getPending()` path used)
- Fee estimate shown to user (fee display is from the Circle path and is skipped for web3)

**Impact:** A user could accidentally send on the wrong chain, double-send if they tap "Confirm & Send" twice while the wallet popup is still loading, or send to a bad address with no server-side `isValidAddress()` guard.

**Fix:**
1. Check `eth_chainId` immediately before `eth_sendTransaction` and abort if not Arc mainnet (5042).
2. Set a `sending` ref to block double-taps before `window.ethereum.request()` resolves.
3. Show "network fee: estimated by your wallet" in the fee row instead of the Circle-fetched number (which is only valid for UCW).

---

## 🟠 High

### H1 — No chain verification after login for web3 wallet

**File:** `src/components/LoginWalletPopup.jsx`

**Issue:** The popup checks the chain at **connect time** and switches to Arc. But `window.ethereum` providers fire an `accountsChanged` and `chainChanged` event asynchronously — after login succeeds and the user is already on the Send screen, they can switch chains in MetaMask with no check in the app. The next `eth_sendTransaction` call will then go to whatever chain MetaMask is currently on.

**Fix:** In `LoginWalletPopup`, subscribe to `window.ethereum.on('chainChanged', ...)` after login and set a React state / navigate back to Login with a warning if the chain changes.

---

### H2 — `ez_wallet_addr` set to lowercase from web3, but Circle UCW path may return checksummed address

**File:** `src/components/LoginWalletPopup.jsx` line 58, `src/circle.js` `ensureWalletAddress()`

**Issue:** Web3 login stores `accounts[0].toLowerCase()`. Circle UCW stores the address as returned by Circle (may be EIP-55 checksummed). `getTokenBalances()` in `chain.js` uses this address as a viem call parameter — viem accepts both. But the sync system (`functions/api/sync.js`) keys KV data off `addr.toLowerCase()` after signature recovery, while UCW users may have their address stored checksummed. This is mostly fine today, but any future `addr === localStorage.getItem('ez_wallet_addr')` comparison will fail for a checksummed UCW address.

**Fix:** Normalize to lowercase on every write: `localStorage.setItem('ez_wallet_addr', info.address.toLowerCase())` in `circle.js ensureWalletAddress()`.

---

### H3 — `estimateSendFee` is called for web3 wallet but uses the UCW `walletId`

**File:** `src/screens/SendConfirm.jsx` — `useEffect` at the top

**Issue:** The fee `useEffect` always runs regardless of login method and calls `estimateSendFee(...)` which internally sends `walletId: localStorage.getItem('ez_wallet_id')`. For a web3 wallet user, `ez_wallet_id` is empty (never set), so the server responds with "missing params" or Circle returns an error. The fee shows "Unavailable" for every web3 wallet send, which is misleading (the actual fee comes from the wallet).

**Fix:** Guard the fee fetch: `if (!isWeb3Wallet) { ... }` and for web3 wallet show "Fee paid to network (estimated by your wallet)" as static text.

---

## 🟡 Medium

### M1 — `SESSION_KEYS` does not include `ez_google_deviceId`

**File:** `src/circle.js` line 78

**Issue:** `SESSION_KEYS` is the definitive list of keys cleared on sign-out. `ez_google_deviceId` (stored at Google login) is NOT in the list. After sign-out, the next Google login attempt reuses the old device ID. If Circle invalidated that device ID, the next login will fail with 155113 until the user clears localStorage manually.

**Fix:** Add `'ez_google_deviceId'` to `SESSION_KEYS`.

---

### M2 — Web3 wallet sign-out does not clear the injected provider connection

**File:** `src/screens/MenuScreen.jsx` (sign-out logic, not audited in full but SESSION_KEYS in circle.js is used)

**Issue:** Clearing `ez_wallet_addr` and `ez_login_method` from localStorage signs the user out of the app, but the browser wallet (MetaMask) still considers the site "connected". The next `eth_requestAccounts` call will return the same account immediately without prompting the user — a different person using the same browser will be silently logged into the previous user's view.

**Fix:** Call `window.ethereum.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] })` on sign-out when `ez_login_method === 'web3wallet'`. (Note: not all wallets support this method yet — wrap in a try/catch.)

---

### M3 — `SendConfirm` web3 branch navigates to `SendReceipt` with `txHash` before the transaction is confirmed

**File:** `src/screens/SendConfirm.jsx` — web3 branch

**Issue:** `eth_sendTransaction` returns a `txHash` as soon as the transaction is **submitted** to the mempool, not when it is confirmed. The code navigates immediately to `SendReceipt` with this hash, which shows the user a receipt for a transaction that may still fail (reverted, out of gas, etc.). The UCW branch waits for `waitFinal()` before showing the receipt (MAINNET-AUDIT C4).

**Fix:** After getting `txHash`, wait for receipt confirmation before navigating. With viem (already a dependency): `await publicClient.waitForTransactionReceipt({ hash: txHash })` and check `receipt.status === 'success'` before calling `navigate('SendReceipt', ...)`.

---

### M4 — OTP code timing: `verifyChallenge` increments `tries` and re-stores the record, but `kv.put` with a past `expirationTtl` may behave differently across KV implementations

**File:** `functions/api/_auth.js` line 96

**Issue:** After a wrong code, `tries` is incremented and the record re-stored with `expirationTtl: Math.max(60, ...)`. In Cloudflare KV this is correct. In the local dev-server KV mock, a very short TTL (< 1s if `exp` is nearly elapsed) may expire the entry before the last try is recorded. This is a dev-only issue but could mislead testing.

**Fix:** Low priority — add a minimum of 30s on the re-store TTL and document the dev mock limitation.

---

## 🟢 Low

### L1 — `ARC_CHAIN_HEX` hardcoded in `LoginWalletPopup.jsx` and `SendConfirm.jsx`

**Files:** `src/components/LoginWalletPopup.jsx` line 6, `src/screens/SendConfirm.jsx`

**Issue:** Arc mainnet chain ID (5042 / `0x13B2`) is defined in `src/network.js` as the authoritative source, but duplicated as a literal in the new web3 files. If the network config ever changes (testnet branch, new chain), the literals won't update.

**Fix:** Import from `NET.chainId` via `clientNet.js` and derive the hex with `'0x' + NET.chainId.toString(16)`.

---

### L2 — `window.ethereum` assumed to be EIP-1193 without a provider type check

**File:** `src/components/LoginWalletPopup.jsx`

**Issue:** Some browser extensions (old Coinbase Wallet, Trust Wallet) inject a non-standard `window.ethereum` that may not support `wallet_switchEthereumChain`. The error thrown by `switchToArc()` is caught by the outer `try/catch` and shown as a generic error string, which may confuse users.

**Fix:** Check for `window.ethereum.isMetaMask || window.ethereum.isCoinbaseWallet` and show a "wallet may not support automatic chain switching — please switch to Arc manually" message if neither flag is set.

---

### L3 — `MAINNET-AUDIT.md` references deleted docs in git history comments

**Files:** Multiple — e.g. `functions/api/send.js` line 232, `functions/api/wallet.js` line 88

**Issue:** Several comments say "mainnet v1 plan item N (2026-09-27, deleted doc - git history)". These decisions are now unrecoverable without digging into git log. Not a security issue, but a maintainability risk.

**Fix:** Copy the relevant decision text inline where it is referenced, or keep the doc in a `docs/` directory rather than deleting it.

---

## 🔵 Info

### I1 — Google login plumbing is kept but disabled

The Google/SSO login code (`handleGoogleLogin`, cookies, `onLoginComplete`) is intact but commented out from the UI. The code is sound but dormant. Reactivating it requires re-reading the comment at line 160 of `Login.jsx` about Circle's 403 on PIN change for SSO users.

### I2 — `EMAIL_OTP_ENABLED = false` in `LoginEmailPopup.jsx`

OTP login is fully implemented but disabled. The flag is easy to flip, but the comment explains the trade-off: OTP users skip the PIN and get Circle's "Contract Interaction" confirmation instead. Re-enabling needs a UX plan for that screen.

### I3 — `MAINNET-AUDIT.md` in the repo root is a thorough self-audit

The project already has a detailed self-audit document. The findings above are incremental to what is already addressed there. The audit document should be updated to include the web3 wallet surface area.

### I4 — No rate limiting on `/api/send` or `/api/wallet`

The `auth.js` endpoint has rate limiting (5 codes/hour per email, 20/hour per IP). The `send.js` and `wallet.js` endpoints rely entirely on Circle's own rate limits. This is acceptable because Circle's limits are enforced server-side, but worth noting for DDoS consideration on Cloudflare Workers (metered invocations).

---

## Recommended Fix Priority

| # | Finding | Effort |
|---|---|---|
| 1 | C1 — Chain check + double-send guard before `eth_sendTransaction` | Small |
| 2 | M3 — Wait for tx confirmation before showing receipt | Small |
| 3 | H1 — Subscribe to `chainChanged` after web3 login | Small |
| 4 | H3 — Skip fee fetch for web3 wallet | Small |
| 5 | M2 — Revoke wallet permissions on web3 sign-out | Small |
| 6 | H2 — Normalize wallet address to lowercase on UCW write | Tiny |
| 7 | M1 — Add `ez_google_deviceId` to `SESSION_KEYS` | Tiny |
| 8 | L1 — Import chain ID from `NET` instead of literals | Tiny |
