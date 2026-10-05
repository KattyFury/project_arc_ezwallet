# Swap on mainnet + auto-convert on send - PLAN (2026-10-03)

Status: **decided (section 5), not built yet.** Real money - every step below
has a measurement or a doc line behind it; keep it that way.

## 1. What already exists (code kept from testnet, OFF on mainnet)
- `functions/api/swap.js` + `_swapCore.js`: `estimate` (Kit `/quote`), `simulate` (eth_simulateV1 bundle, checks the
  wallet's tokenOut balance RISES and the 0.1% fee arrives), `execute` (Kit `/swap` signed intent → ONE Circle
  contractExecution through **Multicall3From**: `[approve(tokenIn→adapter), adapter.execute(params, tokenInputs, sig)]`
  = one PIN). `src/screens/Swap.jsx` (558 lines). C3 double-payment tracker already covers swap (`src/txTracker.js`).
- Gate: `NET.swap = false` (src/network.js) → `/api/swap` answers 503, the Exchange tab shows "Coming soon".

## 2. Measured on Arc MAINNET (2026-10-03)
| Check | Result |
|---|---|
| Swap Adapter `0x7FB8…a845` (adapter-viem-v2 ADAPTER_CONTRACT_EVM_MAINNET) | has code (813 bytes) |
| Multicall3From `0x522f…47D0`, Permit2 | have code |
| Kit `GET /v1/stablecoinKits/quote` USDC→EURC, Arc, 1 USDC, slippage 50 bps | **works**: 0.889118 EURC (min 0.884672), route LI.FI / "Fly", gas ≈ $0.0031. Market (EURC ≈ $1.12) ≈ 0.8929 → quote ≈ 0.4% under market |
| Kit key | the working key is stored as `CIRCLE_TEST_KIT_KEY` in keys.env (kit keys are shared by both networks); `CIRCLE_LIVE_KIT_KEY` is EMPTY. Pages `ezwallet-mainnet` + `ezwallet-test` both have `KIT_KEY` set |
| `eth_simulateV1` | `rpc.mainnet.arc.io` ✗ (method not supported) · QuickNode ✗ · Blockdaemon ✗ (filtered) · **dRPC `rpc.drpc.mainnet.arc.io` ✓** |
| From a Cloudflare Function to dRPC | NOT measured (the public Arc RPC rate-limits Functions - may hit dRPC too → fallback: simulate in the browser) |

## 3. Docs (docs.arc.io, read 2026-10-03)
- `/app-kit/references/supported-blockchains`: Arc mainnet = Send, Bridge, **Swap**, …; adapters Viem / Ethers /
  Circle Wallets. "Swap is available on mainnet only, with the exception of Arc testnet."
- `/app-kit/concepts/swap-fees`: custom fee (ours, 10 bps today) → 90% to our recipient, 10% to Arc; **provider fee
  2 bps always**, taken after the custom fee.
- `/app-kit/tutorials/swap/set-slippage-tolerance-or-stop-limit`: `slippageBps` default **300**; `stopLimit` = exact
  minimum out, wins over slippage when both are set.

## 4. Plan
### Phase 1 - Swap screen live on mainnet (fixes MAINNET-AUDIT C5 + H2)
1. **Validate the intent server-side before any challenge (C5):** every `tokens[].beneficiary` = the user's wallet;
   tokenIn/tokenOut/amount = the request; adapter = `net.contracts.swapAdapter`; `deadline` in the future; refuse
   anything else.
2. **Simulate before the PIN (C5):** eth_simulateV1 through dRPC (new `net.simRpc`), same bundle as today
   (wallet tokenOut rises, fee arrives). If Functions → dRPC is rate-limited, run the simulation in the browser.
3. **Price shown = price executed (H2):** slippage 300 → **50 bps**, and `stopLimit` = the minimum the screen showed,
   so the chain reverts (nothing moves, only gas) rather than fill worse than displayed.
4. `NET.swap = true`; owner tests real swaps ≤ $1 each direction (USDC↔EURC, USDC↔cirBTC), we check every tx with
   `verify-swap.mjs` (receipt: user received tokenOut, fee arrived, adapter holds nothing).

### Phase 2 - Auto-convert on send (owner answers 2026-10-03)
- SendAmount "available" = the wallet TOTAL in USD (verified tokens).
- Typing more than the USDC balance → the confirm screen says "Not enough USDC: X EURC will be converted" → ONE PIN.
- ONE Circle contractExecution through Multicall3From:
  `[approve(EURC→adapter), adapter.execute(swap EURC→USDC, stopLimit = shortfall × 1.005), USDC.transfer(to, amount)]`
  (or the Memo contract call when there is a note). Atomic: if the swap fills short, the whole tx reverts and no money
  moves. The 0.5% buffer stays in the user's wallet as USDC.
- Same C5 validation + simulation as Phase 1 (the bundle must show the recipient's USDC rising by exactly `amount`).
- Send fee estimate includes the swap gas.

### Phase 3 - polish
- History: an auto-convert send shows as ONE row ("Sent $19 to Mom · 8.5 EURC converted"), not 3 legs.
- Receipt shows the converted amount + rate.

## 4b. Phase 1 progress (2026-10-03)
- DONE (code, swap still OFF): no app fee; `SLIPPAGE_BPS = 50`; `estimate` returns `minOut`; Swap screen sends it on
  execute → Kit `stopLimit`; `validateIntent` (C5, `test/swap.test.mjs`, fixture = a real mainnet intent);
  `simulateBatch` via `net.simRpc` - execute REFUSES when the simulation cannot run or delivers < minOut.
- Verified read-only from a PC (2026-10-03): quote → validate → build → eth_simulateV1 on dRPC for wallet 0xEb2D…
  (7.99 USDC): 0.5 USDC→EURC delta 0.444503 (est. 0.444509), 0.5 USDC→cirBTC delta 0.00000589 (= est.).
- **Swap turned ON 2026-10-04** (`src/network.js` mainnet `swap: true` + `simRpc` dRPC) - the owner left auto mode so the edit could be approved.
  Claude's auto mode refused this edit (it turns a real-money feature on for ezwallet.cash users). Until `simRpc`
  exists, execute refuses every swap (safe).
- Still unmeasured: Cloudflare Functions → dRPC (rate limit?). First check after the flip: Exchange on test site, a
  quote, then a ≤ $1 swap; if execute says "Could not check this swap right now", move the simulation to the browser.

## 5. Owner decisions (2026-10-03, DECIDED - do not re-ask)
1. **No app fee.** Remove `config.customFee` from the Kit `/swap` call (`FEE_BPS`/`FEE_RECIPIENT` in `_swapCore.js`)
   and the fee checks in `simulateSwap`; only the provider's 2 bps remain.
2. **Roll-out: both branches at once** (test + main), per the pre-launch rule. → Phase 1 must be fully validated +
   simulated before `NET.swap = true` is pushed, since ezwallet.cash users see it immediately.
3. **Auto-convert source order (owner, refined same day): other STABLECOINS first (EURC today), then cirBTC, then
   ETH "if there is one".** ETH is not a verified token on Arc today (no ETH token in `NET.tokens`) - the order is a
   priority list in code (stablecoins → cirBTC → ETH), so an ETH token added later slots in last. Send "available" =
   every verified token in USD. A shortfall larger than one source's balance takes that source fully and moves to the
   next (several swaps in the same batch, still one PIN).
4. **Exchange pairs: every direction between USDC / EURC / cirBTC** (6).

## 4c. Live checks after the flip (2026-10-04)
- First live call answered "KIT_KEY not configured": the Pages secret `KIT_KEY` existed but was EMPTY on both
  projects. Set from keys.env (`CIRCLE_TEST_KIT_KEY` = the working kit key, shared by both networks) via the Pages API,
  then retried the production deployments.
- After that, on BOTH test.ezwallet.cash and ezwallet.cash: `estimate` 0.5 USDC→EURC = 0.444582 (min 0.442359);
  `simulate` 6/6 ok from Cloudflare → dRPC (delta ≈ 0.4445 EURC = the estimate). Cloudflare → dRPC is NOT rate-limited
  at this volume.
- Next: the owner's first real swap ≤ $1; check its receipt (wallet received tokenOut, adapter kept nothing).

## 4d. Key change (2026-10-04)
- Swap now authenticates with `API_KEY` (the Circle LIVE key); the legacy Kit key leaked in the public history
  (MAINNET-AUDIT K1) and is no longer used. The `KIT_KEY` Pages secret is removed. Dry run: `node tools/verify-swap.mjs`.

## 6. Phase 2 - measured + decided (2026-10-05)
Read-only eth_simulateV1 (dRPC) on the owner's wallet 0xdfe2…b0ab (4.0476 USDC, 2.2318 EURC), "send 5 USDC":
| Check | Result |
|---|---|
| Kit `/quote` exact-OUTPUT mode | **none** - the quote is exact-input only (`feeContext.type: "input"`); amountIn is sized from the quote rate |
| `[approve EURC, adapter.execute(EURC→USDC), USDC.transfer(to, 5)]` via Multicall3From | ✅ status 1, recipient +5.000000, wallet EURC −0.862, one tx, 595,065 gas |
| Same with `Memo.memo(USDC, transfer…)` as the last call | ✅ status 1, recipient +5, 2 extra logs (BeforeMemo + Memo), 611,503 gas - Memo works INSIDE Multicall3From (docs.arc.io batched-transactions: each subcall keeps the EOA as msg.sender) |
| Transfer 2 USDC more than the batch can cover | ✅ whole tx reverts ("transfer amount exceeds balance"), nothing moves |
| Buffer 0.5% (= the 50 bps slippage) with stopLimit = shortfall | ❌ Kit: "No route found that satisfies the requested stop limit" (min out lands just under the shortfall) |
| Buffer 0.6% / 1% | ✅ both pass |

Two rules the plan had missed:
1. **The network fee is paid in USDC from the same balance, up front** (gasLimit × maxFee is held before execution).
   So the shortfall to convert = `amount + feeMax − USDC held`, not `amount + 0.01 − USDC`. Whatever is not burnt
   (feeMax − real fee) + the buffer stays in the wallet as USDC.
2. **The wallet must already hold ≥ feeMax USDC** (Circle checks the fee against the balance before the swap runs).
   A wallet with 0 USDC cannot auto-convert → "Not enough USDC for the network fee".

Owner decisions (2026-10-05, do not re-ask):
- **Buffer 1%** (0.5% does not work, see above).
- **Only USD/USDC sends auto-convert.** EURC / cirBTC sends stay "send what you hold".
- Confirm screen: **one extra row "Converted: 0.865 EURC"** in the existing confirm-row style; screenshot first.

Design (built 2026-10-05, `functions/api/_convertCore.js`):
- The server decides. `/api/send` with `allowConvert` + token USDC reads the wallet's balances ON CHAIN (dRPC) for
  the address Circle gives for walletId (never an address from the request). Enough USDC (amount + 0.01 reserve) →
  the old single-call send, unchanged. Otherwise the convert path.
- Plan: sources in order EURC → cirBTC (→ ETH when listed). Per source: quote the whole balance; if its minimum
  covers what is still missing, swap `ceil(missing × 1.01 / rate)` with stopLimit = missing; else swap it all with
  stopLimit = its quoted minimum and move on. Not enough in total → error, nothing is built.
- `fee`: plan with `missing = amount + 0.01 − USDC`, estimateFee, re-plan with `missing = amount + 2 × feeMax − USDC`
  (one fee is paid, one more stays as USDC - owner 2026-10-05 after the first real sends left 0.036 < next feeMax 0.042),
  repeat until the fee stops growing (max 3) → `{ feeMax, convert: [{ token, amountIn, minOut }] }`.
- `execute`: takes the legs the screen showed, re-fetches each intent with those amountIn + stopLimit = minOut,
  validates each (C5), re-estimates the fee and requires `USDC + Σ minOut ≥ amount + feeMax`, simulates the batch
  (recipient USDC +amount exactly; wallet USDC after ≥ feeMax) - only then the Circle challenge. Any mismatch →
  409 "The price or fee changed - check again", nothing signed.

## 7. First real auto-convert sends (2026-10-05, test.ezwallet.cash, owner wallet 0xdfe2…b0ab → 0xEb2D…52F6)
- `0x655dd390…836a` $2 no note: 0.906757 EURC (= the Confirm row) → 1.018982 USDC, provider fee 0.000182 EURC (2 bps),
  recipient +2.000000, real fee 0.01367 (shown "up to 0.042"), 635,873 gas.
- `0x7b46bfb9…8625` $1 with a note: 0.897164 EURC → 1.00573 USDC, recipient +1, Memo event sender = the wallet,
  real fee 0.01187, 552,043 gas. Adapter holds 0 USDC / 0 EURC afterwards.
- Found: the wallet was left with 0.036 USDC < the next feeMax (0.042) → the next auto-convert would be refused. Fixed
  by converting one extra feeMax (see section 6). Merged to `main` the same day (owner).
