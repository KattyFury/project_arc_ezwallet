# Mainnet readiness audit – how money could be lost

**Date:** 2026-09-27 · **Scope:** the code in this repo (= the testnet app at `241bb36`) read end to end on every
money path (`functions/api/*`, `src/circle.js`, `src/chain.js`, `src/qr.js`, Send/Confirm/Receipt/Swap screens),
plus live checks against Arc Mainnet (`rpc.mainnet.arc.io`, chainId `0x13b2` = 5042) and Circle's own SDK source.
**Status (re-checked against the code 2026-10-04):** every 🔴/🟠 item is FIXED or no longer applies - see the
marker on each heading. New finding K1 (leaked Kit key) is fixed in code; revoking the old key is an owner task.
Still open: the 🟡 items marked "open" at the bottom.

Severity: 🔴 can lose customer or owner money · 🟠 can mislead people about money / enable fraud · 🟡 hardening.

---

## Verified facts (sources, not guesses)

| Item | Mainnet value | Source |
|---|---|---|
| Chain | Arc, chainId **5042**, RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io` | docs.arc.io `/arc/references/connect-to-arc`, `eth_chainId` = `0x13b2` |
| USDC (ERC-20 iface, 6 dec) | `0x3600000000000000000000000000000000000000` (same as testnet) | docs.arc.io contract-addresses |
| EURC (6 dec) | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` (**different** from testnet) | docs.arc.io; `eth_getCode` = contract |
| cirBTC (8 dec) | `0x171A4217b86A807A64eB94757Db6849fb4bDbAA0` (different) - a verified token again since 2026-10-03 | docs.arc.io; read on chain: "Circle Wrapped Bitcoin", 8 dec |
| Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` (same) | docs.arc.io; contract on mainnet |
| Multicall3From | `0x522fAf9A91c41c443c66765030741e4AaCe147D0` (same) | docs.arc.io; contract on mainnet |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` (same) | docs.arc.io |
| **Swap Adapter** | **`0x7FB8c7260b63934d8da38aF902f87ae6e284a845`** (different) | `@circle-fin/adapter-viem-v2@1.18.0` `ADAPTER_CONTRACT_EVM_MAINNET`; contract on mainnet |
| Swap on Arc mainnet | supported (USDC/EURC/cirBTC), Circle Wallets adapter listed | docs.arc.io `/app-kit/references/supported-blockchains` |
| Circle Wallets on Arc **mainnet** | confirmed: chain code `ARC` (see B1) | LIVE key, 2026-09-27 |
| `eth_simulateV1` on the public mainnet RPC | **not supported** (`-32601`); QuickNode no, Blockdaemon filtered; **dRPC `rpc.drpc.mainnet.arc.io` yes** (used, `net.simRpc`) | live calls 2026-10-03 |
| Kit `/quote` + `/swap` auth | accept the regular Circle **API key** (Bearer), not only the legacy Kit key | live calls 2026-10-04 |

---

## ⛔ Blocker

### B1. Circle user-controlled wallets do not (yet) support Arc mainnet — ✅ RESOLVED 2026-09-27
**Update:** Circle now lists `Arc (ARC / ARC-TESTNET)` for user-controlled wallets (EOA + SCA), and a LIVE key
confirmed it: `POST /v1/w3s/user/initialize` with `blockchains:["ARC"]` → 201 + challengeId (made-up chain → 400,
code 156027). Still open for swap (v1.1): `@circle-fin/adapter-circle-wallets@1.8.0` maps only `ARC-TESTNET`.
Original finding kept below.

Circle's supported-blockchains page lists only `ARC-TESTNET`, and Circle's own
`@circle-fin/adapter-circle-wallets@1.8.0` maps only `'ARC-TESTNET'` to a chain (no Arc mainnet entry). The PIN
wallet is the core of ezwallet, so **mainnet cannot launch until Circle ships native Arc mainnet support**.
**Owner decision 2026-09-27: no workaround** (e.g. a generic "EVM" wallet + sign-transaction + self-broadcast is
NOT to be built). Wait for Circle; re-check their supported-blockchains page and the adapter's chain map, then
confirm with a LIVE API key and set `circleBlockchain` in `src/network.js` (left `null` so the app fails closed).

## 🔴 Critical

### C1. Anyone can log in as anyone (no email verification) — ✅ FIXED (`/api/auth` 6-digit email code → `authToken`, required by `/api/session`)
`functions/api/session.js` takes `{ email }`, creates the Circle user if missing and returns that user's
`userToken` + `encryptionKey` - with **no proof the caller owns the email**. The endpoint is CORS `*`.
- **Account squatting:** an attacker registers a victim's email first (setting the attacker's own PIN and
  security answers). The victim later "signs up", lands in the attacker's wallet, shares its address, and every
  payment they receive belongs to the attacker.
- **Takeover via security questions:** with a token for any email, the attacker can open the Forgot-PIN
  challenge; the only remaining barrier is the security answers - weak for the target audience (older users,
  guessable/social-engineerable answers).
- **Privacy:** balance, address and history of any email are readable.
- **Owner's money:** the endpoint can be scripted to create unlimited Circle users (billing/abuse).
**Fix:** verify email ownership in OUR backend before minting a token (a 6-digit code emailed via a mail
provider, short TTL, attempt limit), then keep `userId=email` + PIN exactly as today. Circle's own Email-OTP
auth mode is NOT an option (it removes the PIN - see HANDOFF). Add rate limiting on `/api/session`.

### C2. Hard-coded testnet addresses silently "succeed" on mainnet — ✅ FIXED 2026-09-27 (`src/network.js`, `/api/health`)
On mainnet the testnet **Swap Adapter** and **EURC** addresses have **no code**. EVM calls to a code-less address
succeed without doing anything, so:
- **Swap:** the batch `approve(tokenIn → 0xBBD7…) + execute()` would succeed, move nothing, and leave an
  **allowance to an unknown address** - whoever controls that key can later pull the customer's tokens.
- **Send EURC:** `transfer` to a code-less token address "succeeds"; the app shows "Sent" and nothing moved.
Addresses are duplicated in `send.js`, `_swapCore.js`, `chain.js`, `swap.js` (chain name `Arc_Testnet`),
`wallet.js` (`ARC-TESTNET` + a fallback to `list[0]`), `qr.js` (chainId).
**Fix:** one network config module used by client AND functions; values from the table above only; a startup
self-check (`eth_getCode` must be non-empty for every contract, `eth_chainId` must equal 5042) that refuses to
send if anything is off; remove the `list[0]` wallet fallback.

### C3. Double payment after a network drop — ✅ FIXED 2026-09-27 (Send + Swap, `src/txTracker.js`)
`SendConfirm` treats `executeChallenge` resolving as "sent" and anything thrown as "failed". If the connection
drops after the PIN is accepted, Circle may already have broadcast the transfer while the screen says
**"Send failed"** with the button re-enabled and a **fresh idempotencyKey** → the customer pays twice.
Swap has the same shape. **Fix (spec item 6):** after the PIN, poll Circle `GET /transactions/{id}` (or by
wallet) until `COMPLETE`/`FAILED`; on any doubt show "Checking…" and block re-sending until the previous
transaction's final state is known; reuse one idempotencyKey per confirmation screen.

### C4. The receipt claims success without checking the chain — ✅ FIXED 2026-09-27 (receipt only after `COMPLETE`)
`SendReceipt` never reads the transaction. A signed-but-reverted/failed transfer still produces "Sent", a
notification and a **savable receipt image** - which people will show a seller as proof of payment.
**Fix:** only show the receipt after the on-chain status is `COMPLETE`; include the tx hash on the receipt.

### C5. The swap server trusts the intent blindly and does not simulate — ✅ FIXED 2026-10-04 (`validateIntent` + `simulateBatch` via dRPC in `_swapCore.js`; execute refuses when either fails; `test/swap.test.mjs`)
`swap.js` `execute` takes Circle's intent and builds the batch without checking that every
`tokens[].beneficiary` is the user's own wallet, that `tokenIn`/amount match the request, or that
`minTokenOut` is sane. The app never runs `simulate` before `execute` (only the manual `verify-swap.mjs` does),
and `eth_simulateV1` is not available on the public mainnet RPC anyway.
**Fix:** validate the intent server-side (beneficiary, tokens, amounts, deadline, adapter address) and refuse
otherwise; simulate through a provider that supports `eth_simulateV1` (Alchemy/QuickNode) or an `eth_call`
of the batch from the user's address, and require the tokenOut balance to rise.

---

## 🟠 High

### H1. Amount rounding differs from what the user confirmed — ✅ FIXED 2026-09-27
> Worse than first written: the KEYPAD had no decimal limit either, so a typed `0.004` was sent as 0 too.
> Fixed by `src/money.js` (strings end to end, `parseUnits` on the server, reject instead of round; keypad capped
> at the token's decimals; QR amounts dropped unless clean) - locked by `test/money.test.mjs`.
`SendConfirm` sends `toFixed(2)` for USDC/EURC. The keypad limits input to 2 decimals, but a **QR-supplied
amount** (`qr.js` → `SendAmount` `digits = String(params.amount)`) is not limited: `0.004` is sent as **0**
("Sent $0.004" shown), `12.345` as `12.35`. The server also converts with floats
(`Math.round(parseFloat(x) * 10**dec)`), accepts negatives and exponent notation.
**Fix:** one decimal-string → base-units conversion (viem `parseUnits`) on the server, reject anything that is
not a positive decimal with ≤ token decimals; show and send the same string; spec says up to 6 decimals.

### H2. Price shown ≠ price executed on swap, and 3% slippage — ✅ FIXED 2026-10-04 (50 bps; the screen's minimum is sent as the Kit `stopLimit` = on-chain minTokenOut)
The screen shows a `/quote` result; `execute` fetches a **new** `/swap` intent with `slippageBps: 300`. The
customer can receive up to 3% less than the number they saw. **Fix:** execute exactly the intent whose amount
was displayed (or re-display before the PIN), and use a stablecoin-appropriate slippage (e.g. 30–50 bps) -
spec: "Giá hiển thị trước khi ký lấy trực tiếp từ quote của route sẽ thi hành".

### H3. Malicious QR can prefill a large amount in a different token — ✅ MITIGATED (a QR-filled amount over $100 needs an extra "yes" on SendConfirm; with no live price it always does)
`ezwallet:0x…?amount=1&cur=cirBTC` opens Send with **1 cirBTC** (~tens of thousands of USD) prefilled.
**Fix:** v1 drops cirBTC (spec); show a clear "amount requested by this QR" state; cap/confirm large amounts.

### H4. Testnet addresses shared as text can receive mainnet money — ⚪ NO LONGER APPLIES (testnet removed 2026-10-02)
The testnet app shares the bare address (no chain) by design. A tester who gives that address out may receive
**mainnet** USDC at an address whose key lives in Circle's TESTNET environment - possibly unrecoverable.
**Fix:** label the testnet app "TESTNET – not real money" on Receive/Share, append "(Arc Testnet)" to shared
text; in mainnet docs warn never to reuse testnet addresses.

### H5. The fee recipient must be replaced — ⚪ NO LONGER APPLIES (no app fee on swaps since 2026-10-04, owner decision)
`FEE_RECIPIENT = 0xEb2D…52F6` has no code (an EOA). On mainnet every swap pays 0.1% there - the owner's own
revenue, not customer funds. **Owner decision 2026-09-27: switch to a different wallet** (address to be supplied).
Multi-sig is NOT required: ezwallet deploys no contracts and never holds customer money (Circle MPC + the user's
PIN), so the spec's "deploy with multi-sig" rule does not apply. A wallet whose key the owner controls safely
(hardware wallet or an offline seed) is enough.

### H6. Addresses are not checksum-validated — ✅ FIXED 2026-09-27 (Paste, QR, Contacts, server)
`/^0x[0-9a-fA-F]{40}$/` accepts a mixed-case address with a typo. **Fix:** `viem.isAddress(addr, { strict: true })`
on every entry path (Paste, QR, Contacts) and on the server.

---

## 🔴 K1. Legacy Stablecoin Kit key committed to the public repo — ✅ FIXED IN CODE 2026-10-04
Found by the 2026-10-04 audit: `KIT_KEY:dc68…` was hard-coded in commits `6442d42` / `33ea69e` (2026-06-25) and is in
the public history. It cannot move funds (every tx needs the user's PIN) but lets anyone call the Kit as us.
**Fix:** swap now authenticates with `API_KEY` (measured: /quote and /swap accept it); `KIT_KEY` removed from the code
and the Pages env. **Owner:** revoke the old Kit key in Circle Console / via Circle support. Rewriting git history is
pointless - it has been public for months.

## 🟡 Hardening

- ✅ Server-side validation of `toAddress` in `send.js` (`isValidAddress` before any encoding).
- ✅ Gas shown before confirming = Circle's estimateFee for the exact call (Send + Swap, "up to $X"); no fixed guess.
- ✅ "Checking" state for an unresolved payment (C3, `src/txTracker.js`).
- ✅ CORS `*` removed from the functions.
- ✅ Upstream `detail` goes to the server log only (swap); Circle LIVE keys in place.
- ✅ No offline fallback prices: no live price → "…" (2026-10-04).
- open: `userToken` + `encryptionKey` live in `localStorage` - an XSS would leak them (the PIN is still needed to move
  money). Keep a strict CSP; the Cloudflare Insights beacon is still injected (blocked by CSP - console noise).
- ⚪ 24h lock after a PIN reset: NOT built by owner decision - a security email is sent instead (`_securityMail.js`).
