import { createPublicClient, http, decodeEventLog, parseAbiItem, parseAbi, encodeFunctionData } from 'viem'
import { defineChain } from 'viem'
import { MOCK, MOCK_AMOUNTS, MOCK_RATES, MOCK_CHANGE_24H, MOCK_TX, MOCK_UNVERIFIED } from './mock'
import { fetchHistory, fetchHistoryPage, fetchAllBalances } from './circle'
// The chain id is declared in qr.js (a module that does NOT depend on viem) so screens that only draw/read QRs - ShowQR,
// SavedQRList - can use it without pulling all of viem into their chunk. ONE source of truth: changing chains means
// editing exactly one place over there, and this file follows.
import { ARC_CHAIN_ID } from './qr'
import { NET } from './clientNet'

// The standard Multicall3 is deployed on Arc (Arc docs → Network → Contract addresses:
// "Aggregates multiple read calls into a single call for efficient data retrieval").
// Declared on the chain so publicClient.multicall() can fold N reads into 1 request - see getTokenBalances.
// THE BLOCK EXPLORER - one constant for every tx link (explorer.arc.io, from src/network.js).
export const EXPLORER = NET.explorer

// Arc mainnet - the only network since 2026-10-02.
const arc = defineChain({
  id: ARC_CHAIN_ID,
  name: NET.label,
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [NET.rpc] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: EXPLORER } },
  contracts: { multicall3: { address: NET.contracts.multicall3 } },
})

export const publicClient = createPublicClient({
  chain: arc,
  transport: http(),
})

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
]

// PRICES IN USD (the app's unit of account), live from /api/prices (fetchPrices below). USDC is ALWAYS 1 (it IS the
// dollar) → stablecoins show exactly 1:1. NO OFFLINE FALLBACK PRICES (owner 2026-10-04: the old EURC 1.08 / cirBTC 65000
// were silently shown as real when /api/prices failed) - a token without a live price has usd = null and every screen
// shows "…" for it and for any total that includes it.
// Display-only metadata per symbol. Addresses/decimals come from the network config, so a token the network
// does not list (e.g. cirBTC on mainnet v1) simply does not exist in this build.
const TOKEN_UI = {
  USDC:   { color: '#2775CA' },
  EURC:   { color: '#1A56DB' },
  cirBTC: { color: '#F7931A' },
}
export const TOKENS = Object.entries(NET.tokens).map(([symbol, t]) => ({ symbol, address: t.address, decimals: t.decimals, ...TOKEN_UI[symbol] }))

let priceCache = {}
let priceCache24h = {}   // symbol -> % change in the last 24h (from /api/prices), for the token-list arrow
let lastFetch = 0

// ── Module-level cache: switching screens (Send↔Receive↔Menu) shows the number IMMEDIATELY, with no "..." flash.
// Every navigate swaps the component → it remounts → it refetches; seeding state from the cache shows the previous
// number instantly while a background fetch updates it (like a banking app). It lives for the session (lost on page reload).
let _balCache = {}      // addr(lowercase) -> tokens[] (the most recent getTokenBalances result)
let _ratesCache = null  // the most recent { USDC, EURC, cirBTC }
// MOCK MODE: build fake balances from TOKENS + MOCK_AMOUNTS (no RPC reads).
function mockBalances() {
  return TOKENS
    .map(t => { const amount = MOCK_AMOUNTS[t.symbol] || 0; return { ...t, amount, usd: amount * (MOCK_RATES[t.symbol] ?? 0), change24h: MOCK_CHANGE_24H[t.symbol] ?? null } })
    .filter(t => t.amount > 0)
}

export function cachedBalances(addr) {
  if (MOCK) return mockBalances()   // return immediately, no "..." flash
  return addr ? (_balCache[addr.toLowerCase()] || null) : null
}
export function cachedRates() { return MOCK ? MOCK_RATES : _ratesCache }

// Callers that arrive while a fetch is in flight share it (2026-10-07: opening Home fired /api/prices up to 4 times at
// once - getTokenBalances + getDisplayRates' three lookups - each a server round trip).
let pricesInFlight = null
function fetchPrices() {
  if (Date.now() - lastFetch < 60000) return Promise.resolve(priceCache)
  if (!pricesInFlight) pricesInFlight = fetchPricesNow().finally(() => { pricesInFlight = null })
  return pricesInFlight
}
async function fetchPricesNow() {
  try {
    // Our own /api/prices (functions/api/prices.js): CoinGecko with the Demo key, cross-checked against Binance,
    // cached 5 min server-side for everyone (owner decision 2026-10-03). The browser no longer calls CoinGecko.
    const res = await fetch('/api/prices')
    const data = await res.json()
    TOKENS.forEach(t => {
      if (data.prices?.[t.symbol] > 0) priceCache[t.symbol] = data.prices[t.symbol]
      if (data.change24h?.[t.symbol] != null) priceCache24h[t.symbol] = data.change24h[t.symbol]
    })
    if (data.prices?.ETH > 0) priceCache['ETH'] = data.prices.ETH   // not a token in the wallet yet - price only
    priceCache['USDC'] = 1  // pinned: USDC = exactly $1 (do not let CoinGecko's ~0.9998 skew it)
    // VND is stored as "USD per 1 VND" to MATCH every other rate (rates[cur] = USD per unit),
    // which is what lets displayNum(usd, cur, rates) = usd / rates[cur] be shared with no special case.
    // vndPerUsd = the number of VND per USDC (~26,300) → inverted, ~0.000038.
    if (data.vndPerUsd > 0) priceCache['VND'] = 1 / data.vndPerUsd
    lastFetch = Date.now()
  } catch {}
  return priceCache
}

// Read the balances of ALL 3 TOKENS in EXACTLY 1 HTTP request (Multicall3 folds the 3 balanceOf calls together).
//
// ⚠️ Arc's public RPC IS RATE LIMITED (the Arc "running-a-node" docs advertise running your own node as
// "No rate limits" → so the shared endpoint has them). Measured for real 2026-07-17: firing 3 balanceOf calls IN PARALLEL →
// HTTP 429, failing 5 times out of 5. Sequential with a 350ms gap still failed 5/5; only a 700ms gap per token got through (>2s
// before a balance appeared = far too slow). Folding into Multicall3 → 5/5 successes, 1 request per read.
//
// DO NOT GO BACK to per-token reads with retries: the old version (readBalance trying 3 times per token) fired up to 9 requests
// per balance read → it WALKED INTO the rate limit → 429 → and every retry made it worse (HomeSend also retried
// every 3s → a death loop). That IS the "1000 USDC but it says available 0.00" bug of 07-17.
// Bonus: multicall reads all 3 tokens in the SAME block → consistent balances, never split across blocks.
//
// Two retries for the occasional 429/timeout, spaced 600/1200ms (rate limits need a MUCH longer pause than the
// old 250/500ms). Still failing after that → THROW (do not swallow → see the getTokenBalances warning).
async function readAllBalances(walletAddress, tries = 3) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      const raws = await publicClient.multicall({
        allowFailure: false,   // one bad token → throw, do NOT return a made-up 0
        contracts: TOKENS.map(token => ({
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletAddress],
        })),
      })
      return raws.map((raw, k) => Number(raw) / Math.pow(10, TOKENS[k].decimals))
    } catch (e) {
      lastErr = e
      if (i < tries - 1) await new Promise(r => setTimeout(r, 600 * (i + 1)))
    }
  }
  throw lastErr
}

// ⚠️ NEVER RETURN 0 ON A FAILED READ - that is INVENTING A BALANCE.
// Bug 07-16 (the user: "the numbers go all over the place and wrong before settling down, e.g. it shows
// 0 0 22 and then comes back to 240 0 0"): the old code wrapped each balanceOf in try/catch and returned
// `{amount: 0}` on error. Arc's RPC fails sporadically per token → a failed read showed 0 exactly like a real zero
// balance → the next successful fetch snapped the number back. Worse: that INVENTED result was also WRITTEN TO CACHE
// → the wrong number spread to every other screen.
// Now: all 3 attempts fail → Promise.all rejects → THE FUNCTION THROWS → the screen KEEPS the previous number (cache/
// seed) instead of drawing a fiction. The cache is only written when ALL 3 TOKENS were genuinely read.
export async function getTokenBalances(walletAddress) {
  if (MOCK) return mockBalances()
  if (!walletAddress) return []
  // Prices and balances run IN PARALLEL (it used to await the prices before reading balances → twice as slow).
  // A failed price fetch does not fail the balances: that token's usd is null ("…" on screen), the amounts stay real.
  const [prices, amounts] = await Promise.all([
    fetchPrices(),
    readAllBalances(walletAddress),   // 1 request for all 3 tokens (Multicall3) - do not split it up again
  ])
  // Show EVERY supported token (including a REAL zero balance) - the wallet always lists USDC/EURC/cirBTC (user decision 07-15)
  const out = TOKENS.map((token, i) => {
    const amount = amounts[i]
    const rate = token.symbol === 'USDC' ? 1 : (prices[token.symbol] ?? null)
    // the USD value (NOT rounded - the cents matter); null = no live price. A real 0 balance is worth 0 either way.
    const usd = amount === 0 ? 0 : rate == null ? null : amount * rate
    return { ...token, amount, usd, change24h: priceCache24h[token.symbol] ?? null }
  })
  _balCache[walletAddress.toLowerCase()] = out   // only reached when all 3 tokens were genuinely read
  return out
}

// UNVERIFIED tokens = anything the wallet holds that this network does not list (meme coins, airdrops, spam).
// Owner 2026-10-03: shown under the verified tokens as VIEW ONLY - no $ value, not in the total, cannot be sent.
// Source = Circle's balance list with includeAll (there is no on-chain way to discover unknown tokens; the
// explorer API answers a Cloudflare challenge). Name/symbol come from the token contract, i.e. from whoever deployed
// it - React escapes them and the row truncates them, but they are still untrusted text.
export async function getUnverifiedTokens() {
  if (MOCK) return MOCK_UNVERIFIED
  const walletId = localStorage.getItem('ez_wallet_id')
  if (!walletId) return []
  const listed = new Set(Object.values(NET.tokens).map(t => t.address.toLowerCase()))
  const all = await fetchAllBalances(walletId)
  return all
    .filter(t => !t.isNative && t.address && !listed.has(t.address.toLowerCase()) && Number(t.amount) > 0)
    .map(t => ({ address: t.address, symbol: t.symbol || '?', name: t.name || '', decimals: t.decimals, amount: Number(t.amount), amountStr: String(t.amount) }))
}

// The USD total of a token list, or null when a token the wallet HOLDS has no live price (adding null would count it as
// 0 and show a smaller balance than the real one).
export function sumUsd(tokens) {
  let s = 0
  for (const t of tokens || []) { if (t.usd == null) { if (t.amount > 0) return null } else s += t.usd }
  return s
}

// The USD price of one token (USD per unit). USDC = 1. null = no live price (no offline fallback any more).
export async function getUsdRate(symbol = 'USDC') {
  if (MOCK) return MOCK_RATES[symbol] ?? null
  if (symbol === 'USDC') return 1
  const prices = await fetchPrices()
  return prices[symbol] ?? null
}

// Rates for the display currency: USD per unit {USDC:1, EURC, cirBTC, VND} - a missing live price is null.
// USDC pinned to 1 → stablecoins show exactly 1:1 (5 USDC = $5.00). cirBTC is included so TxHistory converts cirBTC
// transactions using the SAME rate source as the display column (avoiding a source mismatch).
export async function getDisplayRates() {
  if (MOCK) { _ratesCache = MOCK_RATES; return MOCK_RATES }
  const [u, e, b] = await Promise.all([getUsdRate('USDC'), getUsdRate('EURC'), getUsdRate('cirBTC')])
  // VND: not a token - taken straight from the priceCache fetchPrices filled. Missing → null (no fallback).
  const prices = await fetchPrices()
  _ratesCache = { USDC: u, EURC: e, cirBTC: b, VND: prices.VND ?? null }
  return _ratesCache
}

// One token's balance + its USD price (USDC = the token used for sending)
export async function getTokenInfo(addr, symbol = 'USDC') {
  const [balances, rate] = await Promise.all([getTokenBalances(addr), getUsdRate(symbol)])
  const t = balances.find(b => b.symbol === symbol)
  return { balance: t?.amount ?? 0, usd: t?.usd ?? null, rate }
}

// Read the memo (Arc Transaction Memos) of one transaction from the on-chain Memo event → text
const MEMO_CONTRACT = NET.contracts.memo
const memoEventAbi = parseAbiItem('event Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)')
// ── MEMOS: REMEMBER THEM FOREVER + QUEUE THEM, DO NOT FIRE ALL AT ONCE (user decision 07-31 "stop spamming") ──
// Each memo is its own receipt read. The History screen used to fire 30 of them AT ONCE on every open
// → the public RPC blocked it (429), which dragged the balance/fee reads down with it → the app stalled.
// Two guards:
//  1. REMEMBER PERMANENTLY in localStorage - once a transaction is on chain its memo NEVER changes.
//     Remember the "no memo" case (null) too - most transactions land there, and without it
//     every open asks the same questions again. From the second open on = 0 network calls.
//  2. AT MOST 3 CALLS IN FLIGHT, the rest queue up. Every memo still arrives, just spread out.
const MEMO_KEY = 'ez_memos'
const MEMO_MAX = 800          // ~1 line per transaction; over the limit, wipe and start over (cheaper than an LRU)
const MEMO_CONCURRENCY = 3
let _memos = null
function memoStore() {
  if (!_memos) { try { _memos = JSON.parse(localStorage.getItem(MEMO_KEY) || '{}') } catch { _memos = {} } }
  return _memos
}
function rememberMemo(hash, memo) {
  const s = memoStore()
  if (Object.keys(s).length >= MEMO_MAX) { _memos = {} }
  _memos[hash] = memo
  try { localStorage.setItem(MEMO_KEY, JSON.stringify(_memos)) } catch {}
}
let _memoRunning = 0
const _memoQueue = []
function queued(job) {
  return new Promise(resolve => {
    const start = () => {
      _memoRunning++
      job().then(resolve).catch(() => resolve(null)).finally(() => {
        _memoRunning--
        const next = _memoQueue.shift()
        if (next) next()
      })
    }
    if (_memoRunning < MEMO_CONCURRENCY) start()
    else _memoQueue.push(start)
  })
}

export async function getTxMemo(hash) {
  const s = memoStore()
  if (hash in s) return s[hash]              // already asked (including "none") → do NOT ask again
  const memo = await queued(() => readMemoOnChain(hash))
  rememberMemo(hash, memo)
  return memo
}

async function readMemoOnChain(hash) {
  try {
    const r = await publicClient.getTransactionReceipt({ hash })
    for (const log of r.logs) {
      if (log.address.toLowerCase() !== MEMO_CONTRACT.toLowerCase()) continue
      try {
        const d = decodeEventLog({ abi: [memoEventAbi], data: log.data, topics: log.topics })
        if (d.eventName === 'Memo' && d.args.memo && d.args.memo.length > 2) {
          const bytes = Uint8Array.from(d.args.memo.slice(2).match(/.{1,2}/g).map(b => parseInt(b, 16)))
          return new TextDecoder().decode(bytes)
        }
      } catch {}
    }
  } catch {}
  return null
}

// ── TRANSFERS OF ONE TRANSACTION, from its on-chain receipt (the History screen + incoming-money notifications) ──
// Replaces the block-explorer `tokentx` API (mainnet answers it with a Cloudflare bot challenge - measured 2026-10-01).
// Rows keep the explorer's shape { hash, from, to, value, contractAddress, tokenSymbol, tokenDecimal, timeStamp } so the
// screens did not change.
// USDC: read from Arc's native USDC system emitter 0xffff…fffe, NOT the ERC-20 contract 0x3600… - docs.arc.io
// (/integrate/exchanges/deposits, /integrate/wallets/add-arc-to-a-wallet): every USDC movement emits a Transfer there
// (18 decimals), while a plain native send emits nothing on 0x3600… and would be missed. Measured on real receipts: an
// ERC-20 USDC transfer emits BOTH logs (same from/to, 1e18 vs 1e6) → the 0x3600… log is skipped to avoid a double row.
// Other tokens (EURC): their own contract's Transfer log. Gas has no event (docs) → never a row.
// Same guards as the memos above: remembered forever (a final Arc tx never changes - docs: no reorgs) and read through
// the same 3-at-a-time queue (firing many receipt reads at once gets "rate limit exceeded" from the public RPC -
// measured again 2026-10-01 with a 20-call batch). The memo of the same receipt is stored too → no second read.
const SYSTEM_EMITTER = '0xfffffffffffffffffffffffffffffffffffffffe'
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
// v2 (2026-10-03): rows now include UNVERIFIED tokens. v1 stored a tx that only moved an unknown token as [] - those
// empty entries are dropped on migration (so they are read again); every non-empty entry is carried over.
const TRANSFERS_KEY = 'ez_tx_transfers_v2'
const TRANSFERS_KEY_V1 = 'ez_tx_transfers'
const TRANSFERS_MAX = 1500
let _transfers = null
function transferStore() {
  if (!_transfers) {
    try { _transfers = JSON.parse(localStorage.getItem(TRANSFERS_KEY) || 'null') } catch { _transfers = null }
    if (!_transfers) {
      let v1 = {}
      try { v1 = JSON.parse(localStorage.getItem(TRANSFERS_KEY_V1) || '{}') } catch {}
      _transfers = Object.fromEntries(Object.entries(v1).filter(([, rows]) => Array.isArray(rows) && rows.length))
      try { localStorage.setItem(TRANSFERS_KEY, JSON.stringify(_transfers)); localStorage.removeItem(TRANSFERS_KEY_V1) } catch {}
    }
  }
  return _transfers
}
function rememberTransfers(hash, rows) {
  if (Object.keys(transferStore()).length >= TRANSFERS_MAX) _transfers = {}
  _transfers[hash] = rows
  try { localStorage.setItem(TRANSFERS_KEY, JSON.stringify(_transfers)) } catch {}
}
const topicAddr = t => '0x' + t.slice(26)

// symbol + decimals of an UNVERIFIED token, read from its contract once and remembered. Untrusted text: cut to 16 chars.
const META_KEY = 'ez_token_meta'
async function unverifiedMeta(address) {
  let store = {}
  try { store = JSON.parse(localStorage.getItem(META_KEY) || '{}') } catch {}
  if (store[address]) return store[address]
  try {
    const abi = parseAbi(['function symbol() view returns (string)', 'function decimals() view returns (uint8)'])
    const [symbol, decimals] = await Promise.all([
      publicClient.readContract({ address, abi, functionName: 'symbol' }),
      publicClient.readContract({ address, abi, functionName: 'decimals' }),
    ])
    store[address] = { symbol: String(symbol).slice(0, 16) || '?', decimals: Number(decimals) }
    try { localStorage.setItem(META_KEY, JSON.stringify(store)) } catch {}
    return store[address]
  } catch { return null }
}

// → [{ from, to, value, contractAddress, tokenSymbol, tokenDecimal }] (every token transfer in the tx), or null when the
// receipt could not be read (NOT remembered → asked again next time).
async function readTransfersOnChain(hash) {
  // Retry with a growing pause: a rate-limited read is NOT "no transfers" (measured 2026-10-01: 3 of 50 receipts
  // failed in one go and their rows silently vanished from History).
  let r
  for (let i = 0; i < 3 && !r; i++) {
    try { r = await publicClient.getTransactionReceipt({ hash }) } catch { await new Promise(ok => setTimeout(ok, 700 * (i + 1))) }
  }
  if (!r) return null
  const usdc = NET.tokens.USDC.address.toLowerCase()
  const bySym = Object.entries(NET.tokens).map(([sym, t]) => ({ sym, ...t, address: t.address.toLowerCase() }))
  const rows = []
  if (r.status === 'success') {
    for (const log of r.logs) {
      if (log.topics[0] !== TRANSFER_TOPIC || log.topics.length !== 3) continue
      const a = log.address.toLowerCase()
      let value
      try { value = BigInt(log.data) } catch { continue }   // a non-standard token's empty/odd data must not break the receipt
      if (a === SYSTEM_EMITTER) {
        rows.push({ from: topicAddr(log.topics[1]), to: topicAddr(log.topics[2]), value: (value / 10n ** 12n).toString(), contractAddress: usdc, tokenSymbol: 'USDC', tokenDecimal: '6' })
      } else if (a !== usdc) {
        const t = bySym.find(x => x.address === a)
        if (t) rows.push({ from: topicAddr(log.topics[1]), to: topicAddr(log.topics[2]), value: value.toString(), contractAddress: a, tokenSymbol: t.sym, tokenDecimal: String(t.decimals) })
        else if (value > 0n) {
          // UNVERIFIED token (owner 2026-10-03: notify it, in yellow). Zero-value transfers are skipped - that is the
          // "address poisoning" trick (fake 0-token transfers from a look-alike address). Symbol/decimals come from the
          // token contract itself; if they cannot be read, the receipt counts as unread (null → retried later).
          const meta = await unverifiedMeta(a)
          if (!meta) return null
          rows.push({ from: topicAddr(log.topics[1]), to: topicAddr(log.topics[2]), value: value.toString(), contractAddress: a, tokenSymbol: meta.symbol, tokenDecimal: String(meta.decimals), unverified: true })
        }
      }
    }
  }
  if (!(hash in memoStore())) {
    let memo = null
    for (const log of r.logs) {
      if (log.address.toLowerCase() !== MEMO_CONTRACT.toLowerCase()) continue
      try {
        const d = decodeEventLog({ abi: [memoEventAbi], data: log.data, topics: log.topics })
        if (d.eventName === 'Memo' && d.args.memo && d.args.memo.length > 2) {
          memo = new TextDecoder().decode(Uint8Array.from(d.args.memo.slice(2).match(/.{1,2}/g).map(b => parseInt(b, 16))))
          break
        }
      } catch {}
    }
    rememberMemo(hash, memo)
  }
  return rows
}

export async function getTxTransfers(hash) {
  const s = transferStore()
  if (hash in s) return s[hash]
  const rows = await queued(() => readTransfersOnChain(hash))
  if (rows) rememberTransfers(hash, rows)
  return rows
}

// The explorer-shaped rows of a list of { hash, date } (Circle's history, see functions/api/wallet.js 'history'),
// only the transfers that touch `walletAddr`, newest first. onProgress(rowsSoFar) lets the screen draw while the
// receipts are still arriving. Throws when ANY receipt could not be read - an incomplete ledger must not pass for a
// complete one; the rows read so far were already handed to onProgress and are remembered, so the caller's retry is cheap.
export async function historyRows(txs, walletAddr, onProgress) {
  const me = walletAddr.toLowerCase()
  const seen = new Set(), list = []
  for (const t of txs) if (!seen.has(t.hash)) { seen.add(t.hash); list.push(t) }
  const out = []
  let failed = 0
  await Promise.all(list.map(t => getTxTransfers(t.hash).then(rows => {
    if (!rows) { failed++; return }
    const ts = String(Math.floor(Date.parse(t.date) / 1000))
    for (const x of rows) if (x.from === me || x.to === me) out.push({ ...x, hash: t.hash, timeStamp: ts })
    onProgress?.(out.slice().sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp)))
  })))
  if (failed) throw new Error(`could not read ${failed} of ${list.length} transactions from the chain`)
  return out.sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp))
}

// The wallet's history in explorer-shaped rows - the one entry point for TxHistory and NotifArea. `limit` caps how many
// of Circle's newest transactions are read from the chain (the notification poll only needs the latest few).
export async function loadHistoryRows({ limit, onProgress } = {}) {
  if (MOCK) return MOCK_TX.slice().sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp))
  const walletAddr = localStorage.getItem('ez_wallet_addr')
  const walletId = localStorage.getItem('ez_wallet_id')
  if (!walletAddr || !walletId) return []
  // No onProgress (the notification poll): one call for the newest `limit` transactions, as before.
  if (!onProgress) return historyRows(await fetchHistory(walletId, limit), walletAddr)
  // History screen: PAGE BY PAGE (owner 2026-10-03) - the newest 50 are drawn as soon as their receipts arrive, older
  // pages follow behind (it used to fetch EVERY page from Circle before drawing a single row). A page with an unreadable
  // receipt does not stop the next pages; the error is thrown at the end so the screen retries (receipts are cached).
  const max = limit || 1000
  const byTime = rows => rows.sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp))
  let all = [], failed = null, cursor = null, count = 0
  do {
    const page = await fetchHistoryPage(walletId, cursor)
    count += page.txs.length
    let pageRows = []
    try { pageRows = await historyRows(page.txs, walletAddr, rows => { pageRows = rows; onProgress(byTime([...all, ...rows])) }) }
    catch (e) { failed = e }
    all = byTime([...all, ...pageRows])
    onProgress(all)
    cursor = page.next
  } while (cursor && count < max)
  if (failed) throw failed
  return all
}

// The fee of a send BEFORE it is signed now comes from Circle itself (src/circle.js estimateSendFee → /api/send 'fee'):
// the old chain-side estimate here multiplied gas by the BASE price only (Circle adds a priority fee) and fell back to a
// guessed 65k/110k gas - owner 2026-10-04: no guessed numbers in the app.

// The fee a FINISHED transaction actually paid (receipt: gasUsed × effectiveGasPrice, native USDC = 18 decimals, $1),
// for the receipt screen. null when the receipt cannot be read (the caller keeps the estimate it already has).
export async function getTxFeeUsd(hash) {
  if (MOCK || !hash) return null
  for (let i = 0; i < 3; i++) {
    try {
      const r = await publicClient.getTransactionReceipt({ hash })
      return Number(r.gasUsed * r.effectiveGasPrice) / 1e18
    } catch { await new Promise(ok => setTimeout(ok, 700 * (i + 1))) }
  }
  return null
}

