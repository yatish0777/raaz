// Captures the README screenshots into docs/screenshots/.
//
//   npm run build && npm run screenshots
//
// Serves the production build with Vite's preview server and drives it with
// puppeteer-core + an installed Chrome/Edge (no browser download needed).
// Set CHROME_PATH if your browser is somewhere unusual.

import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { preview } from 'vite'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'screenshots')
const PORT = 4179
const BASE = `http://localhost:${PORT}`

const CASE = 'RAAZ-26-1027' // Ponzi scheme: mixer + peel + consolidation, cash-out at NovaX, part of a syndicate
const SHARED_WALLET = 'TaJXqcRHSmfSNjNFNsY7WfGZgnjoyP3vkT' // consolidation wallet reused across 5 cases
const SAMPLE_WALLET = 'TifSd2hP6mxjDp9zH7AVCUmCJFVignpVnV' // TRON wallet from the dummy dataset

const CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p))

if (!CHROME) throw new Error('No Chrome/Edge found. Set CHROME_PATH to the browser executable.')
if (!existsSync(join(ROOT, 'dist'))) throw new Error('Run `npm run build` first.')
mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Scroll the app's main scroll container so the element matching `sel` sits near the top */
async function scrollTo(page, sel, offset = 12) {
  await page.evaluate(
    (sel, offset) => {
      const main = document.querySelector('main')
      const el = document.querySelector(sel)
      if (main && el) main.scrollTop += el.getBoundingClientRect().top - main.getBoundingClientRect().top - offset
    },
    sel,
    offset,
  )
  await sleep(300)
}

async function clickTab(page, label) {
  await page.locator(`[role=tab] ::-p-text(${label})`).click()
  await sleep(700)
}

const server = await preview({ root: ROOT, preview: { port: PORT, strictPort: true, open: false } })
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })

async function shot(name, { path, height = 900, width = 1440, mobile = false, before } = {}) {
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
  await page.goto(BASE + path, { waitUntil: 'networkidle0' })
  await page.waitForSelector('main h1, main h2, main h3', { timeout: 15000 })
  await sleep(1200) // charts + d3 layout
  if (before) await before(page)
  await page.screenshot({ path: join(OUT, `${name}.png`), type: 'png' })
  console.log('saved', name)
  await page.close()
}

const workspaceTab = (label, { height = 1000, scroll = '[role=tablist]' } = {}) => ({
  path: `/cases/${CASE}`,
  height,
  before: async (page) => {
    await clickTab(page, label)
    await scrollTo(page, scroll)
  },
})

try {
  await shot('01-dashboard', { path: '/', height: 1750 })
  await shot('02-new-investigation', { path: `/investigate?address=${SAMPLE_WALLET}`, height: 1050 })
  await shot('03-analysis-progress', {
    path: `/analysis/${CASE}`,
    height: 760,
    before: () => sleep(4300), // mid-pipeline: some stages done, one running
  })
  await shot('04-investigation-workspace', {
    path: `/cases/${CASE}`,
    height: 1350,
    before: (page) => scrollTo(page, 'h1', 60),
  })
  await shot('05-transaction-graph', workspaceTab('Transaction graph', { height: 900 }))
  await shot('06-networkx-analysis', workspaceTab('NetworkX analysis', { height: 1500 }))
  await shot('07-suspicious-patterns', workspaceTab('Patterns', { height: 1000 }))
  await shot('08-exchange-attribution', workspaceTab('Exchange attribution', { height: 900 }))
  await shot('09-risk-score', workspaceTab('Risk score', { height: 820 }))
  await shot('10-network-map', { path: '/network', height: 1250 })
  await shot('11-investigation-report', { path: `/reports/${CASE}`, height: 1350 })
  await shot('12-notice-to-exchange', { path: `/reports/${CASE}?tab=notice`, height: 1350 })
  await shot('13-vasp-directory', {
    path: '/exchanges',
    height: 1200,
    before: async (page) => {
      await page.locator('tbody tr').click()
      await sleep(400)
    },
  })
  await shot('14-watchlist-alerts', { path: '/watchlist', height: 1000 })
  await shot('15-wallet-profile', { path: `/wallets/${SHARED_WALLET}`, height: 1250 })
  await shot('16-cases', { path: '/cases', height: 950 })
  await shot('17-mobile', {
    path: `/cases/${CASE}`,
    width: 390,
    height: 844,
    mobile: true,
    before: (page) => scrollTo(page, 'h1', 60),
  })
} finally {
  await browser.close()
  await new Promise((r) => server.httpServer.close(r))
}
