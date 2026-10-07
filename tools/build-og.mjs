// Rebuilds public/og.png - the 1200x630 link-preview card (X, Telegram, Facebook...).
//
//   npm run mock                       # dev server on :5173 with fake balances
//   node tools/build-og.mjs            # → public/og.png
//
// Then bump `og.png?v=N` in index.html (og:image + twitter:image) - X/Telegram cache by URL.
// Background = the app's own brand gradient (src/brandBg.js, the Login/Splash one), owner request 2026-10-03
// (the solid #0B53BF card looked flat). Text sits on the white half, so it is black/brand like the Login screen.
// ⚠️ The phone frame MUST keep the screenshot's exact ratio (390x844) with NO border, or white bands appear.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GRADIENT } from '../src/brandBg.js'

const APP = process.env.APP_URL || 'http://localhost:5173'
const OUT = fileURLToPath(new URL('../public/og.png', import.meta.url))
const logo = 'data:image/svg+xml;base64,' + readFileSync(new URL('../design/logo.svg', import.meta.url)).toString('base64')

const browser = await chromium.launch()

// 1. A fresh HomeSend screenshot (mock data: USDC, EURC, cirBTC + unverified tokens).
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })
await phone.goto(`${APP}/?screen=HomeSend`)
await phone.waitForTimeout(3000)
const shot = 'data:image/png;base64,' + (await phone.screenshot()).toString('base64')

// 2. The card.
const W = 270, H = W * 844 / 390   // phone frame = the screenshot's own ratio
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; position: relative;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: ${GRADIENT}; color: #000; }
  .logo { position: absolute; left: 76px; top: 56px; height: 52px; }
  h1 { position: absolute; left: 76px; top: 160px; width: 680px; font-size: 46px; line-height: 56px;
    font-weight: 700; letter-spacing: -1.4px; }
  h1 span { color: #0B53BF; }
  p { position: absolute; left: 76px; top: 296px; width: 660px; font-size: 21px; line-height: 32px; color: #667085; }
  .pills { position: absolute; left: 76px; top: 384px; display: flex; gap: 12px; }
  .pill { padding: 9px 18px; border-radius: 999px; border: 1.5px solid #0B53BF; color: #0B53BF;
    background: #fff; font-size: 17px; font-weight: 600; }
  .url { position: absolute; left: 76px; bottom: 56px; font-size: 24px; font-weight: 700; color: #fff; }
  .phone { position: absolute; right: 80px; top: ${(630 - H) / 2}px; width: ${W}px; height: ${H}px;
    border-radius: 30px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,.28); }
  .phone img { width: 100%; height: 100%; display: block; }
</style></head><body>
  <img class="logo" src="${logo}" alt="">
  <h1>A crypto wallet simple enough<br>for <span>my mom</span> to use.</h1>
  <p>Send, receive and swap USDC, EURC and cirBTC.<br>Email + 6-digit PIN. No seed phrase – fees paid in USDC.</p>
  <div class="pills"><div class="pill">Live on Arc Mainnet</div><div class="pill">Open source · MIT</div></div>
  <div class="url">ezwallet.cash</div>
  <div class="phone"><img src="${shot}" alt=""></div>
</body></html>`

const card = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await card.setContent(html)
await card.waitForTimeout(300)
await card.screenshot({ path: OUT })
await browser.close()
console.log('wrote', OUT)
