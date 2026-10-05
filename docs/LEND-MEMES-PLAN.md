# Service hub: Lending/Borrow + Memes - PLAN (2026-10-05)

Status: **plan only, nothing built, owner decisions open (section 5).** Real money - same rules as
`docs/SWAP-PLAN.md`: a doc line or a live measurement behind every step.

## 1. What already exists
- `src/screens/ServiceHub.jsx`: one card (Exchange). Adding a service = one line in `SERVICES` + a screen.
- Swap pattern that works on mainnet (`functions/api/_swapCore.js`): server calls a Circle Kit REST API with
  `API_KEY` → builds ONE batch through **Multicall3From** → `eth_simulateV1` on dRPC → one PIN. Lending/Memes
  should reuse this pattern, not the Kit SDK in the browser (the Kit rejects an API key from a browser context).
- Unverified tokens: can be SENT, not swapped; `/api/swap` refuses unlisted tokens; a "Memes" hub was promised
  for them (HANDOFF 2026-10-05).

## 2. Measured on Arc MAINNET (2026-10-05, read-only GETs with the LIVE `API_KEY`)

**Circle ships both kits for Arc mainnet** (npm, read from the typings):
`@circle-fin/earn-kit` 1.8.1 (`EarnChain.Arc`) and `@circle-fin/borrow-kit` 1.0.0 (`BorrowChain.Arc`, released
2026-09-30, Morpho markets, every write = one atomic batch). REST: `/v1/earnKit/*`, `/v1/borrowKit/*` on
`api.circle.com`, chain id `ARC`.

`GET /v1/earnKit/vaults/explore?chain=ARC` → 200, **30 vaults, all Morpho**. Only ~9 have real money; the rest are
test/junk ("Test", "pjvk", 1-dollar vaults). The big ones:

| Vault | Asset | APY | Deposits | Withdrawable now | Status | circleGuarded |
|---|---|---|---|---|---|---|
| Galaxy USDC | USDC | 1.15% | 89.7M | **0** | low_liquidity | yes |
| Keyrock Prime USDC | USDC | 1.15% | 75.0M | **4** | low_liquidity | no |
| Steakhouse Prime USDC | USDC | 1.12% | 2.58M | 62k | low_liquidity | yes |
| Galaxy EURC | EURC | 1.52% | 503k | 310k | active | no |
| Bitwise Premium RWA USDC | USDC | 4.87% | 423k | 21k | low_liquidity | no |
| Steakhouse Prime EURC | EURC | 3.85% | 9.2k | 8.8k | active | yes |

⚠️ **The biggest USDC vaults cannot pay anyone out right now** (liquidity 0-4 USDC, the API itself flags
`low_liquidity` YELLOW). A user who deposits there may not be able to withdraw for a while. The UI MUST show this.

`GET /v1/borrowKit/markets?chain=ARC` → 200, **13 Morpho markets**. Relevant to our 3 tokens:

| Market (collateral/loan) | LLTV | Borrow APY | Free to borrow | Borrowed |
|---|---|---|---|---|
| cirBTC/USDC | 86% | 1.15% | **3.19 USDC** | 192.4M |
| cirBTC/EURC | 86% | 3.79% | 8,818 EURC | 1.07M |
| WETH/USDC, WETH/EURC | 86% | - | ~0 | ~0 |

⚠️ **Borrowing USDC against cirBTC is effectively impossible today** (3 USDC free). EURC can be borrowed.

Docs: `docs.arc.io/app-kit/earn`, `/app-kit/concepts/earn-fees` (no deposit fee same-chain, withdrawal fee 0
"subject to change", vault performance 0-50% + management 0-5% set by the curator, principal CAN fall in extreme
markets), `/app-kit/borrow` (cirBTC collateral → USDC, webhooks for health changes), `/build/borrow-and-lend`.

**Memes (news, NOT verified on chain):** Arc day one = $410.8M DEX volume, 82% from meme launchpads; Arguspad
(~84k of 97k new tokens), Minara.fun, Tollylabs, Bullcheese, SushiSwap launchpad + AMM. Our own measurement
(2026-10-05 morning): Circle's swap Kit (LI.FI) had a route for **4 of the 8 busiest** Arc tokens.

## 3. Lending/Borrow - proposed phases

**Phase L0 - measure (read-only, no UI):** read the kit `.d.ts` + provider source for deposit/withdraw/borrow:
what does `POST /v1/earnKit/deposit` return (calldata we can put in Multicall3From, or a signed intent like
swap)? Does Borrow need EIP-7702 / a smart account ("plain EOA needs adapter-viem-v2/next")? Can a Circle
user-controlled MPC wallet sign it with one PIN? `tools/verify-earn.mjs` = dry run through `eth_simulateV1`.
Exit = a written yes/no per action, like SWAP-PLAN §2.

**Phase L1 - "Earn" (supply only, the safe half):** deposit USDC/EURC into a vault, see position + yield,
withdraw. Show only vaults that pass a filter (section 5 Q3). Each card shows APY, the curator, and
"Withdrawable now". Withdraw must handle "not enough liquidity" honestly.

**Phase L2 - "Borrow" (only if the owner wants it):** cirBTC collateral → borrow EURC (USDC market is empty).
Needs: health factor + liquidation price on screen, repay/add collateral/close, and warnings. Liquidation
monitoring = Circle webhooks → our backend → in-app notification only (no push today) - a user who does not
open the app will NOT be warned. This is the riskiest feature the app would have.

## 4. Memes - proposed phases

**Phase M0 - measure:** list the unverified tokens real wallets hold; for each, does Circle's swap Kit return a
route (USDC ↔ token)? Which launchpad made it, and is it still on a bonding curve (no DEX pool → no Kit route)?
Price source for memes (CoinGecko has most? GeckoTerminal?) - no price = "…", per the no-guess rule.

**Phase M1 - Memes screen:** the user's unverified tokens with live price (when one exists), sell to USDC via
the Kit when a route exists, otherwise "No route" + Send still available. Strong risk text (yellow, like today).

**Phase M2 (optional):** buy memes, trending list, or open a launchpad.

## 5. Owner decisions needed (nothing is built until these are answered)
1. **Lending scope:** Earn only (supply) · Earn + Borrow · Borrow later.
2. **How to build Earn:** Circle Earn Kit REST (same pattern as swap, Circle picks the vaults) · call Morpho
   contracts directly (more control, more audit work) · link out to the Morpho app.
3. **Which vaults to show:** only `circleGuarded` + status `active` · a short list the owner picks by hand ·
   everything with real deposits, with warnings.
4. **App fee on Earn/Borrow** (Kit `integrators/config`): none (like swap) · a small fee.
5. **Memes scope:** sell-only (unverified → USDC) · buy + sell · also show trending / a launchpad.
6. **Memes source:** Circle swap Kit only (no new provider) · a launchpad/DEX API (Arguspad, SushiSwap…) too.
7. **Order:** Lending first · Memes first · both in parallel (they share nothing but the Service hub).
8. Figma: the owner draws the two new cards + screens before any UI is built (Figma = source of truth).
