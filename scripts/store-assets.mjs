// Makes the images for the itch.io page (cover + screenshots) from the real app, using only the
// built-in sample collection, so no personal data can end up in them.
//
//   npm run build && npm run store-assets
//
// Needs Chrome or Edge (set CHROME_PATH if it isn't in the usual place). Writes to docs/itch/.
// The sample items have no cover art, so this draws simple typographic posters for them and serves
// those in place of the poster requests; nothing is fetched from the internet.

import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const out = path.join(root, 'docs', 'itch')
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Run "npm run build" first.')
fs.mkdirSync(out, { recursive: true })

const CHROME = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p))
if (!CHROME) throw new Error('Could not find Chrome or Edge. Set CHROME_PATH.')

// ---- serve dist/ ----------------------------------------------------------------------------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const f = path.join(dist, p === '/' ? 'index.html' : p)
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end() }
  res.setHeader('content-type', MIME[path.extname(f)] ?? 'application/octet-stream')
  res.end(fs.readFileSync(f))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`

// ---- typographic posters --------------------------------------------------------------------
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
function wrap(title, max = 11) {
  const lines = []
  let cur = ''
  for (const w of title.toUpperCase().split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w } else cur = (cur + ' ' + w).trim()
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 4)
}
function poster(title, year, kind) {
  const h = hash(title)
  const hue = h % 360
  const hue2 = (hue + 40 + (h % 60)) % 360
  const lines = wrap(title)
  const size = lines.some((l) => l.length > 9) ? 38 : 46
  const shape = [
    `<circle cx="171" cy="190" r="92" fill="hsl(${hue2} 85% 62%)" opacity=".9"/>`,
    `<path d="M0 330 L342 190 L342 330 Z" fill="hsl(${hue2} 80% 40%)" opacity=".85"/>`,
    `<rect x="40" y="70" width="262" height="14" fill="hsl(${hue2} 90% 70%)" opacity=".8"/><rect x="40" y="94" width="170" height="8" fill="hsl(${hue2} 90% 70%)" opacity=".6"/>`,
  ][h % 3]
  const label = kind === 'game' ? 'GAME' : kind === 'music' ? 'STEREO' : kind === 'book' ? 'NOVEL' : kind === 'tv' ? 'SERIES' : 'VIDEO'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 342 513" width="342" height="513">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 30%)"/><stop offset="1" stop-color="hsl(${hue} 60% 12%)"/></linearGradient></defs>
  <rect width="342" height="513" fill="url(#g)"/>${shape}
  <text x="171" y="40" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="6" fill="#fff" opacity=".7">${label}</text>
  ${lines.map((l, i) => `<text x="171" y="${390 + i * (size + 4) - (lines.length - 1) * (size + 4)}" text-anchor="middle" font-family="Impact, Arial Narrow, Arial, sans-serif" font-size="${size}" font-weight="800" fill="#fff" stroke="#000" stroke-opacity=".35" stroke-width="2" paint-order="stroke">${esc(l)}</text>`).join('')}
  <text x="171" y="490" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3" fill="#fff" opacity=".8">${year ?? ''}</text>
</svg>`
}

// ---- driving the app ------------------------------------------------------------------------
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'stacks-video-assets-'))
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: profile, args: ['--no-sandbox', '--disable-gpu'] })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function open({ width = 1280, height = 720, theme = 'dark', mobile = false } = {}) {
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const u = new URL(req.url())
    if (u.hostname === 'posters.local') {
      const [title, year, kind] = decodeURIComponent(u.pathname.slice(1)).replace(/\.svg$/, '').split('|')
      return req.respond({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: poster(title, year, kind) })
    }
    if (u.origin === origin) return req.continue()
    return req.abort() // nothing leaves the machine
  })
  await page.evaluateOnNewDocument((theme) => {
    // Once per page: start from an empty library with the help panels folded away, so the screenshots
    // show the collection. (Pages share storage, and this must not run again on the later reload.)
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.removeItem('shelfkeeper.library.v1')
    localStorage.setItem('shelfkeeper.prefs.v1', JSON.stringify({ 'help.collection': 'closed', 'help.wishlist': 'closed', 'help.binder': 'closed', 'help.stats': 'closed' }))
    localStorage.setItem('shelfkeeper.settings.v1', JSON.stringify({ theme, dismissedNotices: ['embedded', 'ios-storage'], loanDays: 0, lastBackupAt: new Date().toISOString() }))
  }, theme)
  await page.goto(origin, { waitUntil: 'networkidle0' })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Try a sample collection/.test(b.textContent)).click())
  await sleep(500)
  // give every sample item a poster, then reload so they render
  await page.evaluate(() => {
    const k = 'shelfkeeper.library.v1'
    const lib = JSON.parse(localStorage.getItem(k))
    for (const i of lib.items) i.posterUrl = `https://posters.local/${[i.title, i.year ?? '', i.category].map(encodeURIComponent).join('|')}.svg`
    localStorage.setItem(k, JSON.stringify(lib))
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(500)
  return page
}
const nav = (page, name) => page.evaluate((n) => [...document.querySelectorAll('nav[aria-label=Main] button')].filter((b) => b.offsetParent).find((b) => new RegExp(n).test(b.textContent)).click(), name)
const shot = async (page, name, clip) => { await sleep(400); await page.screenshot({ path: path.join(out, name), ...(clip ? { clip } : {}) }); console.log('•', name) }

// 1. collection, dark
let page = await open()
await shot(page, '01-collection.png')
// 2. in stock?
await page.click('button[aria-label^="Is it in stock"]')
await page.waitForSelector('dialog[open] input[aria-label="Title or barcode"]')
await page.type('dialog[open] input[aria-label="Title or barcode"]', 'nosferatu')
await sleep(300)
await shot(page, '02-in-stock.png')
await page.click('dialog[open] button[aria-label="Close"]')
await page.waitForFunction(() => !document.querySelector('dialog[open]'))
// 3. binder
await nav(page, 'Binder'); await page.waitForSelector('section[aria-label="Page 1"]')
await shot(page, '03-binder.png')
// 4. coming soon
await nav(page, 'Coming soon'); await sleep(300)
await shot(page, '04-coming-soon.png')
// 5. stats
await nav(page, 'Stats'); await page.waitForSelector('h3')
await shot(page, '05-stats.png')
await page.close()

// 6. light theme
page = await open({ theme: 'light' })
await shot(page, '06-collection-light.png')
await page.close()

// 7. phone
page = await open({ width: 390, height: 844, mobile: true })
await shot(page, '07-phone.png')
await page.close()

// ---- cover image (630x500) ------------------------------------------------------------------
const b64 = (f) => fs.readFileSync(f).toString('base64')
const font = (pkg, file) => b64(path.join(root, 'node_modules', '@fontsource', pkg, 'files', file))
const iconSvg = fs.readFileSync(path.join(root, 'public', 'icons', 'icon.svg'), 'utf8')
const cover = await browser.newPage()
await cover.setViewport({ width: 630, height: 500 })
await cover.setContent(`<!doctype html><html><head><style>
@font-face{font-family:Bungee;src:url(data:font/woff2;base64,${font('bungee', 'bungee-latin-400-normal.woff2')})}
@font-face{font-family:Barlow;font-weight:700;src:url(data:font/woff2;base64,${font('barlow-condensed', 'barlow-condensed-latin-700-normal.woff2')})}
*{box-sizing:border-box;margin:0}
body{width:630px;height:500px;background:#151311;color:#f5eddf;overflow:hidden;position:relative;font-family:Barlow,sans-serif}
.stripes{position:absolute;inset:0;background:repeating-linear-gradient(115deg,transparent 0 46px,rgba(255,99,80,.07) 46px 92px)}
.band{position:absolute;left:0;right:0;bottom:0;height:86px;background:#ff6350;display:flex;align-items:center;justify-content:center}
.band span{font:700 30px Barlow;letter-spacing:5px;color:#1a0a07;text-transform:uppercase}
.icon{position:absolute;left:50%;top:34px;width:200px;height:200px;transform:translateX(-50%) rotate(-4deg);filter:drop-shadow(0 12px 18px rgba(0,0,0,.5))}
.icon svg{width:100%;height:100%}
h1{position:absolute;left:0;right:0;top:252px;text-align:center;font:400 62px Bungee;letter-spacing:2px;line-height:1}
h1 b{color:#ff6350;font-weight:400}
p{position:absolute;left:0;right:0;top:332px;text-align:center;font:700 25px Barlow;letter-spacing:3px;color:#aaa092;text-transform:uppercase}
.sticker{position:absolute;right:30px;top:30px;background:#ffc928;color:#1d1a16;font:700 22px Barlow;letter-spacing:2px;padding:8px 14px;border-radius:4px;transform:rotate(7deg);box-shadow:0 4px 10px rgba(0,0,0,.4)}
</style></head><body>
<div class="stripes"></div><div class="icon">${iconSvg}</div>
<div class="sticker">FREE · PRIVATE</div>
<h1>STACKS<b> VIDEO</b></h1>
<p>Catalog your DVDs, games, records &amp; books</p>
<div class="band"><span>Be kind, rewind.</span></div>
</body></html>`)
await cover.evaluate(() => document.fonts.ready)
await sleep(300)
await cover.screenshot({ path: path.join(out, 'cover-630x500.png') })
console.log('• cover-630x500.png')

await browser.close()
server.close()
fs.rmSync(profile, { recursive: true, force: true }) // our own temp profile only
