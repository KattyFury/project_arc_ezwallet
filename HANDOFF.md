# HANDOFF – ezwallet

**Updated:** 2026-10-06 (Service hub: Lending live-tested, Memes + Borrow built LABS-only; legal pages; QR fixes) · **Repo:** `KattyFury/project_arc_ezwallet` (public; renamed from
`KattyFury/ezwallet` 2026-10-03 - Pages track it by repo id) · **Local:** `D:\Files\Claude\project_arc_ezwallet`
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

## ▶ Session 2026-10-06 - where we stopped (READ THIS FIRST)
**State of the Service hub (all LABS = test.ezwallet.cash + localhost only, `src/labs.js`):**
| Feature | Built | Real-money test | Next |
|---|---|---|---|
| Lending (Earn, Morpho vaults) | yes | **owner tested deposit + withdraw: smooth** | owner happy → enable on ezwallet.cash |
| Memes (Argus on Uniswap v4) | yes, layout v2 (CA + Paste · My memes · Top on Argus · risk line) | **not yet** | owner buys ~1 USDC of STABLE `0xC281…C099`, sells all |
| Borrow (USDC vs cirBTC) | **yes, pushed 2026-10-06, NOT measured on a real wallet** | not yet | see Borrow below |

**Borrow (plan on the owner's Desktop `ezwallet-LEND-MEMES-PLAN.md` §14; code `functions/api/_borrowCore.js`, `borrow.js`,
`borrow-alert.js`, `src/borrow.js`, `screens/BorrowTab.jsx` + `BorrowAction.jsx`, `test/borrow.test.mjs`):**
- Circle Borrow Kit lends **USDC only** (SDK source: "the only loan asset Borrow Service originates against"); market
  cirBTC/USDC `0xc2db…815d` on Morpho Blue `0x34CD04070dD72b14E241112F6d83812Df5Af7fCD` (morpho API + eth_getCode +
  idToMarketParams checked). Free USDC moves a lot (3 → 50.75 USDC between 10-05 and 10-06).
- Service sizes collateral at HF ≈ 1.236 (LTV ≈ 70%, measured). **Owner rule = LTV ≤ 50%** → the batch appends a direct
  Morpho `supplyCollateral` top-up (HF 1.72 via `requiredCollateral/quote`). One PIN. Execute refuses unless eth_simulateV1
  shows: USDC received, collateral ≥ the 50% need, **no Morpho authorization left open**. Max $200 per loan.
- Liquidation alert = **the owner's pick: 2nd PIN right after borrowing** (EIP-712 WebhookRegistration via Circle
  `/user/sign/typedData`). Circle → `/api/borrow-alert` → re-read the loan → email (Resend) to the address Circle has for
  the user (KV `loan:{id}`), dedupe `loanalert:{event_id}`. Some Borrow Service calls refuse an API key (SDK
  `credential:'forbidden'`) - `kit()` only sends it where allowed.
- **NEXT (B0):** the owner is buying cirBTC. Get the owner's full wallet address → simulate a small borrow on it
  (read-only) → then the owner borrows 2-5 USDC on the test site, turns alerts on, "Repay all & close".

**Other things done 2026-10-06:** About rebuilt + in-app Terms/Privacy (`src/legal.js`, live everywhere, owner reviews
later; draft + Vietnam-law findings on the Desktop `ezwallet-LEGAL-DRAFT.md`) · **support@ezwallet.cash** works (Cloudflare
Email Routing → owner's Gmail; Resend untouched on `send.`) · one red network note "Only available network: Arc" everywhere ·
QR: USDC/EURC/cirBTC QRs carry their amount, labels in their own unit, shared image = name + QR + amount, storage Add =
Create QR · Send/Lending show amounts short (display only - Max still sends everything) · ScrollBox (fixed box headers,
fades only where more content) · auto-reload once when a lazy chunk is gone after a deploy (`vite:preloadError`).

**Owner rules learned 2026-10-06 (don't break):** plans/specs → Desktop file, not the repo · "simplify the number" = display
only, never change the amount that moves, never claim the owner accepted a side effect · the app is global, open-source
(MIT), non-profit, by an individual, 18+ · fades only on the side that has more to scroll · box titles are fixed headers.

## ▶ Session 2026-10-05 (2) - Lending (Earn) built, LABS only
- **Plans live on the owner's Desktop, not in the repo** (owner): `ezwallet-LEND-MEMES-PLAN.md` = Lending/Borrow +
  Memes decisions and the Phase L0 measurements (§12).
- **LABS flag (`src/labs.js`):** new Service hub features ship to BOTH branches but are ON only on
  test.ezwallet.cash + localhost (client hides the card/screens, the API answers 503 elsewhere). Turning on
  ezwallet.cash = add it to `LABS_HOSTS` - owner's call.
- **Earn built** (Service hub card "Lending / Borrow", tabs Lending | Borrow; Borrow tab = "coming next"):
  `functions/api/earn.js` + `_earnCore.js`, `src/earn.js`, `screens/Lending.jsx` + `LendAction.jsx`, `test/earn.test.mjs`,
  `tools/verify-earn.mjs` (read-only dry run). Circle Earn Kit REST = the swap pattern (same adapter, one PIN). Rules:
  curators Galaxy/Steakhouse/Keyrock/Bitwise, deposit ≤ the vault's "Withdrawable now", ≤ $200 (USD via live price).
- **Measured:** deposit dry run PASS (1 USDC → Steakhouse Prime USDC, shares = quote, gas 418,782). **Withdraw NOT
  measured** (needs a wallet holding shares) → first real test = owner does 1 USDC deposit + withdraw on the test site.
- Lending UI round 2 (owner): rows 4-8 one grey box of white vault cards with a neutral **Open**; My deposits → Open →
  `LendPositions`; the vault screen has row-1 tabs Deposit | Withdraw.
- **Memes M1 built (LABS only):** `functions/api/meme.js` + `_memeCore.js`, `src/meme.js`, `screens/Memes.jsx` +
  `MemeToken.jsx`, `test/meme.test.mjs`. Argus launch tokens on Arc's shared Uniswap v4 (UniversalRouter + Permit2 through
  Multicall3From = one PIN). Honeypot guard = simulated buy 1 USDC → sell all (eth_simulateV1, USDC topped up by a
  native-balance override). Max $20 per buy, min out = simulated - 3%, buys refused while Argus's opening snipe tax is on.
  Hidden = not supported or cannot be sold. Measured read-only on mainnet (STABLE -3.94%, ARPEP -7.78% round trip); **no
  real buy/sell yet** → first owner test with ~1 USDC on the test site.
  ⚠️ Arc's UniversalRouter needs the NEW v4 `ExactInputSingleParams` (with `minHopPriceX36`).
- **2026-10-06 fixes:** Send shows long token amounts with 6 significant digits + "≈" (`fmtAmountShort`, the exact string
  is still sent) · QRs made in USDC/EURC/cirBTC now carry their amount (only USD/EUR were mapped → bare address QR) and a
  scanned EURC QR reads back as 'EURC' (was 'EUR', unknown to Send) · QR labels in the QR's own unit ("5 EURC", not "$5") ·
  shared QR image = name + QR + amount · QR storage Add = Create QR (currency + optional name), the popup is gone.
- **Legal + support (2026-10-06):** About rebuilt (App / Links / Legal); in-app Terms of Use + Privacy Policy in
  `src/legal.js` (live everywhere, owner reviews later; draft + VN-law findings on the owner's Desktop
  `ezwallet-LEGAL-DRAFT.md` - incl. Resolution 05/2025/NQ-CP art. 7(2)). The app is global, open-source (MIT),
  non-profit, by an individual, 18+. **support@ezwallet.cash** = Cloudflare Email Routing (MX route1-3 + SPF on the
  root, DKIM cf2024-1) → owner's Gmail, tested. Resend's records live on `send.ezwallet.cash` and are untouched.
  Rule: if the app starts collecting new data or adds a provider/fee, update `src/legal.js` in the same commit.
- Next: owner's 1 USDC round trips (Lending, Memes) · Borrow (owner picks the liquidation alert: Circle webhook = a 2nd
  PIN, or a scheduled Worker) · more launchpads (ArcStockPad / Arcade use the same v4 path; Mercuri pre-graduation needs its curve).

## ▶ Session 2026-10-05 - where we stopped
- **Phase now: the owner tests every feature on the phone and sends small polish notes, then announces the mainnet
  launch.** Handle each note fast: measure, offer options for anything real-money or ambiguous, push to BOTH branches.
- Shipped today (all on `main` + `test`): auto-convert on send (`docs/SWAP-PLAN.md` §6-7, two real sends checked on
  chain) · keep one extra feeMax as USDC after a convert · notifications vanish 24h after the EVENT · unverified tokens
  can be SENT (not swapped - a "Memes" hub is planned) · Swap CTA text wraps to 2 lines then shrinks the font ·
  Service hub card fits its content · every button has the soft gradient + a Y-4 drop shadow (exceptions in §2) ·
  Send's Available = number + [50%] [100%] hint chips.
- **Owner's wallet `0xdfe2…b0ab` holds ~0.036 USDC** (< the ~0.042 feeMax) since the first convert build: its next
  auto-convert / EURC swap is refused until a few cents of USDC arrive. Not a bug of the current build.
- Not done yet: real on-chain test of an unverified-token send (no tx seen); friendlier "No route available" /
  "Not enough USDC for the network fee" wording was offered, not requested; Phase 3 (History shows a convert as one row).
- Flaky: one `npm test` run failed once (60/61) and passed on 6 reruns - test not identified.

## Current state (2026-10-04, updated 2026-10-05)
- **Tokens:** verified = USDC, EURC, cirBTC (`src/network.js`). Anything else the wallet holds = "Unverified tokens"
  (Home: one row with a ⌄ arrow, view only, never in the total. **They can be SENT** - picked only in Send's currency
  popup (yellow section), Confirm shows a yellow 'Unverified token' line, the receipt says "(unverified)" and never a $.
  **They can NOT be swapped** (owner 2026-10-05, reversing the same morning's sell-only Exchange): a separate "Memes"
  service hub is planned for them; `/api/swap` refuses any token that is not listed. Source = Circle balances
  `includeAll=true`; a YELLOW notification when one arrives; kept out of History). Whether Circle lists every Arc token is NOT measured.
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
business KYB) · no lock after a PIN reset (a security mail instead) · send reserve stays 0.01 USDC · no app swap fee · Send's Available line = the number only + [50%] [100%] HINT chips (outlined, flat - not buttons); 100% for USD/USDC = all USDC minus the 0.01 reserve (no auto-convert), exact strings, never a float · the two half-oval tabs (Hold to show tokens, Tap to copy) are the ONLY buttons WITHOUT a gradient: plain white, and they KEEP the standard drop shadow (an earlier pass wrongly removed it) · button drop shadow = `0 2px 8px rgba(0,0,0,.48)` (Y 2) · notifications disappear 24h after the EVENT (block time / announcement time), the board re-filters on every tick (2026-10-05).

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
- **Button depth (owner 2026-10-05):** buttons carry a SOFT bottom→top gradient so they lift off the page - subtle,
  never at the cost of legibility; text colours unchanged. Tokens in `src/index.css`, used by `.btn-primary` /
  `.btn-secondary` - reuse them for any new button, never hand-write another gradient:
  - Blue `--btn-grad-brand`: `linear-gradient(to top, brand 88% + black, brand 88% + white)` (brand `#0B53BF`).
  - White `--btn-grad-white`: `linear-gradient(to top, --color-card 45% + white, #FFFFFF)` - the light grey is mixed
    from the card grey, so it is not a 4th grey.
  - **Button shadow drops DOWN (owner 2026-10-05): offset X 0 / Y 2** (8 was too much, then 4, now 2 - owner same day), `0 2px 8px
    rgba(0,0,0,.48)` (was the centred glow `0 0 8px`). Containers/popups keep their own shadows; The two half-oval tabs use the same
    drop shadow on a plain white fill.
  - **EVERY button** carries one (owner: "mọi nút đều có gradient"), inline-styled ones included; green/red buttons use
    `--btn-grad-success` / `--btn-grad-error` (same recipe). Deliberately flat: the two half-oval tabs (plain white + shadow, owner 2026-10-05), containers/popups/notification rows,
    Home's token list rows (they match the plain token rows), the active NavBar cell (it joins the white sheet), the %
    slider thumb, Send's down-arrow circle (not tappable).
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
