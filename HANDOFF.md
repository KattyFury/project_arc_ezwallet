# HANDOFF – ezwallet

**Updated:** 2026-10-05 (auto-convert on send live) · **Repo:** `KattyFury/project_arc_ezwallet` (public; renamed from
`KattyFury/ezwallet` 2026-10-03 - Pages track it by repo id) · **Local:** `D:\Files\Claude\Big projects\project_arc_ezwallet`
**Status:** ezwallet.cash serves **Arc MAINNET** (real money). Target: public launch within October 2026.

> **Start of every session:** read `CLAUDE.md`, this file, then `git pull`.
> **No blind building, no guessed numbers:** official docs first (Claude memory `arc-circle-mainnet-official-docs.md`:
> Circle OpenAPI `developers.circle.com/openapi/user-controlled-wallets.yaml`, `.md` pages via `/llms.txt`; Arc docs
> `docs.arc.io/llms.txt` / the arc-docs MCP) and a live measurement for every number the app shows.
> History of past sessions: `HANDOFF-LOG.md` (newest first). Swap plan: `docs/SWAP-PLAN.md`. Audit: `MAINNET-AUDIT.md`.

## Workflow until launch
1. The owner tests on the phone (ezwallet.cash / test.ezwallet.cash) and reports bugs one by one.
2. For each bug: measure read-only first, find the rule in the official docs, offer options - the owner picks.
3. **Every change goes to BOTH branches** (owner, 2026-10-03): commit on `test`, then
   `git checkout main && git merge --ff-only test`, push both. Both Pages projects auto-deploy.

## Current state (2026-10-04)
- **Tokens:** verified = USDC, EURC, cirBTC (`src/network.js`). Anything else the wallet holds = "Unverified tokens"
  (Home: one row with a ⌄ arrow, never in the total; tapping one opens Exchange to SELL it - owner 2026-10-05, sell only,
  a yellow warning, never blocked; the server reads its decimals on chain (`resolveTokenIn`); dry run: 50,000 BANKARC →
  +0.926622 USDC = the Kit estimate; they can also be SENT - picked only in Send's currency popup (yellow section),
  Confirm shows a yellow 'Unverified token' line, the receipt says "(unverified)" and never shows a $ for them; source = Circle balances `includeAll=true`; a
  YELLOW notification when one arrives; kept out of History). Whether Circle lists every Arc token is NOT measured.
- **Swap: ON** (2026-10-04, `docs/SWAP-PLAN.md` Phase 1 done). No app fee (provider 2 bps only). 50 bps slippage +
  the screen's minimum as `stopLimit`; server validates the intent (`validateIntent`) and simulates the exact batch
  (`eth_simulateV1` on dRPC, `net.simRpc`) before any PIN; auth = `API_KEY` (the legacy Kit key leaked - see Open).
  Two real owner swaps checked on chain: correct amounts, adapter kept nothing, provider fee exactly 0.02%.
- **Fees = Circle's own estimate** (`/transactions/contractExecution/estimateFee`, MEDIUM) for the exact call:
  Swap `/api/swap` `fee`, Send `/api/send` `fee`; screens say "up to $X". Measured max: swap ≈ $0.04-0.045 (real
  paid ≈ $0.016), send ≈ $0.003-0.004. Swap holds that max back from USDC; **Send keeps a flat 0.01 USDC reserve**
  (owner). Receipt = the fee actually paid (on-chain receipt).
- **No guessed numbers:** no offline prices (USDC = $1; others need a live `/api/prices` price, else "…");
  `sumUsd` returns null when a held token has no price. Locked by `test/noGuess.test.mjs`.
- **QR = EIP-681** (`src/qrFormat.js`): `ethereum:<addr>@5042`, amount = ERC-20 `transfer` (MetaMask-scannable).
  Old `ezwallet:` QRs and bare addresses are still read. Not yet confirmed with a real MetaMask scan.
- **History** loads page by page (`/api/wallet` `historyPage`); "Sent to / Received from" wraps, never "…".
- **Create QR** balance = real (USD = the wallet total; a token = its own balance).
- **Prices:** `/api/prices` = CoinGecko (Demo key `COINGECKO_API`) + Binance cross-check, 5-min KV cache.
- **test.ezwallet.cash is PUBLIC** (Access policy Bypass/Everyone) and is the same mainnet build (real money).

## Open items
| # | Item | Who |
|---|---|---|
| 1 | **Revoke the leaked legacy Kit key** (`KIT_KEY:dc68…`, public since 2026-06-25) in Circle Console or via Circle support. The app no longer uses it; the `KIT_KEY` Pages secret was removed. | owner |
| 2 | Bug 1: emails used on testnet cannot sign in on mainnet (Circle 155101 → 155102). Workaround = a new email. Circle support has the request IDs. | Circle |
| 3 | Bug 3b: Admin Lookup "Transfers"/balances still read the explorer/RPC from Cloudflare → fail on mainnet. | open |
| 4 | Bug 5: Cloudflare Web Analytics beacon blocked by CSP (console noise). Turn Web Analytics off or allow it. | owner |
| 5 | Bug 6: is ezwallet.cash needed as an allowed domain in Circle Console for the PIN window? Unchecked. | open |
| 6 | **Auto-convert on send: LIVE on both branches (2026-10-05).** A USD/USDC send short of USDC swaps EURC → cirBTC into the same tx (1% buffer, one PIN, one extra feeMax kept as USDC). Two real owner sends checked on chain (`docs/SWAP-PLAN.md` §7). Left: Phase 3 - History shows it as one row. | next |
| 7 | Confirm the EIP-681 QR with a real MetaMask scan (with and without Arc added). | owner |
| 8 | Idea, not decided: rescue USDC sent on another chain (CCTP v2 / LI.FI) - open questions in `HANDOFF-LOG.md` (2026-10-03). | idea |
| 9 | Cloudflare clean-up: delete old Pages projects `ezwallet`, `ezwallet-testnet`; old CF token 7d9d445c…; `TELEGRAM_*` vars. | owner |
| 10 | Not built, decisions recorded: success sound (`src/sound.js`, decisions in HANDOFF-LOG "MOVED 2026-10-04" §1), poll received money on every screen, network label on Receive, load the Circle SDK only when a PIN is needed. | ask first |

**Owner answers - do NOT offer these again:** contact photos stay per-device · no `<span>` cap-height trim on
buttons · seed/private-key import shelved (Circle has no import) · fiat on/off-ramp dropped (Onramp Kit needs a
business KYB) · no lock after a PIN reset (a security mail instead) · send reserve stays 0.01 USDC · no app swap fee · notifications disappear 24h after the EVENT (block time / announcement time), the board re-filters on every tick (2026-10-05).

## Map (one repo, three Cloudflare Pages projects)

| Site | Pages project | Branch | Notes |
|---|---|---|---|
| ezwallet.cash + www | `ezwallet-mainnet` | `main` | LIVE Circle key, KV `EZ_SYNC_MAINNET`, previews off |
| test.ezwallet.cash | `ezwallet-test` | `test` | SAME mainnet + LIVE key, KV `EZ_SYNC_STAGING`, public; apple-touch-icon inverted (vite plugin) |
| admin.ezwallet.cash | `ezwallet-admin` (root `admin/`) | `main` | Cloudflare Access (owner email) + own JWT check |

Secrets (Pages env, `.env.txt` locally): `API_KEY` (Circle LIVE - wallets + swap), `AUTH_SECRET`, `RESEND_API_KEY`,
`COINGECKO_API`. KV binding `EZ_SYNC`. Branches: only `main` + `test`; old work is in `archive/*` tags.

---

## 2. Visual rules (user-settled 2026-09-27 – apply to every screen)

- **Figma is the source of truth** (file `GxgsMU6HAYqolckzvPWXp1`). When code disagrees with Figma, code is
  wrong - except where the user explicitly overrode a Figma number (row 10 below). Re-fetch the node
  (`get_design_context`/`get_metadata`) before touching a screen; node ids shift. The rendered PNG beats the
  node list (flattened details are missing from the list).
- **The user draws, Claude builds.** Do not redesign or "improve" screens on your own; build the drawing,
  screenshot it to the Desktop, get it approved.
- **Exactly 3 greys:** box/background `#D2DCE6` (`--color-card`; `--color-surface`/`--color-gray`/
  `--color-faint` are aliases) · disabled/placeholder text + hairlines `#94A3B8` (`--color-muted`) ·
  secondary text `#667085` (`--color-muted-2`). Never add a fourth.
- **Radius: 16px on every box and button**, or fully round (pills, circles, avatar). No 8px anywhere.
- **Thin lines: 0.5px `#94A3B8`**.
- **Everything scales with the viewport.** `--u` (index.css) = one design pixel =
  `min(1px, 100dvh/844, 100vw/390)`. Write every size as `calc(N * var(--u))` - fonts, heights, icons,
  paddings, gaps. Radii, borders, shadows and hairlines stay fixed. Gaps that must stay readable:
  `max(8px, calc(16 * var(--u)))`. `useFitFontSize` scales its max/min by the same factor. At ≥844×390 the
  app is pixel-identical to the unscaled design (verified on 25 screens).
- **Grid:** 10 rows of 70/844 with a 16px gutter; row N top = (N−1)×86. Convert `x/390 → %`, `y/844 → dvh`.
  **Row 10 = row 1 = 70px**: `ScreenSheet` ends at y=774 (NOT Figma's 782.3); NavBar buttons are `8.29dvh`.
- **Big cards must be `position: absolute`** (left 6.41%, top 10.19dvh, 87.18% × 69.43dvh). A plain grid
  item (`gridRow`, `.row-2-8`) paints UNDER the absolute `ScreenSheet` and vanishes (this hid QR storage,
  History and the whole Contacts list until 2026-09-27).
- Home action row: the big pill sits exactly one gap below the notification card and one gap above row 10.
- Titles: centred, bottom of row 1, via the shared classes - never positioned per screen.
- NavBar is icon-only (30 design px). Boot is gradient all the way (index.html paints the Splash, App falls
  back to `<Splash/>` while booting, PinGate/ForgotPin use `GRADIENT`).
- **Verify UI with pixels, not eyes:** `npm run mock` + Playwright at 390×844 AND a short/narrow size
  (375×667, 360×780). `tools/figma-check.mjs <Screen> ref.png` gives an app|diff|figma image;
  `?screen=<Name>&params=<json>` opens any screen. **Check routing first** - a returning user boots into
  `PinGate`, not `Splash`; when the user's observation conflicts with your measurement, you are measuring
  the wrong thing. Send screenshots to the user's Desktop.

---


---

## 3. Stack & infrastructure

- **Frontend:** React + Vite → Cloudflare Pages. **Backend:** Pages Functions `functions/api/*.js` (Circle calls with
  server-side keys). Admin app: `admin/` (own Pages project).
- **Wallet:** Circle **User-Controlled Wallet** (MPC EOA, PIN signing via `@circle-fin/w3s-pw-web-sdk`, lazy-loaded -
  `await getSDK()` everywhere). Sign-in = OUR 6-digit email code (`/api/auth`) → `/api/session` (MAINNET-AUDIT C1).
- **Chain:** Arc **Mainnet** only. Everything network-specific lives in **`src/network.js`** (chainId `5042`, RPC
  `rpc.mainnet.arc.io`, `simRpc` dRPC, explorer, Circle App ID, token + contract addresses, `swap: true`). Nothing else
  may hardcode a chain value.
- **Reads:** viem + Multicall3 (1 request for all balances), from the BROWSER only (the public RPC rate-limits
  Cloudflare Functions). Prices `/api/prices`. History = Circle's tx list (`historyPage`) + on-chain receipts.
- **Cloudflare access for Claude:** `CF_API_TOKEN` in `D:\Files\Claude\.secrets\keys.env` (NEVER print or commit).
  Secret env vars read back without a value - that is encryption, not empty. New env vars apply only to NEW deployments
  (retry the latest deployment).
- **Local dev (Windows):** `node dev-server.js` (API on 8787) + `npm run dev` (5173). Not `wrangler pages dev`. The
  Circle SDK does not run on localhost → PIN/login only on a deploy (test.ezwallet.cash).
- **Mock mode:** `npm run mock`; `?screen=<Name>` opens a screen directly. Playwright (not in package.json):
  `npm i --no-save playwright && npx playwright install chromium`. Screenshots for the owner go to the Desktop.
- **Tools:** `tools/verify-swap.mjs` (read-only swap dry run), `tools/verify-convert.mjs` (read-only auto-convert send dry run), `tools/build-og.mjs`, `tools/figma-check.mjs`,
  `tools/update-disposable-domains.mjs`.
- **Tests / CI:** `npm test` (node:test, `test/*.test.mjs`); `.github/workflows/ci.yml` runs tests + build on `main`.
- **KV backup of contacts + QR library:** `functions/api/sync.js` + `src/sync.js` (PIN-signature auth, avatars never
  leave the device).

## 4. Money & display model

- Tokens always show their real name (USDC/EURC/cirBTC). Display currency (`ez_currency` → `$`/`€`) converts USD
  values with LIVE rates; USDC = $1. No live rate/price → "…" (never a made-up number).
- Send reserve: **0.01 USDC** (`GAS_RESERVE_USDC`, `spendableOf`) - USDC only. Swap from USDC: Circle's max fee.
- **English + USD/EUR only.** The VND plumbing (`chain.js`/`qrFormat.js`/`amountHint.js`/`data.js`) is deliberately
  left in place but unreachable - leave it.

## 5. Features (working on mainnet)

Email login (6-digit code) → wallet (PIN + security questions) · PinGate unlock · send USDC/EURC/cirBTC (Memo contract
when there is a note; fee "up to" from Circle) · Deposit (address) / Withdraw · receive (EIP-681 QR + address) · QR
create/scan/library · contacts · history (paged, grouped by day) · **Exchange (swap, all 6 pairs)** · unverified
tokens (view only) · notifications (received = green, unverified = yellow, team announcements) · receipts · change PIN
· KV backup · admin.ezwallet.cash. Google login and Circle's Email-OTP mode are hidden: **never turn Circle's Email OTP
on** (it removes the PIN). Sending to your own wallet is blocked.

## 6. Swap (⚠️ real money) - `functions/api/_swapCore.js` + `swap.js`

1. `estimate` → Kit `GET /v1/stablecoinKits/quote` (Bearer `API_KEY`, `slippageBps` 50) → `amountOut` + `minOut`.
2. `fee` → builds the same batch → Circle `estimateFee` → `feeMax` (shown "up to", held back from USDC).
3. `execute` → Kit `POST /swap` with `stopLimit = minOut` → `validateIntent` → batch
   `[approve(tokenIn→adapter), adapter.execute(params, tokenInputs, signature)]` through **Multicall3From = one PIN** →
   `simulateBatch` (dRPC) must deliver ≥ minOut → only then the Circle challenge.

**Never unpack `instructions[]` and run them by hand** - that skips settlement and strands the money in the adapter
while the tx says status=1. Dry-run any swap change with `node tools/verify-swap.mjs <wallet> USDC EURC 0.5`.
Error `331001` = no route (LI.FI side) - re-measure before touching code.

## 7. Circle / Arc gotchas (keep forever)

- The PIN screen is a cross-origin iframe: its keyboard cannot be auto-opened and it cannot be closed early
  (closing before the challenge settles loses the signature).
- `setCustomSecurityQuestions(questions, requiredCount, securityConfirmItems)` takes POSITIONAL args - an
  object blanks the screen. When an SDK misbehaves, read its `.d.ts` in `node_modules` first.
- `getSDK()` is async - `grep -rn "getSDK()" src/ | grep -v await` must be empty. A userToken lives 60' →
  `refreshSession()` before any PIN action. A wrong PIN does not settle the promise; `155701` = user cancel.
- chainId formats: W3S `ARC` (mainnet), Stablecoin Kit `Arc`.
- The Arc RPC is rate limited (429): fold reads into Multicall3, back off ≥600ms, **show `…` on a failed read,
  never 0**. A cold call takes ~3s → seed every balance screen from the module cache.
- The explorer API ignores `limit` - use `page` + `offset`. Do not merge `txlist` into history (double counts).
- RPC CORS fails on localhost only (normal in mock mode).
- iOS: `body` background must stay white (it paints the PWA status bar); manifest/meta changes need the app
  re-added to the home screen; no `navigator.vibrate`; `clipboard.readText()` only in PasteAddress (the iOS
  Paste confirmation cannot be removed).
- Web Share: `{files, text}` makes iOS hide some target apps. The Receive screen sends image + address text
  anyway (user accepted); ShowQR/receipt send the image only. Shared QR images come from
  `saveImage.brandedQrCanvas()` - the address is never drawn on the image.
- Pages applies new environment variables only to NEW deployments.


## 8. QR format - EIP-681 (since 2026-10-03)

`src/qrFormat.js` (pure, `test/qr.test.mjs`) is the single source; `src/qr.js` binds it to `NET`. Draw:
`ethereum:<addr>@5042`, or with an amount `ethereum:<USDC|EURC>@5042/transfer?address=<addr>&uint256=<base units>`.
Read: those, other wallets' `ethereum:` forms, the old `ezwallet:` format, and a bare `0x…`; another chain returns
`{ wrongChain }`. The `@5042` chain id is what lets a standard wallet switch to Arc - some wallets ignore it.

## 9. Notifications

`NotifArea` polls Circle's tx list + receipts every 5s on Receive, 15s on Send; skips while hidden, polls on return.
Received = green (with the sender's memo in bold), unverified token = yellow (zero-value transfers ignored - address
poisoning). Silence on a money screen is a serious bug for this audience - never optimise the polling away.

## 10. localStorage keys

Session: `ez_user_token`, `ez_encryption_key`, `ez_wallet_addr`, `ez_wallet_id`, `ez_email`, `ez_notifs_<addr>`,
`ez_last_recv_ts_<addr>`, `ez_notified_hashes_<addr>`; `sessionStorage.ez_pin_ok`, `sessionStorage.ez_sync_token`.
Persistent: `ez_contacts_<addr>`, `ez_saved_qrs_<addr>`, `ez_currency`, `ez_default_note`, `ez_sync_at_<addr>`,
`ez_a2hs_done`, `ez_tx_transfers_v2` (receipt cache), `ez_memos`, `ez_token_meta` (unverified token symbol/decimals).
Sign-out clears only the session keys.

## 11. Lessons

- Measure before blaming, and build an isolated measurement before fixing. Three "our bugs" in one session
  were Windows curl encoding, Circle's router, and a pre-existing overflow.
- Unverified "improvements" (aggressive retries, catch-and-return-0) caused worse regressions than the
  original bugs. Verify UI with the Playwright mock, swaps with eth_simulateV1.
- Change code and its test in the same commit (`roundHint.js` left `npm test` red for 9 days).
- A function named `poll…` with no interval is a lethal silence.
- A grid with undeclared columns, or a flex item without `minWidth:0`, lets one long string wreck a screen.
- "Looks unused" is not "safe to delete" here: `src/sound.js`, the VND helpers, the Google-login plumbing,
  `icon/` (the user's own drawings) and `public/tokens/*.png` (loaded dynamically) are all deliberate.
- **No guessed numbers in the app** (owner 2026-10-04): the swap fee was a fixed 65k-gas guess, ~10x too low, and
  missing prices silently became EURC 1.08 / cirBTC 65000. Every number shown must come from a live source.
