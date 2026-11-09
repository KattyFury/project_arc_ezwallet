# HANDOFF: ezwallet

**Updated:** 2026-10-22 · **Repo:** `KattyFury/project_arc_ezwallet` (public) · **Local:** `D:\Files\Claude\project_arc_ezwallet`
**Status:** ezwallet.cash serves **Arc MAINNET** (real money). Target was a public launch in October 2026.

Start of every session: read `CLAUDE.md`, this file, then `git pull`. No blind building and no guessed numbers: official docs first (Circle OpenAPI `developers.circle.com/openapi/user-controlled-wallets.yaml`, Arc `docs.arc.io/llms.txt` or the arc-docs MCP), and a live measurement for every number the app shows.

Older detail, including the open-items table: [docs/archive/handoff-through-2026-10-22.md](docs/archive/handoff-through-2026-10-22.md) · [docs/archive/HANDOFF-LOG.md](docs/archive/HANDOFF-LOG.md). Swap plan: `docs/SWAP-PLAN.md`. Audit: `MAINNET-AUDIT.md`.

## Workflow until launch

1. The owner tests on the phone (ezwallet.cash / test.ezwallet.cash) and reports bugs one by one.
2. For each bug: measure read-only first, find the rule in official docs, offer options. The owner picks.
3. **Every change goes to BOTH branches:** commit on `test`, then `git checkout main && git merge --ff-only test`, push both. Both Pages projects auto-deploy.

## Where we stopped (2026-10-22)

`main` = `test`, both live.

**Next, in order:**
0. Owner checks the Exchange screen spacing on the phone (`86ea4d6`: both rows now a fixed 56 px box in `SideCard`, `src/screens/Swap.jsx`).
1. Owner checks History on the phone: a loan must read **"Borrowed"** + **"Locked as loan collateral"**, a Lending deposit **"Put into Lending"** (never "Swapped" / "Sent to 0x…"). Only checked in mock.
2. Owner tries the new Withdraw popup with the keyboard up (inputs must stay visible).
3. "Repay all & close" on the test loan when the owner wants (one PIN; collateral comes back).
4. Binance Deposit/Withdraw round trip. Then keep walking screens; not re-shot since the redesign: email popup code step, PinGate / ForgotPin, Paste / Contacts inputs.

**Done that session:**
- **Borrow 409 fixed and proven with real money.** The first tap ("Borrow" / "Repay"…) calls `fee`, creating ONE signed intent kept in KV `bintent:<wallet>:<kind>:<loan|market>` until its deadline. The button becomes **Confirm** and `execute` reuses it. A kept intent that fails simulation is dropped. Changing the amount after the first tap can still 409 → plain message. Test loan `82b716bb…`: 0.997255 USDC vs 0.00002412 cirBTC, LTV 50.1%, HF 1.72, liquidation ≈ $48,076, alerts registered, no Morpho permission left open.
- **Withdraw popup:** address + amount directly under the exchange tabs, steps below Continue. Inputs end at y 426 on 393×852.
- **History labels:** `chain.js receiptOp` tags `op: 'loan'` (Morpho Blue events) or `op: 'lending'` (ERC-4626 vault events). Cache `ez_tx_transfers_v3`. Free RPCs refuse log scans, so real hashes are unverified; the owner confirms on the phone.
- **Design system: no opacity for states.** Success buttons stay solid green while disabled (`.btn-success:disabled`).
- **PNGs rebuilt in 0x Blue**: `icon.png`, `fav_icon.png`, `icon-test.png` from `design/logo-pfp*.svg`; `og.png` by `tools/build-og.mjs`. Cache versions: icons `?v=7`, og `?v=8`, icon-test `?v=2`.

**Tooling:** auto mode REFUSES any Borrow Kit call that creates an intent (even a dry run like `tools/verify-borrow.mjs`), so ask the owner first. Read-only loan check = `listLoans` + `hasStandingAuthorization`.
