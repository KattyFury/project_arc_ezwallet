# HANDOFF-LOG – ezwallet (history)

> Everything below is HISTORY, kept for the "why" behind a number or a past decision. It is NOT required
> reading to start a session - `HANDOFF.md` is. Newest archive first.

---

## MOVED 2026-10-04 – the whole HANDOFF.md as it was before the audit rewrite

> Verbatim (headings demoted one level so they nest here). Superseded by HANDOFF.md where they disagree.

## HANDOFF – ezwallet

**Updated:** 2026-10-03 evening (UI polish day: type scale, buttons/inputs 5/6, receipt, Exit screens, prices) · **Repo:** `KattyFury/project_arc_ezwallet` (the ONLY ezwallet repo; renamed from `KattyFury/ezwallet` on 2026-10-03 - GitHub redirects the old URL; the Pages projects track it by repo id) · **Local:** `D:\Files\Claude\Big projects\project_arc_ezwallet`
**Status: ezwallet.cash SERVES MAINNET (since 2026-10-01). Owner is testing mainnet and reporting bugs one by one.
TARGET: public mainnet launch within October 2026.**

> **Start of every session:** read `CLAUDE.md`, this file (the ▶▶▶▶▶ section first), then `git pull`.
> **Before any fix:** official docs first, no blind building - the verified sources are listed in the Claude
> memory file `arc-circle-mainnet-official-docs.md` (Circle OpenAPI + `.md` pages via `developers.circle.com/llms.txt`,
> Arc docs via `docs.arc.io/llms.txt` / the arc-docs MCP). Cite the doc line or a live measurement for every change.

#### Workflow until launch
1. The owner tests on https://ezwallet.cash with an email NEVER used on testnet (see Bug 1) and reports bugs.
2. For each bug: reproduce/measure (read-only first), find the rule in the official docs, then offer options -
   the owner picks before any code.
3. **⚠️ UNTIL PUBLIC LAUNCH (owner, 2026-10-03): every change goes to BOTH `test` and `main`** - commit on `test`,
   then `git checkout main && git merge --ff-only test`, push both. The flow below applies again after launch.
   **Where code goes (since 2026-10-02):** new features → branch `test` → owner tries them on
   **test.ezwallet.cash** → merge `test` into `main` → ezwallet.cash. Small bug fixes the owner asks for directly
   may still go straight to `main` (then fast-forward `test`: `git merge --ff-only main`). Keep `test` = `main` +
   whatever is being tried; never let it drift for long.
4. There is NO testnet any more (see the 2026-10-02 section below).

#### Known open mainnet bugs (2026-10-01)
| # | Bug | State |
|---|---|---|
| 1 | Emails already used on testnet cannot sign in on mainnet: LIVE POST /users → 409/155101, then /users/token → 404/155102 (captured 2026-10-01 07:29 UTC, request IDs b3507b6e… / 2ef9cf2b…; `2a8fe7b` logs them on every such failure) | Circle-side; support's 1st answer was generic ("envs are separate") → follow-up with the request IDs sent; workaround = new email |
| 2 | The public Arc RPC (itself behind Cloudflare) rate-limits **Cloudflare Functions** (eth_chainId passes, the next call fails; a PC passes 30/30) → /api/health failed → sending paused | FIXED `7e5fdb4` - the chain self-check runs in the browser; /api/health only reports the network. Waiting for the owner's phone test |
| 3 | `explorer.arc.io/api` answers a Cloudflare bot challenge → history / "money received" broken | FIXED `7e5fdb4` - Circle's tx list (`/api/wallet` 'history') + each receipt read in the browser (USDC from system emitter `0xffff…fffe`). Verified on the owner's testnet wallet = same rows as the explorer. Waiting for the owner's phone test. eth_getLogs was rejected: 10k blocks per call → ~1,700 calls for a June wallet |
| 3b | Admin Lookup "Transfers" + balances still use the explorer / RPC FROM CLOUDFLARE → fail on mainnet | Open, owner-only tool - Circle tx states still show |
| 4 | Testnet RPC differed from the docs | CLOSED 2026-10-02 - testnet removed |
| 5 | CSP blocks Cloudflare's injected `static.cloudflareinsights.com` beacon (console noise, harmless) | Open, low - turn Web Analytics off or allow it |
| 6 | Circle PIN window on ezwallet.cash - is the domain needed in the Circle Console? | Unchecked |
> Specs: `MAINNET-V1-PLAN.md` (mainnet v1, owner-approved), `admin/SPEC.md` (admin). Older: `MAINNET-SPEC.md`,
> `MAINNET-AUDIT.md`. Secrets: `D:\Files\Claude\.secrets\keys.env` (never in the repo).

### ▶▶▶▶▶▶▶▶▶ 2026-10-03 (afternoon/evening) - SESSION SUMMARY - read this first
Everything below is LIVE on **both** `main` (ezwallet.cash) and `test` (test.ezwallet.cash), same commit (`git log -1`).
Pre-launch rule in force: every change → commit on `test`, `git checkout main && git merge --ff-only test`, push both.

**Current state of the things touched today (details in the dated notes underneath, oldest at the bottom):**
- **test.ezwallet.cash is PUBLIC** (Access policy → Bypass/Everyone; still mainnet, real money). Its home-screen icon
  is the inverted one (blue tile, white mark) via a branch-based Vite plugin; main keeps the normal icon.
- **Prices:** `/api/prices` = CoinGecko (Demo key `COINGECKO_API`, set by the owner on BOTH Pages projects) primary,
  Binance backup + 2% cross-check, 5-min KV cache; ETH returned too. Browser no longer calls CoinGecko.
- **Type scale (`--fs-*`, src/index.css):** 52/48/40/28/26/24/24/22/20/18/16/14 - multiples of 2, min 14, text only
  (layout stays on 8s). `test/fontScale.test.mjs` fails on any literal, odd or <14 size. Icon inside a button next to
  its label = 1.2× the label (`--ib-*`); chevrons/carets excluded.
- **Heights:** buttons `--btn-h` and grey input boxes `--input-h` = 70 × 5/6 = 58.33px.
- **Screens:** Contacts (smaller names, paper-plane send button); Menu Withdraw/Deposit icons = arrow-from/to-line;
  SendConfirm status line under the card in brand blue; **SendReceipt rebuilt** (card grows, SendConfirm row order,
  real network fee from the tx receipt); **Save receipt = download on PC, share sheet on phones**; **Exit screens
  (13) are full white incl. row 10, red Exit centred**; History drops "At", button "Add contacts"; no tap highlight.
- **Money:** USDC fee reserve 0.1 → **0.01** (fees measured ~0.002); Home "out of USDC for fees" warning uses it.
- **Decided / not built:** seed / private-key import SHELVED (Circle has no import). Contact photos stay per-device
  by design (owner asked why; offered thumbnail sync + toggle, NOT decided).

- **Received-money notifications show the sender's memo in BOLD, full length** ("Received 5.00 USDC from Mom · **note**"):
  `addNotif(..., memo)` (src/notif.js) + NotifArea reads it with `getTxMemo` (already cached by loadHistoryRows' receipt
  read - no extra RPC). Owner: no length cap, rows wrap - the notification design already allows multi-line.

- **QR = EIP-681 since 2026-10-03** (owner: MetaMask could not scan the private `ezwallet:` QR; "send on Arc only"
  warning already lives in the notifications). Plain: `ethereum:<addr>@5042`; with amount:
  `ethereum:<USDC|EURC>@5042/transfer?address=<addr>&uint256=<base units>`. The `@5042` chain id is what makes a
  standard wallet switch the sender to Arc (only if Arc is already added there; wallets that ignore it remain the
  risk the old scheme existed for). Format in `src/qrFormat.js` (pure, `test/qr.test.mjs`); old `ezwallet:` QRs and
  bare addresses are still read. NOT yet confirmed by scanning with a real MetaMask.

- **💡 IDEA, not decided / not built (owner 2026-10-03): rescue money sent on the WRONG chain.** Now that the QR is
  EIP-681, a sender may still pay on Base (or another EVM chain) to the same address. Feature: detect USDC on other
  chains for the user's address, and one button bridges it to USDC on Arc - via **CCTP v2** (Circle, native USDC
  burn/mint, Bridge Kit / App Kit) or **LI.FI** (aggregator, also non-USDC tokens). Questions to answer from the
  official docs BEFORE offering options: (1) can the user's Circle user-controlled wallet sign on that chain at the
  SAME address (EOA vs SCA, does a wallet on BASE have to be created first)? (2) who pays source-chain gas (the user
  holds no ETH there - Gas Station / SCA / CCTP Forwarding Service?) (3) Bridge Kit's `adapter-circle-wallets`
  chain support (it lagged on Arc mainnet before) (4) LI.FI fees + whether it reaches Arc mainnet at all.

- **Create QR "Balance:"** was a hard-coded `20.00` from Figma → now real: **USD = the wallet's TOTAL in dollars**
  (USDC + EURC at today's rate, same sum as Home's header), USDC/EURC = that token's balance ("$16.23", "5.00 USDC").
- **💡 PLANNED, not built (owner 2026-10-03): spend the TOTAL in USD.** With 10 USDC + 10 EURC (≈$11) the user may
  send e.g. $19 - the app converts the missing part EURC → USDC (swap) first, then sends USDC. Open points before
  building: swap is a separate tx (2 PIN prompts or one batched challenge?), rate moves between quote and send
  (slippage / keep a buffer), Circle swap availability + fees on Arc mainnet, what SendAmount's "available" shows.

- **cirBTC is a VERIFIED mainnet token again** (owner 2026-10-03; `src/network.js`, checked on chain: Circle Wrapped
  Bitcoin, 8 dec). It now shows on Home, in Send/Create QR pickers and can be sent. Marketing copy still says no cirBTC.
- **Unverified tokens (owner 2026-10-03, option C, VIEW ONLY):** any token the wallet holds that `NET.tokens` does not
  list. Source = Circle `GET /wallets/{id}/balances?includeAll=true` (`/api/wallet` action `balances`) - NOT yet measured
  whether Circle indexes arbitrary Arc tokens (ARCADE `0xcb92…50e3` is the owner's test token: if the row does not
  appear on the owner's phone, Circle does not list it → needs another source). Home shows ONE token-style row
  "Unverified tokens N ⌄" that expands the list (amount + symbol, no $, no logo, not in the total, cannot be sent).
  Receiving one → **YELLOW** notification "Received X SYM (unverified token) from …" (`--color-warning`, low contrast
  on white ~2.1:1 - owner asked for yellow), not tappable; zero-value transfers ignored (address poisoning).
  Unverified rows are filtered OUT of History (txInfo would value them at $1 each). Receipt cache bumped to
  `ez_tx_transfers_v2` (empty v1 entries dropped so those txs are re-read); token symbol/decimals cached in `ez_token_meta`.
- **Auto-convert on send (owner 2026-10-03 answers):** one PIN if possible ("not enough USDC, X EURC will be converted"
  → confirm), 0.5% buffer, Send's "available" = the TOTAL, converting verified tokens to USDC when short. Order: AFTER
  the unverified-tokens work; needs swap re-enabled on mainnet first = fix audit C5 + H2 → write the spec, owner approves.

- **Speed (owner: "app hơi chậm" → waiting for balance / history).** Measured: server/API/RPC 0.3-0.45s each, entry JS
  50 KB gz. Owner picked ONE fix: **History draws page by page** (`/api/wallet` action `historyPage` + `fetchHistoryPage`,
  `loadHistoryRows` with onProgress) - it used to fetch EVERY Circle page before drawing a row. NOT yet verified on a
  real wallet (mock skips it). Offered and NOT picked (do not redo without asking): persist balances / history rows in
  localStorage for an instant first paint; long cache headers for /assets/*.

- **NO GUESSED NUMBERS (owner 2026-10-04, after the swap fee was shown ~10x too low).**
  - Fees come from Circle `POST /transactions/contractExecution/estimateFee` for the EXACT call (MEDIUM): Swap →
    `/api/swap` action `fee`, Send → `/api/send` action `fee`. Screens say "up to $X" (Circle's networkFee is a maximum).
    Measured on the owner's wallet: swap ≈ 0.040-0.045 max (real swaps paid 0.0155-0.016); send 0.1 USDC 0.0031,
    with a note 0.0043, EURC 0.0041. A failed estimate shows "Unavailable" (it used to become 0 → "< $0.001").
    The receipt shows only the fee the tx actually paid. The chain-side 65k/110k gas guess is deleted.
  - Swap holds back Circle's max fee from USDC; EURC/cirBTC swaps are blocked when USDC < fee. **Send keeps the flat
    0.01 USDC reserve on purpose** (owner: "chừa 0.01 USDC luôn luôn"; the measured max send fee is < 0.005).
  - **No offline fallback prices** (EURC 1.08 / cirBTC 65000 / VND 26300 deleted). USDC = $1 always; any other token
    without a live price has usd = null → "…" (and totals via `sumUsd` → "…"). `displayNum`/`fmtDisplay` return "…"
    without a live display rate; fees fall back to $ (their real unit). Locked by `test/noGuess.test.mjs`.

**Owner answers (2026-10-03, do NOT offer these again):**
- Contact photo sync to other devices: **NO** - photos stay per-device.
- Wrapping button labels in a <span> for cap-height trim: **NO**.
- Real-device testing: the owner is testing live on the phone and reporting fixes as they go.
- Bugs table above is unchanged by today's work (1, 3b, 5, 6 still open).

### 2026-10-03 - Contacts: name one size smaller; prices + test icon now on main too
- Contacts list name `--fs-h2` (22) → `--fs-content-1` (19) (owner request). The "Send" text pill on each row
  became a 44px round blue button with Lucide `Send` (paper plane, new `send` icon in Icon.jsx) - owner: too wide.
- **Standard button height 48 (≈ 2/3 of the 70px row) → `--btn-h` = 70 × 5/6 = 58.33px** (owner). One variable in
  `:root`; `.btn` + every inline 48px button (Home Paste/Contacts/Copy/Share, About/Security Done, Login email popup
  Back/Continue, Deposit/Withdraw, Swap) use it. Buttons centred on row 9 stay centred (top = 85.665dvh − btn-h/2).
  The 48px address FIELD in FundsPopup is an input, not a button - unchanged.
- **TYPE SCALE (owner-approved 2026-10-03), smallest allowed = 14px.** All 58 literal font sizes now use `--fs-*`
  tokens in `src/index.css` :root (52/48/40/28/26/24 title/24 num/22/19/17/15/14). Folded: 18+20→19, 16→17,
  13 (notification area)+11 (token-icon fallback)→14, the 2 popup titles 24→22 (Deposit/Withdraw, email login).
  Screen titles (.sheet-title) stay 24 (`--fs-title`). Auto-fit amounts keep their own range (44→18, balance 40→24).
  **`test/fontScale.test.mjs` fails on any literal font size or a token under 14** - add a token, never a number.
- **Same day, owner: every font size is a MULTIPLE OF 2** (layout = multiples of 8, but 8-steps make text too big →
  text uses 2). 19/17/15 rounded UP → content-1 20, content-2 18, caption 16 (+ their --is-* icon pairs). Home action
  tiles (Paste/Contacts/Copy/Share) 14 → 16. 14 = notification area + small hints only. The test also fails on an odd size.
- **Icon inside a button next to its label = 1.2 × the label size** (owner, "thử xem sao"): tokens `--ib-content-1/
  -content-2/-caption` in :root. Applied: Home tiles (Paste/Contacts/QR storage/Share 19.7→19.2, Scan QR/Create QR
  27→24), Menu Withdraw/Deposit 27→24, Menu row icons 18→24 (incl. Sign out), ShowQR Share, Swap success check.
  NOT applied to chevrons/carets (Menu ›, About ›, Security ⌄) - direction marks, not pictures.
- Menu Withdraw/Deposit icons: plain ↑/↓ (same as NavBar Send/Receive → confusing) → Lucide ArrowUpFromLine /
  ArrowDownToLine (`withdraw`/`deposit` in Icon.jsx) - owner picked option B of 5 shown.
- **USDC fee reserve 0.1 → 0.01** (`GAS_RESERVE_USDC`, src/data.js; owner). Measured on mainnet 2026-10-03: base fee
  20 Gwei (floor), send ~65k gas / memo ~110k → fee ~0.0013-0.0022, max-fee cover ~0.0026-0.0044 → 2x headroom.
  The Home "Out of USDC for transaction fees" warning now fires under GAS_RESERVE_USDC (was a hardcoded < 1).
- SendConfirm status line ("Opening PIN confirmation…", our text, not Circle's) was fixed at top:52dvh and overlapped
  a tall card (name + note). Now anchored 16px under the card's bottom edge, brand blue; errors stay red, same spot.
- **Grey text-input boxes = 5/6 of the 70px row too** (`--input-h` = `--btn-h`, 58.33px; were 40-48): .address-input
  (Contacts form, SavedQRList, SendAmount note + note popup, PasteAddress), .memo-row (CreateQR name), the email-login
  field, FundsPopup address/amount/token fields, and the ⋮ button beside the SendAmount note so the row stays level.
- **SendReceipt rebuilt** (owner: rows not matching SendConfirm, stray lines, no fee): the card was a FIXED 3-row box
  (28.67dvh) holding 4-6 rows → Send to / Time were clipped, only their dividers showed. Now header + card are one
  column from 10.19dvh, the card grows like SendConfirm's, same row order + a **Network fee** row = the tx's REAL fee
  (`getTxFeeUsd`: receipt gasUsed × effectiveGasPrice), starting from SendConfirm's estimate (`feeUsd` param).
  `fmtFee` (src/data.js) is the one ≤3-decimal formatter for both screens. Receipt image gained the fee row too.
- **Save receipt: phone → share sheet (Save Image → Photos), computer → downloads the PNG** (`saveImageFile` in
  src/saveImage.js; on a PC the share path opened the OS share dialog / nothing). QR sharing still uses saveImageToPhotos.
- Button text centring measured 2026-10-03: text-only .btn labels sit ≤1px below centre (flex-centred already; the
  rest is font metrics). CSS `text-box: trim-both cap alphabetic` does NOT apply to bare text in a flex button
  (tested, no effect) - it would need the label wrapped in a <span>.
- **Exit screens: no more blue row 10** (owner). ScreenSheet with no tab now covers the whole screen; ExitBar = red
  (--color-error) text filling row 10 (91.71dvh / 8.29dvh), flex-centred - measured centre 809px = row 10's centre.
  Applies to all 13 ExitBar screens. NavBar screens (Home/Receive/Menu/ServiceHub) unchanged.
- **Tap highlight off app-wide** (`-webkit-tap-highlight-color: transparent` on body, inherits): the held "Hold to show
  tokens" pill showed the browser's own press overlay (Android default rgba(51,181,229,0.4), measured) - user-select
  none only stops text selection, not that overlay.
- Contact photos do NOT follow the account to another phone - by design (sync.js whitelist, avatars = family photos =
  PII + payload). Owner asked why; explained, not changed.
- **Import by seed / private key: SHELVED (owner 2026-10-03).** Checked Circle's docs + the full user-controlled-wallets
  OpenAPI (33 endpoints): MPC 2-of-2, keys generated by Circle, NO import endpoint → an external key can never sit under
  Circle's PIN. Options given: A) "move funds from an old wallet" (sign a sweep in the browser, key never stored) - keeps
  PIN; B) a second self-custody wallet type (own PIN = 6 digits is brute-forceable offline → would need passkey) -
  big + risky; C) watch-only. Owner: keeping the same address really needs another wallet provider (e.g. Privy), not
  wanted now → nothing built.
- TxHistory row 2: "At " dropped before the time (it wrapped with the bigger type), time nowrap, button "Add to Contacts" →
  "Add contacts" (owner). All of today's `test` work (prices,
  test-only apple icon) merged to `main` - `COINGECKO_API` secret was added by the owner to BOTH Pages projects.

### 2026-10-03 - Prices via /api/prices (option C) + test.ezwallet.cash opened to the public (on `test`)
- **Owner decision: option C** - CoinGecko primary (Demo key, env `COINGECKO_API`), Binance backup + cross-check.
  `functions/api/prices.js`: both fetched server-side, merged by `mergePrices` (agree within 2% → CoinGecko; only one
  answers → that one; >2% apart → last stored price held; none → stale stored price), cached 5 min in KV EZ_SYNC
  `prices:v1` for everyone. Binance = `data-api.binance.vision` (USDT pairs ÷ USDCUSDT). cirBTC = BTC price. ETH is
  returned too (price only, no ETH token in the wallet). The browser no longer calls CoinGecko (removed from CSP).
  Response field `up` shows which source answered; `src` per symbol shows which one was used. Tests: `test/prices.test.mjs`.
- Measured from Cloudflare 2026-10-03: CoinGecko keyless → 403 "add a descriptive User-Agent" (fixed: UA header);
  Binance `data-api.binance.vision` → 403 nginx, so the function falls through api.binance.com / api-gcp / api1 / api4.
  After the fixes test.ezwallet.cash/api/prices = `up: {coingecko: true, binance: true}`, all 3 prices within 0.5%.
- **TODO (owner):** add `COINGECKO_API` (secret) to Pages `ezwallet-test` and, before merging to main, `ezwallet-mainnet`
  - Claude's auto mode refused to write secrets to Cloudflare. Without it CoinGecko is called keyless (shared IP limit).
- **test.ezwallet.cash is PUBLIC since 2026-10-03** (owner: "ai truy cập cũng được"): the Access policy "invited
  testers" on app e2094640… was changed to Bypass / Everyone (not deleted - change it back to Allow + email to re-lock).
  It is still MAINNET with real money.

### 2026-10-03 - test.ezwallet.cash has its own apple-touch-icon (owner request)
- Builds with `CF_PAGES_BRANCH=test` (Pages `ezwallet-test`) swap the apple-touch-icon to `public/icon-test.png`
  (blue tile, white mark; source `design/logo-pfp-test.svg` = `logo-pfp.svg` with colours inverted). Done in a small
  plugin in `vite.config.js`, so `main` builds keep `icon.png` even after `test` is merged. Favicon/manifest unchanged.
  iOS caches home-screen icons: remove the old shortcut and add it again to see the new one.

### ▶▶▶▶▶▶▶▶ 2026-10-03 - Deposit / Withdraw, link preview, audit + docs (LIVE on main + test since 2026-10-03)

- **Fiat on/off-ramp DROPPED (owner 2026-10-03):** Arc's Onramp Kit (`@circle-fin/onramp-kit`, Transak behind it)
  only enables card / Apple Pay / Google Pay after a business KYB in Circle Console - the owner has no company.
  Circle has no consumer off-ramp at all (Mint / CPN / DAA are B2B). `MAINNET-SPEC.md` "on/off-ramp out of scope" stands.
- **Menu → Withdraw / Deposit are enabled** and open `src/components/FundsPopup.jsx` over the Menu (Menu blurs, like
  Login + LoginEmailPopup). Card = same top edge / left / width as the login email card (10.19dvh, 6.41%, 87.18%),
  height follows the content. X top-right or a tap outside closes it.
  - Deposit: the full wallet address + copy, note "Send USDC on the Arc network... another network will not arrive".
  - Withdraw: address + Paste, amount (left half) + token button (right half, tap = next held token), "Current
    balance", validation (EIP-55 address, not own wallet, decimals, <= balance), Continue → the existing
    `SendConfirm` (fee, PIN, tracker, receipt) with `memo: ''`. SendConfirm's Back goes to SendAmount (its usual target).
- **AddToHome:** "Skip →" 16→18px, semibold, `nowrap` (the bigger text wrapped the arrow onto a second line).
- **Link preview:** `public/og.png` now uses the app's brand gradient (`src/brandBg.js`, white → `#0B53BF`) instead of
  solid blue (owner: "solid xấu"); text black/brand like the Login screen. Rebuilt by **`tools/build-og.mjs`** (needs
  `npm run mock`), `og.png?v=6`. Telegram refresh: send the link to @WebpageBot.
- **Audit (2026-10-03):** tests 40/40, build OK. Cleaned: `arcTestnet` → `arc` (internal to `src/chain.js`), stale
  "testnet" comments. Deliberately NOT removed (see §11): VND helpers, `sound.js`, Google-login plumbing, Swap.
- **Docs refreshed:** README (mainnet badges, Deposit/Withdraw, env table, new `docs/app-*.png`, `app-swap.png`
  deleted), SECURITY.md (mainnet, email-code sign-in), `.env.example` (AUTH_SECRET, RESEND_API_KEY, EZ_SYNC).
  Old dated sections of this file (09-27 → 09-29) moved to `HANDOFF-LOG.md`.
- Merged `test` → `main` 2026-10-03 (owner: "merge"), og.png?v=6 verified live on ezwallet.cash.

### ▶▶▶▶▶▶▶ 2026-10-02 - TESTNET REMOVED; test.ezwallet.cash = mainnet staging (owner decision)

Owner: "ezwallet.cash là mainnet, test.ezwallet.cash là mainnet nhưng dùng để test tính năng trước khi public,
không muốn repo riêng hay testnet riêng nữa". Picked: separate data, invite-only, testnet domain OFF, testnet code deleted.

| | ezwallet.cash | test.ezwallet.cash |
|---|---|---|
| Pages project | `ezwallet-mainnet` (branch `main`) | `ezwallet-test` (production branch **`test`**, previews off) |
| Network / Circle | mainnet, LIVE key | mainnet, LIVE key - **same Circle users, same wallets, REAL money** |
| KV `EZ_SYNC` | `EZ_SYNC_MAINNET` d591e211… | **`EZ_SYNC_STAGING` ca7c7eb8…** (contacts/QR start empty) |
| AUTH_SECRET | its own | its own (`EZWALLET_STAGING_AUTH_SECRET` in keys.env) - sessions do not cross |
| Access | public | PUBLIC since 2026-10-03 (policy switched to Bypass/Everyone). Was: Cloudflare Access app `ezwallet test (mainnet staging)` e2094640… - policy "invited testers" = owner email only; covers test.ezwallet.cash + ezwallet-test.pages.dev + *.ezwallet-test.pages.dev. Add testers = add emails to that policy. `/api/health` has a Bypass app so the admin Health page can read it |

- **testnet.ezwallet.cash is GONE** (DNS + Pages domain removed). Old testnet KV `EZ_SYNC` 5aec627d… was kept, unbound.
  Old Pages projects `ezwallet` / `ezwallet-testnet` (if still there) are unused.
- **Code `10062ce`:** testnet block out of `src/network.js` (values recoverable from git history), faucet list /
  "Faucet successful" / faucet link removed, Deposit stays in place disabled, CSP mainnet-only, local dev + mock =
  mainnet. **Admin:** the switch is now `test | mainnet` (both mainnet + LIVE key; `test` only changes the health
  site and the announcement KV `EZ_SYNC_TEST`). Admin env: `CIRCLE_TEST_API_KEY` + `EZ_SYNC_TESTNET` removed.
- Cloudflare still creates a queued "preview" on `ezwallet-mainnet`/`ezwallet-admin` for every push to `test` (and on
  `ezwallet-test` for pushes to `main`) even with previews off - they never build; cancel them if they bother you.
  Watch PRODUCTION deployments only (`per_page=1` can show one of these instead).
- **Not checked yet:** Circle PIN window on test.ezwallet.cash (open bug 6 - allowed domains in Circle Console?),
  and the PWA install on test (the manifest request goes through Access).
- `MAINNET-V1-PLAN.md` and the older sections below still talk about testnet - historical. (README fixed 2026-10-03.)

### ▶▶▶▶▶▶ 2026-10-02 - small owner requests (both live on ezwallet.cash + testnet)

- **Add to Home Screen: Skip now snoozes for 2 days** (owner: "ấn skip chỉ ẩn 2 ngày thôi"; was permanent).
  `ez_a2hs_done` now stores the Skip time (ms); `A2HS_SNOOZE_MS` in `src/boot.js`. Old value `'1'` counts as
  expired, so everyone who skipped before sees the screen once more. Commit `14df158`.
- **Link preview (X/Telegram) refreshed for mainnet v1** - commits `7b3e169`, `55ecfc7`:
  - `public/og.png` rebuilt: same template as 2026-09-11 (solid `#0B53BF`, white `design/logo.svg`, slogan),
    pills "Live on Arc Mainnet" + "Open source · MIT", phone = a fresh HomeSend screenshot from
    `VITE_NETWORK=mainnet npm run mock` at 390x844 @3x (USDC + EURC only).
  - ⚠️ The phone frame MUST have the screenshot's exact ratio (270 x 584.3 for 390x844) and NO border - the
    first rebuild had a 6px white border + wrong ratio and the owner saw white bands top/bottom.
  - `og:description` / `twitter:description` / `description` / manifest: Send/Receive USDC + EURC, email +
    6-digit PIN, fees in USDC, Arc Mainnet. NO swap, NO testnet, NO cirBTC in the copy until they ship.
  - `og:image` is now `og.png?v=5` - bump it on the next image change (X/Telegram cache by URL).
    Telegram refresh: send the link to @WebpageBot. X: no manual refresh tool; post `?v=N` on the page URL.
- ~~README stale~~ - refreshed 2026-10-03 (mainnet badges, new screenshots).

### ▶▶▶▶▶ 2026-10-01 - ezwallet.cash MOVED to mainnet; mainnet is BROKEN - no blind fixes

- Local folder is now `D:\Files\Claude\Big projects\ezwallet`.
- Owner ordered it: ezwallet.cash + www now serve Pages `ezwallet-mainnet` (removed from the old `ezwallet`
  project, CNAMEs → `ezwallet-mainnet.pages.dev`). The rows of the map below are out of date on that point.
- **Bug 1 - login:** after the email code, "Cannot find the userId in the system" (Circle 155102 from
  POST /users/token). Live `GET /v1/w3s/users` lists only `ezwallet-probe-20260927` - the owner's user was never
  created. `ca38595` makes session.js return POST /users' own error instead of continuing; the owner reported the
  SAME message afterwards - root cause still unknown.
- **Bug 1 ROOT CAUSE (owner-confirmed 2026-10-01, NOT in Circle docs):** on one Circle account, POST /users
  checks userId uniqueness across testnet AND mainnet, while GET /users/{id} and POST /users/token only look in
  the key's own network. Any email that already has a testnet user gets 155101 "already exists" on mainnet, then
  155102 on the token → stuck. An email never used on testnet signs in to mainnet fine (owner tested). The
  API_KEY on Pages was re-written with the console key `LIVE_API_KEY:18394…` (same as keys.env) - not the cause.
  Owner decision 2026-10-01: use a NEW email (never used on testnet) on mainnet for now and report to Circle
  (draft at the owner's Desktop `CIRCLE-SUPPORT-REPORT.md`). No code change for this bug until Circle answers.
- **Bug 2 - RPC:** `rpc.mainnet.arc.io` answers "rate limit exceeded" to Cloudflare Functions every time (fine from
  a home PC) → /api/health fails → sending paused. docs.arc.io lists Blockdaemon / dRPC / QuickNode / Alchemy.
- **Bug 3 (likely):** `explorer.arc.io/api` returns a Cloudflare challenge page instead of JSON → history and
  "money received" may not work on mainnet. Not covered by any Arc doc.
- **Owner rule: no blind building.** Read the official sources first (Circle OpenAPI
  `developers.circle.com/openapi/user-controlled-wallets.yaml`, `.md` pages via `/llms.txt`, Arc docs MCP) and cite
  them for every change.

### Map (one repo, three Cloudflare Pages projects)

| Site | Pages project | Branch | Notes |
|---|---|---|---|
| ezwallet.cash + www + ezwallet-mainnet.pages.dev | `ezwallet-mainnet` | `main` | mainnet, LIVE Circle key (`LIVE_API_KEY:18394…`), KV `EZ_SYNC_MAINNET`, previews off |
| test.ezwallet.cash | `ezwallet-test` | `test` | SAME mainnet + LIVE key (real money), KV `EZ_SYNC_STAGING`, PUBLIC since 2026-10-03 (Access policy = Bypass/Everyone) |
| admin.ezwallet.cash | `ezwallet-admin` (root dir `admin/`) | `main` | behind Cloudflare Access (owner email only) + own JWT check |
| (no domain) | `ezwallet`, `ezwallet-testnet` (OLD) | - | old testnet builds - the owner can delete them |

### Open items (owner)

1. Test mainnet on ezwallet.cash with a new email and report bugs (target: launch within October 2026).
2. ~~Move ezwallet.cash + www to `ezwallet-mainnet`~~ DONE 2026-10-01. Old Pages project `ezwallet` can be deleted.
2b. Send `CIRCLE-SUPPORT-REPORT.md` (Desktop) to Circle support (Bug 1).
3. Delete the old Cloudflare token (id 7d9d445c…) - the master token (151b0875…) replaces it.
4. Delete the old Pages project `ezwallet-testnet` (no domains) in the dashboard.
5. Branches `admin`, `mainnet-v1`, `merge-testnet` are fully merged into `main` - safe to delete when the owner agrees.

> Older dated sections (2026-09-27 → 2026-09-29: the fork, audit progress, mainnet v1 build) are in
> `HANDOFF-LOG.md` → "MOVED 2026-10-03".

---

### 1. Open items (not built - ask before starting any of them)

| Item | State |
|---|---|
| **Success sound** | `src/sound.js` is written but NOT wired. Decisions already made (do not re-ask): play after a send (SendReceipt) and after a swap; Web Audio C6→E6 ~0.3s; ON by default (`ez_sound`); needs an off switch in Security & Region; `unlockOnFirstTouch()` once in `App.jsx` (iOS needs a gesture); `playSuccess()` must fail silently. Test the iOS silent switch on a real device. |
| **Received-money notifications only poll on Send/Receive** | Moving polling into `App.jsx` would announce money on every screen - touches architecture, needs the user's OK. |
| **Network label on the Receive screen** | Shared QR images already say "Only Arc"; the screen itself does not. Where it goes is the user's layout call. |
| **Auto-convert when USDC is short** | User idea (2026-09-08), notes only: swap the highest-balance token into USDC after a confirmation. Open questions (fee, trigger, copy, cirBTC) in `HANDOFF-LOG.md` §7f. |
| **Circle SDK prefetch** | ~1MB SDK is prefetched at idle on boot. Offered: load only when a PIN is needed. User has not decided. |
| **Manual clean-up in Cloudflare** | Delete `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` from Pages → ezwallet → Settings → Variables (the bug-report feature was removed 2026-09-10) and revoke the bot via @BotFather. |
| **Circle PIN screen limits** | No auto-clear on wrong PIN, keyboard needs a tap - Circle's iframe, cannot be fixed here. |

---

### 2. Visual rules (user-settled 2026-09-27 – apply to every screen)

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

### 3. Stack & infrastructure

- **Frontend:** React + Vite → Cloudflare Pages. **Backend:** Pages Functions `functions/api/*.js` proxy the
  Circle API (keys server-side).
- **Wallet:** Circle **User-Controlled Wallet** (MPC EOA, PIN signing via `@circle-fin/w3s-pw-web-sdk`,
  lazy-loaded - `await getSDK()` everywhere). Sign-in = OUR 6-digit email code (`/api/auth`) → `/api/session`.
- **Chain:** Arc **Mainnet** only. Everything network-specific lives in **`src/network.js`** (chainId `5042`,
  RPC `https://rpc.mainnet.arc.io`, explorer `explorer.arc.io`, Circle App ID `5ffb6dbb…`, token + contract
  addresses). Nothing else may hardcode a chain value. Official sources: Claude memory `arc-circle-mainnet-official-docs.md`.
- **Reads:** viem + Multicall3 (1 request for all balances) · CoinGecko prices (60s cache). The RPC is called
  from the BROWSER only - it rate-limits Cloudflare Functions (Bug 2). History = Circle's tx list + receipts (Bug 3).
  **Swap:** off on mainnet (`NET.swap`), code kept (§6). **QR:** `qrcode.react` + `jsqr`.
- **Cloudflare access for Claude:** `CF_API_TOKEN` in `D:\Files\Claude\.secrets\keys.env` (NEVER print or commit).
  Pages + DNS + Access via the REST API (`Authorization: Bearer`). Secret env vars read back without a `value` -
  that is encryption, not empty. Pages applies new env vars only to NEW deployments.
- **Secrets** (Pages dashboard, `.env.txt` locally): `API_KEY` (LIVE), `AUTH_SECRET`, `RESEND_API_KEY`, `KIT_KEY`.
  KV binding `EZ_SYNC`. See `.env.example`.
- **Local dev (Windows):** `node dev-server.js` (API on 8787) + `npm run dev` (5173). Not `wrangler pages dev`.
  The Circle SDK does not run on localhost → PIN/login only testable on a deploy (test.ezwallet.cash).
- **Mock mode:** `npm run mock` - fake wallet/balances/history, skips Login/PIN, never reaches production.
  Playwright (not in package.json): `npm i --no-save playwright && npx playwright install chromium`.
  `tools/build-og.mjs` (link preview) and `tools/figma-check.mjs` use it.
- **CI:** `.github/workflows/ci.yml` runs `npm test` + `npm run build` on pushes to `main` and on PRs.
- **KV backup of contacts + QR library:** `functions/api/sync.js` + `src/sync.js`, binding `EZ_SYNC`.
  localStorage is the source of truth; newest edit wins (`ez_sync_at_<addr>`); auth = a PIN signature over a
  nonce (session token in `sessionStorage.ez_sync_token`); avatars never leave the device. Tests:
  `test/sync.test.mjs`.

---

### 4. Money & display model

- Tokens always show their real name (USDC/EURC/cirBTC). The display currency (`ez_currency` ∈ USDC/EURC →
  `$`/`€`) is a conversion layer over USD rates, USDC pinned to $1. Send takes input in "USD" = USDC 1:1.
- One string, one style: `fmtMoney()` → `$2` / `€2` / `2 USDC`.
- Gas reserve: 1 USDC is always held back from "available".
- **English + USD/EUR only.** The i18n layer was deleted 2026-08-25. The VND plumbing in `chain.js`/`qr.js`/
  `amountHint.js`/`data.js` is deliberately left in place but unreachable - leave it.

### 5. Features (working, verified on a deploy)

Email login (6-digit code) → wallet (PIN + security questions) · PinGate unlock on reopen · send USDC/EURC (Memo
contract when there is a note) · Menu Deposit (address) / Withdraw (send to an Arc address) · receive (QR + address) · QR create/scan/library · contacts (per account,
avatar cropper) · history (grouped by day, swaps as 2 rows, self-sends labelled) · swap (OFF on mainnet; Exchange shows "Coming soon") · in-app notifications · receipts (canvas → Photos via Web Share) · change PIN · KV backup.
Google login and Circle's Email-OTP auth mode are hidden: Circle only allows a PIN with the plain `userId=email`
flow, so CIRCLE's OTP would mean losing the PIN - **never turn Circle's Email OTP on**. (A verification code sent by
OUR server before asking Circle for a token is a different thing and keeps the PIN - see MAINNET-AUDIT C1.) Sending to your own wallet is blocked in
PasteAddress, QRScanner and SendAmount (`isOwnAddress()`).

### 6. Swap (⚠️ real money)

1. `POST https://api.circle.com/v1/stablecoinKits/swap` (Bearer `KIT_KEY`) → a **signed intent**. `amount` is an
   INTEGER in base units.
2. Batch `[approve(tokenIn→adapter), adapter.execute(executionParams, tokenInputs, signature)]` through
   **Multicall3From = one PIN**. ABI copied from the SDK, encoded with viem.
3. The adapter runs the route (LI.FI underneath) and settles the output to the wallet.

**Never unpack `instructions[]` and run them by hand** - that skips settlement and strands the money in the
adapter while the tx still says status=1. Verify every swap change with `node verify-swap.mjs <wallet> EURC
USDC 2` (eth_simulateV1, free). App fee: `customFee.percentageBps = 10` (0.1%) to
`0xEb2D222d28F35fE7BeB5387f8Bc4eBF65f2652F6`, taken from the input token; the estimate is already net.
Error `331001` = no route (LI.FI side, happened 08-13→08-25 and recovered on its own) - re-measure before
touching code.

### 7. Circle / Arc gotchas (keep forever)

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

### 8. QR format – locked to Arc

`src/qr.js` is the single source: `ezwallet:0xABC…@5042[?amount=25&cur=USD]` (chain = `NET.chainId`). EIP-681 is deliberately not
used (wallets ignore its chainId). `parseQR` accepts the standard form, the old form without `@chain`, and a
bare `0x…` (to pay outsiders); another chain returns `{ wrongChain }` (no `.address` - catch it first). The
address as TEXT (copy/share) stays bare on purpose.

### 9. Notifications

`NotifArea` polls Circle's tx list + receipts (`/api/wallet` history, NOT the explorer API): every 5s on Receive (someone is waiting), 15s on Send; skips while the tab is
hidden and polls immediately on return; `page=1&offset=20`. Silence on a money screen is a serious bug for
this audience - never optimise the polling away.

### 10. localStorage keys

Session: `ez_user_token`, `ez_encryption_key`, `ez_wallet_addr`, `ez_wallet_id`, `ez_email`, `ez_notifs`,
`ez_last_recv_ts_<addr>`, `ez_notified_hashes_<addr>`; `sessionStorage.ez_pin_ok`,
`sessionStorage.ez_sync_token`. Persistent: `ez_contacts_<addr>`, `ez_saved_qrs_<addr>`, `ez_currency`,
`ez_default_note`, `ez_sync_at_<addr>`, `ez_a2hs_done`. Sign-out clears only the session keys.

### 11. Lessons

- Measure before blaming, and build an isolated measurement before fixing. Three "our bugs" in one session
  were Windows curl encoding, Circle's router, and a pre-existing overflow.
- Unverified "improvements" (aggressive retries, catch-and-return-0) caused worse regressions than the
  original bugs. Verify UI with the Playwright mock, swaps with eth_simulateV1.
- Change code and its test in the same commit (`roundHint.js` left `npm test` red for 9 days).
- A function named `poll…` with no interval is a lethal silence.
- A grid with undeclared columns, or a flex item without `minWidth:0`, lets one long string wreck a screen.
- "Looks unused" is not "safe to delete" here: `src/sound.js`, the VND helpers, the Google-login plumbing,
  `icon/` (the user's own drawings) and `public/tokens/*.png` (loaded dynamically) are all deliberate.


---

## MOVED 2026-10-03 – dated sections of HANDOFF.md from 2026-09-27 → 2026-09-29

> Verbatim. Superseded by HANDOFF.md where they disagree (testnet is gone since 2026-10-02).

## ▶▶▶▶ 2026-09-29 (end) - MAINNET V1 BUILT, deployed on ezwallet-mainnet.pages.dev, awaiting the owner's real-money test

- Branch `mainnet-v1` merged into `main` (owner-tested on the preview): testnet = mainnet (swap off, no cirBTC,
  Exchange "Coming soon"), CSP + no CORS + no raw Circle payloads, README limits, QR >$100 extra confirm (the
  on-screen "requested by this QR" label was REMOVED by the owner), unknown QR currency drops the amount, temp-mail
  block for NEW accounts (CC0 list, `tools/update-disposable-domains.mjs`), security mails (created / PIN change
  requested / PIN reset started), fee = eth_estimateGas of the exact call shown to 3 decimals ($0.002), home lists
  only held tokens, Exit on ShowQR, in-app announcements.
- **Two Circle doc lies found live (both fixed):** the transactions LIST omits `refId` (only GET /transactions/{id}
  has it) - the send tracker never confirmed anything since 09-27 (hotfixed to testnet same day); GET /v1/w3s/user
  returns the user at `data.id`, not `data.user.id`.
- **Pages `ezwallet-mainnet`** (repo main, previews off): NETWORK/VITE_NETWORK=mainnet, API_KEY=LIVE key,
  AUTH_SECRET=EZWALLET_MAINNET_AUTH_SECRET, KIT_KEY live, RESEND. KV `EZ_SYNC_MAINNET` (d591e211…) bound as EZ_SYNC;
  also bound to the admin as EZ_SYNC_MAINNET. /api/health mainnet OK.
- ⚠️ The public mainnet RPC rate-limits: the first /api/health failed ("rate limit exceeded", then 3/3 OK). Health
  fails closed → a user may see "Sending is paused" and succeed on retry. Watch it; a paid RPC may be needed.
- Next: owner tests with ≤ $1 on ezwallet-mainnet.pages.dev (create wallet + mail, receive, send, PIN change + mail,
  forgot PIN + mail) → only then, with the owner's explicit OK, move ezwallet.cash + www from the old Pages project
  `ezwallet` (old testnet build + redirect script) to `ezwallet-mainnet`.

## ▶▶▶ 2026-09-29 - ADMIN FIRST, then mainnet v1

- **Owner decisions:** plan A (finish ALL of phase 2 before ezwallet.cash moves; it still serves the old testnet build
  from Pages project `ezwallet` + a redirect script to testnet). **Testnet must be IDENTICAL to mainnet** - never add
  testnet-only features/labels; differences live only in `src/network.js` (chain, App ID, addresses, faucet). So:
  plan item #8 (TESTNET label) is DROPPED; testnet gets swap OFF and no cirBTC like mainnet (not done yet - after
  admin). Temp-mail block (#6) = a free, bundled open-source domain list. Plan item #5 was already done (`send.js`
  rejects bad/non-checksummed addresses).
- **Admin `admin.ezwallet.cash`** - spec `admin/SPEC.md` (owner-approved v2). Code in `admin/` on branch `admin`.
  - Pages project `ezwallet-admin`, root dir `admin`, production branch `main` (merged 2026-09-29), previews off. Env: CIRCLE_TEST_API_KEY, CIRCLE_LIVE_API_KEY, RESEND_API_KEY (secrets), ADMIN_EMAIL,
    ACCESS_TEAM_DOMAIN `plain-fog-e653.cloudflareaccess.com`, ACCESS_AUD. KV `EZ_ADMIN` (audit log).
  - Cloudflare Access app `ezwallet admin` (id 5f4f6774-…), one-time PIN only, policy = kattyfury1403@gmail.com.
    Code re-verifies the Access JWT on every request (`admin/functions/_access.js`) → `*.pages.dev` answers 403.
  - Done: health, stats, lookup (read-only), email ONE user (preview + confirm, logged). Verified 2026-09-29 on the
    owner's account: Circle returns wallets/transactions/balances by userId with the API key alone; transactions
    carry no amounts (amounts come from ArcScan); address → email reverse lookup is NOT possible.
  - Tabs: Health, Stats, Users (every email, owner request), Lookup, Announce, Mail, Log.
  - **In-app announcements DONE + owner-tested on a phone (2026-09-29), merged to `main` → live on testnet.**
    Broadcast only, ≤ 200 chars, no links. Admin writes KV `inbox:all` in the APP's KV (admin binding
    `EZ_SYNC_TESTNET` = testnet EZ_SYNC; `EZ_SYNC_MAINNET` to add at mainnet launch). App: `functions/api/inbox.js`
    + `src/inbox.js` (poll on open, then ≤ 1 per 5 min; each id shown once per account). Spec admin/SPEC.md §5.5.
  - Next: back to mainnet v1 - first "testnet = mainnet" (swap OFF + no cirBTC on testnet), then plan items.
  - Mainnet ArcScan API answers with a Cloudflare challenge page to curl - lookup on mainnet may show no transfers.
- Cloudflare: ONE master token now (`CF_API_TOKEN` in the central secrets file, id 151b0875…) with Pages, Workers,
  KV, Access, DNS, Single Redirect. The old token (7d9d445c…) is to be deleted by the owner.

## ▶▶ LATEST (2026-09-27, later session) - supersedes the section below where they disagree

- **B1 RESOLVED - Circle PIN wallets work on Arc mainnet.** Circle's live supported-blockchains page now lists
  `Arc (ARC / ARC-TESTNET)`, user-controlled EOA + SCA (the Circle docs MCP index was stale - always fetch the live
  page). Confirmed with the owner's LIVE key: `POST /v1/w3s/user/initialize` `blockchains:["ARC"]` → 201 + challengeId
  (control: a made-up chain → 400 code 156027). A probe user `ezwallet-probe-20260927` exists on the live account.
- **Mainnet App ID:** `5ffb6dbb-ea01-5758-8780-2eb6b8cb2996` (testnet: `518fec6a-4680-5175-9de6-0810fb3dfd04`,
  still hard-coded in `circle.js`, `Login.jsx`, `LoginEmailPopup.jsx` - must move into `src/network.js`).
- **Kit key is one key for testnet AND mainnet** (developers.circle.com/w3s/keys). Still open for swap later:
  `@circle-fin/adapter-circle-wallets@1.8.0` maps only `'ARC-TESTNET'`.
- **Secrets now live in ONE file outside every repo:** `D:\Files\Claude\.secrets\keys.env`
  (`CIRCLE_LIVE_API_KEY`, `CIRCLE_LIVE_APP_ID`, `CIRCLE_TEST_API_KEY`, `CIRCLE_KIT_KEY`, `CF_*`, `RESEND_API_KEY`,
  `EZWALLET_TESTNET_AUTH_SECRET`, `EZWALLET_MAINNET_AUTH_SECRET`). The old per-repo `.env.txt` are kept as backup.
- **Owner decisions:**
  1. **Mainnet v1 = Send/Receive only.** Swap stays OFF on mainnet (C5/H2, paid RPC and the adapter question are
     deferred to v1.1). "Build slowly."
  2. **ONE repo:** this repo (`KattyFury/ezwallet`) serves both networks via `VITE_NETWORK`/`NETWORK`;
     `KattyFury/ezwallet-testnet` will be ARCHIVED (not deleted) once testnet.ezwallet.cash deploys from here.
- **Testnet `main` now has the email sign-in code (C1)** - merged + live 2026-09-27 (commit `f60b1b9` in the testnet
  repo; `/api/session` without an auth token → `AUTH_REQUIRED`). Port it FROM the testnet repo `main`, not `wip/otp`.
- **DONE later the same day (phase 1 of the owner-approved plan, spec = `MAINNET-V1-PLAN.md`, owner-approved with Claude Chat):**
  - C1 email code brought over (`bc80527`); `src/`, `functions/`, `test/` were then byte-identical to the testnet repo.
  - `src/network.js`: `circleAppId` per network, mainnet `circleBlockchain: 'ARC'`, `swap` flag (mainnet false →
    `/api/swap` 503). App ID no longer hard-coded (`23c5ee4`).
  - **New Pages project `ezwallet-test`** (repo `KattyFury/ezwallet`, branch `main`, NETWORK/VITE_NETWORK=testnet,
    SAME testnet API key / KIT_KEY / AUTH_SECRET / RESEND key / KV `EZ_SYNC` as the old project, so testers stay
    signed in). **testnet.ezwallet.cash now serves from it** (domain moved + CNAME → `ezwallet-test.pages.dev`,
    owner-approved and owner-verified on a phone: same wallet, balance, history).
  - Full testnet-repo history kept HERE as tags: `archive/testnet-main` (558 commits since 2026-06-16),
    `archive/testnet-privy`, `archive/testnet-feature-otp`, `archive/feature-*`. Its `.env.txt` keys are in the
    central secrets file (`EZWALLET_TELEGRAM_*`, `EZWALLET_PRIVY_*`).
  - **`KattyFury/ezwallet-testnet` repo and its local folder DELETED by the owner (2026-09-27). THIS is the only
    ezwallet repo now.** (One public fork of the old repo exists on someone else's account - not ours to delete.)
    The old Pages project `ezwallet-testnet` (no domains any more) is left for the owner to delete in the dashboard
    - never touch `ezwallet-test`, it serves testnet.ezwallet.cash.
  - Next: phase 2 (mainnet v1 work, `MAINNET-V1-PLAN.md`) - ask the owner before starting.
- **Plan, in order (ask the owner before each step):**
  1. Bring the testnet repo's post-fork code (C1 email code) into this repo; per-network flags in `src/network.js`
     (App ID, swap on/off, cirBTC, faucet); set mainnet `circleBlockchain: 'ARC'`.
  2. New Pages project for TESTNET built from this repo (`NETWORK`/`VITE_NETWORK=testnet`), move
     testnet.ezwallet.cash to it, verify testers see the same wallets; then archive the testnet repo.
  3. Mainnet v1 work (spec: `MAINNET-V1-PLAN.md`) → Pages project for mainnet →
     tiny-amount tests (≤ $1) → ezwallet.cash.

## ▶ WHERE WE ARE (end of session 2026-09-27) - read this first

- ~~**Mainnet is BLOCKED by Circle (MAINNET-AUDIT.md B1)**~~ - resolved, see LATEST above.
- `main` here has the audit fixes C2, H1/H6, C3/C4 (the same code now runs on testnet). Branch `wip/otp` holds an
  EARLY server-only copy of the email-code work (C1); the finished, tested version lives on the testnet repo's
  `feature/otp` branch (it adds a KV-read fix, the client popup step and the pasted-code fix) - port FROM there.
- Fee wallet confirmed by the owner: `0xEb2D222d28F35fE7BeB5387f8Bc4eBF65f2652F6` (unchanged; no multisig needed -
  ezwallet deploys no contracts and holds no customer money).
- ~~Owner still to do for mainnet: Circle "Upgrade to Prod" (paid plan)~~ - WRONG (checked 2026-09-29): Circle
  Wallets is pay-as-you-go per Monthly Active Wallet, the first 1,000 MAW/month are free, billed in arrears - nothing
  to prepay. Gas is not billed by Circle either (EOA wallets, users pay their own gas; only Gas Station is invoiced).
  The LIVE key already works. Still open for swap (v1.1): a paid RPC with eth_simulateV1 for C5.
- No Pages project exists for this repo yet (`wrangler.toml` name `ezwallet-mainnet`).

## M0. READ `MAINNET-AUDIT.md` FIRST (2026-09-27)

Money-loss audit of this code against Arc Mainnet: 5 critical items (no email verification, testnet addresses
that silently "succeed" on mainnet, double payment after a network drop, receipts without on-chain checks, the
swap server trusting the intent blindly) plus high/hardening items, with verified mainnet addresses and the
proposed order of work. Nothing in it is fixed yet.

## M0b. Progress on the audit (2026-09-27)

- ✅ **C2 done - one network config.** `src/network.js` holds every chain id/RPC/explorer/token/contract per
  network (values verified live). Client picks it with `VITE_NETWORK` (`.env.development`/`.env.mock` = testnet,
  `.env.production` = mainnet), functions with the runtime env `NETWORK` (no default → 503). `/api/health`
  checks chainId + contract code at every address; `SendConfirm`/`Swap` call `assertNetworkReady()` and refuse
  to create a challenge if it fails or the two sides disagree. Mainnet build: USDC+EURC only, label "Arc", no
  faucet (Deposit disabled), `circleBlockchain: null` → `/api/wallet` answers 503 until B1 is resolved.
- ✅ **H1/H6 done** - `src/money.js`: amounts are decimal strings end to end, `parseUnits` on the server, anything
  unclean is rejected (never rounded); keypad capped at token decimals; EIP-55 checksum on every address path.
  Tests: `test/money.test.mjs`.
- ✅ **C3/C4 done** - `src/txTracker.js`: every Send/Swap carries a `refId` (a UUID the server passes to Circle's
  contractExecution); after the PIN - and after any doubtful error - `/api/wallet` `txByRef` lists the wallet's
  recent transactions and the app waits for the REAL state. Receipt / "Swapped … (complete)" only on `COMPLETE`;
  `FAILED/DENIED/CANCELLED` → "nothing left your wallet", retry allowed; not final / could not ask → blocked
  ("Check again"), persisted per account (`ez_pending_tx_<addr>`) so no new payment starts until it resolves.
  Mock rehearsal: `localStorage.ez_mock_tx_state = COMPLETE | FAILED | SENT`. Verified: each scenario issues exactly
  one send. Open UI point: Swap shows its long "still being confirmed" warning inside the button (existing pattern).
- ⏳ Next (needs owner input): C1 (6-digit email code - needs a mail provider + sender domain), C5/H2 (swap intent
  validation + simulation via a paid RPC + quote/slippage), H3 (QR amount/token UX), H4 (testnet labelling), H5
  (new fee wallet address). Circle API facts for C3 are verified: contractExecution accepts `refId`;
  `GET /v1/w3s/transactions` (X-User-Token, filters walletIds/from/operation) returns refId/state/txHash.
- "Email OTP" wording: Circle's Email-OTP **auth mode** removes the PIN (never use it). C1's fix is different -
  OUR server emails a 6-digit code before asking Circle for a token; Circle still sees `userId=email` + PIN.

## M1. Before building anything (from MAINNET-SPEC "Việc cần xác nhận")

1. Does LI.FI (under Circle's Stablecoin Kit) support Arc Mainnet yet? If not, find another swap route.
2. Arc Mainnet addresses (Swap Adapter, TokenMessenger, Memo, Multicall3From, USDC/EURC) - from docs.arc.io,
   never copied from testnet (except USDC per the spec).
3. Does the Circle Wallets adapter / W3S fully support the Arc mainnet chain code?
Then plan the port with the user (spec rules: multi-sig deploys, ERC-20 6-decimals everywhere, no cirBTC /
sub-apps / CCTP / Gateway in v1, 24h lock after PIN reset, gas shown in USDC before confirming, a
"checking" state instead of "failed" when the network drops mid-send).

## M2. Deployment - nothing exists yet

- **No Cloudflare Pages project for mainnet yet.** Create `ezwallet-mainnet` (GitHub source = this repo) when
  there is something to deploy. ⚠️ The existing project `ezwallet` belongs to the TESTNET repo (it tracks
  it by repo id; the dashboard still shows the old name `KattyFury/ezwallet` - do not reconnect it here).
- **Domain:** `ezwallet.cash` + `www` are still attached to the testnet project, and the testnet build's
  `index.html` redirects them to `testnet.ezwallet.cash`. To give the apex to mainnet: detach both from
  project `ezwallet`, attach them to `ezwallet-mainnet`, then delete the redirect script in the TESTNET repo.
- Secrets: `.env.txt` was copied locally from the testnet folder (gitignored, never commit it). It holds the
  Cloudflare API token plus the TESTNET Circle keys - mainnet needs its own Circle app/keys.
- `src/chain.js`, `src/qr.js` (`ARC_CHAIN_ID`), token/contract tables below are all still TESTNET values.

---

## Inherited from ezwallet-testnet (describes this code as it is today)


**Updated:** 2026-09-27 · **Repo:** `KattyFury/ezwallet-testnet` · **Local:** `D:\Files\Claude\Build on Arc\ezwallet-testnet`
**Live:** https://testnet.ezwallet.cash (Cloudflare Pages project `ezwallet`, auto-deploys from `main`)

> **Start of every session:** read `CLAUDE.md` (how to work with the user) and this file, then `git pull`.
> Full history - every dated decision, round-trip and the pre-2026-09-27 version of this file - lives in
> `HANDOFF-LOG.md`. Read it only when you need the "why" behind something here.

---

## 0. What this repo is (after the 2026-09-27 fork)

- **This is the Arc TESTNET build** of ezwallet - a stablecoin wallet for everyday people and older users
  (email + 6-digit PIN, no seed phrase, gas paid in USDC). Feature-complete and polished; testers use it.
- **The Arc MAINNET product lives in a separate repo: `KattyFury/ezwallet`** (local
  `D:\Files\Claude\Build on Arc\ezwallet`), started 2026-09-27 as a copy of this code with fresh history.
  Its spec is `MAINNET-SPEC.md`. **Do mainnet work there, not here.**
- Sibling folders under `Build on Arc\` (`build-on-arc`, `luckypot`, `taptip`, `ezwallet`) are separate,
  unrelated repos - never let one end up nested inside another.

**Core belief (every decision answers to it):** people shouldn't have to adapt to crypto; crypto should
adapt to people. Ask of every change: *does this make sending/receiving simpler for an everyday user?*
If something drifts from that, stop and ask the user.

---


---

## ARCHIVE 2026-09-27 – the full HANDOFF.md as it stood before the pre-fork cleanup

> Verbatim copy (923 lines). Superseded by the condensed `HANDOFF.md` written the same day. Where the two
> disagree, `HANDOFF.md` wins - several sections here (design system §5/§6, the Telegram bug button, LuckyPot,
> the deferred Menu icons and square-viewport items) were already obsolete when this was archived.

## HANDOFF – ezwallet

**Updated:** 2026-09-22 · **Local:** `D:\Files\Claude\Build on Arc\ezwallet`
⚠️ The path above was WRONG in every earlier version of this file (it said `D:\Files\Claude\ezwallet`,
with no `Build on Arc\`). Sibling projects `build-on-arc`, `luckypot` and `taptip` live in that same
parent folder and are **separate, unrelated git repos** – never let one end up nested inside another.

---

### ✅ VISUAL RULES SETTLED 2026-09-27 (user) – apply to every new screen

- **Exactly 3 greys.** Background/box `#D2DCE6` (`--color-card`; `--color-surface`, `--color-gray`,
  `--color-faint` are now aliases of it) · disabled/placeholder text + all hairlines `#94A3B8`
  (`--color-muted`) · secondary text `#667085` (`--color-muted-2`). Do not add a fourth.
- **Radius:** every grey box = **8px** (and the white boxes inside one: token rows, notifications, hint block); every button = **16px or fully rounded** (pill/circle).
- **Thin lines:** always **0.5px `#94A3B8`**.
- **Full cards must be `position: absolute`** (left 6.41%, top 10.19dvh, 87.18% × 69.43dvh). A plain
  grid item (`gridRow`, `.row-2-8`) paints UNDER the absolute `ScreenSheet` and vanishes – this hid
  QR storage's grey, History's grey and the ENTIRE Contacts list until 2026-09-27.
- **Row 10 = row 1 = 70/844.** `ScreenSheet` ends at y=774 (NOT Figma's 782.3, which left the NavBar strip 62px); the NavBar button is `8.29dvh` tall so its icon stays centred on any phone.
- NavBar is icon-only (30px). Menu shows the address as `0xabcd...efgh` + copy button.
- Boot is gradient all the way: `index.html` paints the Splash, `App.jsx` falls back to `<Splash/>`
  while booting, and PinGate/ForgotPin use `GRADIENT` (they were white = "gradient flashes then white").
- Block explorer moved to `explorer.testnet.arc.io` (`EXPLORER` in `src/chain.js`); the old host
  301s without CORS, which had broken History + incoming notifications. Use `page=1&offset=N`, never `limit`.
- Not done, offered to the user: load the Circle SDK only when a PIN is needed (it prefetches ~1MB on boot).

### ⚠️ CURRENT STATE (2026-09-22) – READ BEFORE THE FIGMA SECTION BELOW

Three things are in flight. **Nothing below this block has been superseded**, but this is where the
project actually stands right now.

**1. THE FORK HAS NOT HAPPENED.** The user's plan, stated 2026-09-22:
   - **`ezwallet`** (this repo's name) becomes the **Arc MAINNET** project
   - **this current repo is renamed `ezwallet-testnet`**
   - The mainnet spec is saved verbatim at **`MAINNET-SPEC.md`** – read it before doing any fork work.
   - **The user explicitly postponed the fork** to improve the UI first. Do not start forking unprompted.

**2. THE UI REDRAW – THE USER IS DRAWING IT, NOT CLAUDE.** Asked which areas to improve and how far
   Claude could go, the user answered: *"Thay vì bảo bạn đoán, mình sẽ vẽ"* + *"Vẽ lại tự do, tôi duyệt
   từng màn"*. So:
   - **Do not design, propose layouts, or "improve" screens on your own initiative.** Wait for the user's
     drawing, build that, screenshot it to the Desktop, get it approved, then move to the next screen.
   - The redraw IS allowed to change the locked 2026-09-09 design system – the user lifted that
     restriction for this round. (`MAINNET-SPEC.md` still says "dùng nguyên bản đã chốt 2026-09-09,
     không vẽ lại" – that line was written BEFORE this decision and now means "the fork inherits
     whatever the redraw settles on", not "never change it".)
   - Figma remains the preferred handover format, because `tools/figma-check.mjs` verifies against it.

**3. LANDING PAGE CONTENT – requested 2026-09-22, nothing built.** The user asked for copy suggestions
   and supplied **ethos.network** (mobile) as the visual reference: a full-bleed photo background, a thin
   black hairline grid splitting the page into stacked cells, one huge serif headline, three short
   sans-serif sentences (what it is / what you do / why it matters), and one black CTA button.
   ⚠️ **Open question nobody has answered yet:** `ezwallet.cash` currently boots straight into the app
   (Login). Where a landing page goes – replacing the root, on a path, or on a separate domain – has
   **not** been decided. Ask before building anything.

#### ✅ DONE 2026-09-27 - the whole design scales (the deferred item below is resolved)

`--u` in `src/index.css` = one DESIGN pixel = `min(1px, 100dvh/844, 100vw/390)`. Every font size, box/
button height, icon, padding and gap is written as `calc(N * var(--u))` (≈250 sites, converted by
script); radii, borders, shadows and 0.5px hairlines stay fixed. `useFitFontSize` scales its max/min by
the same factor (read off a probe element). Gaps that must stay readable use `max(8px, calc(16 * var(--u)))`.
- On a viewport >= 844 tall and >= 390 wide `--u` = 1px: verified PIXEL-IDENTICAL to before on 25
  screens/popups (only History's live timestamps differed).
- Checked at 375x667, 390x560, 360x780, 390x440: nothing spills into row 10 or out of its own box.
  Screenshots were sent to the user's Desktop (`ezwallet-2026-09-27/scale_*`).
- **New code must follow it:** write sizes as `calc(N * var(--u))`, not bare px numbers.

#### ⚠️ (RESOLVED 2026-09-27, see above) KNOWN, DEFERRED (2026-09-23) - the 2026-09-23 redesign breaks on a SQUARE-ish viewport

The user, verifying the Receive QR fix: when the viewport is forced toward a **square aspect ratio**
(not just short - specifically closer to 1:1 than a phone's usual ~9:19.5), the redesigned screens break
down more broadly than the one QR-vs-button overlap already fixed (see `src/screens/HomeReceive.jsx`'s
QR sizing comment for that one). **The user's own words, to be read literally when this is picked up:**
*"khi màn hình bị ép về hình vuông thiết kế sẽ vỡ, sau này mình sẽ fix = cách giảm size chữ size box size button cho tương ứng chiều cao màn hình"*
- i.e. the planned fix is to make FONT SIZE, BOX SIZE and BUTTON SIZE all shrink in step with viewport
  HEIGHT (the same `min(..., calc(Xdvh - Ypx))` pattern the Receive QR fix already uses), not a one-off
  patch per element as each breakage is found.
- **NOT STARTED.** The user deferred it explicitly ("sau này" = later) - do not build a general
  fix unprompted. When asked, the QR fix in `HomeReceive.jsx` is the reference pattern: read it before
  inventing a new approach.
- Everything built under the 2026-09-23 redesign (`GRADIENT` background, `ScreenSheet`, `NavBar`,
  `BalanceHeader`, the token/notification cards on Send/Receive, `AddToHome`, `Login`,
  `LoginEmailPopup`) is `dvh`-anchored the same way the pre-redesign app already was (see §6 Layout
  Rules) - so this almost certainly affects ALL of it, not just Receive. Assume every new screen has the
  same latent issue until it is actually tested at a square-ish viewport.

#### ⚠️ KNOWN, DEFERRED (2026-09-23) - Menu's two row markers ARE real icons, not decided yet

`src/screens/MenuScreen.jsx`'s row markers (the flat squares at each end of Transaction history /
Security, language & currency / Learn about blockchain / About) are currently a literal `Marker`
component - a plain coloured square, built that way because Figma draws them as undifferentiated
squares with no reference photo to go by (unlike the Add screen's share-sheet icons, which had the
user's own iOS screenshot as ground truth).

**The user confirmed what they should become, 2026-09-23, but NOT to be built tonight/this session -
"handoff tối làm tiếp" (write it down, continue tonight):**
*"note lại các ô vuông màn Menu chính là icon, bên trái là icon tượng trưng bên phải là icon tam giác
hướng qua phải, để điều hướng người dùng click vào"*
- **LEFT marker → a real, PER-ROW symbolic icon.** Not one shared glyph - each row gets its own
  meaningful icon (a clock for Transaction history, a shield for Security, etc. - pick per row when this
  is built, the same way the pre-redesign Menu once did before the 2026-09-10 rebuild replaced per-item
  icons with a plain triangle bullet).
  ⚠️ The `Icon.jsx` mapping already used Lucide equivalents for exactly this kind of thing on other
  screens this session (see the Add screen's `bookmark`/`star`/`note`/`find`/`addSquare`) - reuse that
  approach (import the matching Lucide component, add it to `ICONS`) rather than inventing a new pattern.
- **RIGHT marker → ONE shared icon, the same on every row: a right-pointing chevron/triangle** (`>`),
  a plain navigation affordance ("tap to open this row"). Lucide's `ChevronRight` is already imported in
  `Icon.jsx` as `right2` (used for About's link rows before the redesign) - almost certainly the correct
  choice here too, just confirm the visual weight/size against Figma once this is actually built.
- **NOT STARTED.** Do not build this unprompted - it is deferred to a later session ("tối làm tiếp").
  When it is picked up: `Sign out`'s markers should very likely follow the same rule (left = a real icon,
  e.g. a logout glyph, right = the same chevron, both in the danger red) even though the user's note only
  names the 4 items above it - confirm before assuming.

**Separately, confirmed and ALREADY FIXED the same message:** the divider between rows was invented
(not a Figma node - it's baked into that frame's background image, see the ITEMS comment in
`MenuScreen.jsx`) using the wrong colour, `var(--color-gray)` (#E3E3E3). The user approved having a
divider there at all, but corrected the colour: *"line xám mờ 0.5px bạn tự bịa nhưng tôi thấy ok, miễn
là line cùng màu với line khác, màu 94A3B8 thì phải"* - now `var(--color-muted)` (#94A3B8) at 0.5px,
matching the exact hairline spec Figma already bakes into the Add screen's own share-sheet dividers
(`stroke="#94A3B8" stroke-width="0.5"` in that asset).

#### Found 2026-09-22, NOT fixed (the user has not approved the fix)

Leftovers from the 08-25 removal of Vietnamese. All verified by reading the code, all real:
- `src/screens/SendReceipt.jsx:16` formats the receipt date with **`vi-VN`** (→ `22/09/2026`) while
  `src/screens/TxHistory.jsx:21` uses **`en-GB`** (→ `22 Sept 2026`). **Two date formats in one app.**
- `src/screens/TxHistory.jsx:332` – the transaction-detail popup also uses `vi-VN`, while the list rows
  directly above it use `en-GB`. Inconsistent **within a single screen**.
- `src/screens/SendReceipt.jsx:79` saves the receipt image to the user's photo library as
  **`bien-lai-<ts>.png`** (Vietnamese for "receipt") in an English-only app.
- The other `vi-VN` hits (`amountHint.js`, `data.js`, `SendAmount.jsx`, `SendConfirm.jsx`) are the
  **deliberate** dead VND plumbing documented in the 08-25 log entry – leave them alone.

#### Shipped 2026-09-22

- **`72ee40f` – the desktop handset frame.** On a desktop window the app used to be a bare white 430px
  column on pastel blue `#D6EAFB`. It is now drawn as an iPhone-style handset (rounded screen, black
  bezel + metal rim via box-shadow rings, drop shadow) on `#E1E7ED`. Entirely inside the existing
  `@media (min-width: 481px)` block in `src/index.css` – **mobile is untouched**.
  **⚠️ The rule that makes it work, do not "simplify" it away:** the handset keeps a FULL viewport
  height and is then shrunk with `transform: scale(0.93)`, because all ~165 layout coordinates in this
  app are `dvh` – i.e. anchored to the VIEWPORT, not to the parent. Giving `#root` a smaller height
  (`calc(100dvh - 48px)`) silently drifts every one of them and the NavBar collides with the content
  above it. Scaling shrinks rendered pixels while every `dvh` still resolves to exactly what it did
  before. The full reasoning is in the comment above the rule.
  **Deliberate side effect:** a transformed ancestor becomes the containing block for `position: fixed`
  children, so `.popup-overlay` / `.sheet-overlay` / `ErrorToast` now stop at the handset's edges
  instead of covering the whole desktop window.
  **Known trade-off the user was told about:** because the layout is `dvh`-anchored, the handset's
  aspect ratio follows the browser window's height (400×837 at a 900px-tall window, 400×1004 at 1080px).
  Locking it to a true 430:932 iPhone ratio would mean removing `dvh` from all ~165 sites – its own
  project, not a tweak.
- Cloudflare Pages **auto-deploys from GitHub `main`** – confirmed 2026-09-22 by fetching the live CSS on
  `ezwallet.cash` minutes after the push and finding `E1E7ED` already served. No manual deploy step.
- ⚠️ **The stored wrangler OAuth token is EXPIRED** (`%APPDATA%\xdg.config\.wrangler\config\default.toml`
  → the Cloudflare REST API answers `10000 Authentication error`). Section 1's "Claude's Cloudflare
  access" notes are correct in method but the credential needs `npx wrangler login` again before any of
  it works.

#### ⚠️ READ THIS FIRST - REBUILDING SCREENS FROM FIGMA (23 done, 0 to go)

**Figma file: `GxgsMU6HAYqolckzvPWXp1`.** The user's position, stated directly on 2026-09-10:
*"toàn bộ thiết kế Figma đang chuẩn BRAND GUIDELINE chỉ có Claude là đang làm sai"* - the Figma file and
`BRAND-GUIDELINE.md` agree with each other. **When the code disagrees with them, the code is wrong.**
It took four rounds of user corrections to get 3 screens right. Everything below exists so the next 17
do not cost the same.

**⚠️⚠️ TWO SOURCES OF TRUTH ONLY: live Figma + `BRAND-GUIDELINE.md`. Nothing else.** Stated directly by
the user 2026-09-10 after a Send money round-trip cost three separate corrections: *"note vào handoff:
figma là nguồn sự thật, sửa thiết kế theo figma chứ không nửa figma nửa code cũ."* Concretely:
- Every measurement (position, size, gap, colour, icon) comes from a **fresh** `get_design_context` /
  `get_metadata` call on the node being built, not from memory of an earlier fetch, not from a sibling
  screen's "close enough" precedent, and not from whatever the pre-existing code already did. Re-verify
  the number, don't reuse it.
- A value **inherited from old code and never re-checked against this pull is a bug**, not a base to
  build on - even something as small as a leftover `margin` or a `flex` proportion. If you didn't
  personally verify a number against the current node, assume it's wrong.
- Borrowing a solution from a DIFFERENT screen (even one already verified correct) is still a fabrication
  if the current node's own export doesn't show it. Convenient precedent is not evidence.
- If Figma's raw export looks incomplete (no icon layer, a blank key, a missing colour) - it very often
  IS incomplete (flattened into a background image, an unexported detail) rather than "the design really
  has nothing there." When the user states directly what it should be, that instruction overrides an
  empty API response - it does not count as fabrication, the API export was the gap.
- **Two related, cautionary examples from the SAME session** (Send money, `1:88`, seventh round-trip):
  1. The "You send" card's chip/available-line/amount were positioned with flexbox
     (`justify-content:space-between`/`flex-end`) approximating the layout instead of each element's own
     measured `x/y` - it LOOKED right at a glance but landed 15-20px off Figma's real coordinates, which
     only `figma-check.mjs`'s pixel diff (not eyeballing) caught. Fixed by placing every child at its own
     absolute `%`/`dvh` coordinate, the same per-element method Confirm transaction/Receipt already used.
  2. The numpad's key height/gap and the token icon's shape were carried over from pre-Figma-rebuild code
     (a `flex:5.5` proportion, a real circular icon reused from `Swap.jsx`) instead of the current node's
     own numbers (fixed 48px keys/8px gap/27px to the CTA row; a flat 24px BLACK SQUARE, no real icon at
     all). Both looked defensible in isolation - neither was what the current Figma pull actually draws.

**Repo cleanup (2026-09-10):** `FIGMA-SCREENS-SPEC.md` and `SEND_MONEY_FIGMA_SPEC.md` are DELETED - both
were reading a *different, older* Figma file (`iQxFGA890VhyXkEKipCC9C`) than the one this whole rebuild
uses, both had already misled at least one build (Send money's now-corrected "it's a % slider" guess came
straight from the deleted spec doc), and per the two-sources rule above they were a competing, stale
third source that should never have existed alongside live Figma. `BRAND-GUIDELINE.md` stays - it is
verified byte-for-byte identical to the text literally embedded in the Figma file itself (node `1:419`),
so it counts as Figma, not a separate paper copy of it. Do not recreate a similar "spec digest" doc for
any future screen - read the live node instead, every time.

##### 1. THE GRID - this was the root cause of nearly every error

`BRAND-GUIDELINE.md` says *"Grid dọc: 10 hàng, spacing mỗi hàng 16px"* and *"Grid ngang: 12 cột, spacing
mỗi cột 8px"*. That gutter had **never been implemented**: `.screen` was `repeat(10, 1fr)` with no gap, so
rows were 844/10 = 84.4px. The real row height is **70px** (844 − 9×16 = 700, ÷10). Everything was
therefore up to ~14px out, and the fix was one line: `row-gap: 16px` on `.screen`.

| Row | y (of 844) | What lives there |
|---|---|---|
| 1 | 0–70 | the balance number |
| 2 | 86–156 | Withdraw/Deposit (Menu) |
| 2–5 | 86–414 | the token card (Send) / QR card (Receive) |
| 3–7 | 172–586 | the 5 Menu rows (centres 207/293/379/465/551) |
| 6–8 | 430–672 | the notification card |
| 9 | 688–758 | the action pill row (centre 723 = 85.66dvh) |
| 10 | 774–844 | the NavBar - exactly **70px**, not 84.4 |

Row N: `top = (N−1)×86`, `bottom = top + 70`. Horizontally: column = (390 − 11×8)/12 = **25.167px**, so
cols 2–11 = x 33.17–356.83 = the **324px white cards**, and the same span including its outer gutters =
x 25.17–364.83 = the **340px grey boxes** = an inset of **6.45%**. Convert with `x/390 → %`,
`y/844 → dvh`. **If a Figma measurement does not land on this grid, suspect your reading of the grid -
do not start nudging individual elements.**

**THE HEADER RULE (user, 2026-09-10, stated directly - applies to every screen title app-wide):** the
title sits in row 1 (its own 70px box), size **28**, horizontally **centred**, vertically anchored to the
**bottom** of that row - not centred, not a raw pixel offset guessed from a screenshot. The single shared
definition is `.screen-title` in `index.css` (`font-size:28; align-items:flex-end`, riding on `.center`
for `display:flex` + horizontal centring by CSS source order); every screen title uses
`className="row-1 center screen-title"` with NO inline `fontSize` - the class is the only place this
value lives. **Never fix a title with one-off absolute positioning per screen** (ServiceHub/Exchange did
this on the first pass and had to be converted back) - route it through this class instead.

##### 2. The five mistakes - what made each one possible

1. **Trusting the MCP node list over the rendered image.** `get_design_context` returns a structured node
   list, but anything flattened into the frame's background image is **absent from it** - the Menu divider
   lines and the navbar's white active cell were both invisible in the node list while being plainly
   visible in the render. Both were dropped, twice.
   → **The rendered PNG is ground truth. The node list only supplies coordinates.**
2. **Comparing by eye.** A balance rendering at 28px instead of 50px, a missing grey card behind the QR,
   and a 12px offset on the button row all survived several "looks right" screenshot reviews. They fell
   out in seconds under an overlay diff.
3. **Trusting stale docs in this repo.** §5/§6 below still described Barlow, gradients, `#F2F2F7`, and a
   "10 equal rows" grid. `FIGMA-SCREENS-SPEC.md` §1 asserted 84.4px rows. Those documents were written
   against older Figma files and actively misled the work.
4. **Assuming a shape from its silhouette.** "Hold to show tokens" / "Tap to copy your address" are **half
   ovals**, not pills: measuring the white run row by row gives 183px wide at y=374 growing to 258px at
   y=412, then cut dead at y=414 - the grey box's bottom edge. They are 258×40 with a 38px radius on the
   **top corners only**, sitting inside the grey box so the box clips the lower half *and the shadow*.
   That clipping is the whole effect: shadow on the grey, nothing on the white page below.
5. **A CSS grid trap.** Placing an element at `grid-row: 2` while `BalanceHeader` already spans
   `grid-row: 1/3` makes CSS Grid insert an implicit second column and split every row's width - the Menu
   rows silently shrank to 133px and wrapped. Absolute positioning sidesteps it.

##### 3. The verification workflow - not optional

```bash
npm i --no-save playwright && npx playwright install chromium   # once
npm run mock                                                    # dev server, fake balances
node tools/figma-check.mjs HomeSend ref.png --probe 195,374 48,774
```
`tools/figma-check.mjs` renders the screen at 390×844, writes a 3-panel `app | difference | figma` image,
and prints RGB at any pixels you name. Get `ref.png` from the Figma MCP `get_screenshot` on the frame's
node id, then `curl` the URL it returns. **The middle panel finds drift; the probes prove it is gone.**
Glyph-edge ghosting is expected - the app renders the system font, Figma draws Inter.

Also useful: `?screen=<Name>` on any URL forces that screen (a QA override in `App.jsx`), so a screen can
be opened without walking the flow.

⚠️ **BUT: verifying one component proves NOTHING about what the user actually sees - CHECK THE ROUTING
FIRST.** `?screen=X` and a clean pixel diff only tell you that component X is correct *if it renders*.
On 2026-09-11 a "the logo is centred" report was answered with a pixel-perfect `figma-check` of
`Splash.jsx`, a byte-check of the live bundle and a real-browser measurement reading exactly 21.28% -
and the user was told their screenshot must be wrong. They were right: `ez_pin_ok` is in sessionStorage,
so `App.jsx` boots a returning wallet **straight into `PinGate`** and `Splash` is only reached on a fresh
login - the screen being measured was one the user essentially never sees, while the one they did see
(`PinGate`, with its own hand-rolled centred lockup) was never opened. **When a user's direct observation
conflicts with your measurement, assume you are measuring the wrong thing.** Read `App.jsx`'s boot logic,
find which component actually renders in their situation, and check *that*. Note also that mock mode
auto-unlocks, so `?screen=PinGate` will NOT show PinGate - it resolves and navigates to HomeSend.

##### 4. Where the rebuild stands

**Done (23) - ALL FRAMES BUILT:** Splash `1:169` · Login `1:180` · Sign in with email `1:193` · Send
`1:328` · Receive `1:373` · Menu `1:16` · Service hub `1:43` · Exchange `1:63` (= `Swap.jsx`) · LuckyPot
`1:158` · Paste address to send `1:205` · Confirm transaction `1:215` (= `SendConfirm.jsx`) · Receipt
`1:227` (= `SendReceipt.jsx`) · Send money `1:88` (= `SendAmount.jsx`) · Language & currency `1:259`
(= `Currency.jsx`) · Security `15:190` (= `Security.jsx` - the Figma frame is literally misspelled
"Secutiry"; HANDOFF's old id `1:275` no longer exists in the file - **node ids shift, always re-check
with `get_metadata` before trusting an id written down earlier**, not just the design content) · Contacts
`1:239` · Transaction history `1:248` · About `1:286` · Create receive QR `18:82` (= `CreateQR.jsx` -
old id `1:113` no longer exists, another shifted id) · Created receive QR `1:128` (= `ShowQR.jsx`) ·
Arabica `18:296` (= `ShowQR.jsx`, `fromStorage` - old id `1:139` no longer exists) · Scan QR `1:150`
(= `QRScanner.jsx`) · QR storage `1:303` (= `SavedQRList.jsx`).

**Left: none.** Every frame in the file has been rebuilt against a fresh `get_design_context`/`get_metadata`
pull at least once. That does not mean "finished forever" - the user has repeatedly kept editing frames
mid-session (Send money's numpad gained digit labels between two fetches minutes apart; Security's whole
node id changed). Before touching ANY screen again, re-fetch its node fresh - never trust this file's
notes, or an earlier session's memory, as still current.


---

📜 **Full historical detail moved to `HANDOFF-LOG.md`** (2026-09-11) - every dated round-trip from the
Figma rebuild (screens 1-23), the LuckyPot build log, and the 2026-09-07/09-08 session snapshots. Read it
only when you need the "why" behind a specific number or a past decision's rationale; it is not required
reading to start a session. This file keeps only what still needs to be read every time: the process
rules above, the current shared values right below, then the structured reference (stack, money model,
design system, gotchas, lessons) starting at §0.

---

##### 5. Current shared values (these changed on 2026-09-10 - §5/§6 below are older)

- `--color-surface` **#E1E7ED** (was #F1F5F9) - guideline "Surface / input / card", confirmed against the
  Sign-in input and the navbar bar.
- **Buttons carry a GLOW, not a drop shadow:** `0 0 8px rgba(0,0,0,.48)` on the rebuilt screens
  (guideline: *"Chỉ phần tử bấm được. Glow đều quanh, không offset"*). The navbar active cell uses
  `0 0 15px rgba(0,0,0,.5)`, measured off the fringe.
- **NavBar:** flat `--color-surface` bar, 16px semibold labels, 24px icons, bottom-aligned with 10.5px of
  padding. The active tab is a **white cell contiguous with the white content above** - one block casting
  its shadow down onto the grey. `.navbar` is `overflow: hidden` so that glow cannot leak upwards and grey
  the seam.
- **Action pills:** side 100×56 radius 28, centre 124×64 radius 32, no border, 13px / 16px semibold labels,
  icons 19.5 / 24. Columns `1fr 1.24fr 1fr`, gap 8 (100+8+124+8+100 = 340).
- **Notification area:** 13px text throughout. The hint block is a **borderless white card, radius 16**,
  black body text with semibold keywords and a red network line - it is no longer a blue-bordered blue-text
  box. Notification rows are white pills, radius 16, tinted text - no more pale coloured fills.
- **Token rows (Send)** are individual white cards, 48px tall, radius 16, 10px apart, name and value both
  18px semibold. The verified-check badge was dropped (the design has no slot for it).
- **BalanceHeader** measures its fit box by a definite `width`; with only `max-width` the box sizes to its
  own text and `useFitFontSize` collapses to the floor. That bug rendered the balance at 28px.
- **`.btn` is FIXED 48px tall, 18px text** (was `height:6dvh`≈50.6px with `min-height:48px` only as a
  floor, and `font-size:var(--fs-body)`=19px) - see the recurring-bug note above. This is every button in
  the app, not just the ones rebuilt so far.
- **`.confirm-box` is radius 16** (was 20) - shared by `SendConfirm.jsx`/`SendReceipt.jsx`.
- **Header rule** (§1 below has the full statement): every screen title is bottom-anchored, centred, 28px,
  in row 1's 70px box, via the single shared `.screen-title` class - never position a title per screen.
- `App.jsx`'s `?screen=` QA override now also reads `?params=<URI-encoded JSON>` for screens that need nav
  params to render without crashing (SendConfirm/SendReceipt read `address`/`amount`/etc and call
  `.toFixed()` on them - undefined without this). `tools/figma-check.mjs` has a matching `--params` flag.

##### 6. Open points the user may want to settle

- **13px notification/hint text** comes from the Figma, but a 2026-07-16 decision set 17px *for older
  eyes*. The design's layout only fits at 13. Flagged, not resolved.
- **Fixed 258px pill width** comes from the Figma; a 2026-08-13 decision said those two buttons should hug
  their text and be deliberately unequal. Figma now draws both identical.
- **Receive labels** are verbatim Figma: the button says **"Custom QR"** while the hint above it says
  "Create QR" - the inconsistency is in the design itself.
- **The balance stays `--fw-light`** even though Figma draws Regular, per the standing "big numbers are
  always Light" rule. Say so if that should change.
- **The bug-report feature was removed entirely** this session (component, `functions/api/bug.js`, the
  Telegram integration, the icon, `__APP_VERSION__`). §7d below is obsolete. **Still to do by hand:**
  delete `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` from Cloudflare Pages → ezwallet → Settings → Variables,
  and revoke the bot via @BotFather if it should stop working immediately.
- **SendConfirm's secondary button is now "Back"** (was "Edit") - the exact Figma text, onClick unchanged
  (still re-opens SendAmount with the existing params, i.e. still functions as "edit"). Not flagged by the
  user, just a literal-text-match call - say so if "Edit" was the better word for what it does.


---


##### OPEN ITEMS carried out of the 2026-09-11 session

| Item | State | Who / what unblocks it |
|---|---|---|
| `design/pfp.png` | ✅ Added (dropped via Desktop, same day) | done |
| README screenshots | ✅ Rebuilt (4-image grid, Playwright/mock, see the Brand assets section) | done |
| `public/og.png` | ✅ Rebuilt - solid `#0B53BF`, no gradient, new screenshot | done |
| Circle PIN: no auto-clear on wrong PIN · mobile keyboard needs a tap | **Cannot be fixed here** - see the ⛔ CIRCLE'S PIN SCREEN note in `HANDOFF-LOG.md` for the full API evidence | Only Circle can fix it; report alongside the `common.showPin` issue already raised |
| `.scroll-thin` inside a grey box | ✅ Fixed everywhere - `HomeSend`, `Contacts.jsx`, `TxHistory.jsx` all switched to `.scroll-hidden` | done |
| `HANDOFF.md` was 1581 lines/213KB, getting silently truncated on read | ✅ Split - chronological history moved to `HANDOFF-LOG.md`, this file now 745 lines | done |
| Code cleanup (unused files/exports, duplicated logic) | ✅ See "CODE CLEANUP" note right below - some flagged-as-dead code turned out to be deliberate, NOT deleted | done |
| Everything below in this section | Unchanged from the previous session | - |

**⚠️ CODE CLEANUP 2026-09-11 - read before deleting anything that "looks unused":** an audit found several
candidates for dead code; cross-checking against this file's own history caught 2 FALSE POSITIVES before
they were deleted - **"looks unused" is not the same as "safe to delete" on this project, check history
first.**
- **`src/sound.js` is UNWIRED but NOT dead** - it's a real, still-open TODO with a 7-step wiring plan (see
  `### 🟠 UNFINISHED` right below, item A). Deleting it would have destroyed planned work, not cleaned up
  junk.
- **`data.js`'s `fmtVND`/`symbolAfter` are UNCALLED but NOT dead** - they're part of the VND plumbing a
  prior session *deliberately* left in place (unreachable since the 08-25 i18n removal) in case VND
  support returns - see `## 2. Money & display model` below. Not this session's call to remove.
- **Actually deleted (genuinely orphaned, verified with grep, no history note protecting them):**
  `public/logo.png` (leftover from before the SVG-based logo) - that's it, everything else the audit
  flagged turned out to be either already-fine or protected by a standing decision.
- **Actually fixed:** the `shortenAddr`/`shortAddr` address-truncation helper was copy-pasted into 6
  places (`SendAmount`/`SendConfirm`/`SendReceipt`/`TxHistory`/`NotifArea`/`Contacts`), with `TxHistory`'s
  copy silently using `'...'` instead of the real ellipsis `'…'` the other 5 used - consolidated into one
  `shortenAddr()` export in `data.js`.

##### The real next step (do this FIRST, before anything else)

Test on a real deploy, in this order (Circle's SDK cannot run on localhost, so none of this is
testable in mock mode or on `npm run dev`):
1. Push a preview deploy, faucet the wallet some testnet USDC, do a small real Deposit - confirm the
   PIN screen opens, the tx lands on Arc Testnet (check `testnet.arcscan.app`), and `src/lib/luckyPot.js`'s
   read picks up the new `deposited`/`eligible` numbers afterward.
2. Withdraw a small amount the same way - confirm the wallet's USDC balance actually rises (same
   "never trust tx status=1 alone" discipline as Swap's `verify-swap.mjs`).
3. Claim needs a wallet that actually won an epoch to test for real - if none exists yet, at minimum
   confirm the "Latest result" popup's tap-to-reveal renders correctly for a wallet that has a
   `prevEpochId` but did NOT win (the "Good luck next epoch" branch - already screenshotted in mock,
   but mock never exercises the real `owedTo`/`hasClaimed` reads).

##### Older standing state (still true, kept for context)

- **Production runs:** **ENGLISH + USD/EUR ONLY.** Vietnamese and Chinese were **REMOVED FROM THE PROJECT ENTIRELY on 08-25** - the i18n layer is gone, not merely switched off (see section 2). The whole repo, comments and documents included, is English now; the only file still holding Vietnamese is `.env.txt`, which is gitignored.
- **🟢 SWAP IS BACK UP** - the user tested it live on a deploy 08-25 and it went through with no `331001`. See section 4 for the outage history (kept in case it returns).
- **New in session 08-25 (part 1):** the LuckyPot tile · the i18n layer removed · the whole codebase translated · 2 notification bugs fixed (dust amounts showing 0.00, long text cut off) · `Available Network: Arc Testnet` in the hint block · a `Balance:` line on the Send screen. Details in `HANDOFF-LOG.md`'s 08-25 session tables.
- **New in session 08-25 (part 2, UI polish batch):** a 24h price-change triangle (▲/▼, tap for a popup) next to each token's amount on the Send tab · the network line reworded to `Current Available Network: Arc Testnet` · the Paste/Scan QR/Contacts hint titles are no longer tap-navigable (they were sending people to random screens) · the Scan QR caption now says "Scan Arc Testnet QRs only" · Security's icon is a new hexagon shield (`icon/shield.svg` replaced, same filename) · Menu's Currency entry + its screen title are now "Language & Currency" · the Send screen's `Balance:` line moved from beside "Send to" down to the blank space below the note field. Details in `HANDOFF-LOG.md`'s 08-25 session tables.
- **CI is live** (`.github/workflows/ci.yml`): every push to `main` runs `npm test` + `npm run build` on Node 22. All 3 runs on 08-25 were green.
- **In progress:** the success sound (`src/sound.js` is written but **not wired into the app**) - sections 7c + `HANDOFF-LOG.md`'s 08-25 session table. This is the first thing to pick up.
- **Who does what:**
  - **LongDC** → the multi-language work is on hold: the i18n layer was removed 08-25, so adding a language now means designing it again from scratch (see section 2).
  - **User + Claude** → refining the UX/UI.
- **Still pending, needs a human:** the message to Circle support was sent 08-25 (swap recovered on its own before a reply came back, so no answer is being chased any more) · **nothing from session 08-25 has been touched on a real device yet** - the deploy checklist for it is in `HANDOFF-LOG.md`'s 07-31 entry.

> ⚠️ **`DECK-DESIGN-SPEC.md` and `PITCH.md` were DELETED 2026-09-11** (user instruction, repo cleanup) - both
> described the pre-redesign brand (Barlow, `#F2F2F7`/`#E2EAF7`, flat drop-shadows, a stale "20 screens"
> count) and no longer matched `BRAND-GUIDELINE.md`/the live app after the Sep 2026 rebuild. The stale
> `docs/*.jpg`/`docs/*.gif` screenshots those two files embedded were deleted too - the user wants new ones
> re-captured later, once today's remaining UI bugs are fixed (do not re-take screenshots before that).
> If a pitch deck or messaging kit is needed again, write it fresh from the current `BRAND-GUIDELINE.md` +
> `README.md`, not by resurrecting these.

> **A stablecoin wallet for everyday people and older users.** Simple UX, mobile-first. **The user-satisfaction milestone was reached (07-18): the whole flow - login, PIN, sending, swapping real money - was tested by the user on a deploy and ran smoothly.**
> AT THE START OF EVERY SESSION read BOTH `HANDOFF.md` (this file) and `CLAUDE.md` (how to work with the user).
> The principle: **follow Circle/Arc properly, read the docs and verify with real API/eth_call responses before building, NEVER guess.**
> Detailed per-session history: `git log` (the commit messages carry the detail) - this file holds only the LATEST STATE + the rules + the lessons.

**EXTERNAL documents (do not put marketing content in this file):** `README.md` = the technical introduction for GitHub. `PITCH.md` (messaging kit) and `DECK-DESIGN-SPEC.md` (deck design system) were DELETED 2026-09-11 - see the note above.

AI resources: Circle [skills](https://developers.circle.com/ai/skills) · [mcp](https://developers.circle.com/ai/mcp) - Arc [skills](https://docs.arc.io/ai/skills) · [mcp](https://docs.arc.io/ai/mcp). Already installed locally: the Circle Skill (`circle:*`), Circle MCP (`mcp__circle__*`), Arc MCP (`mcp__arc-docs__*`).

---

### 0. Core value - EVERY decision in this project revolves around it

> ezwallet was built on a simple belief: everyone should be able to own their
> own money, without needing to become a crypto expert.
>
> Self-custody shouldn't mean memorizing seed phrases, copying long wallet
> addresses, or worrying about gas tokens. Those are technical barriers, not
> the value of crypto.
>
> We believe people shouldn't have to adapt to crypto. Crypto should adapt to
> people, making it simple enough for anyone to use while preserving full
> ownership of their money.

**How to apply it:** every feature, UX decision and architectural choice in this file must be able to
answer the question "does this make crypto simpler for an everyday user,
or is it making them adapt to crypto?". Anything that drifts from that: stop and ask the user.

---

### 1. Stack & infrastructure

- **Frontend:** React + Vite → Cloudflare Pages. **Backend:** Cloudflare Functions (`functions/api/*.js`) proxy Circle API (key server-side).
- **Wallet:** a Circle **User-Controlled Wallet** (MPC EOA, signing with a **PIN** through `@circle-fin/w3s-pw-web-sdk`, lazy-loaded - see the gotcha in section 7).
- **Chain:** Arc Testnet · chainId `5042002` · RPC `https://rpc.testnet.arc.network` · Explorer `explorer.testnet.arc.io` (moved from `testnet.arcscan.app` - the old host 301s WITHOUT CORS, so browser fetches to it fail; see `EXPLORER` in `src/chain.js`, fixed 2026-09-27).
- **Balances/prices:** on-chain through viem (`src/chain.js`, Multicall3 in 1 request) + CoinGecko prices (60s cache). **Swap:** the Circle Stablecoin Kit REST API (section 4). **QR:** `qrcode.react` (drawing) + `jsqr` (scanning).
- **CLAUDE'S CLOUDFLARE ACCESS (set up 08-01 - the user: "find a way to do this work for me"):** `npx wrangler login` has been run (the user clicked Allow once), and the OAuth token is stored at `<user home>\AppData\Roaming\xdg.config\.wrangler\config\default.toml` (key `oauth_token`) - ⚠️ the machine/user folder in this path changes when the project moves machines (it was `Dell`, now `MR VAN` as of 2026-09-11) - don't trust an old session's literal path, resolve it fresh with `%APPDATA%\xdg.config\.wrangler\config\default.toml`. Account `f9df99b7751b7dc3c80a22b6911c6f2b`. It works for the REST API with the header `Authorization: Bearer <oauth_token>` - the `wrangler` CLI is missing many commands (e.g. there is NO `pages domain`), so REST is the complete option.
  **✅ WHAT WORKS:** add/remove/list Pages custom domains · view + PATCH the project config (env vars, **KV bindings**) · create/write/read KV namespaces · view deployments and roll back.
  **✅ THERE IS ALSO A DEDICATED API TOKEN (created by the user 08-01, named `claude-code`)** - kept in **`.env.txt`**: `CF_API_TOKEN=` + `CF_ACCOUNT_ID=f9df99b7751b7dc3c80a22b6911c6f2b`. That token **HAS DNS Edit permission** (which the `wrangler login` token lacks) → Claude can create/edit DNS records. Usage: read those 2 lines from `.env.txt` and call REST with `Authorization: Bearer <token>`. **NEVER print the token into chat/logs, NEVER commit it** (`.env.txt` is on line 5 of `.gitignore` - verified with `git check-ignore`, and it has never been committed). If the token breaks or leaks, the user can kill it instantly at My Profile → API Tokens → Roll/Delete.
  **Worth remembering when reading the Pages config through the API:** environment variables returned as `type=secret_text` **have no `value`** - that is Cloudflare encrypting and hiding them, **NOT an empty variable**. `API_KEY`/`KIT_KEY`/`VITE_CIRCLE_APP_ID` are all in that state (verified 08-01), so do not panic and re-set them.
- **Domain (07-29):** `ezwallet.cash` (bought on Cloudflare → the zone is already in the same account) attached to the Pages project `ezwallet` through **Workers & Pages → ezwallet → Custom domains**. The apex is the main link; `ezwallet.pages.dev` is NOT lost (Pages always keeps its original subdomain) so old links still work. **The code hardcodes no domain** - Login/Circle use `window.location.origin` and `manifest.json` uses `start_url: "/"` → changing domain needs no code change. ⚠️ **When Google login comes back (roadmap section 4): the origin `https://ezwallet.cash` MUST be added to the redirect-URI allowlist in Circle Console + Authorized origins in Google Cloud Console**, or error 155140 follows (per the Circle docs: `redirectUri` only exists in the SOCIAL login flow; the email+PIN flow in use needs no domain declaration - checked in the docs 07-29).
- **Secrets** (`.env.txt` + `.dev.vars`, both gitignored, set in the Cloudflare Dashboard): `API_KEY` (Circle W3S), `KIT_KEY` (Stablecoin Kit). **Hardcoded IDs** (not secrets): APP_ID `518fec6a-4680-5175-9de6-0810fb3dfd04`, GOOGLE_CLIENT_ID `51031114717-...googleusercontent.com`.
- **Local dev (Windows - do NOT use `wrangler pages dev`, it fails with "write EOF"):** Terminal 1 `node dev-server.js` (proxy on 8787, importing `functions/api/*` directly) + Terminal 2 `npm run dev` (Vite 5173). ⚠️ **The Circle SDK does NOT run on localhost** → the PIN/login/swap flows can only be tested on a deploy.
- **MOCK MODE - `npm run mock` (for checking UI/flow locally, with NO Circle):** `src/mock.js` + the `VITE_MOCK=1` flag. Skips Login/PIN → straight into HomeSend with a fake wallet and fake balances (`MOCK_AMOUNTS`); intercepts `/api/*` + ArcScan with fake data; Send/Swap pretend to succeed. It NEVER reaches production. **Verify the UI with Playwright at 390×844 AND 375×812 on the mock** (lesson 07-23: measuring only 390 misses overflow bugs). ⚠️ CORRECTED 2026-09-11: Playwright IS installed (`node_modules/playwright`, installed via `npm i --no-save playwright` per **READ FIRST §3**) and `tools/figma-check.mjs` IS committed in the repo - the old external `C:\tmp\ezw-verify` harness this line used to point at no longer exists. If `node_modules/playwright` is ever missing, just `npm i --no-save playwright && npx playwright install chromium`.

**Tokens on Arc Testnet:**
| Token | Address | Dec | CoinGecko |
|---|---|---|---|
| USDC | `0x3600000000000000000000000000000000000000` | 6 | `usd-coin` |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | 6 | `euro-coin` |
| cirBTC | `0xf0c4a4ce82a5746abaad9425360ab04fbba432bf` | 8 | `bitcoin` |

**Arc contracts (predeployed, the precompile preserves msg.sender):**
| Contract | Address | Used for |
|---|---|---|
| Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` | sending money with a note (the Memo event) |
| Multicall3From | `0x522fAf9A91c41c443c66765030741e4AaCe147D0` | batching approve+swap into 1 tx / 1 PIN (from an EOA, allowFailure=false, NO value) |
| Swap Adapter | `0xBBD70b01a1CAbc96d5b7b129Ae1AAabdf50dd40b` | Circle's swap settlement (section 4) |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | batched balance reads (declared in `defineChain`) |

---

### 2. Money & display model (user decisions - do not misread them again)

- **Tokens ALWAYS show their REAL NAME** (USDC/EURC/cirBTC) in the token list, in history (the secondary line) and on receipts.
- **"Display money"** = a conversion layer over fetched rates (NOT a real swap): `ez_currency` ∈ {USDC, EURC}, defaulting to USDC. Symbols USDC→`$`, EURC→`€`. **The conversion base is USD, with USDC pinned to $1** (`getDisplayRates()` returns USD per unit; `displayNum(usd,cur,rates)=usd/rate[cur]`).
- **The Send screen takes input in "USD"** (the friendly label) = sending USDC 1:1; the real token is chosen through the chip.
- **Money is formatted as ONE STRING IN ONE STYLE:** `fmtMoney()` → `$2` / `€2` / `2 USDC`. A bold number with a regular symbol is FORBIDDEN.
- **Fee reserve:** `GAS_RESERVE_USDC = 1` - the available USDC always has 1 subtracted (Arc gas is paid in USDC).
- **The app is English + USD/EUR ONLY. Vietnamese and Chinese were REMOVED ENTIRELY on 08-25 (user decision):** `src/i18n.js` and `src/circleLocalizations.js` are deleted, all 219 `t('...')` calls became plain English strings, `npm run check-lang` and `scripts/check-lang.cjs` are gone, and the Language screen became `screens/Currency.jsx` with only the currency picker (the CNY + VND options, both already locked, were dropped with it). `SUPPORTED_CURRENCIES = ['USDC','EURC']` in `data.js` is unchanged. The VND rate/format plumbing in `chain.js` + `qr.js` + `amountHint.js` is **deliberately left in place** but is now unreachable (nothing can select VND) - see the dead-code note in `HANDOFF-LOG.md`'s 08-25 session table.
  - **Why VND was switched off first (a real bug, 08-12):** `QRScanner.parseQR()` defaulted to `currency: 'VND'` for a QR with no currency (a bare `0x` address / a link missing `&cur`). While VND was locked, `SendAmount` treated `'VND'` as "unknown" → it fell back to USD, so it was harmless. Enabling VND on 08-04 made that string valid → **scanning a QR in an English/USD app opened the amount screen in VND**. The default is now `'USD'`, and that is still the case after the i18n removal.

---

### 3. Features (final state - ✅ genuinely working / verified on-chain or on a deploy)

- **Email login → wallet creation** (userId=email, authMode PIN) + security questions. **Wallet unlock:** reopening the app → `PinGate` opens the Circle PIN automatically (signing an empty message, no gas). Google login is **hidden from the UI** (the plumbing is kept, including the `cookies-next` dependency + `refreshSocialToken`). Email OTP is built but **PERMANENTLY OFF because of a Circle constraint (user decision 07-29): Circle only allows a PIN with the plain `userId=email` flow; Email-OTP/SSO users have NO PIN** (see section 7) → enabling OTP means losing the PIN, which means losing the core UX. **Do NOT propose "turn on Email OTP" as the answer to anything again** (`EMAIL_OTP_ENABLED=false`).
- **BACKUP of contacts + the QR library to Cloudflare KV (07-29):** `functions/api/sync.js` + `src/sync.js`. localStorage is STILL the source of truth; KV is only a copy against losing data on a new machine / cleared cache / a domain change. Pulled once at app start (`App.jsx`), pushed after each edit (1.5s debounce). **Merging = THE MOST RECENT EDIT WINS** by the `ez_sync_at_<addr>` stamp (union is not used, because union means a DELETE never sticks). **The KV key is the WALLET ADDRESS, which the server obtains itself by asking Circle `GET /wallets` with the userToken - the client's claim is NOT trusted**. **AVATARS NEVER REACH THE SERVER** (the server whitelists fields: contacts carry only `id/name/address`); on pull, the pictures already on the device are kept by `id`. With no KV binding → the API returns 503 `sync-disabled`, the client silently skips, and the app behaves as before. It needs a binding named **`EZ_SYNC`** (Workers & Pages → ezwallet → Settings → Bindings → KV namespace). Locally, `dev-server.js` has an in-RAM fake KV. Tests: `test/sync.test.mjs` (9/9, locking the invariants above).
  ✅ **THE 07-29 TECHNICAL DEBT IS PAID (08-06) - AUTH = PIN SIGNATURE.** The door is no longer a `userToken` (which anyone knowing the email could obtain). The new flow: `/api/sync` action `nonce` issues a single-use nonce (TTL 5') → `PinGate` has Circle sign the sentence `Unlock ezwallet. Nonce: <uuid>` using **the PIN entry that already happens** (NO extra step for the user) → action `session` recovers the address from the signature with **viem's `recoverMessageAddress`** (stronger than `verifyMessage`, because the client never declares an address) → a session token with TTL 24h is issued and kept in `sessionStorage.ez_sync_token`. `pull`/`push` carry that token. **The server no longer calls Circle on the sync path** (there is a test locking that). The KV key is still `bak:<addr>` ⇒ data backed up by the old version reads back intact. **SAFETY CHECK:** `session` also returns `address`, and the client compares it with `ez_wallet_addr`; a mismatch → throw the token away and disable backup for that session (better OFF than writing to the wrong key). Tests: `test/sync.test.mjs` 15/15.
- **Sending** USDC/EURC/cirBTC (`send.js`): a plain transfer, or through the Memo contract when there is a note (UTF-8 fine). `idempotencyKey` prevents duplicate sends.
- **Swap** USDC↔EURC↔cirBTC - ENABLED, eth_simulateV1 verification passed + **the user tested it with REAL MONEY on a deploy (07-18)**. The Swap screen = a % slider (5 marks 0/25/50/75/100, magnet ±2%) + round-number chips (`roundHint.js`, tests `node test/roundHint.test.mjs` **26/26**). **The suggestion rule - user decision 08-13 (third revision, do not revert):** `value ≥ 30` → step **1 (whole units)** · `3 ≤ value < 30` → step **0.5** · `value < 3` → shrink with the magnitude. Take the **NEAREST** multiple as the centre + one step each side.
  ⇒ 9,15 → 8,5·9·9,5 · 17,3 → 17·17,5·18 · 101,3 → 100·101·102 · 0,0083 → 0,008·0,0085·0,009
  **Both earlier versions were WRONG, do not go back:** 07-17e pinned a 0.5 step for every value → 39,000 suggested "39,000.5". 08-04 used `u = 0.5 × 10^floor(log10(value))` → the step **jumped 10x right at the value 10** (9.99 stepped by 0.5 while 10.0 stepped by 5) ⇒ dragging to 14.55 suggested "10·15·20", reported by the user 08-13. **Lesson: a step tied to powers of 10 gives one tier per decade - far too coarse.** This version has exactly ONE jump (0.5 → 1 at 30) and it doubles rather than multiplying by ten.
  ⚠️ The `< 3` branch MUST STAY: cirBTC amounts are thousandths, and a pinned 0.5 step rounds the centre to 0 → everything is filtered out (`v > 0`) → an EMPTY chip row.
  ⚠️ **Lesson 08-13:** the 08-04 commit changed `roundHint.js` but **forgot `test/roundHint.test.mjs`** → 5 cases stayed on the old spec and `npm test` was red for 9 days while the app was correct; once you are used to red, the test stops warning you. Re-synced on 08-13. **Next time `roundHint.js` changes, change the test IN THE SAME COMMIT.**
- **SERVICE HUB (08-12)** - `src/screens/ServiceHub.jsx`, **NavBar tab 1** (icon `hub`, label "Services"), replacing the old Swap tab. A 2-column grid of raised SQUARE tiles in a grey box, geometry copied from the QR Storage screen. The service list is the `SERVICES` array in that file; adding a service = adding one line:
  - **Swap** → opens the `Swap` screen (that screen's content is unchanged).
  - **Piggy Bank** · **LuckyPot** (renamed from "Dollar-Cost Averaging" on 08-25, icon `icon/luckypot.svg`) → `screen: null` ⇒ the tile dims itself to 0.4 and is `disabled`. Not built yet.
  - ⚠️ **The Swap screen has no tab of its own any more** ⇒ its row 10 is **the word "Exit" in red, bold and centred** (NOT a pill button - user fix 08-13: the first version used a huge red `.btn-error` gradient that looked heavy and fought with the blue gradient Swap button above it). The touch area covers the whole row so older users can hit it. **Do NOT use the `.row10-single` class**: that class is `position:absolute; top:85dvh` = centred at **90dvh (the row 9 position)**, and Swap's row 9 already holds the "Swap" button → they would end up stuck together. It must be `gridRow 10` (centre 95dvh = exactly the band the NavBar vacated).
  - **Text/icon sizes in the hub - SETTLED AFTER 2 MISSES (user 08-13), do not push back to either extreme:** `icon 48 + text --fs-item 17` = the user called it **"too small"** → `icon 64 + text --fs-title 30` = **"too big"** → **SETTLED IN BETWEEN: `icon 56` + text `--fs-md-lg` 21** (= exactly the app's button text size, and these tiles are buttons). At that size "Piggy Bank" fits 2 lines and "LuckyPot" 1.
  - **Tiles are NOT forced square** (`aspectRatio:1`) - a tile comes out ~160×150 (near-square on a phone), but on the narrowest column (Android 360 → 145px) 150px of content is still taller than the column; forcing a square overflows the text, and `aspectRatio` does NOT grow with content. Use **`gridAutoRows:'1fr'`** so rows are equal height (left alone, the 3 tiles came out 147/180/213, badly uneven); leave `alignItems` at its default `stretch`, do not set `'start'`. The grey box has **`marginBottom:'2dvh'`** = the gap before the NavBar (the user reported it touching the navbar), matching the bottom-gap rule on every other screen. Measured with Playwright at 4 screen sizes: 3 tiles of equal height, no overflow of the tile, the box or the screen.
  - The **Service Hub entry in MenuScreen**: unlocked 08-12 → **REMOVED ENTIRELY 08-13** (user decision). It is already navbar tab 1, and a second door in the Menu means two ways into one place - redundant for everyday users. The Menu is back to **4 entries in rows 4-7 + Sign out in row 8** (exactly the pre-07-31 layout), with row 9 left empty as the gap before the NavBar.
- **On-chain balances + live rates** are cached (`_balCache`/`_ratesCache`) - switching screens shows the previous number immediately while a background fetch updates it.
- **TxHistory** (ArcScan + the memo event, a grey box, grouped by day), **Contacts** (per account, avatar cropper, a grey box), **QR** (create/scan/library), **in-app notifications** (NotifArea), **receipts** (canvas → Photos through Web Share), a per-account store (`store.js`).
- **Change PIN** (email users): `PUT /v1/w3s/user/pin` ✅. **`refreshSession()`** is called BEFORE any PIN action (a userToken lives 60').
- **DELETED 07-18 (dead code cleanup):** the `Onboarding` + `ComingSoon` screens (nothing had navigated to them for a long time - retrieve them from git history if needed), ~30 orphaned CSS classes (modal-*, pin-dot*, text-*, token-item…), and the `ez_onboarded` key.
- **AUDIT + CLEANUP ROUND 2 - 07-29** (audit scripts outside the repo: `C:\tmp\ezw-verify\audit*.mjs` - the import graph, orphaned exports, orphaned CSS classes/variables, icons, i18n, localStorage, dependencies). **Deleted:** 3 span classes `.row-2-3/.row-3-4/.row-3-6` · 4 CSS variables `--font-title/--fs-huge/--fs-sub/--is-title` · a redundant `import React` (Login.jsx - the automatic JSX transform makes it unnecessary) · the `shortenAddr` function (HomeReceive, dead since 07-19) · `fmtAmount` (chain.js) · **37 dead EN i18n keys** (the deleted ComingSoon screen, the "Swap coming soon" string, old hints, a duplicate key with a trailing space). **Icons:** 7 icons that no screen renders had their **import removed from `Icon.jsx`** (~2.9KB of raw SVG left the bundle) - `back · facebook · google · hint · left · right · swap` - **the .svg FILES ARE KEPT in `icon/`** (the user's drawings); to use one again, add an import line + a name to `ICONS`. (`dca` joined that list on 08-25 when the tile became LuckyPot.)
  **Icons added 08-12:** `exchange · pig · dca` (from the library at `D:\Files\Claude\Icons`) for the Service Hub, plus `luckypot` on 08-25. ⚠️ Those files use a **200×200 viewBox** while every other icon is 100×100 - **DELIBERATE, the user drew them at double size because they render LARGE** (so relatively thinner strokes are the intent). **Do NOT "normalise" them to 100×100 or double the `stroke-width`.** Normalising on import into the repo means only: `width/height` → `100%`, `stroke/fill="black"` → `currentColor`. ⚠️ `luckypot` is the exception: it is a FULL-COLOUR drawing (yellow #FFCC00 + green #16A34A + black outline) kept as drawn, so the `color` prop has no effect on it. The `trade` icon is STILL used (the reverse button on the Swap screen) even though the navbar dropped it.
  **DELIBERATELY KEPT (do not "clean" these, they are NOT junk):** the Google login plumbing (`refreshSocialToken`, `cookies-next`, the `ez_login_method` key, the `googleErr` state) - roadmap section 4 will bring it back · `design/logo-icon.svg` (held in reserve) · `public/tokens/*.png` (loaded DYNAMICALLY through `/tokens/${sym}.png` - a static scanner reporting them as "unused" is WRONG) · `.row-4`…`.row-7` (MenuScreen builds `` `row-${i+4}` `` at runtime) · internal-use exports in `_swapCore.js`/`chain.js`/`data.js` (do not touch the money path for cosmetic reasons). (The i18n entries that used to be listed here - `getLang/setLang`, the ZH map - no longer exist: the whole layer was removed 08-25.)
  **Verification after the cleanup:** `npm test` 17/17 · `npm run build` OK · a Playwright mock run through ALL 14 screens, counting the `<svg>` elements per screen to catch missing icons, with **0 console errors**.

---

### 4. Swap - how it works (⚠️ real money, read carefully)

> 🟢 **STATUS 2026-08-25: SWAP IS BACK UP** - the user tested it live on a deploy ("test swap rồi, êm" = tested, smooth) and it went through with no `331001`. The Circle/LI.FI-side routing outage described below (2026-08-13 → 2026-08-25) resolved itself; nobody touched `swap.js`/`_swapCore.js`/`circle.js` to fix it. The user had already drafted questions for Circle support and sent them during the outage - no reply needed any more, the issue is moot.
> **History, kept for the next outage (the same 331001 error may return):**
> 🔴 STATUS 2026-08-13: SWAP WAS DOWN - `No route available` (331001), AN ERROR ON THE CIRCLE/LI.FI SIDE, NOT IN OUR CODE.
> Measured on production: **every pair, every amount returned 331001** - 0.01 / 0.1 / 0.5 / 1 / 10 EURC→USDC · 10 USDC→EURC · 10 USDC→cirBTC.
> **The reasoning (reusable next time):** if it were about *amounts being too small*, large amounts would work → it is not that. If it were *our code*, the real-money swap on 07-18 would not have worked → not that either. `331001` is LI.FI's **ROUTING** code (LI.FI being the router underneath the Circle Stablecoin Kit), meaning **it cannot find a swap route on Arc Testnet** - most likely the testnet pools were drained of liquidity, and they were refilled/re-routed by 08-25.
> The 3 core swap files (`swap.js` · `_swapCore.js` · `circle.js`) **have not been touched since 05-08**. The 08-12/08-13 changes in `Swap.jsx` only replaced the NavBar with the Exit text - no logic was touched.
> **If `331001` returns:** re-measure the 3 pairs above first with `verify-swap.mjs` (eth_simulateV1, costs nothing) before touching any code - all 3 failing again means it is on Circle's side, same as before.


**The flow (`functions/api/_swapCore.js` - the core shared by swap.js + dev-server):**
1. `POST https://api.circle.com/v1/stablecoinKits/swap` (Bearer `KIT_KEY`) → returns **a SIGNED INTENT**. ⚠️ `amount` = **AN INTEGER IN BASE UNITS** (a decimal → 400; too small → 422 `331001` "No route").
2. Submit the intent to the **Swap Adapter**: `execute(executionParams, tokenInputs, signature)` with `approve(tokenIn→adapter)` first, batching `[approve, execute]` through **Multicall3From = 1 PIN**. The ABI is copied verbatim from the SDK source; encoding uses **viem** (nested tuples with dynamic bytes - hand-rolling offsets is easy to get wrong, and wrong means lost money).
3. The adapter pulls the tokens in, runs the route (a third-party provider - measured as `lifi`), and **COLLECTS the output, crediting the wallet** (settlement).

**⚠️ DO NOT REPEAT THE OLD MISTAKE:** do NOT unpack `instructions[]` and run them by hand - that skips settlement → the output is **STRANDED IN THE ADAPTER, MONEY LOST** (while the tx still reports status=1). Every swap change MUST be verified with `node verify-swap.mjs <wallet> EURC USDC 2` (eth_simulateV1, costs nothing) - ship only when the tokenOut balance rises correctly. Tip: the simulation needs a wallet with a balance → take any holder from the ArcScan API `/api/v2/tokens/<addr>/holders` (simulation needs no key).

**THE 0.1% APP FEE (user decision 07-23):** `_swapCore.js` sends `config.customFee = { percentageBps: FEE_BPS=10, recipientAddress: FEE_RECIPIENT=0xEb2D222d28F35fE7BeB5387f8Bc4eBF65f2652F6 }` in the `/v1/stablecoinKits/swap` body (the official field - dissected from the source of `@circle-fin/provider-stablecoin-service-swap`, whose schema accepts `percentageBps` 1..10000 OR `amount` in base units, plus `recipientAddress`; the receiving address is public, not a secret). How it works: the fee is taken from the **INPUT TOKEN** and Circle's adapter contract forwards it to the recipient inside the swap tx (NO contract of ours is deployed); the returned `estimatedAmount` is **ALREADY NET OF THE FEE** → the "You receive" UI needed no change. Verified by simulation 07-23: swapping 2 EURC→USDC, the fee wallet gained +0.002 EURC (exactly 0.1%) and the user received what the estimate promised. `simulateSwap` now measures the FEE_RECIPIENT balances too (calls[1,2,5,6]), and verify-swap.mjs prints an "App fee" line. ⚠️ Per Circle's docs, Circle keeps 10% of a custom fee (90% to the wallet) - the testnet simulation showed 100% arriving, so MEASURE AGAIN ON MAINNET.

---

### 5. Design System (`src/index.css` :root) - ⚠️ PARTLY SUPERSEDED

> ⚠️ **Written before the 2026-09-10 Figma rebuild.** Barlow, the gradients, `#F2F2F7`/`#636366`, the
> straight-down drop shadow, the blue-bordered hint block and the "white + grey border = tappable" rule
> have all since changed. Where this section and **READ FIRST §5** disagree, READ FIRST wins - and where
> both are silent, the Figma render decides. Kept for the reasoning behind each older decision.

**Font: ONE FONT ONLY = BARLOW** across the app (all 4 `--font-*` variables point at Barlow, keeping the old names so the JSX needs no edits). Weights loaded: `300;400;500;600`.
**Weights:** `--fw-light 300` = large HERO NUMBERS (balances, amounts - user decision 07-17f: KEEP Light, do not bold them) · `400` body · `500` buttons/items/labels/important values · `600` titles + active. **NEVER 700** (`--fw-bold` is locked at 600).
**Font sizes + THE NAMES THE USER USES:** amount 52 · huge 38 ("extra large", the number on the Swap screen) · title 30 ("large") · num 24 · md-lg 21 ("medium-large" = BUTTONS + the slogan + typed text) · body 19 ("medium" = content + the NAVBAR) · item 17 ("medium-small") · label 15 ("small") · tiny 13 ("mini"). When the user names a size, look it up here.
**Icons:** the `--is-*` scale pairs 1-to-1 with `--fs-*` - an icon beside text uses that text's size. Only icons STANDING ALONE use hardcoded numbers (the SendReceipt check at 76, the Contacts avatar, the QR delete button, the Swap reverse button, the numpad erase key). New icons MUST use `width/height="100%"` + `stroke="currentColor"`.

**Gradients (user decision 07-17d, vertical, lighter on top → darker at the bottom, both ends fully opaque - 0%/100% are STOP POSITIONS, do not describe them as "0% at the top", it implies a pale colour):**
- Brand: `#0088FF → #0B53BF` (the background of `.btn-primary` + `.action-card.primary`)
- Green `#34C759 → #16A34A` (`.btn-success`) · Red `#FF4D51 → #DC2626` (`.btn-error`) · Yellow `#FFCC00 → #F59E0B` (the token is kept, the btn-warning class was dropped as unused - if it returns, BLACK TEXT)
- **THE DROP SHADOW ON TAPPABLE BUTTONS (user decision 07-22d - final):** a **STRAIGHT-DOWN** shadow (offset-x 0, cast vertically) `box-shadow: 0 4px 6px rgba(0,0,0,ALPHA)` - **MEDIUM, NO SPREAD** (a small 6px blur), and BLACK (do not tint it to the button colour). **The ALPHA differs so they LOOK EQUAL (user decision 07-22g): GRADIENT buttons `.35`, WHITE buttons/chips `.25`** - a gradient button's dark fill "swallows" a black shadow, so it has to be deeper to look like the white one. Applied to: `.btn-primary/.btn-success/.btn-error/.btn-secondary` + `.action-card` + `.action-card.primary` (classes), AND **every inline tappable pill button/chip** (user decision 07-22f "every button gets a shadow so an older person understands"): the Swap token chips (`TokenRow`), "Hold to show tokens" (HomeSend), the copy-address button (HomeReceive), the currency chip (Currency screen). Do not tint it, do not increase the blur. **The white pill buttons "Hold to show tokens" + copy address use BLACK text (07-22f, previously muted).**
- **A BUTTON STANDING ALONE = 3/4 OF THE SCREEN WIDTH (user decision 07-29 - "make every lone button the same size for consistency"):** `width: min(75vw, calc(var(--screen-max) * 0.75))` (anchored to .screen, NOT a % - the parent frame is inset 20px, so a % gives a different number on every screen). Applied to: "Hold to show tokens" (HomeSend), "Tap to copy your wallet address" (HomeReceive), **the Swap button** (previously 66.67%). **Plus `.row10-single .btn` (index.css) changed from 66.67% → 3/4** (user decision 07-29, covering About/Currency/Security) **plus the Reload button on the ErrorBoundary screen**. Measured with Playwright 07-29: EVERY lone button = **293px @390 · 281px @375**, all equal; the `.row10-single` centre is still exactly 90dvh. The `.row10-dual` button pairs (44% each) are UNCHANGED - this rule is only for buttons standing ALONE. **A DELIBERATE exception: the "Sign in with Email" button on Login stays at 80%** - it matches the width of the slogan line above it (also 80%), and dropping it to 75% breaks that pairing; do not "harmonise" it by mistake.
  - ⛔ **REVERSED ON 08-13 FOR EXACTLY 2 WHITE PILL BUTTONS** (the user: *"I slightly regret making it this big"*): **"Hold to show tokens"** (HomeSend) and **"Tap to copy your wallet address"** (HomeReceive) **dropped the 3/4 width and now HUG THEIR TEXT** - `padding: '0 18px'` + `maxWidth` + `overflow/textOverflow` as the safety net. Measured button/text ratios of **1.26×** and **1.16×** (matching the user's "if the text is 50, the button is 60"). ⚠️ Those 2 buttons USED TO be deliberately equal ("a PAIR" at the same 55% coordinate on the two tabs) - **they are now DELIBERATELY unequal because the two sentences differ in length, so do not "even them up"**. ⚠️ Safe against the old 07-29 bug (text wrapping on older iPhones once the width was fluid) because both already carry `whiteSpace:'nowrap'`. The 3/4 rule STILL HOLDS for the remaining lone buttons (the Swap button, `.row10-single`, Reload).
- **Buttons in a `.row10-dual` pair are PLAIN TEXT, NO icon** (user decision 07-29: the "Add" button on Contacts used to carry the `add` icon → out of step with every other Back/<action> pair in the app).
- **The `down2` dropdown arrow uses `--color-brand`** (user decision 07-22c, previously muted): the Swap token chip (`TokenRow`) + the currency chip on Send (`SendAmount`) + the currency chip on the Currency screen (07-22f).

**Semantic colours:**
| Meaning | Token | Hex |
|---|---|---|
| Brand (CTAs, active nav, action/leading icons, SENDING) | `--color-brand`/`--color-info` | `#0B53BF` (+soft `#E2EAF7`) |
| Received/PNL/success | `--color-primary` | `#16A34A` (+soft `#DCFCE7`) |
| Money lost/errors | `--color-error` | `#DC2626` (+soft `#FEE2E2`) |
| Warning/hint | `--color-warning` | `#F59E0B` (+soft `#FEF3C7`) |
| Secondary text (DARK GREY, 6.0:1, passes AA) | `--color-muted` | `#636366` |
| Borders/dividers (NEVER a fill, NEVER a text colour) | `--color-gray` | `#E5E5EA` |
| **BOX/CARD FILL** | `--color-surface` | `#F2F2F7` |

**THE BOX RULES (the soul of the design - the standard comes from the Swap screen):**
- **Separate blocks with a surface FILL + border:none + radius 20 (large cards) / 8-12 (chips, input fields)** - never a grey border on white.
- **A TAPPABLE element INSIDE a grey box → WHITE + a 1.5px GREY BORDER** (the Swap token chips, the Hold button, the currency chip, the Contacts avatar placeholder...). The text inside still follows its role (Hold = muted).
- Grey boxes currently cover: the 2 cards on Swap (Fee/Rate has been bare text with NO box since 07-20) · the token area on HomeSend (rows 3→5.5, `height calc(100%+5dvh)`) · the Contacts/TxHistory lists (rows 2-8) · **SavedQRList (rows 2-8, 07-23): a 2-COLUMN grid (3 columns made the QRs too small), each QR a WHITE box with a 1.5 grey border, radius 16, a .25 drop shadow and a delete X top-right; the grey box has padding 10 + gap 10 (white boxes exactly 10px from the grey edge), and the QR SCALES with the box (svg width 100%, height AUTO - the viewBox keeps it square; forcing height 100%/aspectRatio was 3px off, and a hardcoded 104 frame distorted it) + the name at fs-item 17 + the amount at fs-label 15. ⚠️ 3 LESSONS: (1) do NOT use .scroll-thin INSIDE a grey box (its margin-right -20 overflows to the right - desktop compensates with scrollbar-gutter so it looks fine, iOS does NOT → broken; use .scroll-hidden); (2) layout verification must ALSO measure 375px, not only 390; (3) grid columns MUST be `minmax(0,1fr)` and the "+" tile must NOT use aspectRatio (bug 07-23c: 3 QRs → row 2 = [QR | +], and the + button's aspectRatio was stretched to the QR box height → INFLATED SIDEWAYS → the 2 columns went badly uneven; grid tests must test an ODD number of items).** · Currency (2-3) · Security (2-4) · About (2-8) · every input field (`.address-input`, `.memo-row`; errors = a red inset shadow).
- **Real NOTIFICATIONS** (received/sent/error) = **a pale coloured fill with NO border and BLACK text** (received green, sent blue, error red). **HINTS ARE COMPLETELY DIFFERENT (user decision 07-22d - THE APP-WIDE HINT STANDARD):** a **WHITE background + a 1.5px brand BLUE border + brand BLUE text/icons** (matching the amount chips on Swap). It applies to EVERY hint: the `HintBlock` (NotifArea on Home), the email + domain chips on EnterEmail, and the round-number chips + the "Slide to adjust…" hint on Swap. **NO yellow background, NO lightbulb icon** (user decision 07-22e: `hint.svg` was dropped so hints all look alike - border + text only). The Home hint block format: each line is `Label: desc`, the label is medium weight and TAPPABLE (going to the button of the same name in row 9), and long sentences wrap. **HINT FONT SIZE = `--fs-item` 17 FIXED across the app (user decision 07-22e: the sign-in chip was 21px and came down to 17 to match the Home/Swap hints) - never let a hint be bigger. CORNER RADIUS: hint chips are PILLS `borderRadius 999` (Swap/EnterEmail); the multi-line Home hint block is `12` (user decision 07-22g: the sign-in chip at radius 10 looked square and was changed to a pill).**
- **THE "TAPPABLE" SIGNAL = A WHITE FILL + A 1.5px GREY BORDER** (user decision 07-21 - a `--color-surface` grey fill reads as "recessed / not tappable"). Applied to: the secondary `.action-card`s (Contacts/Paste/QR Storage/Share; the `.primary` cards Scan QR/Create QR stay gradient with `border:none`) · the AMOUNT field on the "You pay" card on Swap (the "You receive" card stays bare - an output is not an input) · the email + domain chips on EnterEmail. Text input fields (`.address-input`) keep the surface fill - they are real inputs with a caret/placeholder, so there is no confusion.
- An ACTIVE toggle/filter = a white fill + a brand border + brand text. Primary buttons take 2/3 of the width, secondary 1/2.
- NO em dashes (use `–`), NO emoji. Scrollbars: `.scroll-thin`/`.scroll-hidden`.

**LINK PREVIEW CARDS (07-29):** `public/og.png` at **1200×630** + the full set of `og:*` / `twitter:*` / `description` / `canonical` tags in `index.html`. Before that the page had no meta tags at all → pasting the link into X/Telegram/Facebook produced **an empty box**. ⚠️ The original 07-29 image (gradient background + `docs/app-home.jpg`, built from an external `C:\tmp\ezw-verify\og-card.html` template) is GONE - see the 2026-09-11 rebuild note a few lines below for the current image/template. **This is a DRAFT and the user can replace it with their own design at any time** - it only has to stay **1200×630** and keep the name `og.png`. ⚠️ `og:image` MUST be an absolute URL; X/Facebook **cache the card** → after changing the image, use their debug tools to force a re-scan, or rename the file.

**THE SLOGAN CHANGE (08-02):** the settled slogan is now **"A crypto wallet simple enough for my mom to use."** ("your grandma" / "stablecoin wallet" are gone from brand sentences - the word "stablecoin" is still used where it states a product fact). Synced across: `<title>` + `og:title` + `twitter:title` + `og:image:alt` (`index.html`) · a rebuilt `public/og.png` · `package.json` · `README.md` · `PITCH.md` (sections 1 + 8) · `DECK-DESIGN-SPEC.md` (thesis + P1 + section 3). The voice rules are settled in the **Brand Voice** section of `CLAUDE.md`. **Every em dash `—` was also changed to an en dash `–`** in everything a reader sees (html, md, package.json, .env.example); since 08-25 the code comments in `src/` and `functions/` are English too, so the same rule is easy to keep there. `og:image` was bumped to `og.png?v=2` to force X/Facebook to re-scan (they cache by URL); **when the image changes again, bump it to `?v=3`**.

**Brand assets - `design/` HOLDS EXACTLY 3 FILES, NO OTHER VERSIONS (user rule, 2026-09-11: "còn lại xóa
hết các phiên bản vớ vẩn trong repo đi"). ⚠️ The user replaced all 3 again later the same day with cleaner
re-exports of the IDENTICAL artwork (dropped via Desktop, same convention as `apple.svg` before it) - if a
future session finds different viewBox numbers than the ones below, check `git log` before assuming
drift; the user's own re-exports are expected to change these over time.**
| File | What it is | Used by |
|---|---|---|
| `design/logo.svg` | THE FULL LOGO (wordmark, viewBox **1425×406** as of the 2nd revision, Inter letterforms - confirmed by the user, do NOT re-flag it as Barlow) | Splash · Login · PinGate · ForgotPin · SendReceipt, all through `.logo-lockup` |
| `design/new-brand/icon.svg` | THE APP/FAVICON ICON, viewBox **512×512** as of the 2nd revision - fully transparent background (no `<rect>` at all, dropped even the white square the 1st revision had) - copied to `public/icon.svg`, rasterised to `public/icon.png` + `public/fav_icon.png` at 512×512 **with a white background painted in during rasterisation** (iOS handles transparent apple-touch-icons poorly - fix the PNG step, not the SVG) | `index.html` favicon + apple-touch-icon (`?v=4`), `manifest.json` |
| `design/pfp.png` | Added 2026-09-11 (dropped via Desktop) - the EZ mark alone, for social profile pictures (X etc.) | nothing (storage only, not referenced by the app) |
DELETED 2026-09-11 as stale duplicates: `design/logo-icon.svg` (the pre-redesign GRADIENT icon - the brand
is solid-colour only now) and `design/luckypot/logo-full.svg` (never imported anywhere; `LuckyPot.jsx`
renders its name as text in Space Grotesk, it has no logo file). Do not recreate either.

**README screenshots REBUILT 2026-09-11** (the user: "UI đã ổn rồi đẹp rồi, dựng lại hình ảnh... phải trực
quan và ngắn gọn") - captured fresh via Playwright in mock mode (`?screen=<Name>`), replacing the deleted
pre-redesign set. Deliberately CONCISE per that instruction: ONE 4-image grid (`docs/app-send.png` ·
`app-receive.png` · `app-swap.png` · `app-luckypot.png`), not the old 2-section layout (4 GIFs + 6 stills).
No GIFs this round - stills only, faster to keep in sync with a UI that is still actively changing.
**`public/og.png` REBUILT 2026-09-11 (user confirmed: "nền đặc" = solid background, not the old gradient).**
New template (rendered with Playwright from an inline HTML string, no more `C:\tmp\ezw-verify\...` - that
path is gone): solid `#0B53BF` fill (no gradient - matches the redesign's "no more gradients" rule),
`design/logo.svg` forced white via CSS `filter: brightness(0) invert(1)` (no separate white-logo file
exists, so every future og-card rebuild should do the same rather than hand-drawing a white variant), the
same tagline/pills/URL copy as before, and a REAL screenshot (`docs/app-send.png`, the new one) in a
rounded phone frame on the right. Bumped `og.png?v=2` → `?v=3`.

> 🎨 **Design: the user does the UI themselves, and draws the icons themselves (viewBox 100, stroke 10).** Do not redesign on your own; wait for the user's direction and then port it. The aesthetic reference: Coinbase Wallet - big light numbers, pale tiles, plenty of breathing room.

---

### 6. Layout Rules

> ⚠️ **Positions in this section predate the 2026-09-10 grid fix** (they assume 84.4px rows and the old
> 90dvh button centre). The structural reasoning still holds; the numbers do not. See **READ FIRST §1**.

- **A 10-row grid WITH A 16px GUTTER** (`.screen` grid 10×1fr + `row-gap:16px`, 100dvh, padding `0 20px`, `position:relative`) → rows are **70px**, not 84.4. Sub-screens: the title in row 1, buttons in `.row10-single`/`.row10-dual` (absolute, now row 9 = top 81.52dvh / height 8.29dvh → centre 85.66dvh, forcing `grid-row:auto`). The 4 main screens: a full-bleed NavBar in row 10, text+icons at `--fs/is-body 19`. **An UNSELECTED tab = `--color-muted-2` #8E8E93 (MID grey, user decision 07-22d - the dark grey #636366 looked dull); the SELECTED tab = black + a brand bar above it.**
- **⚠️ `.screen` MUST have `grid-template-columns: minmax(0,1fr)`** - without it a single long `nowrap` string inflates the column and skews the whole screen. **A flex item holding nowrap text MUST have `minWidth:0`.**
- **THE APP-WIDE KEYBOARD RULE (user decision 07-23, "option A" - ending the two-keyboard conflict for good):** **ENTERING MONEY = the app numpad** (large, with a dot, independent of locale) · **ENTERING TEXT = the iPhone keyboard** · **NEVER both at once.** Concretely: SendAmount + CreateQR - focusing a text field (note/QR name/note popup) → `typingText` HIDES the numpad panel, and blur brings it back. The Add QR popup (SavedQRList) - the Amount field is no longer an `<input>` (the iPhone decimal keyboard on some locales shows a `,` that the regex swallows, and it breaks the app standard) but a div that opens the app numpad SHEET (geometry identical to the Swap sheet, rendered AFTER the popup so it floats above it, and the popup is anchored to the top half so they do not overlap; tapping the field blurs the Name field first so the iPhone keyboard drops). Do not add another screen that takes money input through the system keyboard.
- **The APP-WIDE numpad is the "MID GREY" style (user decision 07-22g: `--color-surface-2` #D1D1D6, no longer the pale surface #F2F2F7 - so the white keys pop):** the panel/sheet has a `--color-surface-2` background, full-bleed from HALF OF ROW 6 → the bottom of the screen, top corners at radius 20, with WHITE key tiles at radius 12 and an 8px gap - the shared class is `.numpad-gray` (index.css). SendAmount + CreateQR: `gridRow 6/11, margin 5dvh -20px 0, padding 24px 20px 0`, numpad flex 5.5 + the button/padding area flex 3.5, with the `.row10-dual` buttons floating on the grey. Swap: a sheet overlay with the same geometry (see the Swap section), flex 5.5/0.5/2/1. **24px of grey padding on top + SHORTER keys (numpad 5.5 parts, NOT 6)** - user decision 07-20c: if the keys are too big, reduce the key height; Back/Done ALWAYS stay anchored to the row 9-10 edge, do not move them.
- **The number-field caret is a blinking BLACK `_`** (class `.caret`, colour `--color-content`, user decision 07-22c: a grey caret clashed with the black text; it covers Swap/SendAmount/CreateQR). When EMPTY = the caret ONLY, with no faint 0 drawn (user decision 07-20b on Swap): do not draw a faint 0 beside the caret ("0 is 0, _ is _"). **"You receive" with NO amount entered = COMPLETELY EMPTY (the `idle` prop, user decision 07-23)** - "…" is ONLY for "an amount was entered and the estimate is loading" (it used to show "…" while idle too, which looked like a load that never finished). **The Swap screen - AREA LAYOUT (user decision 07-20e, FINAL):** the rows 2→9 area is one flex column with `justify-content: space-between` (paddingBottom 2dvh) split into **3 BLOCKS**, with the 2 gaps AUTOMATICALLY EQUAL (the user: "the You pay/receive group is as far from the hint+slider group as that group is from the Swap button", no lopsided space): (1) You pay + ⇅ + You receive + Fee/Rate; (2) the suggestion chips + PctSlider - **the chip row MUST have a FIXED `height: 40`** (bug 07-21: an empty `hints.map` → a 0-height row → space-between dragged the whole slider group down every time a hint appeared/disappeared; reserving the space keeps the slider still while the chips merely fade). **07-23 (reversing 07-22e): the "Slide to adjust…" hint pill was REMOVED - with NO amount chosen the row stays EMPTY (still height 40) and the instruction moved ONTO THE SWAP BUTTON: it reads "Slide or tap here to enter" (text at fs-item 17 - the default 21 gets ellipsised, verified with Playwright scrollW≤clientW) and tapping it opens the numpad (openPad); with an amount, the button returns to "Swap" and the round-number chips come back.** Verify by measuring `getBoundingClientRect().top` of the track + the Swap button at pct=0 and pct=50 - they must MATCH; (3) **the Swap button = the default `.btn` PILL** (radius 50, height 6dvh - user decision 07-21, REVERSING the 07-20e "square 8dvh" because it did not match the buttons on other screens) **CONCENTRIC with the Scan QR/Create QR action-cards**: its wrapper copies the `.action-grid` geometry exactly = `height 8dvh` + `marginBottom 2dvh`, last in the `2/10` flex space-between → a band of 80→88dvh with the button centred ⇒ **its centre at 84dvh** matches the action-card. **WIDTH = 3/4 OF THE SCREEN (07-29, previously 66.67%)** - see the "lone button" rule in section 5; the vertical centre is UNCHANGED (re-measured 07-29: the Swap button cy=709 = Create QR cy=709 @390). ⚠️ Do NOT add `paddingBottom` to the parent area (the block's marginBottom already reserves 2dvh) and do not change the height/radius back. Verify: measure the `centerY` of Scan QR (Send), Create QR (Receive) and Swap - they must be EQUAL (measured at 783px for all 3). The button is still the ONLY place the Preparing/Enter PIN/Submitted/error status appears. The You pay/receive cards are flex columns with **height `calc(20dvh - 5px)` + justify-content CENTER + gap 10** (user decision 07-22f: each card 20dvh-5px, plus the 10px ⇅ gap = exactly 40dvh → the 2 cards FIT rows 2-5 precisely and Rate/Fee lands in the top half of row 6; measured with Playwright at 390×844: You pay 10→29.4dvh, You receive 30.6→50dvh, Rate/Fee 51.2→53.6dvh - do NOT exceed 40dvh or Rate/Fee is pushed out of place). Center+gap pulls the label CLOSE to the token chip. **The balance line: You pay = "Available: <amount> <token>" (balLabel="Available"), You receive = "Balance: <amount> <token>" (balLabel="Balance") - on 07-22g the user asked to KEEP Available on You pay (do not remove it). The [SYM] token chip carries the black drop shadow like every button.** The ⇅ button uses margin **-17/-17** on a 44px button → a net 10px in flow = a 10px GAP between the cards (user decision 07-22b: touching looked bad; You receive moved to 31.2→51.2dvh and Rate/Fee to 52.4→54.7dvh, still in the top half of row 6). The button bridges the gap; **the ⇅ button (user decision 07-29 - REVERSING the 07-22h pale-blue-background/dark-blue-icon version): a `--grad-brand` GRADIENT circle + a WHITE `trade` icon + a .35 drop shadow (the gradient-button standard)** - the same family as `.btn-primary`/`.action-card.primary`; the button stays 44px and the 10px gap is unchanged. *(The icon here is `trade.svg`, NOT `swap.svg` - the user calls it "the swap icon", do not edit the wrong file.)* **Fee/Rate**: one fs-item 17 line, `Rate:` aligned LEFT · `Fee:` aligned RIGHT, grey labels with BLACK figures. Card content: the label · [token chip ▼ left | THE BIG NUMBER right, with no repeated token name] · [Available left | ~$ right]; **the You pay/receive labels are `--fs-body` 19 and the secondary Available + ~$ line is `--fs-item` 17** (07-21: making them equal DESTROYED the heavy/light hierarchy), the chip logo is 32 with 19 text, and the number is base 52 shrinking to fit. **The Swap numpad:** tapping the You pay AMOUNT → a sheet slides up covering **half of row 6 → row 10** (55→100dvh): a GREY surface background + WHITE key tiles at radius 12 with an 8px gap (raised buttons), NO wasted white space on top, and a TRANSPARENT overlay (user decision: a numpad rising while the main screen dims is WRONG); inside the sheet, the numpad takes 30dvh + the Back/Done pills at 44% sit at 85-95dvh (aligned with .row10-dual) + 5dvh of padding. Typing updates the amount + pct + estimate live; Back discards what was typed, Done/tapping outside keeps it; the slider and suggestion chips are unaffected.
- **SENDING TO YOURSELF IS FORBIDDEN (user decision 07-31 - "you must not let me send money to my own wallet"):** blocked in **3 places**, because there are 3 ways into the Send screen - `PasteAddress` (a well-formed address that is your own wallet → the button does not proceed + a red message, and the clipboard is NOT read over the top of it), `QRScanner` (scanning your own receive QR → say so and keep scanning, for both the camera and picked images), and `SendAmount` (**the final guard** for the Contacts route - the user can save their own wallet as a contact; it uses `walletAddr` fetched from Circle and NOT localStorage, because a PWA may be missing the key). The shared helper is `isOwnAddress()` in `data.js`.
- **A SELF-SEND IS NOT A SWAP (bug 07-31):** a self-send transaction has `from == to` on **ONE SINGLE ROW**, and `swapHashes` only required "an out and an in" → it was labelled **"Swapped 5.00 USDC to USDC"**, so the user searching for "Sent" found nothing and thought the transaction had VANISHED. The fix: any row that is both out and in is SKIPPED (a real swap always has 2 SEPARATE ROWS), and TxRow shows **"Sent to yourself"**. The mock includes this case (`0xmockself1`) so it can be retested.
- **TxHistory MUST SORT ITSELF + DateHeader keys need an index (bug 07-31):** the list renders straight from the array, and a repeated date label meant 2 `DateHeader`s with the **same key** → React warned *"children to be duplicated and/or omitted"* = **transaction rows can be dropped**. Fixed by sorting `timeStamp` descending on the client + `key={h-<date>-<i>}`.
- **TxHistory ALWAYS shows the FULL history** (user decision 07-20, correcting the 07-19 misunderstanding: it was once cut to 24h with a usage hint → WRONG). Only NOTIFICATIONS (NotifArea) are "today's" things; history is the reconciliation ledger - never truncated, and NO hints inside it.
- **TxHistory: a swap is 2 SEPARATE ROWS, never merged** (user decision 07-20d, reversing the 07-19 merge decision - merging into "Swapped X → Y" LOST both the -X / +Y figures on the right). Each leg is a TxRow: the out leg "-$X / X EURC" (red), the in leg "+$Y / Y USDC" (green). **Both rows are titled "Swapped <outAmt> <outSym> to <inSym>"** (e.g. "Swapped 20.00 USDC to EURC" - user decision 07-20d, a bare "Swapped" told you nothing) + **the subtitle "Swap completed · At <time>"**. It needs `swapPairs` (a map hash→{outAmt,outSym,inSym}, derived from `txs` so the Sent/Received tabs still have both directions) passing `swapInfo` into TxRow. `SwapRow` + `buildDisplayList` were deleted. TxRow fonts were REDUCED to fit the screen: icon 40→34, the money on the right fs-num 24→fs-md-lg 21, token/time/note at fs-tiny 13, vertical padding 11, gap 10.
- **MERGING applies to the 2 swap NOTIFICATIONS (NotifArea), NOT to history** (the user's reminder 07-20d): one notification, `Swapped X EURC to ~Y USDC (complete)` (or `(failed)`), fired from `Swap.jsx handleSwap`; `NotifArea.pollIncoming` has its `outHashes` branch DISABLED (no separate "Swap complete·received" any more).
- **The % slider (PctSlider):** magnet snapping depends on the GESTURE (user decision 07-20d) - CLICK/TAP `SNAP_TAP = ±9%` (easy to hit a mark), DRAGGING `SNAP_DRAG = ±2%` (does not fight the drag). `pctFromEvent(e, snapZone)`: down()→SNAP_TAP, move()→SNAP_DRAG. Verified with Playwright: click@47%→50, drag→47% stays put. Mark dots are 14px, the % labels are fs-item 17 and TAPPABLE (tapping a label jumps to that mark). Markers at 0/25/50/75/100.
- **ShowQR (viewing/creating a receive QR):** the big QR = `min(30dvh,78vw)` (the same size as on the Receive screen), 3 rows tall (2-4); rows 5→8 hold the big amount at `fs-amount` light + a `fs-md-lg` caption; the Share/Back buttons are in `.row10-dual` (9-10). The title is DYNAMIC based on the `fromStorage` flag (07-20d, NOT based on whether there is a name): opening a SAVED QR from the library → `QR Storage: <name>` (unnamed → `QR Storage: Item`); a newly created QR (Receive/custom) → `Create receive QR`. SavedQRList's onClick MUST pass `name: q.name` + `fromStorage: true`. **Add-to-QR-Storage (the SavedQRList popup, retitled from "Add to library" on 07-23):** the Amount field is a div that opens the app numpad sheet (see THE KEYBOARD RULE), with a placeholder carrying the default currency symbol - `Amount (${displaySymbol(getDisplayCurrency())})` (USDC→$, EURC→€).
- **A HINT (NotifArea) is `Label: description`, with the label BOLD (medium), NO underline, and TAPPABLE** (user decision 07-21, final - underlining was tried and dropped, the bold stayed): each line is `{label, desc, onClick}`, and tapping the label goes exactly where the button of the same name in row 9 goes; long sentences MAY WRAP (no nowrap/ellipsis - only REAL notifications keep to one line with "…"). **A hint's label MUST MATCH the row 9 button's label.**
  **The settled text (do not edit it yourself):** Send - `Paste: Paste a wallet address` → PasteAddress · `Scan QR: Scan a QR code to send` → QRScanner · `Contacts: Save people you send to often` → Contacts (the hint order matches the row 9 button order left→right, user decision 07-23: Contacts is used most → it sits on the RIGHT). Receive - `QR Storage: Save your favorite QR codes` → SavedQRList · `Create QR: Create a QR to receive money` → CreateQR · `Share: Share your wallet address` → handleShare.
  ⚠️ When a real notification arrives, the hint is pushed up and fades at the top edge (by design: the hint has the lowest priority). The token box on Send STILL scrolls with many tokens (do not remove the overflow).
- **SendAmount - THE DEFAULT NOTE** (user decision 07-20e): the Send-to/amount/note group is one flex column at `gridRow 2/6` with **gap 4dvh** (07-22c: 2dvh felt cramped → opened up while staying one centred group). The note field has an **`option` icon on the RIGHT** (a 52×52 button with a surface background) → a "Set your default note" popup (an input reading "Type here", Back/Save), stored in `localStorage ez_default_note`. The memo initialises to the default note → shown as a real VALUE (not a faded placeholder); **tapping the note field for the first time (onFocus) while it holds the default note CLEARS it for fresh typing** (`noteTouched` prevents it being cleared again). Every send then carries the default note in its memo.
- **CreateQR MATCHES SendAmount's GEOMETRY (user decision 07-23 "two screens with the same job must look the same"):** the same gridRow 2/6 flex column with gap 4dvh - line 1 "Amount to receive" (where "Send to: X" sits, BLACK medium text at fs-md-lg) · line 2 the amount + the [USD] chip copied verbatim from Send (chip fs-md-lg + a brand arrow) · line 3 the QR name field (fromLibrary) or **a placeholder of height 52** - without that third row, justify-center drags the whole group 43px down and the two screens no longer line up. Verify: measure the top of the label/caret/chip on both screens. ⚠️ UPDATED 08-25: they no longer match EXACTLY. The Send screen gained a `Balance:` line above `Send to:` (user request), which makes its centred block taller, so its amount/caret now sits **~15px higher** than CreateQR's (measured 229 vs 214 @390×844; the same ~15-16px at 375 and 360). The structure, the gaps and the 3-row rule are unchanged - only that one offset. Do NOT "fix" it by padding CreateQR: the two screens legitimately carry a different number of lines now.
- **The BIG balance in BalanceHeader** (user decision 07-20e, filling the empty space): `amountFontSize(str, 76, 7, 40)` - base 76px (previously fs-amount 52), shrinking with length (7 characters fit exactly, longer shrinks, floor 40), plus `whiteSpace nowrap` + padding 12 so a large number still fits the width. Shared by HomeSend/HomeReceive/MenuScreen.
- **The ShowQR title = `QR: <name>`** (user decision 07-20e, dropping the word "Storage" for compactness - long names need the room); an unnamed QR → `QR: Item`; a new one → `Create receive QR`.
- **SavedQRList row 9 = `.row10-dual`: [Back WHITE] + [Add BLUE]** (user decision 07-29, replacing the old `.row10-single` blue Back). Add opens the exact "Add to QR Storage" popup that the "+" tile in the grid opens (`setAdding(true)`) - adding a QR is the screen's main action, so the user should not have to scroll to find the "+".
- **Deleting a QR in SavedQRList uses a CONFIRM POPUP** (user decision 07-20e, guarding against mis-taps): tapping × → a `Delete QR: <name>` popup (unnamed → the amount) + [Back][Confirm in red], never an instant delete. The standard popup, centred over rows 1-6.
- **The `right2` chevron (a row that goes somewhere) uses `--color-brand`** (07-20, previously `--color-faint`, which read as disabled); `--color-faint` is now only for placeholders/hidden icons. The standard text field is height 52 + `--fs-md-lg` (email/memo/paste address are all aligned).
- **Text inputs live in rows 1-4, or in a popup anchored to the top half** (`.popup-card` centred at 30dvh) - the iPhone keyboard covers the bottom half. No autoFocus inside a popup. **Page scrolling is pinned** (an `App.jsx` listener) - DO NOT remove it.
- **The 55dvh position = "the secondary line in the middle of the screen"**, shared: the Hold-to-show button (Send) and the address+copy line (Receive) are absolutely positioned at top 55% → switching tabs, nothing jumps. The QR on Receive = `min(30dvh, 78vw)`, occupying rows 3-6.
- **HomeSend:** rows 1-2 the balance · 3-5.5 the token box · 7-8 NotifArea · 9 the 3 action-cards (left→right **Paste · Scan QR · Contacts**, user decision 07-23) · 10 the NavBar. **QRScanner (07-29):** row 1 = the TITLE "Scan QR" (consistent with every sub-screen - this screen used to have no title and the scan box took row 1 as well); the scan box + 2 caption lines moved down to be centred on **rows 2-7**; the right (blue) button is **"Done" and NOT "Back"** (user decision 07-29: a blue button is the primary/finishing action, and "Back" on a blue button reads as the wrong role - Back is always the secondary WHITE button).
- **SendReceipt (07-23):** the confirm box + the receipt canvas carry an **Address row with the SHORTENED address `0x1234…5678`** (user decision: NOT the full one - long and ugly), and it is **shown ONLY when Send to is a contact NAME** (without a name, Send to is already the shortened address, so repeating it is redundant). The canvas is `H = 590 + 60·(has Address) + 60·(has Note)` - the bottom of the last row + **50px of breathing space + the logo + a 22 margin** (the logo used to touch the last row's divider - do not let that return).
- **A TxHistory row:** on the left `[icon] Sent/Received` + the time + [Add to Contacts] + the Note; on the right `±$` (red/green) + the real token in grey. **NO grey separator lines** in lists/boxes (except the NavBar + the Rate/Fee row).
- **`<button>/<input>` must inherit the font** - there is a global `font-family: inherit` rule, do not remove it.

---

### 7. Circle/Arc gotchas (hard-won - keep forever)

**Circle W3S:**
- **The PIN screen is a `pw-auth.circle.com` iframe (cross-origin):** its UI structure cannot be changed, and **the numeric keyboard CANNOT be opened automatically** (browsers forbid cross-origin focus, and iOS requires a direct tap - the user already asked, do NOT dig it up again). **The iframe also CANNOT be closed sooner after the PIN is entered** (the user asked 07-20): the SDK already removes the iframe IMMEDIATELY on the `onComplete` message (read the `messageHandler` source); the 1-3s "pause" after typing is Circle's spinner processing the challenge inside the iframe. Removing the iframe before the challenge settles loses the signature (the root cause of the old PIN bug) - DO NOT do it.
- **⚠️ HISTORICAL (08-04, no longer in the code): Vietnamese was once enabled for the PIN/security screens through `setLocalizations`** (the translations lived in `src/circleLocalizations.js`, called from `circle.js:getSDK()` + the 2 SDK constructions in `Login.jsx`). That reversed the earlier "pure English because Circle only half-localises" decision (07-01), which was WRONG: reading the docs carefully (customization.md + web-sdk-ui-customizations, checked 08-04) showed the Recovery Method + security questions ARE localisable, not hardcoded as previously assumed. **The part that was right:** there is no field for runtime ERROR text (wrong/locked PIN...) → that stays English, which is acceptable because it rarely appears. **Never localised:** `transactionRequest`/`contractInteraction`/`signatureRequest`/`emailOtp` (the SDK supports them, but those fields mix static labels with dynamic values and need careful testing). **All of this was removed on 08-25 together with the i18n layer** - the app is English-only and English is Circle's own default, so nothing is called. If multi-language ever returns, the file and the correct call are in git history.
- **2 bugs found while testing the Vietnamese Circle screens (08-04), both fixed at the time (kept as SDK lessons):**
  1. `requiredMark` (the "Required" word beside Question/Answer) was concatenated by the SDK DIRECTLY onto the preceding label with no space inserted ("QuestionRequired") → fixed with `requiredMark: ' (required)'` (padding the space + brackets yourself).
  2. The 3 risk-warning lines on the "Security confirmation" screen stayed English despite `setLocalizations` - because they belong to the `securityConfirmItems` field of a **DIFFERENT** method (`setCustomSecurityQuestions`), not to the `Localizations` object. That method had to be called as well (in 3 places, like `setLocalizations`).
- **✅ 08-04c - CONFIRMED FOR REAL: `inputMatch` (the "Security confirmation" screen) DOES change the phrase the SDK validates against.** Setting a custom `inputMatch` and typing that exact phrase on a deploy genuinely enabled the Continue button. It is not merely displayed text, as first feared.
- **🔴🔴 08-04 - THE ROOT CAUSE of the "EMPTY security questions screen": CALLING `setCustomSecurityQuestions` WITH THE WRONG SIGNATURE. Our mistake, NOT Circle's.** That method takes **POSITIONAL ARGUMENTS**, not an object:
  ```js
  setCustomSecurityQuestions(questions?: SecurityQuestion[] | null, requiredCount = 2, securityConfirmItems?: string[])
  ```
  (verify: `node_modules/@circle-fin/w3s-pw-web-sdk/dist/src/index.d.ts:91`; the body at `index.js:254` assigns `this.securityQuestions = questions` directly, with NO destructuring.) Calling it object-style as `setCustomSecurityQuestions({ questions, securityConfirmItems })` → the SDK received the whole **object** where an **array** of `questions` was expected → a broken question list → **an empty screen that blocked the entire wallet-creation flow**; and at the same time `securityConfirmItems` (the THIRD argument) never arrived → the 3 warning lines stayed English. **One bug explaining both symptoms.** Fixed by passing positionally in all 3 places. Check: `grep -rn "setCustomSecurityQuestions({" src/` must be EMPTY.
  **The lesson:** the 3 attempts before that all changed the WRONG variable (removing `questions`, then disabling the method, then disabling `Localizations.securityQuestions`) because they reasoned from symptoms instead of READING THE FUNCTION SIGNATURE in `node_modules` - which was there from the start and takes 30 seconds to read. When an SDK behaves strangely: read the `.d.ts` + the function body FIRST, do not guess and trial-and-error on production.
- **`Localizations.securityQuestions` WAS INNOCENT** - it was fully re-enabled. The user's screenshot at `f02cd86` (when only `setLocalizations` was called, before `setCustomSecurityQuestions`) showed the screen rendering the full dropdown + input → that block never emptied the screen.
- **✅ 08-04e - the same `securityIntros` concatenation bug fixed too:** two headline strings running together, the same disease as `requiredMark` (the SDK joins `headline`+`headline2` without inserting a space) → pad a leading space onto `headline2`.
- **`getSDK()` is ASYNC (lazily loading 740KB of SDK+polyfill)** - every call site MUST `await getSDK()`. Forgetting the await kills the PIN silently. Check: `grep -rn "getSDK()" src/ | grep -v await` must be EMPTY.
- **A userToken lives 60'** → call `refreshSession()` before ANY PIN action.
- **A wrong PIN does NOT close the iframe** - `executeChallenge` IGNORES `RETRYABLE_CODES` (155112/155703/155704/155115/155705) and only settles on success or a terminal error. `155701` = the user cancelled → stay silent.
- The 3 PIN endpoints: `POST /user/pin` to set · `PUT` to change · `POST /user/pin/restore` for a forgotten PIN. SSO/OTP users have no PIN → 403.
- `contractExecution`: flat fields with `feeLevel:'MEDIUM'`, accepting `abiFunctionSignature`+`abiParameters` or `callData`. Circle errors: return them verbatim as `message (HTTP status, code)`; read `e?.message || e?.error?.message`.
- 2 format chainId: W3S = `ARC-TESTNET`, Stablecoin Kit = `Arc_Testnet`.

**Arc / Stablecoin Kit:**
- **The public RPC is STRICTLY RATE LIMITED (HTTP 429):** reading several things MUST be folded into Multicall3 (`publicClient.multicall()` does it for you); retries spaced ≥600ms; frequent retries walk into a permanent 429 (lesson 07-17b). **A failed read shows `…`, it NEVER draws 0.**
- Gas is paid in USDC (18 decimals internally) and is very cheap - show `< $0.01` rather than `$0.00`.
- **ArcScan (Blockscout) IGNORES `limit` - use `page` + `offset`** (measured for real 07-31 on a busy wallet): `&limit=50` → returns **10,000 rows / 11.7s**; `&page=1&offset=50` → 50 rows / **0.4s**; `offset=1000` → 1.7s. TxHistory used to pass `limit=50` and was therefore **silently downloading the wallet's ENTIRE history** on every open. ArcScan DOES honour `sort=desc` - but the list still **sorts on the client**, because the API order must not be trusted.
- **Do NOT merge `txlist` (native transfers) into history** (tried and REJECTED 07-31): Arc uses USDC as its native token, so it seemed `tokentx` might be missing native transfers → measurement showed **0 missing transactions** over the same window (Blockscout always indexes native transfers as token transfers). Adding `txlist` would **DOUBLE-COUNT 70 of 75 transactions**.
- **A COLD Arc RPC call takes ~3.3s** (subsequent ones 130-360ms; measured 07-31). So EVERY screen that reads balances MUST seed from the module-level cache (`cachedBalances`) and fetch in the background - HomeSend/HomeReceive/Swap all do. A screen that starts from `{}` leaves the user staring at `…` for seconds.
- **RPC CORS: fine on production, NOT on localhost.** `rpc.testnet.arc.network` echoes `access-control-allow-origin` for the real Origin (verified from a browser running INSIDE the `ezwallet.cash` origin: 200, 535ms) but blocks `http://localhost:5173`. → red CORS logs from the RPC during `npm run mock` are **NORMAL**, not a production bug, so do not go fixing them.
- The Kit's `amount` is in base units (section 4).

**PWA (added to the iOS home screen):**
- **The grey band at the top of the status bar is the `body` background.** An iOS standalone PWA without `viewport-fit=cover` (index.html) keeps content inside the safe area; the status bar region (outside the viewport) is filled by iOS with the **`body` background colour**. It used to be `--color-gray` → a visible grey band. Fixed 07-19: `body background = --color-white` (index.css) → it blends with `.screen`. **Do NOT set the default body background back to grey.** ⚠️ Updated 07-22: the area OUTSIDE the app frame on desktop/tablet is a SOFT PASTEL BLUE through `@media (min-width: 481px) { body { background: #D6EAFB } }` (user decision 07-22c - from #0B53BF→#0088FF→#D6EAFB, paler each time to stop it glaring; reversing the 07-21 grey) - safe because phones are always ≤430px and never reach the threshold; `.screen` has its own white background so the app frame is not tinted. For a native-style full-bleed look, add `viewport-fit=cover` + `env(safe-area-inset-*)` padding to `.screen` (which touches the 10-row grid - the user chose NOT to, keeping the white background). ✅ RESOLVED 2026-09-11: the 08-25 filming change (`body` defaulting to `#D6EAFB`) was exactly this - the status bar/PWA band went pale blue on both iPhone and desktop, reported and fixed by reverting the default `body` background to `var(--color-white)`. The `@media (min-width: 481px)` desktop-blue rule above is untouched and still correct.
- iOS caches the meta/manifest at "Add to Home Screen" → manifest/meta changes do not take effect until the app is **deleted and re-added** (CSS changes like the above take effect on the next open).

**Other:**
- iOS Safari: no BarcodeDetector → jsQR; the Web Share API saves to Photos; do not use `clipboard.readText()` (an annoying dialog). **The single exception: the Paste button in PasteAddress** - and it only reads when the field is empty (07-23): the "Paste|Speak" popup is an iOS 16+ CONFIRMATION (clipboard security, the web cannot disable it, and it cannot be replaced with our own popup either - ours would come BEFORE the iOS one, making it two taps; "Speak" appears because Spoken Content is enabled on the device); if the field already holds a valid EVM address → **the button label flips "Paste"→"Confirm"** and it proceeds directly without touching the clipboard → no popup. The user has asked twice; stop looking for a way to "disable/replace the popup".
- Screens without a NotifArea show errors through `ErrorToast` (passing `sendError` through navigate).
- Sign-out only clears the session keys, KEEPING `ez_contacts/ez_saved_qrs/ez_currency`.
- **localStorage IS TIED TO THE ORIGIN → changing domain "loses" local data (07-29, not a bug):** anyone who used the app on `ezwallet.pages.dev` will arrive at `ezwallet.cash` **signed out, with empty contacts / QR library / notifications** - because the `ez_*` keys live on the old origin. **THE WALLET AND THE MONEY ARE NOT LOST** (the wallet is tied to the email at Circle: sign in with the same email + PIN and it is back). Only `ez_contacts`/`ez_saved_qrs` have to be re-entered by hand, or viewed by opening the old link. Do not promise the user that everything carries over.

---

### 7b. QR - LOCKED TO THE ARC NETWORK (user decision 2026-08-13)

**`src/qr.js` IS THE SINGLE SOURCE OF TRUTH for the QR format.** Every drawing site (HomeReceive · ShowQR · SavedQRList) calls `buildQR()`, and the reading site (QRScanner) calls `parseQR()`. **Do NOT hand-build `ezwallet:...` strings in any screen** - before 08-13 it lived in 3 places, and fixing one left the others wrong.

```
ezwallet:0xABC…@5042002                      ← the default QR on the Receive screen
ezwallet:0xABC…@5042002?amount=25&cur=USD    ← a QR with a preset amount
```

**Why it is locked:** the default QR USED TO draw a **bare `0x…` address**. EVM addresses are identical on EVERY chain ⇒ any wallet sitting on Ethereum/Base/BSC can scan it and send, and money that lands on another chain is **gone for good**. The app's audience is older people with no way of noticing the wrong chain. The user's position: **"for now we use one network only"**; CCTP Unified Balance may come later, possibly under the model *"a different chain is a different bank"*.

**The asymmetry is DELIBERATE (do not "make it consistent"):**
- **The QR is LOCKED** to Arc. It is the one-tap-and-it-sends path, so it must be blocked.
- **The address as text (the copy button / Share) is LEFT BARE**, with no chain attached. That is the escape hatch for topping up from an exchange or another wallet. The user's ruling: *"the wallet address itself is fine".*

**⚠️ EIP-681 (`ethereum:0x…@5042002`) IS DELIBERATELY NOT USED:** that standard does have a chainId field, but plenty of wallets implement it sloppily - they read the address and **ignore `@chainId`**, sending on whatever chain is open ⇒ more dangerous than a bare address, because we would believe it was locked. Faced with the unknown `ezwallet:` scheme, other wallets have only one option: **refuse**.

**parseQR accepts 3 shapes** (round-trip tested): the standard `ezwallet:…@5042002` · `ezwallet:…` **with no @chain** (OLD QRs printed/shared/saved as images before 08-13 - treated as Arc, they must keep working) · **a bare `0x…`** (a QR from an outside wallet that we scan IN ORDER TO SEND - locking this would leave the user unable to send to outsiders). An ezwallet QR from another chain → returns `{ wrongChain }` → the scan screen says *"QR from another network – this wallet currently only works on Arc"*. **`{ wrongChain }` has NO `.address`** - catch it before the valid branch, or you land on the amount screen with `undefined`.

**Changing chain (mainnet / adding a chain) → edit `ARC_CHAIN_ID` in `src/qr.js`** (`chain.js` imports that constant for `defineChain`, so it is not declared twice).

---

### 7e. MONEY-RECEIVED NOTIFICATIONS - the polling interval (bug reported 2026-08-13)

**The symptom:** *"the money-received notification takes forever to appear"*, while **sending shows instantly**.

**The root cause:** `NotifArea.pollIncoming` - named *poll* (ask repeatedly) but called **EXACTLY ONCE** on mount (`useEffect(..., [])`), with **no `setInterval` anywhere in the app**. Sitting still on Send/Receive, money could arrive with nobody asking again → the notification only appeared when the user happened to switch tabs (a component remount). **SENDING** appeared instantly because `SendReceipt` calls `addNotif` itself with no network involved - so only RECEIVING was slow.

**⚠️ WHY THIS IS NOT A SMALL BUG:** this app is for older people. Being told *"I sent you the money"* and opening the app to nothing makes them **WORRY**, then call to ask, then tap randomly. Silence on a money screen is a serious bug. Do not "optimise" the repeated polling away.

**THE INTERVAL FOLLOWS WHAT THE USER IS DOING (user decision):**

| Screen | Interval | Why |
|---|---|---|
| **Receive** | **5s** (`pollMs={5000}`) | The QR has just been held out to someone; they are **standing there waiting** for the money |
| **Send** | **15s** (default) | Nobody is waiting for incoming money on this screen |

- **Skip the tick while the tab is hidden** (it costs battery/data and nobody is looking) + **ask IMMEDIATELY on returning to the app** (`visibilitychange`) - the most common scenario is: told the money was sent → open the app → it must be there.
- A module-level `polling` flag prevents overlapping requests on a slow network.
- ⚠️ **If one screen needs to be faster, pass `pollMs` to THAT screen only**, do NOT lower the default: each tick is a request multiplied by every device with the app open.
- ⚠️ The effect's deps are `[pollMs]`, not `[]`.

**Measured with Playwright:** over the same 22s → the Receive screen polled **4 times, evenly spaced 5.0s apart**; the Send screen **once**. Hiding/showing the tab triggered an immediate poll.

**STILL MISSING:** the polling only runs on the **Send or Receive screens** (the only 2 that render `NotifArea`). Money arriving while the user is in History/Menu/Swap goes unannounced until they return Home. Announcing it on every screen means moving the polling up into `App.jsx` - **not done, it needs the user's approval because it touches the architecture**.

---

### 7f. AUTO-CONVERT ON INSUFFICIENT USDC (user idea, raised 2026-09-08) - ⚠️ NOT BUILT, NOTES ONLY

**The scenario:** the Send screen defaults to "USD" = sending USDC 1:1 (section 2). Today, if the wallet shows e.g. $20 total but that $20 is actually EURC (0 USDC), `SendAmount` checks the balance of the EXACT selected token → the send is blocked with "Insufficient balance", even though the wallet is not really empty. The user finds this confusing: the top-line balance says $20, but sending fails.

**The user's proposed fix (idea only, exact wording given 09-08 - do not rephrase the confirmation copy without asking):**
1. When the user tries to send USD/USDC and the USDC balance is insufficient, **auto-convert (swap) the token with the HIGHEST balance into USDC** rather than just blocking.
2. Before doing it, **show a confirmation** with a message along the lines of: *"Hết USDC nên auto convert token có số dư cao nhất thành USDC"* (out of USDC, so auto-converting your highest-balance token into USDC) - the user must confirm before it runs.
3. If the user instead **manually picks EURC** (the currency chip) as the send currency, show the balance as **"Available: 20.00 EURC"** (i.e. label the balance line with the real token, not converted to $).

**Open questions - NOT settled, ask the user before building:**
- Which existing plumbing performs the conversion - the real Swap flow (`_swapCore.js`, 0.1% fee, section 4) or something else? If it's the real Swap, the 0.1% app fee would apply here too - does the user want that?
- Exact trigger point: only when USDC is fully 0, or also when USDC is nonzero but not enough to cover the typed amount (partial top-up vs. full conversion of the whole balance)?
- Exact button/copy for the confirmation dialog (Confirm/Cancel wording, where it appears - a popup like the note popup, or inline like the `overBalance` error text).
- What happens with cirBTC in the "highest balance" comparison - does it get force-converted too, or is auto-convert EURC→USDC only?

**Already true today (no change needed):** part 3 above (manual EURC selection showing the real-token balance) is effectively already the case - `SendAmount.jsx`'s "Balance:" line already uses `fmtMoney(availableAmt, cur)`, which renders EURC as `"20.00 EURC"` (not converted to `$`), and the "Insufficient balance" message already quotes the balance in the selected token. Only the label differs ("Balance:" vs the user's wording "Available:") - a possible one-word tweak, not a new feature.

---

### 7d. ⛔ REMOVED 2026-09-10 - THE BUG-REPORT BUTTON → TELEGRAM (2026-08-13)

> The whole feature was deleted at the user's request: `BugButton.jsx`, `functions/api/bug.js`, the bug
> icon, the `/api/bug` dev route and `__APP_VERSION__` are gone (commit `dd13c26`). **Still to do by hand:**
> remove `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` from Cloudflare Pages → ezwallet → Settings → Variables,
> and revoke the bot via @BotFather. The rest of this section is kept only as a record of how it worked.

A **grey** 🐛 icon (`--color-muted-2`) flush right, centred on **row 1**, present on **EVERY screen including Login/PinGate** (errors are most likely exactly when you cannot get into the app). Rendered once in `App.jsx` inside an anchor frame of `maxWidth: var(--screen-max)` → it hugs the right edge **of the app**, not the desktop screen edge.

⚠️ **COLOUR: do not change it to blue/red** (the user weighed all 3): brand blue = the "tap this" colour → it would compete with the main content on every screen; red = the error/danger colour → a red dot next to the balance makes older users think **their money** is in trouble. Grey = "a tool sitting there, not needed yet" (= an unselected navbar icon).

**`functions/api/bug.js` - the bot IS ONLY A TOKEN, it does NOT run in the background and needs NO VPS.** It does not listen, poll or use a webhook: each button press is one `fetch` to `api.telegram.org` and then it ends. (Completely unlike the TemBro bots on the VPS that must run 24/7.)

- ⚠️ **Do NOT use `parse_mode`** - the user types freely, and turning on Markdown/HTML breaks the message (`*_\`<>`) or allows tag injection. Plain text needs no escaping.
- ⚠️ **Whitelist exactly 5 fields** (`message/screen/wallet/device/version`). The client must **NOT collect localStorage** and send it. `ez_user_token` / `ez_encryption_key` / `ez_refresh_token` / `ez_sync_token` getting out means **LOSING THE WALLET**. The wallet address is sent (it is public, and without it a failed transaction cannot be looked up).
- Flood protection of **5 per hour per IP** through the `EZ_SYNC` KV. **With no KV, SKIP the guard rather than blocking everything**: better to take spam than to lock out someone genuinely calling for help.
- Telegram returns **200 with `ok:false`** for a wrong chat_id / a blocked bot ⇒ you must read `ok`, never trust the HTTP status alone.
- With the variables unset → **503 `bug-report-disabled`** and the app runs normally (the same pattern `sync.js` uses without a KV binding).

**Environment variables (ALREADY SET on Cloudflare Pages production, encrypted):** `TELEGRAM_BOT_TOKEN` · `TELEGRAM_CHAT_ID`. The bot is `@ezwallet_report_bot` ("ezwallet Bug Report"). The values are also in the local `.env.txt` (gitignored) so `dev-server.js` works.
⚠️ **Pages only applies new variables to NEW deployments** - after setting them, create a new deployment (`POST …/pages/projects/ezwallet/deployments -F branch=main`); the running build will **not** pick them up.
⚠️ Telegram **blocks a bot from messaging anyone who has not pressed Start with it** - if the recipient changes, that person must press Start first.

**The version in a bug report** = 7 characters of the commit, embedded at build time (`vite.config.js` → `__APP_VERSION__`): Cloudflare provides `CF_PAGES_COMMIT_SHA`, locally it asks `git`, and if both fail → `'dev'` (never let the build die over it).

**Verified on production:** a real POST → `{"ok":true}` + the message arriving in Telegram. An empty message → 400 `empty-message`. *(The 5-per-hour limit has only been read in the code, not fired for real, because testing it means spamming the user's Telegram.)*

---

### 7bb. Web Share on iOS - `files` + `text` REMOVES SOME TARGET APPS (bug reported 2026-08-13)

**The symptom:** tapping Share on the Receive screen → the iOS share sheet **appears normally** but **Messages/Zalo are MISSING** from the list of target apps.

**How it was narrowed down (reusable for future share bugs):** ask the user 2 questions - *does the sheet appear at all* (it does ⇒ `navigator.share()` is NOT blocked, ruling out "share called outside a gesture") and *do the other 2 share buttons still work* (they do ⇒ the fault is only here, not in `saveImage.js`). Then `grep saveImageToPhotos(` → **the Receive screen is the ONLY caller passing a `text` argument**; ShowQR and SendReceipt send only the image and work fine. ⇒ `text` is the culprit.

**The rule learned:** `navigator.share({ files, text })` makes iOS **filter the target apps**. Sending only `{ files }` brings Messages back.

**⚠️ THE FIRST FIX WAS REJECTED BY THE USER - read carefully so you do not loop back to it.** That version dropped `text` and **drew the address onto the image**; the user disliked it (*"putting the address on the QR looks awful"*) and ruled: ***"as long as it shares 2 things, not 1"***.

**FINAL STATE (user decision 08-13):**

| Share site | What is sent | Note |
|---|---|---|
| **Receive screen** | **THE IMAGE + the wallet address as TEXT** | ⚠️ Including text ⇒ iOS filters the target apps (Messages can disappear). **The user KNOWS and ACCEPTS this.** Do NOT drop `text` to "fix" it again. |
| **ShowQR / QR library** | **IMAGE ONLY** | Here the amount inside the QR is what matters; scanning yields the address, so attaching it is both redundant and costs target apps. |
| **Receipt** | IMAGE ONLY | unchanged |

**The QR image comes from the shared `saveImage.brandedQrCanvas()`** - the QR + the words **"Only Arc Testnet"** + the ezwallet logo. **The address is NEVER drawn onto the image.** Both the Receive screen and ShowQR go through that function, so do not hand-draw it anywhere.
**This also closed pending item B in section 9:** shared images now carry the network label. The screen itself still does not (the user still has to choose where to put it).

---

### 7c. THE SUCCESS SOUND (user decision 2026-08-13) - ⚠️ STILL UNFINISHED

**Status:** `src/sound.js` is written. **NOT wired into any screen, NO off switch yet, NOT tested, NOT committed.** The remaining work is in section 9.

**The user's 4 decisions (alternatives were weighed before deciding - do not propose them again):**

| | Decision | REJECTED, and why |
|---|---|---|
| Where it plays | **After sending money** (SendReceipt) · **after a swap** | ❌ *Money received*: it arrives on its own with NO user gesture ⇒ iOS blocks playback, requiring an AudioContext kept alive for the whole session. ❌ *Copy/save QR/small actions*: too many chimes and the sound **loses its meaning**, so the moment money leaves the wallet no longer stands out |
| Where the sound comes from | **Generated with Web Audio** (2 rising sine notes C6→E6, ~0.3s) | ❌ *An mp3 file*: it has to be sourced, it adds weight, it carries licensing questions, and the first play can lag |
| An off switch | **YES** - add a row to the `Currency` screen (formerly Language & Currency) | ❌ *No off switch*: if iOS plays sound even on a silenced phone, the user would have no way out |
| Default | **ON** (`localStorage.ez_sound`, only written as `'off'` when muted) | — |

**⚠️ THE iOS RULE - why `unlockOnFirstTouch()` exists:** an `AudioContext` is born `suspended` and **can only be `resume()`d INSIDE a user gesture**. By the time a send completes, several `await`s have passed (PIN signing inside the Circle iframe, waiting on-chain) ⇒ **the gesture chain is BROKEN** and calling `resume()` there is too late. So it must be unlocked on the **FIRST touch anywhere in the app** (App.jsx calls it once). Touching Circle's PIN iframe does **not** count for our page.

**⚠️ UNKNOWN, must be tested on the user's real device:** whether iOS honours the **silent switch** for Web Audio - it varies by iOS version. That is exactly why an in-app off switch is mandatory.

**⚠️ Vibration (`navigator.vibrate`) IS NOT POSSIBLE on iPhone** - Safari iOS does not support it, only Android does. Do not promise "vibrate + chime".

**The golden rule:** `playSuccess()` must **fail silently** (everything wrapped in try/catch, returning when there is no `AudioContext`) - **a chime must NEVER break the money flow**.

---

### 8. localStorage keys

**Session:** `ez_user_token`, `ez_encryption_key`, `ez_wallet_addr`, `ez_wallet_id`, `ez_email` (email login), `ez_refresh_token`/`ez_google_email`/`ez_google_deviceId`/`ez_login_method` (Google), `ez_notifs`, `ez_last_recv_ts`, `ez_email_history`, `ez_notified_hashes`, `ez_faucet_pending`. `sessionStorage.ez_pin_ok` = the session unlock flag; **`sessionStorage.ez_sync_token`** = the contacts-backup token, traded for a PIN signature in `PinGate` (08-06) - **deliberately in sessionStorage** so it dies with the app session and reopening the app signs again.
**Persistent:** `ez_contacts_<addr>`, `ez_saved_qrs_<addr>` (per account, see `store.js`), `ez_currency`, `ez_default_note`, **`ez_sync_at_<addr>`** (the last-edit stamp - the arbiter of the "newest wins" rule for KV backups). (`ez_lang` no longer exists: the i18n layer was removed 08-25.)

---

### 9. What comes next


*(Per-session change-log tables for 2026-09-07, 2026-08-25 (both parts), and 2026-08-13 moved to
`HANDOFF-LOG.md` - read them there if you need the detail behind an item below.)*

#### 🟠 UNFINISHED - session 2026-08-13 (do this FIRST)

**A. The success sound** (the full decisions are in section 7c, do not ask the user again):
1. `App.jsx` → call `unlockOnFirstTouch()` once in a `useEffect` at startup.
2. `SendReceipt.jsx` → `playSuccess()` on entering the screen (next to the `addNotif('Sent…')` call).
3. `Swap.jsx` → `playSuccess()` right after `setSuccess(true)` (the "submitted" step, where the user sees the button turn green).
4. `Currency.jsx` → add a second row **"Sound: On/Off"**, reusing the existing `Picker` component + `CHIP` style (do not invent a new toggle). The grey box must grow from `gridRow: '2 / 3'` → `'2 / 4'` for 2 equal rows.
5. **Rename the screen** `Currency` → **"Settings"**: the label in `MenuScreen` ITEMS + the screen title. Reason: it would no longer hold only the currency. ⚠️ Splitting this screen off from Security (08-04) still stands, do not merge them back.
6. (The old step 6 - adding i18n keys - no longer applies: the i18n layer was removed 08-25, so the new strings are written directly in English.)
7. **Test on the user's real device** (headless Playwright cannot HEAR anything; it can only verify that nothing throws and that the off switch writes localStorage correctly): check whether iOS honours the **silent switch**.

**B. The network label ON SCREEN on the Receive screen - WAITING FOR THE USER TO CHOOSE WHERE IT GOES.** *(Shared images have carried "Only Arc Testnet" since 08-13 - see 7bb. Only the on-screen part is missing.)* The QR is locked to Arc at the data level (section 7b), but **nothing on screen says which network this is** - a machine can read `@5042002`, a person only sees a black-and-white square. It fits the model the user is considering: *"a different chain is a different bank"*. The obstacle: the Receive screen is already full (row 6 the copy button, 7-8 the hint area, 9 the three buttons) → **where it goes is the user's layout decision, do not insert it yourself**.

**C. Money-received notifications only run on the Send/Receive screens - WAITING FOR THE USER'S APPROVAL (it touches the architecture).** Those two are the only screens rendering `NotifArea` (section 7e). Money arriving while the user is in History / Menu / Swap goes unannounced until they return Home. Announcing it everywhere means moving the polling up into `App.jsx` - ~20 minutes, but it relocates the logic, so the user has to agree.

**D. Swap `No route available` - NOT OUR PROBLEM, WAIT FOR CIRCLE.** See the red block at the top of section 4. Do not edit the code; re-measure the 3 pairs periodically and stop when it works again.

*(The 2026-07-31 deploy-click checklist and the since-removed multi-language ownership notes moved to
`HANDOFF-LOG.md`.)*

---

#### Roadmap / future direction (brainstormed 07-24 - ⚠️ NOT settled, NOT started, notes only)

> The user raised the 4 directions below as a VISION, not a commitment. Do not build them on your own. The COMMON blocker for most of them: **how far Circle User-Controlled Wallets support native/biometric/EIP-712 - read the Circle docs and verify BEFORE building.**

1. **More Languages & Currencies (global users).** ⚠️ Updated 08-25: the i18n infrastructure NO LONGER EXISTS (it was removed with Vietnamese/Chinese - see section 2). Bringing this back means designing it again from scratch, plus real translations and rates for the new currencies (the base is USD).
2. **Privacy features (protecting the balance).** The idea: hide the balance (tap to reveal), a privacy mode. NEW, not designed.
3. **A native mobile app.** FaceID/fingerprint (instead of the PIN), real push notifications, Keychain/Keystore (safer token storage than localStorage), the App Store/Play Store. The approach that avoids a rewrite: wrap the existing React app with **Capacitor** + native plugins → reuse the code. ⚠️ Verify: (a) whether Circle's PIN iframe runs inside a Capacitor webview, (b) how Circle's native SDKs (iOS/Android) bind biometrics to a User-Controlled Wallet.
4. **In-app selective services (offering services to customers).** NOT a dApp browser open to every dApp (that contradicts "safe for older people" and is full of approvals and scams). Instead: wrap 1-2 SELECTED reputable DeFi/services into ezwallet's simple UI, hiding the complexity behind it. ⚠️ Verify: whether Circle can sign **EIP-712** + arbitrary transactions (only contractExecution + message signing are used today); it also needs mainnet + more chains (this is Arc Testnet). *(Promise no interest rates or specific products - design that separately when it is actually built.)*

> Considered and SET ASIDE: **a browser extension** - feasible, but desktop-only (against the mobile-first positioning for older users), plus the risk of the Circle SDK/PIN iframe clashing with Manifest V3's CSP, and the `chrome-extension://` origin possibly not being whitelisted by Circle. The PWA (already shipped) fits the target better.

---

### 10. Key lessons (distilled - the details are in git log)

- **A swap must go through `adapter.execute` with a signed intent** - unpacking the instructions and running them by hand LOSES MONEY (it happened).
- **Aggressive retries against a rate-limited RPC are self-destructive** - batch with Multicall + back off generously; when a number is not certain, show `…` and never draw 0.
- **Circle's iframe keeps the modal open when the user gets it wrong** - rejecting the promise early means the user enters it correctly and the result falls into the void.
- **A grid with no declared columns / a flex item without minWidth:0** = one long string wrecks the whole screen's layout.
- **A function named `poll…` with no `setInterval` is a lethal silence** (08-13): the money-received notification ran once on mount for weeks. Sending appeared instantly (it calls `addNotif` itself), so the bug hid well. **For an audience of older people, an app that goes silent on a money screen is a SERIOUS bug, not a small one.**
- **A rounding step tied to powers of 10 gives one tier per decade - far too coarse** (08-13): 9.99 stepped by 0.5 while 10.0 stepped by 5 → nudging by a cent changed the whole order of magnitude of the suggestions. It took 3 attempts to get right; see the `roundHint` part of section 3.
- **Changing code and forgetting the test disarms the test** (08-13): the 08-04 commit left `npm test` red for 9 days, and once you are used to red you stop seeing it. **Changing `roundHint.js` means changing its test IN THE SAME COMMIT.**
- **Measure before assigning blame** (08-13): three times in one session something looked like our bug and was not - (a) Vietnamese text losing its diacritics in Telegram = `curl` on Windows encoding it wrongly, while the server-generated labels were fine; (b) the Swap `No route` = Circle's side, with the 3 core files untouched for 8 days; (c) the hint block overflowing on a 360px Android = **it had already been overflowing before the change**, proven with `git stash`. **Always build an isolated measurement before fixing anything.**
- **Cloudflare Pages only applies environment variables to NEW deployments** (08-13) - after setting a variable, create a new deployment; the running build will not pick it up.
- **"Improvements" that are not verified step by step** (retries, catch-and-return-0) have caused regressions worse than the original bug - verify every UI change with the Playwright mock, and every swap change with eth_simulateV1.


---

## OLDER HISTORY (the log as it stood before 2026-09-27)

# HANDOFF LOG – ezwallet (history)

Chronological build log, split out of `HANDOFF.md` on 2026-09-11 to keep that file short enough to read
in full every session (it had grown to 1581 lines / 213KB and was getting silently truncated on read -
the first read of it this same session only returned 27% of the file before hitting a token cap). This
file is pure history - the blow-by-blow of each dated round-trip and the "why" behind past decisions.

**For current state and active rules, read `HANDOFF.md` instead.** Nothing here is guaranteed still
true - a later entry (in this file or in `HANDOFF.md`) may have superseded it. Cross-check against the
live code before relying on a specific number or claim from here. This file is not required reading to
start a session; open it only when you need the reasoning behind something `HANDOFF.md` states as settled.

---

**Session 2026-09-22: the desktop handset frame, a UI audit the user took over, and the fork plan.**
Three separate things; only the first produced code.

1. **The desktop frame (`72ee40f`, shipped and live).** The user: *"vào ezwallet.cash trên desktop, hiện
   tại frame xấu (chiếm 1 phần nhỏ màn hình, phần dư thì màu xanh nhạt), sửa lại thành một frame mobile
   như iphone bao quanh app còn nền trống đổi thành màu E1E7ED"*. Done in one edit to the existing
   `@media (min-width: 481px)` block; mobile untouched. **The one non-obvious part**, now also written as
   a warning comment in `src/index.css`: the obvious implementation (`#root { height: calc(100dvh - 48px);
   margin: 24px auto }`) is WRONG here. This app positions ~165 elements in `dvh`, which is anchored to
   the viewport and not to the parent, so shrinking `#root` leaves every one of those coordinates pointing
   at the old place – content drifts down ~5% and the NavBar collides with the action pills. The handset
   is therefore built at full viewport height and shrunk with `transform: scale(0.93)`; every `dvh` still
   resolves to exactly what it did before. A second, deliberate benefit: a transformed ancestor is the
   containing block for `position: fixed` descendants, so `.popup-overlay` / `.sheet-overlay` /
   `ErrorToast` – which previously dimmed the entire desktop browser window – now stop at the handset's
   edges. Verified: `npm test` 16/16, `npm run build` clean, Playwright at 1280×720 / 1440×900 / 1920×1080
   with 0 console errors, and the popup overlay's bounding box measured equal to `#root`'s box rather than
   the viewport. Also confirmed that **Cloudflare Pages auto-deploys from GitHub `main`** (the live CSS on
   `ezwallet.cash` was serving `E1E7ED` minutes after the push) – and that **the stored wrangler OAuth
   token has expired**, so the Cloudflare REST API rejects it.

2. **A UI audit that the user cut short – deliberately, and the outcome matters more than the audit.**
   Claude screenshotted all 18 screens at 390×844 and listed what looked weak: large dead empty areas on
   Service hub / Confirm transaction / empty Contacts / the Home token card; the red
   `Current Available Network: Arc Testnet` + three "Paste: … / Scan QR: … / Contacts: …" help lines on
   both Home screens reading like developer notes; `▶` play triangles used as navigation chevrons on Menu
   and About; a repeated "Add to Contacts" button on every Transaction history row. Offered a menu of
   areas + how far the locked 2026-09-09 design system could be touched, the user replied **"Thay vì bảo
   bạn đoán, mình sẽ vẽ"** and **"Vẽ lại tự do, tôi duyệt từng màn"**.
   → **The standing instruction from this point on: the user draws, Claude builds, one screen at a time,
   screenshot to Desktop for approval before moving on. Claude does not design.** The audit list above is
   kept only as evidence of what the user may or may not choose to address – it is NOT a work queue.
   ⚠️ One false alarm worth recording so nobody re-reports it: the "Invalid Date" visible on the Receipt
   screenshot was an artefact of Claude passing fake `?params=` without a `timestamp`, not a bug.

3. **The fork plan, recorded but NOT started.** `ezwallet` is to become the Arc **mainnet** project and
   this repo is to be renamed **`ezwallet-testnet`**. The user's full mainnet spec – core belief,
   positioning, stack, v1 scope, send/receive/swap flows, the security floor, the hard limitations for
   the README, the mainnet deployment rules, and the three things to verify before building – was
   supplied in chat and is now saved verbatim as **`MAINNET-SPEC.md`** so it stops living only in a
   transcript. The user postponed the fork in order to improve the UI first.

4. **Five Vietnamese leftovers found, none fixed** (offered, not taken up yet) – the date-format split
   between `SendReceipt.jsx` (`vi-VN`) and `TxHistory.jsx` (`en-GB`), the same split *within* TxHistory
   between its rows and its detail popup, and the `bien-lai-<ts>.png` filename the receipt image is saved
   under. Listed with line numbers in `HANDOFF.md` § "Found 2026-09-22". They are invisible to any
   redraw, so if they are not fixed they will be inherited by **both** repos after the fork.

5. **A landing page was requested at the end of the session** (copy suggestions, with ethos.network's
   mobile page as the visual reference). Nothing was built. The placement question – `ezwallet.cash`
   currently boots straight into the app – is still open.

---

**Seventh round-trip (2026-09-10):** Confirm transaction/Receipt's divider line, then three more screens in
one pass - Send money, Language & currency, Security. Findings:
- **Send money is a real architecture rewrite, not a reskin, and the OLD `SEND_MONEY_FIGMA_SPEC.md` is
  WRONG** - it documents a *different, older* Figma file (`iQxFGA890VhyXkEKipCC9C`) that predicted a
  Swap-style % slider. The CURRENT file (`GxgsMU6HAYqolckzvPWXp1`, node `1:88`) keeps a numpad, just
  restyled (radius 16 + glow, was 12/flat) - fixed at the shared `.numpad-gray .numpad-key` class, so Swap
  and CreateQR's numpads picked up the same correction for free. `SendAmount.jsx` dropped its old
  "Send to: / centred amount+chip / Balance:" flow entirely for two cards ("You send" / "To") + a
  non-clickable connector circle, the same shape Confirm transaction/Receipt use - all business logic
  (VND plumbing, insufficient-balance guard, self-send guard, default-note popup) carried over unchanged,
  only the JSX layer was rebuilt. ⚠️ SUPERSEDED by the eighth round-trip below: the connector circle DOES
  carry an icon (`down`), the user said so directly after the export came back blank - see below.
- **Language & currency and Security were both sized wrong**: both used a small 1-3-row card
  (`gridRow:'2/3'` and `'2/5'`) when the current Figma draws the SAME full 340×586 (`gridRow:'2/9'`) card
  template every Menu sub-screen shares - `About.jsx` already had this part right, these two didn't.
  Content still packs at the TOP of the tall card (flex column, not `justify-content:space-evenly` -
  that would spread 2-3 rows across the whole 586px and not match Figma at all).
- **Language row is back** despite the 08-25 i18n deletion - Figma still draws it. Resolved with the user
  directly: a real popup, English locked as the only option (same disabled-button pattern
  `CURRENCY_OPTIONS` already used), never a functional switch.
- **Security's "Change PIN" became a pill button** (white, glow shadow, no caret) replacing the old
  right-chevron row-link style: Figma draws a real button. `pinStatus` states re-purpose the pill instead of
  swapping in a chevron.
- Two small colour/size drifts caught the same way as Confirm/Receipt: Security's Email/Wallet-address
  values were `--fs-item`(17)/`--color-muted` - Figma wants 16px/`--color-muted-2`, the same "Label:"-line
  token used everywhere else. Currency's dropdown chips had a grey BORDER (07-17f decision) - current
  Figma draws a borderless glow-shadow chip instead, matching the token chip everywhere else already does.
- Verified with `tools/figma-check.mjs` against fresh `get_screenshot` pulls of all three nodes - diff
  panels clean on all three, `npm run build` clean, `npm test` 16/16.

**Eighth round-trip (2026-09-10, same day): the user rejected the Send money rebuild outright** ("bạn
build sai... bớt ngu lại") over three concrete things, all fixed:
1. **The numpad's key size/spacing was fabricated** - `flex:5.5` of whatever space happened to be left,
   inherited unverified from pre-rebuild code, not Figma's own fixed 48px-tall/8px-gap keys. Fixed with an
   explicit 216px-tall numpad block (4×48 + 3×8) and 27px of panel padding-top - both numbers the user
   gave directly, matching node `18:16` etc. exactly (panel top 430 → first key 457 = 27px; last key
   672 → CTA row 699 = 27px).
2. **The token icon was a real circular icon borrowed from `Swap.jsx`'s chip**, not what node `1:95`
   actually draws (a flat 24px BLACK SQUARE, no rounding, no real icon). "Exchange does it too" is not a
   defence - each screen's own export is the source, not a sibling screen's precedent. Fixed.
3. **The connector circle needed the `down` icon (`down.svg`)** - the raw `get_design_context` export
   showed no icon layer under node `1:100` (checked 4 times, always empty), but the user confirmed
   directly this is a flattened-into-background-image miss, not an actually-blank node - the same failure
   mode §2.1 above already documents for the Menu dividers/NavBar cell. Added `Icon name="down"`, white,
   centred.
4. **Root cause, worth stating plainly**: the "You send" card's own children (chip, available line, big
   amount) were positioned with flexbox (`space-between`/`flex-end`) approximating Figma's layout rather
   than each element's own measured coordinate - visually close enough to look right, but a `figma-check`
   pixel probe on the icon (46,163) read solid white in the app against solid black in Figma, proving the
   chip was actually ~15-20px away from where Figma puts it. Rebuilt with per-element absolute `%`/`dvh`
   positions (label 13.55dvh, chip 19.4dvh, available 25.28dvh, amount 16.72dvh - all centre-anchored
   except the amount, which Figma itself top-anchors), the same method Confirm transaction/Receipt use.
   **Lesson: flexbox convenience layout is not a substitute for the node's own numbers, even when it looks
   right on screen** - only a pixel diff proves it, eyeballing doesn't.
5. Re-verified against a matching-content Figma pull (`currency:"EURC"` params, matching the static
   example) - diff panel clean, no more doubled digits, icon lands exactly on Figma's black square.
   `npm run build` clean, `npm test` 16/16.

**Ninth round-trip (2026-09-10, same day): Contacts, Transaction history, About.** All three share the
same 340×586 (radius 16, was 20 on all three) card template - Contacts/TxHistory are dynamic scrollable
lists Figma draws EMPTY (no example rows, so the internal row padding/avatar sizing has no Figma evidence
and was left as the prior user-tuned value - only the outer card radius was wrong). About is fully static
- 7 rows, RE-VERIFIED each at its own measured row-centre (14.34/24.53/34.72/44.91/55.09/65.28/75.47dvh),
filling the whole card top to bottom (unlike Security/Currency's 2-3 rows packed at the top) - the old
version used `justify-content:space-evenly` inside one flex column, which is the exact same "approximate
with flexbox instead of the node's own coordinate" mistake the eighth round-trip just called out - fixed
the same way, per-row absolute position.
⚠️ **TxHistory's 3-button filter row (Send/Receive/Back) had a REAL vertical offset**, caught only by
`figma-check.mjs`'s diff (looked fine on a smoke check): first built with `gridRow:'9/11'` (a 2-row grid
span centred ~43px below Figma's real button position), "fixed" to `gridRow:'10'` (still wrong - literal
grid row 10 is 774-844px, not row 9 at 688-758 where Figma actually puts every bottom button row), finally
fixed by copying `.row10-single`/`.row10-dual`'s own proven position verbatim (`position:absolute; top:
81.52dvh; height:8.29dvh` - NOT the CSS grid at all, per the comment already on that shared class). **Any
custom (non-`.row10-*`) bottom button row should copy this absolute positioning, not grid-row - grid-row
10 is a real, different location and looks plausible enough to ship by mistake.**
All three verified with `tools/figma-check.mjs` against fresh `get_screenshot` pulls - diff panels clean,
`npm run build` clean, `npm test` 16/16.

**Tenth round-trip (2026-09-10, same day): the SHARED `.row10-single`/`.row10-dual` class itself was wrong**
- the user stated the rule directly: 1 button = full 340px card width; 2 buttons = 166px each (340-8)÷2;
3 buttons = 108px each (340-8-8)÷3 - always the SAME 6.41% side inset, always an 8px gap. This is not a
per-screen convention, it is the ONE button-row rule the whole Figma file uses everywhere, confirmed
across every button row measured this session (Confirm/Receipt, Security, Currency, Send money, Contacts,
TxHistory, About). The shared class had THREE numbers wrong at once, silently, in every screen using it
(About/Currency/Security/Contacts/EnterEmail/CreateQR/LuckyPot/PinGate/QRScanner/SavedQRList/SendAmount/
ShowQR/Swap/TxHistory - 14 files):
- `left/right: 20px` (matching `.screen`'s own margin) instead of `6.41%` (25px, matching the 340px card
  width every button row actually fills) - a plausible-looking number that was simply the wrong reference.
- `.row10-single .btn { width: min(75vw, screen-max*0.75) }` - a **07-29 decision, never re-verified
  against this Figma file**, which draws every lone Back button at the FULL card width, not 3/4 of it.
- `.row10-dual .btn { width: 44% }` + `gap: 12px` - neither number was derived from Figma; 44%×2 + 12px
  gap does not even sum to the container's own width, so the pair was centred and narrower than Figma
  draws, not edge-to-edge.
Fixed at the shared class: `left/right:6.41%`, `gap:8px` on both variants, `.row10-single .btn{width:100%}`,
`.row10-dual .btn{flex:1}` (naturally yields 166px for 2 buttons, 108px for 3 - `.row10-dual` is a class
name, not a hard count, so TxHistory's 3-button row now just uses `className="row10-dual"` instead of
duplicating the position inline). **This is the third time in three round-trips a number got fabricated
by inheriting old code instead of re-measuring against Figma (numpad spacing, then the "You send" card
layout, now this) - when in doubt, re-derive the number from the current node, every time, even for a
class that "obviously" already looks right.**
Re-verified About/Currency/Security/Contacts/TxHistory (the ones already rebuilt against this Figma file)
with `tools/figma-check.mjs` - all clean, no regression from the wider buttons. `npm run build` clean,
`npm test` 16/16.

**Eleventh round-trip (2026-09-10, same day): the last 5 frames - Create receive QR, Created receive QR,
Arabica, Scan QR, QR storage.** Two node ids had shifted again (Create receive QR `1:113`→`18:82`, Arabica
`1:139`→`18:296` - caught by re-fetching instead of trusting HANDOFF's own earlier notes, per the lesson
above). Findings:
- **ShowQR.jsx's title logic was wrong on both branches**: a freshly created QR reads "Create**d** receive
  QR" (past tense - the code was missing the "d"), and a SAVED QR's title is the raw name with no prefix
  at all (node `18:296` literally reads "Arabica", not "QR: Arabica" as the code built).
- **ShowQR's amount is 48px SEMIBOLD**, not the app's usual hero-number Light override - this is a RESULT
  display (like Receipt's card amount, which is also semibold), not an input, so the "big numbers are
  Light" rule doesn't apply here either.
- **The caption's danger colour**: `Created receive QR`/`Arabica` are older, unedited copies still drawing
  the pre-09-08 red `#EC221F` - `BRAND-GUIDELINE.md`'s current `#FF383C` wins per the two-sources rule (an
  unedited leftover inside Figma is not a second source of truth).
- **CreateQR.jsx's "You receive" card sits at rows 3-4 (top 20.38dvh), not rows 2-3** like Send money's
  "You send" - a real, one-row difference, not assumed from the sibling screen. Its own numpad/button
  labels ("Back"/"Continue", not "Cancel"/"Create QR") and the fixed 48px-key/8px-gap/27px-offset numpad
  geometry (same fix as Send money's own round-trip) were re-verified fresh, not copied.
- **QRScanner/ShowQR's QR-or-camera square is a literal fixed 258x258** (was a responsive 82%/aspectRatio
  on QRScanner, min(30dvh,78vw) on ShowQR) - the real camera feed and dynamic scan hint are kept (working
  functionality with no Figma equivalent), only the static caption below was rewritten to match Figma's
  exact wording/styling (16px semibold, second line in `--color-error`).
- **SavedQRList's tiles were a `minHeight:190` approximation**, not Figma's fixed 242px, with a stale
  1.5px grey border + old straight drop-shadow instead of the glow-only-on-clickable rule, and the name
  label was brand-blue (should be black - blue is the amount's colour only).
All five verified with `tools/figma-check.mjs` against fresh `get_screenshot` pulls - diff panels clean
(ShowQR checked against BOTH its Figma frames, `amount`/`fromStorage` params matching each), `npm run
build` clean, `npm test` 16/16. **Every frame in the file has now been rebuilt at least once** - see the
"Left: none" note in §4 above for what that does and does not mean going forward.

**Twelfth round-trip (2026-09-10, same day): the text scale itself, app-wide.** With every screen rebuilt,
the user defined an official 5-tier TEXT hierarchy (not hero numbers - see BRAND-GUIDELINE.md's Typography
section, rewritten to match) - Header 1/Header 2/Nội dung 1/Nội dung 2/Chú thích = 28/22/19/17/15px,
REPLACING the old --fs-label/-item/-body/-md-lg/-title/-tiny/-content scale entirely (those CSS var names
no longer exist - do not resurrect them). Two of the five are a **deliberate round-number consolidation,
not a fresh Figma reading**: the user was told outright that the raw measured values for "Nội dung 1" and
"Nội dung 2" were 18px and 16px (buttons/card-labels; meta "Label:" values) across every screen rebuilt
today, and chose 19/17 anyway for a cleaner, evenly-stepped scale - a real, deliberate design decision,
not a fabrication, and the one place today where "match Figma's raw pixel exactly" was knowingly overridden
on the user's own instruction. Header 1 (28) and Header 2 (22) already matched the raw Figma reading
exactly, no consolidation needed there.
Applied via `--fs-h1/-h2/-content-1/-content-2/-caption` (+ paired `--is-*` icon sizes) in `index.css`,
then bulk-renamed across every screen/component (`var(--fs-old-name)` → the matching new token) and every
literal `fontSize: 18/19/16/20/22/24` in the screens rebuilt this session → the corresponding token.
**Explicit exceptions, not oversights:**
- `NotifArea.jsx`'s `NOTIF_FS` (13px) was NOT bumped to Chú thích (15) - its own comment documents a real,
  previously-hit overflow bug ("at 17 the hint block's 4 lines wrap and overflow the card") at just 4px
  more; 15 was never tested against that same 4-line hint block, so this was left alone rather than risk
  reintroducing a fixed bug. Worth a deliberate look later, not a blind bump.
- Hero number displays (balance, amount-entry, receipt/QR amount: 44/48/52px + `--fw-light`) are a
  SEPARATE system, out of scope for this 5-tier TEXT scale - not touched.
Re-verified Confirm transaction/Security/About with `tools/figma-check.mjs` after the change (1-2px text
size shifts, nothing overflows or misaligns) - diff panels clean. `npm run build` clean, `npm test` 16/16.

**LuckyPot was explicitly PULLED IN too, same round-trip - the standing "keeps its own local size scale"
exception is GONE for size.** First pass left it alone (per that old exception); the user immediately said
otherwise ("LuckyPot theo hệ quy chiếu mới luôn đi") and separately flagged its old 13px text as genuinely
hard to read ("13px khó đọc lắm") - a real usability complaint, not just a consistency nit, so no half
measure was applied. All of `LuckyPot.jsx`'s own literal 13/16/18px text now uses
`--fs-caption`/`--fs-content-2`/`--fs-content-1` like every other screen. What DID survive as a real,
narrower exception: the Space Grotesk FONT-FAMILY + mixed-case header treatment (still LuckyPot's own
brand identity, per the 2026-09-08 decision - only the SIZE mapping changed), and the two true hero-number
displays (the deposit/withdraw amount input, the "you won $X" amount - 28/32px + `--fw-light`, the same
separate system every other screen's hero numbers use, never part of the 5-tier text scale). Verified with
a live Playwright screenshot in mock mode (not `figma-check` - this screen has no single static Figma
frame to diff against) - the denser stat boxes do NOT overflow at the larger sizes, confirming the
original "app-wide sizes read as oversized here" concern that justified the old exception no longer holds
now that the app-wide scale itself changed. `npm run build` clean, `npm test` 16/16.

**Thirteenth round-trip (2026-09-10, same day): the FRAME/SPACING rules distilled into BRAND-GUIDELINE.md**,
consolidating everything measured across all 13 round-trips today (THE GRID's exact row math, the 6.41%
card inset vs the unrelated 20px `.screen` margin, the 8px content inset, the 0.5px `#94A3B8` divider, the
340x586 full list-card template, the row-9 button-row geometry with its 1/2/3-button width formulas, the
27px numpad offsets, the icon-text size pairing rule) - see BRAND-GUIDELINE.md directly for the actual
numbers, not repeated here. Also fixed a real, previously-unnoticed drift found while writing it: the
shared `.popup-card` class used `width:88%; max-width:340px` (effectively always 340px, the standard card
width) - the user confirmed the GENERAL rule is actually 5/6 of the screen (325px), which LuckyPot's own
popups already used - `.popup-card` was the outdated one, not LuckyPot's exception. Fixed at the shared
class (`width: min(calc(100vw*5/6), calc(var(--screen-max)*5/6))`, the same idiom LuckyPot's popup and
`.row10-single .btn` already use), so every popup app-wide picks up the correction at once.

**Fourteenth round-trip (2026-09-10, same day): the SHARED `.btn-primary`/`.btn-secondary`/`.btn-success`/
`.btn-error` classes still carried the pre-redesign straight-down drop shadow** (`0 4px 6px rgba(...)`,
a 07-22d decision), caught by the user asking outright why a button still cast a downward shadow instead
of the centred glow BRAND-GUIDELINE.md's Shadow rule already states. Root cause: dozens of buttons got an
INLINE `boxShadow:'0 0 8px rgba(0,0,0,.48)'` override during today's screen-by-screen rebuilds, but the
shared class itself - the actual DEFAULT every untouched button falls back to - was never fixed, so any
button without its own override (most buttons on screens not touched today, and even some inline-styled
ones on screens that were) still rendered the old shadow. Fixed once at the shared class, closing it for
every `.btn` app-wide. Same sweep also caught and fixed: `.action-card`'s own literal 13/16px font sizes
(missed by the earlier typography sweep, which only scoped screen files, not index.css's own component
classes) → `--fs-caption`/`--fs-content-2`; `ErrorToast.jsx`'s old drop shadow removed entirely (it isn't
itself clickable, matching `NotifArea`'s notification cards, which carry no shadow either); `PctSlider.jsx`'s
draggable thumb and `LuckyPot.jsx`'s token-dropdown panel both converted from offset drop shadows to a
centred glow (both ARE interactive, so they keep a shadow - just the right kind). Re-verified About with
`tools/figma-check.mjs` - clean. `npm run build` clean, `npm test` 16/16.

**Fifteenth round-trip (2026-09-10, same day): NavBar spacing (user decision, not a Figma correction) +
four real LuckyPot bugs, one of them verified directly on-chain.**
- NavBar: `.navbar-btn` was bottom-anchored (`justify-content:flex-end; padding-bottom:10.5px`, matching a
  2026-09-10 Figma reading of icon-top-785/label-bottom-833.5) - the user asked directly for the icon+label
  block CENTRED in the 70px row instead, with less air between them. This is a stated design decision
  overriding the earlier Figma reading, not a "the code was wrong" correction - noted here so a future pass
  doesn't "fix" it back to bottom-anchored. Also dropped a redundant 2px inline `marginBottom` stacked on
  top of the 3px CSS `gap` (5px combined) down to a single 2px gap.
- **LuckyPot "N winners out of M players" used the wrong M** - `participantCount()` (18, a lifetime
  counter that never decreases) instead of who is actually ELIGIBLE for the current draw. The user compared
  against the real luckypot.cc site directly and found it disagreed (14) - **verified by calling the live
  contract directly** (a one-off script, not guessed): of the 18 lifetime addresses, exactly 14 have
  `eligibleBalance()>0` right now, matching the real site's number exactly. Neither number was fake - they
  measure different things - but the sentence needs the eligible count, not the lifetime one. Fixed by
  counting non-zero entries in the SAME `eligibleBalance` array `usePoolData.ts`'s pool-total sum already
  computes (`lib/luckyPot.js`'s new `eligibleParticipantCount` field) instead of summing them.
- **"Total tickets / Pool" and "My tickets / My deposit" were BOTH prefixed "$"** on both halves - the
  first half is a TICKET COUNT (no currency symbol at all), the second is a real USDC amount (reads
  "USDC", never "$" - this pool has no dollar display-currency, only the on-chain token). Fixed in
  `SplitAmount`; the small half's existing 15px/grey styling (Chú thích/`--color-muted-2`) already matched
  what was asked, no change needed there.
- USDC/ARC control changed from a dropdown (revealing ARC/ETH, both disabled) to a 2-segment TOGGLE - USDC
  filled/selected, ARC greyed out and unclickable right beside it, same underlying "only USDC works, no
  token yet" reason as before, per direct user request (no popup needed for a 2-way choice).
Verified with a live Playwright screenshot in mock mode (LuckyPot has no single static Figma frame to
diff against) - all four changes render correctly, nothing overflows. `npm run build` clean, `npm test`
16/16.

**Sixteenth round-trip (2026-09-10, same day): the same icon/label tightening applied to `.action-card`**
(Paste/Scan QR/Contacts on Send, QR storage/Custom QR/Share on Receive) - user decision, same pattern as
NavBar: `gap:6px` → `2px`. `align-items:center`/`justify-content:center` were already there (these were
never off-centre), only the icon-to-label gap needed closing. Verified with live Playwright screenshots
of HomeSend/HomeReceive in mock mode. `npm run build` clean, `npm test` 16/16.

**Seventeenth round-trip (2026-09-10, same day): two LuckyPot bugs, unrelated to each other.** (1) The
user felt Deposit/Withdraw/Result button text sat below-centre, not on it. A standard 4x-zoomed Playwright
screenshot confirmed real asymmetric spacing (more room above the text than below) - root cause was
`line-height: normal`'s default asymmetric leading, invisible on the app's usual 48px-tall buttons but
visible on LuckyPot's short 34px ones. Fixed with `line-height: 1` on the shared `.btn` class (`index.css`)
- one-line fix, no screen-specific override needed since every button inherits it. (2) The user reported
the balance "trơ ra" (stays stuck) right after a real deposit. `LuckyPot.jsx`'s `loadInfo()` was called
exactly ONCE, synchronously, right after `executeChallenge` resolves - **zero seconds of polling, no
retry**. That resolve only confirms the PIN signature was accepted and the tx was broadcast, not that it
is mined/indexed by the RPC yet, so the immediate read can and does land before the chain has caught up.
Added `reloadInfoAfterTx()` (immediate read + 2 delayed re-reads at 3s and 8s, same backoff shape
`multicallWithRetry` already uses inside one RPC call, just applied here at the UI layer across multiple
reads) and swapped all 3 tx handlers (`handleDeposit`/`handleWithdraw`/`handleClaim`) from bare `loadInfo()`
to it. `npm run build` clean, `npm test` 16/16.

**Eighteenth round-trip (2026-09-11): 4 real bugs the user found on a real iPhone/live app.**
1. **The iOS status bar area rendered pale blue instead of white.** `body`'s background was left at
   `#D6EAFB` - a value the file's own comment already flagged as "TEMPORARY for filming a clip... CHANGE
   BACK to `var(--color-white)` once filming is done" (index.css:114 explains standalone-PWA status bars
   take the body background colour). Filming was over; the temporary value never got reverted. Fixed by
   restoring `background: var(--color-white)`.
2. **Send screen's white token cards (USDC/EURC/...) had an 8px gap from the grey box on the left but sat
   flush (0px) on the right.** Root cause: the inner scroll container used `.scroll-thin`, whose
   `margin-right:-20px`/`padding-right:12px` trick pushes content 8px past the box's own 8px right
   padding - which then gets clipped by the box's `overflow:hidden`, gluing the cards to the right edge.
   This is the EXACT bug class `SavedQRList.jsx` already documents avoiding ("Do NOT use `.scroll-thin`
   INSIDE a grey box... iOS does NOT support `scrollbar-gutter` to compensate") - `HomeSend.jsx` just
   hadn't been switched over. Fixed by using `.scroll-hidden` instead (same fix SavedQRList already uses),
   verified visually - both sides now show the same gap. ⚠️ `Contacts.jsx` and `TxHistory.jsx` also use
   `.scroll-thin` inside an `overflow:hidden` grey box - same latent bug, smaller effect there (their boxes'
   own padding is 16px/14px, so the -8px push shrinks the right inset rather than zeroing it) - not touched
   this round since the user didn't flag them, but worth the same swap if noticed later.
3. **Scan QR showed "Point the camera at a QR code"** - a string invented on an earlier pass, never
   requested and with no Figma equivalent (the dynamic hint line itself is real, working functionality;
   this particular default text was not). Fixed by starting `hint` as `''` instead of that sentence -
   the line now only ever shows a REAL scan result (wrong network / own QR / invalid QR).
4. **Service hub's two cards were resized in Figma to a fixed 112px tall** (was 156px = a full
   double-row). Re-pulled `get_design_context` on node `1:43`: card 1 stays at top 86px (10.19dvh,
   unchanged), card 2 moves to 214px (25.36dvh) = card 1's new bottom (86+112=198) + the standard 16px
   gutter - re-derived from the fresh node, not assumed. Icon size/position, text gap, and padding were
   all re-checked against the same pull and are UNCHANGED (still land on the same numbers as the existing
   code). Verified with `tools/figma-check.mjs` against a fresh `get_screenshot` of `1:43` - card
   position/size match exactly (only difference is the app's real icons vs. Figma's black placeholder
   squares, expected). `npm run build` clean, `npm test` 26/26.

**Same day, a 5th bug: the Apple home-screen icon "didn't feel like the new logo (solid colour)".**
Diagnosed by rendering `design/new-brand/icon.svg` (the 2026-09-07 source for `public/icon.svg`/
`icon.png`/`fav_icon.png`) at its native size: the artwork was already the correct solid-blue "EZ" mark
(no gradient), but inset ~24% from the canvas edge on all sides - fine as a favicon on a white browser
tab, but on an iOS home-screen tile (which iOS masks/rounds at the OUTER square, not around the artwork)
it read as a mostly-white tile with a small logo floating in the middle, not a solid brand tile. Per the
standing rule that these brand files are the user's own, not to be redrawn by AI, this was reported back
rather than cropped/rescaled unilaterally - the user supplied a corrected full-bleed version
(`apple.svg`, same artwork, ~5% inset instead of ~24%). Replaced `public/icon.svg` + `design/new-brand/
icon.svg` with it, re-rasterised `icon.png`/`fav_icon.png` at 512×512 from the new SVG (Playwright
screenshot render, same approach as `tools/figma-check.mjs` - the old `C:\tmp\ezw-verify\render-icons.mjs`
no longer exists), and bumped the cache-busting query from `?v=2` to `?v=3` in `index.html` (favicons/
touch icons are cached hard - HANDOFF's own 09-07 note already flagged this same cache risk for the prior
icon swap). `npm run build` clean.

⚠️ **CORRECTED same day: `design/logo.svg` IS already the Inter wordmark - the user confirmed this
directly ("LOGO.SVG CHÍNH LÀ BẢN INTER") after an earlier note here wrongly flagged it as still
Barlow.** That earlier note was a misread of vectorized path outlines by eye (a text logotype is
flattened to paths, not live text, so it can't be checked by inspecting a `font-family` - the guess was
wrong). No file replacement needed here; `design/logo.svg` stays as-is.

**Same day, 3 more real bugs, one of them a repeat of a bug class already fixed once before:**
1. **The out-of-USDC faucet warning only fired at <=1 USDC and used the wrong colours** (pale-yellow card
   + BLACK body text, only the "Faucet" word itself coloured). User decisions: (a) threshold raised to
   <=20 - "under 20 USDC" now covers the old "freshly created empty wallet" case too, so it's one rule,
   not two; disappears only once balance is OVER 20. (b) Card must be WHITE with the icon AND all its text
   in `--color-warning` together - the same "white card, one solid type colour for icon+text" rule the
   real notification rows already use (`STYLE.received/sent/error` in NotifArea.jsx), not HintBlock's
   black-body/coloured-keyword pattern. Fixed in `HomeSend.jsx`; already non-dismissible (NotifArea's
   `warning` branch never renders an X button - same standing-hint treatment as the network/QR Storage/
   Create QR/Share hints).
2. **Notifications leaked across accounts on the same device - a REPEAT of a bug class `store.js` already
   fixed once for contacts/QR storage** (its own top comment: "It used to use shared keys... signing in
   with another account still showed the previous account's contacts"). `notif.js`'s `ez_notifs` and
   `NotifArea.jsx`'s `ez_notified_hashes`/`ez_last_recv_ts` were never migrated to that same per-account
   pattern - they were still one GLOBAL key each, so signing into an old, long-unused account on a device
   that had recently used a different account showed that OTHER account's still-under-24h notifications.
   Exported `acct()` from `store.js` (was private) and namespaced all 3 keys by wallet address exactly
   like `loadContacts()`/`loadSavedQRs()` already are - no sign-out cleanup needed, each account now just
   has its own separate storage the way contacts/QR already do.
3. **`TxHistory.jsx` could show a false "No transactions yet" on a real fetch failure** - `.catch(() => {})`
   + `setLoading(false)` on error looks IDENTICAL to a genuinely empty wallet, and the user could not tell
   which one an old account's blank history actually was. This is the exact "never fall back to a fake
   empty/0 state" lesson `HomeSend`'s balance fetch already learned (section 10) but `TxHistory` never
   applied - fixed the same way: on failure, keep loading and retry every 3s until a REAL answer (success
   or a genuinely empty `result: []`) arrives.
`npm run build` clean, `npm test` 16/16.

**⚠️⚠️ THE LOGO SCREEN BUG - and a process failure worth more than the bug itself (2026-09-11).**
The user reported, repeatedly and on BOTH iPhone and desktop, that the logo screen shown on entering the
site draws the logo DEAD CENTRE instead of row 3. I measured `Splash.jsx`, found it pixel-perfect against
Figma node 1:169 (`figma-check` diff clean, live bundle byte-checked, a real browser at 1440x900 reading
191.5/900 = exactly 21.28%) and told the user their screenshot must be wrong. **I was measuring a screen
the user almost never sees.**
- `ez_pin_ok` lives in **sessionStorage**, so it is gone every time the browser is reopened. `App.jsx`
  (lines ~66-69) then boots a returning user with a saved wallet **straight into `PinGate`** - `Splash`
  is never rendered on that path at all. Splash is only reachable on a fresh login.
- `PinGate.jsx`'s busy state (the default on mount, shown while Circle's PIN iframe loads) drew its own
  lockup: `row-1-9 center col` + `width:56%` → rows 1-9 = y 0-758, centred = **379/844 = 44.9%**, and 6%
  too wide. That is exactly the "logo in the centre" in the user's screenshots. `ForgotPin.jsx` had an
  identical copy. So 2 of the 4 screens that draw the wordmark were correct (Splash, Login) and the 2 that
  users actually hit every visit were not.
- **The lesson (bigger than the fix): when a user's direct observation conflicts with my measurement, the
  default assumption must be that I am measuring the wrong thing - not that the user is wrong.** Verifying
  one component in isolation proves nothing about what the app actually renders; check the ROUTING
  (`App.jsx`) first to find out which component the user is really looking at.
- **THE FIX - one shared definition, per the same rule `.screen-title` already follows:** the lockup now
  lives ONLY in `.logo-lockup` (`index.css`, see THE LOGO RULE written there with the measured numbers).
  Splash/Login/PinGate(both states)/ForgotPin(both states) all render `<img className="logo-lockup">` with
  NO inline positioning. Do not re-add a per-screen variant. Verified: all four measure top 179.59px /
  21.28dvh / width 195px at 390x844.
- PinGate/ForgotPin's error text moved out of the old flex block to its own absolute line at 34.72dvh -
  the same slot Login's slogan occupies, i.e. directly under the lockup.
⚠️ NOTE FOR TESTING: `?screen=PinGate` in mock mode does NOT show this screen - mock auto-unlocks, so
`unlock()` resolves instantly and navigates to HomeSend. Verify the class through Splash/Login (same
class) or on a real deploy.

**Faucet hint, corrected twice in one session (2026-09-11) - final state:** shows when USDC is **strictly
under 20** (at exactly 20.00 it is already gone - the user caught a `<= 20` version still showing on a
$20.00 balance), and is drawn as a WHITE card with **no icon** and **semibold** `--color-warning` text,
padding 6px/10px + radius 16, i.e. structurally identical to the hint card above it. Two rules came out
of this, both app-wide: **(1) COLOURED TEXT IS ALWAYS SEMIBOLD** - at 13px on white, neither the red
network line nor yellow warning text carries enough contrast at regular weight (the user: "đỏ và vàng
phải bold cho dễ đọc"); **(2) blocks in the notification area are TEXT-ONLY** - the warning's icon made it
the odd one out next to the icon-less hint card.

**⛔ CIRCLE'S PIN SCREEN - 2 real complaints that CANNOT be fixed from this codebase (checked 2026-09-11,
do not re-investigate without new information):** (a) entering a wrong PIN does not auto-clear the dots,
(b) on mobile the keyboard does not open until the field is tapped. Both are behaviours INSIDE Circle's
PIN UI, which is an iframe served from **`https://pw-auth.circle.com`** - a DIFFERENT ORIGIN from
ezwallet.cash, so the browser blocks all DOM access: we cannot read or clear its inputs, and we cannot
call `.focus()` on them (which is what would raise the mobile keyboard; on iOS even a same-origin
`.focus()` needs a real user gesture, so this would likely fail anyway). The SDK's iframe field is
`private readonly` and its **entire public API is 14 methods** - `setAppSettings`, `setAuthentication`,
`updateConfigs`, `getDeviceId`, `performLogin`, `verifyOtp`, `execute`, `setCustomSecurityQuestions`,
`setLocalizations`, `setResources`, `setThemeColor`, `setCustomLinks`, `setOnForgotPin`,
`setOnResendOtpEmail` (read from `node_modules/@circle-fin/w3s-pw-web-sdk/dist/src/index.d.ts`, v1.1.11).
The PIN screen is reachable through **text only** (`Localizations.enterPincode.headline/headline2/subhead/
forgotPin`, `Common.retry`) and **colours only** (`ThemeColor.pinDotBase/pinDotActivated/pinDotBaseBorder`,
`inputBorderFocused*`). There is NO hook for clearing the dots, focusing the input, or any other
behaviour. → The only route to a fix is **Circle themselves**; add these two to the same report channel
that `common.showPin` was already raised on (see the Current limitations list in README).

**LuckyPot note (2026-09-10):** the user redrew this frame's own Figma to bring it closer to the real
luckypot.cc frontend, then added a "My history" box to row 9 (next to "Draw history") - the handler
(`openMyHistory`) and its popup already existed in the code, only wired into the hamburger menu; row 9
now calls it directly. Two more real mismatches came out of this rebuild specifically: `TokenDropdown`
was a solid-blue pill with white text (Figma: white pill, black text, glow shadow) and every stat-box
label had `textTransform: uppercase` left over from a 2026-08-09 decision that this newer Figma pull no
longer follows (only "EPOCH #3" is capitalised, and that is literally typed that way in the string, not
a CSS transform) - both were caught by the diff tool, not by eye.

**Exchange note:** rebuilt `Swap.jsx` in place (same screen id, Figma just relabels the tile "Exchange" -
see ServiceHub). The user's instruction *"vùng từ hàng 8 trở lên là vùng dành cho slider"* is now literal:
the round-number chips + `PctSlider` sit in an absolutely-positioned block at rows 7-8 (top 61.14dvh,
height 18.48dvh), matching the blank space in the Figma mockup (which does not render the slider's own
UI, being a static frame). The CTA button lost its old "3/4 of the screen width" rule - node 1:85 is
340px wide, the same edge-to-edge width as the cards above it, with a larger one-off glow
(`0 0 20px rgba(0,0,0,.32)`) that is NOT the shared button shadow. The button copy stays "Slide or tap
here to **enter**" (not "input") - a standing, deliberate override recorded in `FIGMA-SCREENS-SPEC.md`
§9, not a miss.

⚠️ **On the Exchange round-trip (same day, later):** the reverse button and the CTA both had REAL bugs
the user caught by looking at the app, not by diffing. (1) The reverse button used the raw Figma pixel
(26.71dvh), which sits mostly INSIDE the "You pay" card rather than bridging the gap between the two
cards - moved to the literal midpoint of the gutter (29.62dvh) per the user's explicit "phải nằm chính
giữa 2 box". (2) The CTA had `height:'100%'` on its 70px row-9 slot, making it 70px tall ("mập") instead
of the 48.66≈48px Figma draws right there in the design context - the data was available the whole time,
the code just filled the row instead of reading it. Also: the round-number hint chips still carried the
pre-rebuild `--fs-item` (17px); verified live against Figma that "Available: 20.00 EURC" and "Hold to
show tokens" both read 16px on this same screen pull and fixed the chips to match - EnterEmail's
suggestion/domain chips were ALSO re-verified live (not from memory) and turned out to be 16px too, not
the 17 the code had.

**Third round-trip:** the user redrew Service hub's and Exchange's headers in Figma (they had been wrong)
and asked for a check. Both now match `.screen-title`'s bottom-anchored/28px/centred rule exactly -
**zero changes needed**, because both titles were already routed through the shared class rather than a
one-off position, so the correction landed automatically. This is the payoff of "one shared definition":
fix the rule once, every conforming screen inherits the fix for free.

**THE RECURRING BUG CLASS, stated plainly:** a fixed pixel value (a button height, an icon size) sits
right there in the Figma design context, and the code uses a relative/generic value instead
(`height:'100%'` of a row slot, a shared token that was never re-measured) - not because the value was
hard to find, but because nobody read the number that was already in hand. This happened on the CTA
button THREE separate times across two different screens (Exchange's CTA, then the discovery that the
SAME bug lived in the shared `.btn` class - see §5) before it was fixed at the class level. **When
sizing anything, check the design context response for that exact node's own height/width before writing
a percentage, a `dvh`, or a `100%` - do not default to "fill the container".**

**Fourth + fifth round-trip, same day:** the user is actively iterating on the Figma file WHILE this
rebuild is in progress, not just fixing typos - `Confirm transaction` (`1:215`) and LuckyPot's 3-button
row were both **structurally redrawn** between one `get_design_context` call and the next, not just
nudged: the confirm card went from 328px/4 rows to 242px/3 rows and the warning line changed from loose
text into a real positioned 340×70 box with its own literal `rgba()` fill; LuckyPot's Deposit/Withdraw/
Result went from a 92:91:125 proportion to exactly equal (102.66px each). Neither was an error in the
earlier read - the frame itself changed. **⚠️ Do not trust a design-context response as still current
just because it was fetched earlier today.** If the user says a rebuilt screen still isn't right, RE-FETCH
`get_design_context` for that node before touching any code - diff the fresh response against what the
component currently does, rather than re-guessing at spacing/font tweaks. Both fixes are recorded in
commit `9dc9fa8`.

**Sixth round-trip, same day:** the user asked to rebuild Confirm transaction/Receipt again, calling the
"cannot be undone" warning box invented drama for a wallet with no bank-style reversal to warn about -
a RE-FETCH of node 1:215 confirmed the Figma frame agrees: the warning node is gone entirely now, not
just redrawn, so `SendConfirm.jsx` dropped it outright (no replacement). The same fetch caught two more
real drifts nobody had asked about: (1) the card's own text inset measures **8px from the card edge, not
18px** - `.confirm-row` padding was quietly stale from an earlier pull; (2) the fetch now draws a real 1px
divider under every row but the last (`.confirm-row:not(:last-child)::after`), reversing the 09-10 "no
grey rule, spacing from padding alone" decision recorded lower in this file - that decision was for a
frame that no longer exists. Also caught: Receipt's own "Amount" row inside the card had **no styling at
all** where Figma draws it 22px semibold brand-blue (SendConfirm's had this; Receipt's copy of the same
card never got it). Verified with `tools/figma-check.mjs` against a fresh `get_screenshot` of both nodes -
diff panels clean, `npm run build` clean, `npm test` 16/16.

---

### ⚠️ READ THIS FIRST - LuckyPot Deposit/Withdraw/Claim/History is LIVE AND VERIFIED ON-CHAIN

`functions/api/luckypot.js` encodes deposit/withdraw/claim/sweep calldata and calls Circle's real
`contractExecution` (same pattern as `swap.js`); `src/circle.js` has the matching
`executeLuckyPot{Deposit,Withdraw,Claim}` wrappers. **The user tested a real $10 Deposit on a deploy
2026-09-07 and it worked** - independently confirmed on-chain (not just "the UI said success"): the
wallet `0x29Eb3eC21a556dF96384A01E44E28B1F9488d03D` shows up as a brand-new `participants()` entry with
`balances()=10 USDC`, and the pool's `balancesTotal()` rose by exactly $10 in the same block range
(tx `0xff96d0...` → `Multicall3From.aggregate3`, status ok). Withdraw/Claim use the same signing path
and are built but not yet individually confirmed on-chain the same way.

**Layout went through several rounds of user corrections on 2026-09-08** (`Desktop/LUCKYPOT-LAYOUT-SPEC.md`
is the base; trust the chat corrections below over that file where they differ):
- Row 1: menu icon (1/3 of the row's height) + "LuckyPot.cc" wordmark, BOTH in Space Grotesk (the drawn
  logo SVG was dropped entirely) - this also freed the row's right side for the app-wide `BugButton`
  (renders absolute at right:20/top:5dvh on every screen).
- Row 2: one hint strip, ALWAYS solid `var(--color-warning)` + black text - faucet suggestion (direct
  copy-address-and-open-faucet action, no popup) OR a "you won" prompt (icon becomes `check`).
- Epoch box + Tickets box: `var(--color-surface)` (light blue), fixed height (243.2/844 → `28.82dvh`),
  4 equal sub-rows via flex (the last spans 2), a divider line under sub-rows 1 and 2 (without it the box
  read as one undifferentiated block - user fix). Amounts render as "$black-17 / $grey-14"
  (`SplitAmount`). The USDC/ARC toggle became a `USDC ▾` dropdown revealing ARC/ETH, both disabled (no
  token yet) - 2 plain pills made ARC look like a live option.
- **TYPOGRAPHY (final, revised twice)**: headers/titles (the wordmark, EPOCH #, TOTAL TICKETS/POOL, My
  tickets/deposit, Draw history, EVERY popup title) use **Space Grotesk** (luckypot.cc's own brand font),
  all-caps. Everything else uses the app's normal system-font stack - NOT Inter (tried once, reverted:
  ezwallet dropped webfonts app-wide on 08-25 for first-paint speed, so only Space Grotesk is loaded, and
  only on this one screen, injected on mount via `useLuckyPotFonts()` - not in `index.html`). One local
  size scale for the whole screen (17 for header/emphasis, 14 for body) - NOT the app-wide 15/19/25/52
  tokens, which read as inconsistent/oversized here (this applies inside every popup too now).
- **Fixed a real bug**: "0 winners out of 0 players" - `numWinners`/`eligibleParticipants` on
  `getEpoch()` only get written when an epoch COMMITS near draw time, reading 0 the rest of the week.
  Switched to the off-chain estimate the real luckypot.cc frontend uses (`frontend/src/lib/prize.ts`:
  `projectedWeeklyYield` + `estimateNumWinners`, sqrt-based) fed by live `eligiblePoolTotal` +
  `currentAprBps`, and live `participantCount()` instead of the frozen field. Verified against live RPC
  (eligible pool ≈5732 → estimate = 2 winners, matching the real site).
- **Result button**: only enabled during the live self-claim window (`prevEpochDrawnAt..+SWEEP_DELAY`),
  dimmed otherwise - browsing OLDER results is Draw History's job now, not this button's.
- **Draw History AND My History both built for real** (both used to be disabled placeholders):
  - `getEpochHistory()` multicalls `getEpoch()` over past ids for Draw History.
  - `getMyHistory()` reads `Deposited`/`Withdrawn`/`Claimed` EVENT LOGS via ArcScan's Etherscan-compatible
    `getLogs` endpoint, filtered by the wallet's address as the indexed topic - a raw `eth_getLogs`
    against the public RPC over the whole history since deploy hits `"requested range too large"`
    (verified against the live RPC), ArcScan's own indexer has no such cap.
  - **Fixed a real bug here too**: ArcScan answers BOTH "genuinely no logs" and a rate-limit/error with
    the same `status:"0"` - only `message` differs (`"No logs found"` vs anything else). The first version
    treated both as empty, which would tell a rate-limited user "No activity yet." when they actually have
    history. Now only `message === "No logs found"` returns `[]`; anything else throws.
- Popup shell: **5/6** of the MOBILE frame width (not the browser viewport - `.popup-overlay` is
  `position:fixed` to the whole window, so a naive `width:75%`/`83%` balloons past the phone frame on
  desktop; use `min(calc(100vw*5/6), calc(var(--screen-max)*5/6))`, same idiom `.row10-single .btn`
  already needed). Closes ONLY via the X top-right or a click outside - no bottom Close button.
- Referral stays OUT of scope (the only thing still deliberately unbuilt on this screen).

**Verified:** `npm run build` clean, `npm test` 16/16, every popup/state screenshotted with Playwright in
mock mode (390px AND a wide 1280px viewport to catch popup-width regressions) - copied to Desktop each
round. `getMyHistory`'s ArcScan query pattern (topic0 hashes, address-topic padding, ABI decode) was
verified against the real deposit tx (`0xff96d0...`) before being trusted, not guessed.

### 🔗 THE 4 OFFICIAL LINKS - use this set when introducing the project (user decision 08-04)
| | |
|---|---|
| **Demo** | https://ezwallet.cash (domain bought on Cloudflare 07-29; `ezwallet.pages.dev` runs alongside it, auto-deployed from `main`) |
| **GitHub** | https://github.com/KattyFury/ezwallet |
| **Video** | https://youtu.be/UIR4Ee3Wp_Y |
| **Deck** | https://canva.link/zr3ik84radd39vc |

### 📍 WHERE THINGS STAND (end of session 2026-09-08, part 2 - the Figma re-sync)

⚠️ **The 09-07 brand redesign bullet below is PARTLY STALE as of 09-08 - read this first, not that.**
Same day, later: the user re-drew several screens in Figma (file `iQxFGA890VhyXkEKipCC9C`, now 9 frames,
up from 8) and declared **that file's palette the new canonical source, reversing the 09-07 colour
decision one day after it shipped**. What actually changed 09-08:

- **`--color-surface`/`-2` is back to light GREY `#F1F5F9`** (NOT the light blue `#E3F1FF` from 09-07 -
  that lasted exactly one day). `--color-muted` split into TWO tones (`#94A3B8` general secondary/nav-
  inactive/placeholders, `#667085` specifically the "Label:" prefix word in meta lines like "Available:"/
  "Fee:"). `--color-error` is now `#FF383C` (was `#EC221F`). Full rationale + the reversed-premise banner:
  `BRAND-GUIDELINE.md` (rewritten) and `FIGMA-SCREENS-SPEC.md` (rewritten for all 9 frames - the old
  8-frame version was reading a Send-money design that no longer exists).
- **NEW rule: shadows only on CLICKABLE elements**, a centred glow (no x/y offset) instead of the old
  straight-down `0 4px 6px`. **NOT YET applied to the actual CSS/JSX** (`.btn-primary` etc. still use the
  old shadow) - apply it screen-by-screen when each one is rebuilt, not as one big sweep.
- **Button text sizes went DOWN app-wide** (safe - shrinking can't overflow a button that already fit):
  `.btn` 21px Medium → **19px Semibold**; `.action-card` (Paste/Contacts-style) 17px Medium → **15px
  Semibold**; `.action-card.primary` (the emphasised middle one, e.g. Scan QR) → **17px Semibold**.
- **Every screen title's weight fixed app-wide**: the repeated `row-1 center screen-title` inline style
  (16 screens) was rendering at Medium(500); the real rule (confirmed identically across 4 separate Figma
  frames) is **Semibold(600)**. Fixed in all 15 titled screens (Contacts.jsx's OTHER title, "Adjust
  photo", was left alone - different row, not this pattern).
- **`BalanceHeader.jsx` (the big balance on Home send/Home receive/Menu)**: capped at **50px** (was 76),
  now occupies row 1 + HALF of row 2 (was 2 full rows), hard-capped at **≤75vw** so a long decimal amount
  never overflows - this was the exact bug the user hit ("$10,000.00" pushing past 3/4 width).
- **`HomeSend.jsx` fixes**: token name went Semibold→**Regular**, the amount is now **brand-blue** (was
  black, matching the label-black/value-blue pattern used everywhere else), added the thin divider lines
  between token rows that Figma has and the app was missing.
- **`LuckyPot.jsx`**: buttons (Deposit/Withdraw/Result) are now a fixed **2/3 of a 10dvh row** with
  `flexShrink:0` - the stat box's tight flex layout was squeezing them shorter than every other button in
  the app. ⚠️ **Its Space-Grotesk-ALL-CAPS typography is UNCHANGED and must STAY that way** - a first pass
  this session wrongly "normalised" it to the app-wide font/casing, which the user explicitly reverted:
  that treatment is a deliberate, already-decided per-screen exception (see the file's own header
  comment), not a lint error. **Lesson for next time: a screen with its own dated "user decision" comment
  block is not fair game for a blanket guideline sweep - only apply the parts that have no stated
  exception (this session, that meant spacing/button-sizing only, not typography).**
- **NEW:** `SEND_MONEY_FIGMA_SPEC.md` (repo root) - the Send money screen's build spec. Its big finding:
  the redesigned Send money screen copies `Swap.jsx`'s architecture (% slider + round-number hints +
  numpad bottom-sheet) instead of `SendAmount.jsx`'s always-on numpad - a real architecture change, not a
  reskin. All open questions for it are resolved (see the file) - **not built yet**, next in line.
- **NOT YET DONE (still pending, in priority order): Send money + Exchange screens (spec-ready, 0 code
  written) · `NavBar.jsx` rebuild (raised-white-cell-bleeding-into-content mechanism, §5 of
  FIGMA-SCREENS-SPEC.md - direction confirmed, not built) · the shadow-glow migration across
  `index.css`/JSX · Home receive (needs a fresh `get_design_context` read, not done this session) ·
  Menu/Service Hub restyle to the new grey surface + button sizes (PigSave should be REMOVED, not just
  disabled, per a 09-08 decision) · Splash/Login screens re-verified against Figma (only checked via
  metadata, not a full design-context read, this session).**

### 📍 WHERE THINGS STOOD (end of session 2026-09-07, mostly still true - see the 09-08 box above for what changed since)

- **One branch only: `main`** (a parallel `privy` branch exists from an earlier, since-abandoned attempt
  at a different PIN mechanism - **do not check it out or merge it without an explicit go-ahead**, user
  instruction 2026-09-07). Latest commit on `main`: `7b7d268`.
- **Forgot PIN is now real**: Circle's own "Forgot PIN" button inside the PIN-entry iframe used to do
  nothing (no callback registered anywhere) - now wired to a new `ForgotPin.jsx` screen through
  `POST /user/pin/restore` (security-questions recovery). See section 9's session table for detail.
- **Brand redesign applied from 2 user-written spec files** (`BRAND-GUIDELINE.md` +
  `FIGMA-SCREENS-SPEC.md`, both in the repo root): solid brand blue everywhere (no more gradients),
  system font (Barlow is gone), new NavBar (raised white active cell on a flat grey bar, ⚠️ NOT actually
  built yet as of 09-08 either), recessed boxes/inputs were light blue `#E3F1FF` for exactly one day
  (⚠️ SUPERSEDED 09-08, now grey `#F1F5F9` - see the box above), Service Hub rebuilt to full-width cards.
  The new brand icon/logo assets (`public/icon.svg`, `design/logo.svg`) are the user's own official
  files, not redrawn.
- **LuckyPot integration - Deposit/Withdraw/Claim BUILT (M1-M4), untested on a real deploy.**
  `src/lib/luckyPot.js` (M1, reads) was already verified against LIVE Arc Testnet RPC in the prior pass.
  This pass added the writes: `LuckyPot.jsx` now matches `Desktop/LUCKYPOT-LAYOUT-SPEC.md` row-by-row
  (logo + hamburger menu popup with Deposit/Withdraw/Draw history[disabled]/My history[disabled]/Exit;
  row 2 dynamic banner - gold "claim your prize" when `owedTo(prevEpoch)>0 && !hasClaimed`, else a
  faucet-copy-address banner; epoch box; tickets/deposit box with Deposit/Withdraw/Latest-result
  buttons; row 9 Draw history dimmed/disabled; row 10 Exit). Referral stays OUT of scope (spec §0) -
  intentionally no `?ref=` capture, no `setReferrer` call anywhere in this pass.
### 📒 WHAT SESSION 2026-09-07 DID (long session, several unrelated threads - see the honest note at the top of this file)

| # | Work | Commit |
|---|---|---|
| 1 | **Forgot PIN wired up for real** - Circle's own "Forgot PIN" button inside the PIN-entry iframe existed but did nothing (no `setOnForgotPin` callback registered anywhere in the app). Added `functions/api/luckypot.js`-style backend action `restorePin` (`POST /user/pin/restore`), `src/circle.js` `restorePinChallenge()`, and a new `ForgotPin.jsx` screen (same shape as `PinGate.jsx`) | `b7bea59` |
| 2 | **Full brand redesign** from the user's own `BRAND-GUIDELINE.md` + `FIGMA-SCREENS-SPEC.md` (both written this session, both in repo root - read them before touching colours/fonts/layout again): the old multi-tier iOS grey system collapsed onto the guideline's 7 colours, all gradients → solid, Barlow → system font, NavBar rebuilt (raised white active cell), Service Hub rebuilt from a 2-column tile grid to full-width cards, new brand icon/logo applied (user-supplied files, not redrawn) | `914980c` |
| 3 | **LuckyPot draft frame** added (placeholder, not the final design) so there was something to build the real integration on | `8295dc9` |
| 4 | **LuckyPot M1 (read-only)** - `src/lib/luckyPot.js` reads real balances/epoch/referral data via `publicClient.multicall`, same discipline as `chain.js`'s battle-tested balance reads (batch, retry, never fabricate a 0 on failure). **Caught a real bug**: `getEpoch()` returns 10 flat values, not one tuple - found by testing against LIVE Arc Testnet RPC (mock never exercises the real decode path), fixed before it shipped | `eeed013` |
| 5 | **Tried, then reverted, a LI.FI icon** on the Exchange card - the swap backend actually calls Circle's Stablecoin Kit, not LI.FI directly (verified: no LI.FI reference anywhere in `functions/api/swap.js`/`_swapCore.js`, and Circle's own docs describe StableFX routing through Talos + market makers). Card now correctly credits "Stablecoin Kit" | `c30ffdc` |
| 6 | **Real LuckyPot brand icon** applied (was a placeholder 4-leaf-clover ezwallet drew before real assets existed) - pulled from the user's own `KattyFury/LuckyPot` repo, not redrawn. **Picked the wrong file on the first try** (`brand-assets/pfp.svg`, missing the black outline) and had to fix it to `src/assets/logo.svg` (the real 3-path version) after the user caught it from a screenshot | `4af6677`, `7b7d268` |
| 7 | **Recessed-box colour**: `#E3F1FF` (light blue) replaces grey for input fields and sunken content boxes - `--color-gray` (borders/dividers/NavBar) stays grey, only `--color-surface`/`-2` changed | `878aabe` |

**Decisions the user settled this session (do NOT ask again):**
- LuckyPot theme inside ezwallet: **light/blue, matching ezwallet's own tokens** - NOT the dark/green
  theme a separate AI-generated draft proposed (that draft is not in this repo; its write-flow logic was
  reused, its theme/layout/architecture were not - see the "real next step" note at the top of this file).
- LuckyPot screen row 1: **the LuckyPot logo + a hamburger menu icon** (not a plain centred title).
- Referral: **link-based** (`?ref=0x...` → localStorage → bundled into the first Deposit), reusing
  luckypot.cc's own already-proven mechanism verbatim - not a manual input field.
- Referral IS in scope for this integration (not deferred to later).
- Piggy Bank's Service Hub card: removed from the UI (not deleted from code, see `ServiceHub.jsx`'s
  comment) because the new Figma frame only shows 2 cards (Exchange, LuckyPot) - whether it comes back
  is still open (`FIGMA-SCREENS-SPEC.md` §8.3).

**Read before continuing LuckyPot work:** `Desktop/LUCKYPOT-INTEGRATION-SPEC.md` (contract ABI, addresses,
the `contractExecution`/Multicall3 pattern - all verified against the live contract) and
`Desktop/LUCKYPOT-OPEN-QUESTIONS.md` (product-intent questions, now mostly answered - see the decisions
list above). The actual `KattyFury/LuckyPot` repo (local clone: `D:\Files\Claude\Build on Arc\luckypot`)
has real, working reference code for all of this (`frontend/src/hooks/usePoolData.ts`,
`frontend/src/pages/Deposit.tsx`, `frontend/src/lib/referralState.ts`) - read it again rather than
reconstructing from memory.

**Verification:** `npm run build` clean and `npm test` 16/16 after every commit above · the LuckyPot M1
read path was tested against the LIVE Arc Testnet contract with a standalone script (not just mock) ·
every UI change was screenshotted with Playwright AND copied to the user's Desktop (they cannot run the
dev server themselves - always do this for UI work, not just describe it).

### 📒 WHAT SESSION 2026-08-25 (PART 2, UI POLISH BATCH) DID

| # | Work | Written up in |
|---|---|---|
| 1 | **Swap confirmed working again** - the user tested a real swap on a deploy, no `331001`. The Circle support questions were sent (no reply needed any more, the outage resolved itself) | 4 |
| 2 | **24h price-change indicator**: a small green/red triangle after each token's amount on the Send tab, tap → a popup with the exact % and "Value changed from X to Y". Backed by CoinGecko's `usd_24h_change` (added to the existing `simple/price` call in `chain.js:fetchPrices` - no extra request) · `TOKENS`/`getTokenBalances` now also return `change24h` per token · hidden when the move is under 0.005%. **VOLATILE TOKENS ONLY (user correction, first pass showed it on USDC/EURC too - "stablecoin thì đâu có biến động")**: `STABLECOINS = ['USDC','EURC']` in `HomeSend.jsx` gates it, so today only cirBTC gets the arrow. **Gap is EXACTLY 15px** (user correction - the first pass's flex-gap + button padding stacked to more than that): the button's own `margin: '-6px -6px -6px 9px'` cancels its 6px touch-padding on 3 sides and leaves precisely 9+6=15px on the left; no arrow for a token → no gap at all, the amount sits flush at the row edge exactly as before the feature | HomeSend.jsx, chain.js |
| 3 | **Home hint block reworded**: `Available Network: Arc Testnet` → `Current Available Network: Arc Testnet` (user request) | NotifArea.jsx |
| 4 | **The Paste / Scan QR / Contacts hint titles on the Send tab are no longer tappable** - the user reported they navigated to "random" places; the row-9 buttons below already do the same job, so the `onClick` on the hint labels was simply dropped | HomeSend.jsx |
| 5 | **Scan QR caption reworded**: "Scan crypto wallet QRs only" → "Scan Arc Testnet QRs only" (matches the network-lock wording used elsewhere) | QRScanner.jsx |
| 6 | **Security's icon replaced** with a new hexagon shield drawing from `D:\Files\Claude\Icons\shield.svg`, normalised on import (stroke `black`→`currentColor`, as the header comment in `Icon.jsx` prescribes) - same filename `icon/shield.svg`, so no code change needed elsewhere | icon/shield.svg |
| 7 | **Menu's "Currency" entry + the screen's own title became "Language & Currency"** (user request - the name should say what the screen still half-implies even though the language picker itself is gone) | MenuScreen.jsx, Currency.jsx |
| 8 | **Send screen: the `Balance:` line moved** from beside "Send to" (added just last session, 9A above) down into the blank space right below the note field - the user found the original grouping "hơi xấu" (a bit ugly). "Send to" now stands alone where the pair used to be | SendAmount.jsx |
| 9 | **The USDC gas reserve lowered 1 → 0.1** (user decision) - `GAS_RESERVE_USDC` in `data.js` is the single source of truth (`spendableOf()` uses it everywhere "available to send/swap" is computed), so this one constant change updates Send, Swap and the Balance line together. The `<=1` low-balance warning threshold on HomeSend (separate hardcoded number, "out of USDC for fees") was deliberately left at 1 - it is an early warning, not the reserve itself | data.js |

**Decisions the user settled this session (do NOT ask again):**
- `- 08-25: hint-block titles (Paste/Scan QR/Contacts) are plain text, not links` - reason: they duplicated the row-9 buttons and just added a second, confusing way to navigate.
- `- 08-25: Currency screen is named "Language & Currency"` - reason: kept as the umbrella name even with only a currency picker inside, in case language ever returns there.
- `- 08-25: the 24h change arrow hides below a 0.005% move, AND only shows for non-stablecoins` - reason: USDC/EURC are pegged 1:1 and barely move day to day; an arrow "moving" on peg noise would mislead rather than inform. Today this means cirBTC only.
- `- 08-25: GAS_RESERVE_USDC = 0.1 (was 1)` - reason: 1 USDC held back was far more than real gas costs on Arc, over-reserving on a small balance.

**Verification:** `npm run build` OK · `npm test` 16/16 · a Playwright pass on the mock at 390×844 and 375×812 (HomeSend token list + the price-change popup, Menu, Language & Currency, Send money with the relocated Balance line) - no console errors on any screen. The Scan QR camera cannot be exercised headless (`getUserMedia` fails in that environment, an existing limitation, not a regression), so its 3-line caption was verified by reading the source instead of a screenshot.

---

### 📒 WHAT SESSION 2026-08-25 DID (8 commits, `f467b6d` → `dbce9bd`)

| # | Work | Written up in |
|---|---|---|
| 1 | **Service Hub: the DCA tile became LuckyPot** (still hidden/`screen: null`), using the user's own `icon/luckypot.svg` - the first FULL-COLOUR icon in the set | 3 · `Icon.jsx` |
| 2 | **Vietnamese and Chinese removed from the project entirely.** The i18n layer is gone, not merely switched off: `src/i18n.js` + `src/circleLocalizations.js` deleted, 219 `t('...')` calls replaced by plain English, `check-lang` deleted, `Language.jsx` → `Currency.jsx` (currency only, CNY/VND options dropped) | 2 |
| 3 | **Every comment and document translated to English** - all 46 files under `src/`, `functions/`, `test/`, the CI workflow, the root scripts, `README.md`, `PITCH.md`, `CLAUDE.md` and this file. `.env.txt` was deliberately left alone (gitignored, holds secrets) | - |
| 4 | **2 notification bugs fixed** (reported by the user): a faucet payout showing "received 0.00 cirBTC" (a hardcoded `toFixed(2)` against cirBTC dust → the new shared `data.js:fmtTokenAmount`), and long notifications being cut off with "…" (the row was pinned to one line → it now wraps) | 7e |
| 5 | **The network line in the hint block became `Available Network: Arc Testnet`** - two passes: the user first asked for "currently" so the sentence would leave room for more networks, then cut it to this label form because the longer sentence wrapped onto 2 lines. It now matches the `Label: value` shape of the 3 hint lines under it and fits one line down to 360px. The QRScanner wrong-network message keeps the sentence form ("this wallet currently only works on Arc") | 7b |
| 6 | **The CI workflow finally landed** (`.github/workflows/ci.yml`) after switching the git identity to the `KattyFury` account, whose token carries the `workflow` scope | 9 · item 2b |
| 7 | **The Send screen shows the balance**: a `Balance: $126.66` line directly above `Send to:` (user request - "the Send screen is missing Balance"). It shows the SPENDABLE amount (the same number the "Insufficient balance" message quotes, i.e. minus the 1 USDC gas reserve), formatted with `fmtMoney` so it follows the selected currency: `$126.66` / `84.20 EURC` / `0.01542000 cirBTC`. Loading → `…`, never a drawn 0 | 6 |

**Decisions the user settled this session (do NOT ask again):**
- `- 08-25: remove Vietnamese and Chinese from the project` - reason: the app has been English-only in production since 08-13, and keeping an i18n layer whose keys are Vietnamese strings meant carrying a whole translation system for one language.
- `- 08-25: translate every comment and document, this file included` - reason: if the project is English, it is English everywhere, the same all-or-nothing rule that governed the languages.
- `- 08-25: keep LuckyPot hidden` - the tile is renamed, but the service is still not built.
- `- 08-25: notifications may grow taller rather than lose words` - reason: a truncated notification hid the token being received.

**Known consequences to keep in mind:**
- The VND plumbing (`chain.js` rates, `qr.js` parsing, `amountHint.js`) is still in the code but is now UNREACHABLE - nothing can select VND. It was left in place deliberately rather than ripped out on the same day as everything else; delete it in its own session if it is ever confirmed unwanted.
- `Swap.jsx` and `SendAmount.jsx` still carry their own local `decimalsFor()` alongside the new shared `fmtTokenAmount` - out of scope for the bug fix, worth unifying later.
- The `Balance:` line makes the Send screen's amount row sit ~15px higher than CreateQR's, breaking the pixel alignment those 2 screens had (section 6). Deliberate.
- The hint block is back to 4 single lines (115px at ≥375px, 138px at 360px) after the network line was shortened, so nothing has to be scrolled to be read. Keep that line SHORT if it is ever reworded - the block shares a fixed-height area with the notifications.

**Decisions the user settled this session (continued):**
- `- 08-25: the Send screen shows the SPENDABLE balance, not the raw one` - reason: the raw balance would promise money that Continue then refuses. Consequence accepted: Send can read $126.66 while Home reads $127.66.
- `- 08-25: the network line is a label, not a sentence` - `Available Network: Arc Testnet`, one line at every width.

**🧪 DEPLOY CHECKLIST FOR THIS SESSION (nothing below has been touched on a real device yet).**
Everything was verified with Playwright on the mock at 390/375/360px, `npm test` 16/16 and a production build - but the mock cannot exercise Circle, the faucet or a real share sheet:
- [ ] Open `https://ezwallet.cash` on the phone → login + PIN still work (the Circle localisation calls were removed; the PIN screen must come up in Circle's own English, not blank or broken).
- [ ] Tap the faucet on HomeSend → wait for the payout → the notification must read **`Faucet successful · received 0.000549 cirBTC`** style, NOT `0.00 cirBTC`. This is the exact bug reported; it can only be confirmed with a real faucet payout.
- [ ] The same notification must show its FULL text over 2 lines with no `…`.
- [ ] Send screen: the `Balance:` line shows a real number (not a stuck `…`), and it matches what the Continue button accepts - type the exact balance shown and Continue must stay enabled.
- [ ] Switch the currency chip through USD / USDC / EURC / cirBTC - the Balance line must follow it and never overflow.
- [ ] Menu → the entry now reads **Currency** (not "Language & Currency") and the screen has one row, with no leftover language picker.
- [ ] Home hint block: `Available Network: Arc Testnet` on one line, red, above the 3 hint lines.
- [ ] Nothing anywhere in the app renders Vietnamese or Chinese any more.


### 📒 WHAT SESSION 2026-08-13 DID (9 commits, `c80db30` → `1c348a2`)

| # | Work | Written up in |
|---|---|---|
| 1 | **Turned Vietnamese + VND off.** The root bug: `QRScanner` defaulted the currency to `'VND'` for a QR with no unit → an English/USD app scanning a QR produced VND | 2 |
| 2 | **Service Hub** became navbar tab 1, with Swap a service inside it; the Swap screen's row 10 became the red Exit text | 3 |
| 3 | **Locked QRs to the Arc network** (`src/qr.js` = the single source of truth) | 7b |
| 4 | **QR sharing**: the Receive screen sends the image + the address as text; ShowQR sends the image only; both carry the logo + "Only Arc Testnet" | 7bb |
| 5 | **The bug-report button → Telegram**, live in production | 7d |
| 6 | **Fixed the very slow money-received notification** + a per-screen polling interval (Receive 5s / Send 15s) | 7e |
| 7 | **Fixed the round-number suggestion bug** where the step jumped 10x at the value 10 | 3 · `roundHint` |
| 8 | The 2 white pill buttons now hug their text; Service Hub removed from the Menu | 6 · 3 |
| 9 | `src/sound.js` written **but not wired into the app** | 7c |

**Decisions the user settled during that session (do NOT ask again, do NOT change them):**
- `- 08-13: turn 'vi' + VND off` - reason: both machines run English/USD, and leaving them on caused currency confusion. **(Superseded 08-25: Vietnamese and Chinese were removed from the project entirely.)**
- `- 08-13: lock the QR to Arc but leave the address as plain text` - reason: a QR is the one-tap-and-it-sends path and must be blocked; the plain address is the escape hatch for topping up from an exchange.
- `- 08-13: the Receive screen shares the IMAGE + TEXT even though iOS filters target apps` - reason: *"as long as it shares 2 things, not 1"*.
- `- 08-13: the bug icon is GREY` - reason: blue would compete with the main content, red would make older users think their money is in trouble.
- `- 08-13: round-number suggestions - ≥30 step 1, 3-30 step 0.5, <3 shrinks; take the NEAREST multiple` - reason: the old version jumped 10x at the value 10.
- `- 08-13: Service Hub icon 56 + text 21px` - reason: 48+17 was "too small", 64+30 "too big".

**TRIED AND FAILED, do not repeat:**
- `- 08-13: drop text from the share payload + DRAW the address onto the QR image` → the user disliked it (*"putting the address on the QR looks awful"*) → back to including text, accepting that iOS filters the target apps.
- `- 08-13: make the Swap Exit button a .btn-error (a big red gradient block)` → the user found it heavy and clashing with the blue Swap button → changed to centred red TEXT.
- `- 08-13: use .row10-single for the Exit button` → that class centres at 90dvh = the row 9 position, colliding with the Swap button → it must be `gridRow 10`.
- `- 08-13: list what a bug report sends as one long sentence` → the user: *"reporting a bug and it is this demanding?"* → cut to one line → the user then wanted a numbered list → the third version was settled.
- `- 08-13: force Service Hub tiles square (aspectRatio 1)` → 30px text overflowed → aspectRatio dropped in favour of `gridAutoRows: '1fr'`.

---


### 🔴 WAITING FOR THE USER TO CLICK - settled in session 2026-07-31 (read this section FIRST)

> The code is all written and pushed. **2 things can only be done in the Cloudflare Dashboard** (Claude cannot log in: `wrangler login` needs OAuth through a browser, and **wrangler v4 has NO command for attaching a custom domain to Pages** - checked `wrangler pages --help`, it only has project/deployment/deploy/secret/download).

**0. `www.ezwallet.cash`** - ✅ **DONE 08-01, by Claude** (added the custom domain to Pages through REST + created a proxied `CNAME www → ezwallet.pages.dev` with the `claude-code` token). Measured afterwards: www came up in **15 seconds**, both domains HTTP **200**, valid SSL (`ssl_verify_result=0`), serving the same app. **No www → apex redirect is needed**: `index.html` already has `<link rel="canonical">` pointing at `https://ezwallet.cash/`, so SEO sees no duplicate content.

**1. Attaching the domain `ezwallet.cash`** - ✅ **DONE** (measured the evening of 07-29: A `172.67.168.76`/`104.21.94.133` + AAAA, HTTPS **200**, valid SSL, Cloudflare serving it). ⚠️ **`www.ezwallet.cash` was NOT attached at the time** (it did not resolve) - to make www work, go to Custom domains → add `www.ezwallet.cash`.

**2. Creating the KV binding for the contacts backup** - ✅ **DONE 08-06, by Claude** (no Dashboard needed: `wrangler` was already signed in through OAuth with the scopes `workers_kv (write)` + `pages (write)`).
  - Namespace `EZ_SYNC` id `5aec627d80c74c3981944dc070b3bbf0` (`wrangler kv namespace create EZ_SYNC`).
  - Attached to the Pages project through REST `PATCH /accounts/{acct}/pages/projects/ezwallet` with `deployment_configs.production.kv_namespaces` (+ `preview`). **PATCH merges** - the 3 env vars `API_KEY`/`KIT_KEY`/`VITE_CIRCLE_APP_ID` were re-checked after the PATCH: intact.
  - Redeployed through REST `POST .../deployments` (branch `main`) → deployment `7dd93cfe`, commit `d01f7b6`.
  - **⚠️ Do NOT use `wrangler pages deploy` or add `pages_build_output_dir` to `wrangler.toml`** for this project: it is connected to GitHub (`source: github/ezwallet`, prod branch `main`). Deploying directly creates a direct-upload deployment outside the Git flow; switching to a `wrangler.toml` configuration can make the Dashboard env vars be ignored → breaking `API_KEY` = breaking login/swap. The REST route above is the safe one, reuse it.
  - **Verified on production (08-06):** `POST https://ezwallet.cash/api/sync {"action":"nonce"}` → **200** (previously 503). The whole flow was exercised with a viem test key: nonce → sign → session (the recovered `address` matched the signing wallet) → push → pull (the avatar was correctly stripped) → replaying the nonce **401 bad-nonce** → a made-up token **401 bad-token**. **All 3 test keys were deleted from KV afterwards** (`wrangler kv key list` returns `[]`).
  - **WHAT REMAINS = one single thing a machine cannot verify:** whether Circle's REAL signature follows EIP-191 as the server assumes (the Circle SDK does not run on localhost, and a test key cannot stand in for MPC). → the 🔴 checklist in section 3.

**2b. CI** - `.github/workflows/ci.yml` was written and sat LOCAL and uncommitted for a while: GitHub refused the push because the `gh` token lacked the `workflow` scope. ✅ **Committed and pushed 08-25** after switching to the `KattyFury` account (`gh auth switch --user KattyFury` + `gh auth setup-git`), whose token has that scope. The CI badge can go back into the README now that the workflow exists.

*(To let Claude do the two items above: create a Cloudflare API token with **Account → Cloudflare Pages → Edit**, write it into `.env.txt` as `CF_API_TOKEN=` + `CF_ACCOUNT_ID=` - the file is gitignored, so the token never has to be pasted into chat - then ask Claude to call the REST API.)*

**3. The ON-DEPLOY test checklist** (things localhost cannot test, because the Circle SDK does not run there):
- [ ] Open `https://ezwallet.cash` → email login + **PIN** work normally on the new domain
- [ ] Send once + swap once (making sure the domain change did not break the money path)
- [ ] **Fix 07-31 - history:** a transaction the user accidentally sent to themselves must read **"Sent to yourself"** (NOT "Swapped … USDC to USDC"), the newest-to-oldest order is right, and it opens noticeably faster
- [ ] **Fix 07-31 - self-send guard:** pasting your own address → a red message and no way forward · scanning your own receive QR → a message and no way forward
- [ ] **Fix 07-31 - smoothness:** opening the Swap screen shows the balance **immediately** (no frozen `…`) · opening History a second time is instant (the memos are remembered)
- [ ] The link preview card: paste `ezwallet.cash` into Telegram to yourself → an image + a title must appear (X/Facebook cache the card, see section 5)
- [ ] The 6 UI fixes of 07-29: 3/4-width buttons (Swap · Tap-to-copy · Hold-to-show · Back on About/Currency/Security) · the ⇅ gradient button with a white icon · Scan QR has a row 1 title + a **Done** button · the Contacts Add button has no icon · QR Storage has the **Back | Add** pair
- [ ] ⚠️ A reminder: existing users on `ezwallet.pages.dev` arriving at the new domain will be **signed out with empty contacts** (localStorage is per origin). The wallet and the money are not lost. See the gotcha in section 7.
- [ ] ~~08-04 - the localised PIN screens~~ **NO LONGER APPLIES:** the Circle localisation was removed on 08-25 along with the i18n layer, and the PIN screens are back to Circle's English default.
- [ ] **🔴 08-06 - CONTACTS BACKUP AUTH.** The KV binding + the deploy + the server side are verified with a test key (section 9 item 2). What follows can **only be measured on a real device**, because it needs a PIN + Circle MPC signing:
  - [ ] Open the app → through PinGate → **the console must NOT contain `[sync] address recovered from signature does NOT match the open wallet`**. That line means Circle does NOT sign per EIP-191 as assumed → backup disables itself (the app still works, nothing breaks) but **report it immediately**, because the verification in `functions/api/sync.js` would have to change.
  - [ ] Device A adds a contact → device B (same email + PIN) opens the app → the contact appears, **with NO picture** (by design, avatars never reach the server).
  - [ ] Delete that contact on device B → reopen device A → it must **be gone there too** (last-write-wins; it coming back means the merge rule is broken).
  - [ ] Enter the WRONG PIN once then the right one → you still get into the app **and** backup still works (the nonce is not spent by a failed signature).
  - [ ] Sign out → `sessionStorage.ez_sync_token` must be gone; sign in with a different email → the previous account's contacts must **not** appear.
- [ ] ~~08-04b - the security question screens in Vietnamese~~ **NO LONGER APPLIES** (removed 08-25 with the i18n layer). The SDK lessons behind those fixes are kept in section 7.

**Completed in session 08-04:** Vietnamese `setLocalizations` was enabled for Circle's PIN/security screens (a new `src/circleLocalizations.js` wired into `circle.js`/`Login.jsx`) - reversing the 07-01 English-only decision after the docs confirmed the localisable scope was wider than believed (see the gotcha in section 7). The production build passed. **(All of this was removed on 08-25 - kept here as the record of why the decision flipped twice.)**
After testing for real, the user reported 2 bugs (with screenshots): the "Required" word running into the label, and the Security confirmation screen still showing 3 English lines. Both were fixed (see the gotcha in section 7) + `setCustomSecurityQuestions` had to be called as well (a separate method, not part of `setLocalizations`).
8 Vietnamese security questions were then written (`CIRCLE_SECURITY_QUESTIONS`) and wired through `setCustomSecurityQuestions({ questions })`. On retesting: `inputMatch` GENUINELY WORKED (the button lit up) ✅ - but `questions` EMPTIED the entire security-questions screen ❌ (blocking wallet creation) and dragged `securityConfirmItems` back to English. Removing `questions` while keeping `securityConfirmItems` and fixing the `securityIntros` concatenation, then redeploying → **STILL EXACTLY AS EMPTY** (the user: "still no security questions to fill in"). The conclusion at the time: it was not `questions` but the very act of calling `setCustomSecurityQuestions()` (see the gotcha in section 7). The method was **DISABLED in all 3 call sites** - the security-questions screen went back to Circle's English default.

Then the REAL root cause was found: **calling `setCustomSecurityQuestions` with the WRONG SIGNATURE** (positional arguments, not an object) - see the gotcha in section 7. With that fixed, both the question set and the 3 warning lines worked. That unlocked the multi-language work that followed - all of which was removed on 08-25.

---

### 👤 OWNERSHIP: ADDING LANGUAGES was assigned to **LongDC** (user decision 08-04) - ⚠️ ON HOLD SINCE 08-25

> 🔴 **SUPERSEDED 08-25:** the whole i18n layer was removed from the project (see section 2), so the process below no longer matches the code - `src/i18n.js`, `src/circleLocalizations.js`, `READY_LANGS` and `npm run check-lang` no longer exist. It is kept as the record of how it worked, and of the traps found along the way. Anyone bringing multi-language back should design it fresh and read this first.
>
> **What existed then:** `vi` (Vietnamese, the source language) and `en` were 100% complete and enabled. `zh` covered **35%** of the dictionary and had **no** Circle translation → it stayed locked.
>
> **The mandatory rules (settled by the user, non-negotiable):**
> - **"If it is Vietnamese, it is Vietnamese everywhere; if English, English everywhere"** - never let a user see a screen half in one language and half in another.
> - **"One language = one thorough build"** - finish the translation completely before enabling it, never enable it half-done.
>
> **The process for adding a language (e.g. `zh`):**
> 1. Extend the dictionary in `src/i18n.js` (`const ZH = {...}`). The keys were the original Vietnamese strings.
> 2. Add the Circle translation in `src/circleLocalizations.js`: all 3 constants `CIRCLE_LOCALIZATIONS`, `CIRCLE_SECURITY_QUESTIONS`, `CIRCLE_SECURITY_CONFIRM_ITEMS`. Skipping this leaves the app translated but the PIN screen English = a breach of the rule above.
> 3. Run **`npm run check-lang zh`** until it reported "ELIGIBLE".
> 4. ONLY THEN add `'zh'` to `READY_LANGS` (`src/i18n.js`). **Do not edit the `locked` flag in the Language screen** - it was derived from `READY_LANGS`.
> 5. Test on a **real deploy**, not localhost (the Circle SDK does not run on localhost).
>
> **4 traps that were hit, do not hit them again** (details in section 7) - these are CIRCLE SDK lessons and remain valid:
> - `setCustomSecurityQuestions` takes **positional arguments** `(questions, requiredCount, securityConfirmItems)` - calling it object-style leaves the security-questions screen COMPLETELY EMPTY, blocking wallet creation, **with no error reported**.
> - The SDK **concatenates directly**: `questionHeader` + `requiredMark` and `headline` + `headline2`, WITHOUT inserting a space → pad the space yourself (Chinese does not need it, as Han characters take no inter-word spaces).
> - `common.showPin`/`hidePin` are ignored by Circle (their bug, reported) - translating them has no effect, do not waste time digging.
> - Runtime error text inside the iframe **cannot be localised** (16 fields, none for errors). That is a real limitation.
>
> **Which branch:** everything was merged into `main` (08-04) and the `wip/circle-vi-localization` branch was deleted.
>
> **Rough edges in the Vietnamese:** the user reviewed the Vietnamese build and reported "plenty of rough edges" while accepting the merge. That cleanup was LongDC's - and it is moot now that Vietnamese is gone.

### 🌏 MULTI-LANGUAGE + VND CURRENCY - session 08-04 (⚠️ TURNED OFF 08-13, REMOVED 08-25, read section 2 first)

> 🔴 **WARNING: this section describes the state as of 08-04 and is NO LONGER TRUE.** On 08-13 the user turned Vietnamese and VND off, and on 08-25 the i18n layer was removed from the project altogether - see section 2. The section is kept as documentation for anyone rebuilding it.


> **MERGED into `main` 08-04** (commit `1c3a6c0`), the WIP branch deleted, running on `ezwallet.cash`.
> **The default was ENGLISH** - `detect()` no longer guessed from `navigator.language`, so a Vietnamese-configured device still opened in English. Vietnamese + VND sat in the Language & Currency screen for anyone who CHOSE them. The reason: the demo video + the intro deck are both in English, and the app had to match what people watch.
> ⚠️ **The Vietnamese + VND paths were never exercised on a real device** (the Circle SDK does not run on localhost). The risk was low because the default path was unchanged, but anyone enabling Vietnamese and hitting an error would have hit it on PRODUCTION.
> 💡 The env vars for preview deployments (any branch) already have `API_KEY`/`KIT_KEY` set through the Cloudflare API - a newly pushed branch gets a working preview with no extra configuration.

**THE RULES THE USER SETTLED 08-04 - permanent:**
> **"IF IT IS VIETNAMESE, IT IS VIETNAMESE EVERYWHERE; IF ENGLISH, ENGLISH EVERYWHERE"** - never let a user see a screen half in one language and half in another.
> **"ONE LANGUAGE = ONE THOROUGH BUILD"** - finish a language completely before enabling it, never half-done.

- **`READY_LANGS` (`src/i18n.js`) was the SINGLE source of truth** for both `detect()` and the locked/unlocked options on the Language screen. It held `['vi','en']`; `zh` was outside it because the dictionary covered 35% and there was no Circle translation. **The `locked` flag was never edited by hand** - it was derived from `READY_LANGS`.
- **The gatekeeper: `npm run check-lang`** (`scripts/check-lang.cjs`). It measured dictionary coverage + checked whether a Circle translation existed. **It had to reach 100% before a code could be added to `READY_LANGS`.** `en` was exempt from the Circle requirement (English is Circle's own default). Reading by eye MISSED things twice (the action cards on the 2 home screens, the "You pay/You receive" labels) → use a script, do not trust your eyes.
- **Circle errors come in 2 kinds** (documented in `circle.js`): errors drawn INSIDE the iframe (wrong PIN…) are English and CANNOT be changed; terminal errors that surface outside can be worded through `circleErrorMessage()`, mapped by NUMERIC CODE (never match English text - if Circle rewords it, matching goes silent).
- **An unfixed Circle bug:** `common.showPin`/`hidePin` are ignored by the iframe even though `common.continue` works (SDK 1.1.11, the latest). Reported to support.

**VND AS A CURRENCY (the user's decision: type VND directly and let the app convert to USDC):**
- Rates: `vnd` was added to the EXISTING CoinGecko call (`chain.js fetchPrices`) with **no extra request** - the free tier is strictly rate limited. A `VND_PER_USD_FALLBACK` covered a dead API. Stored as **"USD per 1 VND"** to match every other rate.
- **`CURRENCY_CFG` (`data.js`) is the single source of truth** for the symbol / its position / decimals / separators. **₫ goes AFTER the number** (`1.250.000 ₫`) while $ goes before → that is why `fmtDisplay()` exists and why `${symbol}${number}` must never be concatenated by hand (it is what forced 4 screens to be fixed).
- **⚠️ NEVER convert the rate A SECOND TIME:** `SendAmount` settles `tokenAmount` and passes it through `SendConfirm` → `SendReceipt`. Recomputing on a later screen means the number the user confirmed ≠ the number that actually leaves the wallet (rates refresh every 60s).
- Changing currency mid-entry on the Send screen **CLEARS what was typed** ("50" as dollars versus as dong differ by a factor of twenty thousand).
- The "fee too small" threshold must follow **each currency's decimals** (`decimalsOfCurrency`), never a hardcoded `0.01`: a 13 ₫ fee would print as "13,00 ₫", and Vietnamese money has no decimals.
- **2 DIFFERENT suggestion systems, do not merge them** (the user stressed this 08-04):
  - **Typing by hand** (`amountHint.js`, the Send screen): adds zeroes to what was typed - "50" → `5,000 · 50,000 · 500,000`. VND ONLY (typing "50" in USD already means 50 dollars, and suggesting ×100 would be a deadly trap).
  - **The slider** (`roundHint.js`, the Swap screen): rounds around the dragged value - 39,000 → `35,000 · 40,000 · 45,000`. The rounding unit **scales with the magnitude** (the old version pinned u=1, so dragging to 39,000 suggested "39,000.5" - broken). The trade-off the user accepted (option A): 24.4 now gives `20 · 25 · 30` instead of the 07-17e spec's `24 · 24.5 · 25`.
- **Auto font sizing:** `BalanceHeader` + `SendAmount` moved from `amountFontSize` (counting characters) to **`useFitFontSize`** (measuring real width on canvas) - VND numbers are twice as long as USD ones, so counting characters overflowed the layout.

**NEVER TESTED ON A REAL DEVICE** (the Circle SDK does not run on localhost): it would have needed a preview link - switch language, choose VND, type an amount on Send, and check the "Actually sent … USDC" line on Confirm + the Receipt.

**Left pending at the time:** (1) the message to Circle support, drafted but not sent; (2) merging that branch into `main` after testing; (3) Chinese - run `npm run check-lang zh` to 100% + add the Circle translation before adding `'zh'` to `READY_LANGS`. **(2) and (3) are moot since 08-25.**

**⚠️ THE MERGE CHECKLIST for that branch** - README/PITCH described `main` correctly at the time (English-only) but would have become wrong the moment it merged. It had to be updated AT THE SAME TIME as the merge, not before (a public README would otherwise advertise something not yet live). **The whole checklist is moot since 08-25: the app is English-only again, permanently, so the README statements below are true as written.**
- `README.md:183-184` - *"**English-only UI.** The Circle PIN screen is a cross-origin iframe that only renders in English, so the rest of the app is kept in English to match."* → it was to be DELETED on merge. **Since 08-25 the sentence is accurate again**, although the reasoning is now different: the app is English-only by decision, not because Circle forced it (Circle can be localised - see section 7).
- `README.md:101` - "Show balances in USDC or EURC" → VND was to be added. Moot.
- A "Full Vietnamese + VND display/entry" row was to be added to the README feature table. Moot.
- **PITCH.md was to be SKIPPED** (it also carried 4-5 "English-only" sentences): it was considered out of date, with the real introduction living in the video + the Canva deck. **Updated 08-25:** PITCH.md was rewritten in English and its facts refreshed, so it is usable again - but **the VIDEO and the DECK are still the things people actually watch**.

---

**Completed in session 08-03:** `6f6b2cb` **core value** - added the "0. Core value" section to this file plus its own section in `CLAUDE.md`/`README.md`/`PITCH.md` (the 3 English paragraphs the user settled), so that from then on every feature/decision has to answer "does this make crypto simpler for an everyday user?". It also caught and fixed the **GitHub repo description** accidentally using "your grandma" (breaking the Brand Voice rule locked in `CLAUDE.md`) → changed to the correct "my mom" slogan matching the core value. A grep confirmed the short slogan was already consistent in `package.json`/`index.html`/`SECURITY.md`/`DECK-DESIGN-SPEC.md`, so nothing else needed changing.

**Completed in sessions 07-29 → 07-31** (`git log` describes each one in full):
`81ee602` the 6 UI fixes the user reported · `c240911` `.row10-single` = 3/4 · `b181309` **PITCH.md** (the spec + messaging kit) · `9b183b2` audit + dead-code cleanup round 2 · `7f61888` the `ezwallet.cash` domain · `16dd010` the KV backup (OFF on production at the time) · `039faea` **professionalising the repo**: meta/OG + `public/og.png` + `SECURITY.md` + `package.json` metadata + the GitHub homepage · `ef7f7cc` **4 real bugs**: a self-send labelled as a Swap · wrong ArcScan pagination (10,000 rows/11.7s) · no sorting + duplicate React keys (rows could be dropped) · Swap not using the balance cache; **+ blocking self-sends** on all 3 entry paths · `b9a645e` memos: remembered permanently + at most 3 requests in flight (replacing the 30-at-once burst on every open). (From the other machine: `b8d5978` fixing QRs losing their decimals.)

---


> ✅ **07-18 the user CONFIRMED ON A DEPLOY: everything runs smoothly - the PIN (after making `getSDK` async) + a real-money swap both fine.** Nothing is blocked.

1. **The warning `!` icon looks smaller than other icons in the same slot** - the cause: the `!` glyph only occupies ~45/100 of the viewBox inside its circle. WAITING FOR THE USER TO CHOOSE: (a) scale it individually, (b) the user redraws it. The icons are the user's own set - ask first.
2. **A new QR Library icon** - the user will draw it (suggested: 2 stacked cards + a QR corner, viewBox 100, stroke 10). Once drawn, replace it in `HomeReceive`.
3. **Real transaction status** - poll the txHash after sending → "it is on the blockchain" (Swap already has the submitted/successful pair).
4. **Rebuild Google login** through Google Identity Services → routing into the email flow (an architecture change, its own session).
5. Batch sending to several people (Multicall3From, the encoder already exists).
7. ~~**REAL AUTH FOR THE KV BACKUP - THROUGH A PIN SIGNATURE**~~ ✅ **DONE 08-06** - details in section 3. The blocking question back then ("does `executeChallenge` return the signature?") was answered by reading the SDK types: **YES** - `node_modules/@circle-fin/w3s-pw-web-sdk/dist/src/types.d.ts:242` `SignMessageResult.data.signature`, with no extra endpoint needed. One difference from the old plan: `recoverMessageAddress` is used instead of `verifyMessage`, so the client never declares its own address. **WHAT REMAINS = testing on a deploy** (the section 3 checklist), because the Circle SDK does not run on localhost.
6. **Bundle optimisation:** the ~1MB SDK chunk is mostly crypto-browserify (the `crypto` polyfill in `vite.config.js`) - try removing `'crypto'` and see whether the SDK still runs, BUT it can only be tested on a deploy → give it its own session, do not bundle it with other work.
   - **DONE 07-22g (the user: "the app is not smooth yet"):** `App.jsx` PREFETCHES during `requestIdleCallback` - loading the frequently used screens in the background (HomeSend/Receive/Swap/Menu/SendAmount/Contacts/TxHistory) + the 1MB Circle SDK (skipped under MOCK) → switching tabs no longer flashes white, and the PIN step does not stall on a cold download. No logic changed (it only warms the cache; the dynamic import() still runs on real navigation). Measured bundles: `index`(SDK) 1026KB/gz281 · `chain`(viem) 270KB/gz83 · `QRScanner`(jsqr) 134KB - the latter two are correctly lazy. The smoothness has not been verified on a deploy (the mock does not load the SDK) - it needs measuring on a real device.

