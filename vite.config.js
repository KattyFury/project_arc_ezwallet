import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// test.ezwallet.cash (Pages `ezwallet-test`, production branch `test`) gets an inverted home-screen icon -
// blue tile, white mark - so the owner can tell the staging app from ezwallet.cash on the phone.
// Cloudflare Pages sets CF_PAGES_BRANCH at build time; main builds keep the normal icon.
const testIcon = {
  name: 'test-apple-touch-icon',
  transformIndexHtml(html) {
    if (process.env.CF_PAGES_BRANCH !== 'test') return html
    const from = '<link rel="apple-touch-icon" href="/icon.png?v=7" />'
    if (!html.includes(from)) throw new Error('test-apple-touch-icon: index.html apple-touch-icon line changed - update vite.config.js')
    return html.replace(from, '<link rel="apple-touch-icon" href="/icon-test.png?v=2" />')
  },
}

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['util', 'stream', 'buffer', 'events', 'crypto'],
      globals: { Buffer: true, global: true, process: true },
    }),
    testIcon,
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
