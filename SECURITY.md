# Security

## Scope and current status

ezwallet runs on **Arc Mainnet** at [ezwallet.cash](https://ezwallet.cash) and moves
**real money** (USDC, EURC, cirBTC). The app is **not audited** – start with small amounts.

**Key custody:** ezwallet does not hold or store private keys. Keys are managed by
[Circle User-Controlled Wallets](https://developers.circle.com/wallets/user-controlled)
using 2-of-2 MPC, and every signature is authorised by the user's PIN, entered in
Circle's own cross-origin iframe. This project never sees the PIN. This is
*user-controlled* custody, not seed-phrase self-custody – an intentional trade-off
to remove the seed phrase from the onboarding path.

**Secrets:** the Circle API key (`API_KEY`, used for wallets and swap), `AUTH_SECRET` and `RESEND_API_KEY` live only in Cloudflare Pages
environment variables and are used exclusively from server-side Pages Functions
(`functions/api/*`). They are never shipped to the browser.

**Past incident (disclosed):** a legacy Circle Stablecoin Kit key was committed to this public repository on
2026-06-25 (commits `6442d42`, `33ea69e`). A Kit key can request swap quotes/intents but cannot move anyone's
funds (every transaction still needs the wallet owner's PIN). Since 2026-10-04 the app no longer uses it - swap
calls Circle with the regular API key - and the old key is being revoked with Circle.

**Swap safety:** before a swap is offered for signing, the server checks Circle's signed intent against the
request (the output goes to the user's own wallet, right tokens, right amount, not expired), sets the minimum
output to the screen's estimate minus at most 0.5% (enforced on chain), and simulates the exact transaction
(`eth_simulateV1`); if the check or the simulation fails, nothing is sent for signing. The network fee shown is
Circle's own estimate for that transaction.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

- Preferred: GitHub → **Security → Report a vulnerability** (private advisory) on
  [this repository](https://github.com/KattyFury/project_arc_ezwallet/security/advisories/new).
- Alternative: DM [@0xhieuxyz](https://x.com/0xhieuxyz) on X.

Please include what you did, what happened, and what you expected. Since this is a
project maintained by one person, expect a reply in days rather than hours.

## Known limitations

Being explicit about what is *not* hardened yet:

- **No audit.** The contract interactions (Arc Memo, Multicall3From, Circle Swap
  Adapter) and the app itself have not been reviewed by a third party.
- **Account identity is an email address.** Signing in sends a 6-digit code to that
  email (`/api/auth`); a Circle session is only minted for an email whose code was
  verified (`/api/session`). Circle's own email-OTP mode stays off because OTP/SSO
  accounts cannot have a PIN. Funds are protected separately: every transfer requires
  the PIN, entered in Circle's iframe.
- **Contact backup is gated behind a PIN signature, not the email session.**
  The optional Cloudflare KV backup of contacts and saved QR codes does *not* use
  the email-derived session token above. `/api/sync` issues a single-use nonce, the
  wallet signs it through Circle's MPC signer (the same PIN prompt that unlocks the
  app – no extra step for the user), and the server derives the storage identity by
  recovering the address from that signature. Knowing an email is therefore not
  enough to read or write someone's contact book. Session tokens live in
  `sessionStorage` and expire after 24h server-side. Avatars are never uploaded.
  The backup still requires a `EZ_SYNC` KV binding to be present; without it the
  endpoint returns `503` and the app silently keeps everything local.
