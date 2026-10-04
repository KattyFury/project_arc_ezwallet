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
