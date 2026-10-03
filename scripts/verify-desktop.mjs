// Desktop audit: builds the app, launches the real Electron desktop app, and checks it from the
// outside (through the browser debugging port): it loads, is isolated from Node, keeps your data
// between runs, refuses to leave the app, may use the camera but nothing riskier, and can reach
// the lookup services from its own address.
//
//   npm run audit:desktop                                           check the app run from source (electron .)
//   npm run audit:desktop -- --packed=release/win-unpacked/"Stacks Video.exe"   check a packaged build
//   npm run audit:desktop -- --shots=./shots                        also save a screenshot
//
// Uses a throwaway data folder, so it never touches your real data.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { build } from 'vite'
import puppeteer from 'puppeteer-core'
import electronPath from 'electron'

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const i = a.indexOf('=')
      return i < 0 ? [a.slice(2), 'true'] : [a.slice(2, i), a.slice(i + 1)]
    }),
)
const PORT = 9334
const HOME = 'app://stacksvideo/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `: ${detail}`}`)
  if (!ok) failures++
}

if (!args.packed) {
  console.log('Building...')
  await build({ logLevel: 'error' })
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stacks-video-desktop-'))
const launch = () => {
  const cmd = args.packed ? path.resolve(args.packed) : electronPath
  const argv = [...(args.packed ? [] : ['.']), `--remote-debugging-port=${PORT}`, `--user-data-dir=${dataDir}`]
  // some editors set ELECTRON_RUN_AS_NODE, which would make Electron start as plain Node
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env
  return spawn(cmd, argv, { stdio: 'ignore', env })
}

async function connect(proc) {
  for (let i = 0; i < 80; i++) {
    try {
      const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
      const page = (await browser.pages()).find((p) => p.url().startsWith(HOME))
      if (page) return { browser, page }
      browser.disconnect()
    } catch {
      /* not up yet */
    }
    if (proc.exitCode !== null) throw new Error('the app exited before it could be checked')
    await sleep(500)
  }
  throw new Error("couldn't connect to the desktop app")
}

const stop = async (proc) => {
  if (proc.exitCode === null) {
    proc.kill()
    await new Promise((r) => proc.once('exit', r))
  }
  await sleep(500)
}

try {
  console.log('First run:')
  let proc = launch()
  let { browser, page } = await connect(proc)
  await page.waitForFunction(() => document.body.textContent.includes('The shelves are empty'), { timeout: 30000 })

  const info = await page.evaluate(async () => ({
    title: document.title,
    origin: location.origin,
    secure: isSecureContext,
    desktop: window.stacksVideoDesktop?.isDesktop === true,
    platform: window.stacksVideoDesktop?.platform,
    hasRequire: typeof require !== 'undefined',
    hasProcess: typeof process !== 'undefined',
    workers: (await navigator.serviceWorker?.getRegistrations?.().catch(() => []))?.length ?? 0,
    folderPicker: typeof showDirectoryPicker,
    embedded: window.self !== window.top,
    notice: !!document.querySelector('p[role=note]'),
    fonts: (await document.fonts.ready, [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family)),
  }))
  check(info.title === 'Stacks Video', 'window title is Stacks Video', info.title)
  check(info.origin === 'app://stacksvideo', 'served from its own app:// address', info.origin)
  check(info.secure, 'is a secure context')
  check(info.desktop, 'knows it is the desktop app', String(info.platform))
  check(!info.hasRequire && !info.hasProcess, 'page has no access to Node (require/process)')
  check(info.workers === 0, 'no service worker (not needed on desktop)', String(info.workers))
  check(info.folderPicker === 'function', 'folder picker for automatic backup is available')
  check(!info.embedded && !info.notice, 'no "running inside another website" notice')
  check(info.fonts.includes('Bungee') && info.fonts.includes('Barlow Condensed'), 'bundled fonts load from the app', info.fonts.join(', '))

  if (args.shots) {
    fs.mkdirSync(args.shots, { recursive: true })
    await page.screenshot({ path: path.join(args.shots, 'desktop-window.png') })
  }

  // permissions: the camera is allowed (barcode scanning), nothing else risky
  const perms = await page.evaluate(async () => {
    const out = {}
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true })
      s.getTracks().forEach((t) => t.stop())
      out.camera = 'granted'
    } catch (e) {
      out.camera = e.name // NotFoundError (no camera on this machine) still means the permission was allowed
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      out.microphone = 'granted'
    } catch (e) {
      out.microphone = e.name
    }
    out.geolocation = await new Promise((resolve) => navigator.geolocation.getCurrentPosition(() => resolve('granted'), (err) => resolve('code ' + err.code), { timeout: 4000 }))
    return out
  })
  check(perms.camera !== 'NotAllowedError', 'the camera permission is allowed for barcode scanning', perms.camera)
  check(perms.microphone === 'NotAllowedError', 'the microphone is refused', perms.microphone)
  check(perms.geolocation === 'code 1', 'location is refused', perms.geolocation)

  // data survives a restart (the app's storage keys keep their original "shelfkeeper." prefix)
  await page.evaluate(() => {
    localStorage.setItem('shelfkeeper.library.v1', JSON.stringify({ version: 1, items: [{ id: 'persist-1', title: 'Persisted Film', category: 'movie', format: 'dvd', status: 'owned', addedAt: new Date().toISOString() }] }))
  })

  // leaving the app is blocked
  const before = (await browser.pages()).length
  await page.evaluate(() => window.open('https://example.com/', '_blank'))
  await sleep(600)
  check((await browser.pages()).length === before, 'an external link does not open a new window inside the app')
  await page.evaluate(() => { location.href = 'https://example.com/' })
  await sleep(1000)
  check(page.url().startsWith(HOME), 'navigating to another site is blocked', page.url())
  await page.evaluate(() => { location.href = 'file:///C:/Windows/win.ini' })
  await sleep(800)
  check(page.url().startsWith(HOME), 'navigating to a local file is blocked', page.url())

  // lookup services must be reachable from the app's own origin (CORS)
  const tmdb = await page.evaluate(async () => {
    try {
      const r = await fetch('https://api.themoviedb.org/3/authentication', { headers: { Authorization: 'Bearer not-a-real-token' } })
      return { status: r.status }
    } catch (e) {
      return { error: String(e) }
    }
  })
  check(tmdb.status === 401, 'can reach TMDB from the desktop app (a fake token is refused, not blocked)', JSON.stringify(tmdb))
  const ol = await page.evaluate(async () => {
    try {
      return { status: (await fetch('https://openlibrary.org/search.json?q=dune&limit=1&fields=key,title')).status }
    } catch (e) {
      return { error: String(e) }
    }
  })
  check(ol.status === 200, 'can reach Open Library from the desktop app (no key needed)', JSON.stringify(ol))

  // a path that tries to escape the app's folder gets nothing
  const escaped = await page.evaluate(async () => (await fetch('app://stacksvideo/..%2f..%2fpackage.json')).status)
  check(escaped === 404, 'a path outside the app folder is refused', String(escaped))

  // the app actually works: sample collection, binder, in-stock check
  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(() => document.body.textContent.includes('Persisted Film') || document.querySelector('[aria-label="Search your collection"]'), { timeout: 15000 })
  const work = await page.evaluate(async () => {
    const q = (s) => document.querySelector(s)
    return {
      cards: [...document.querySelectorAll('main button[aria-label]')].some((b) => /Persisted Film/.test(b.getAttribute('aria-label'))),
      stock: !!q('header button[aria-label^="Is it in stock"]'),
    }
  })
  check(work.cards && work.stock, 'the collection screen renders the stored item and the "In stock?" button')

  await sleep(1500)
  await browser.close().catch(() => {}) // close the app the way a user would, so storage is written out
  await stop(proc)

  console.log('Second run (same data folder):')
  proc = launch()
  ;({ browser, page } = await connect(proc))
  await page.waitForFunction(() => document.querySelector('[aria-label="Search your collection"]'), { timeout: 30000 })
  await sleep(800)
  const again = await page.evaluate(() => ({
    kept: JSON.parse(localStorage.getItem('shelfkeeper.library.v1') || '{}').items?.[0]?.title,
    shown: document.body.textContent.includes('Persisted Film') || !![...document.querySelectorAll('main button[aria-label]')].find((b) => /Persisted Film/.test(b.getAttribute('aria-label'))),
  }))
  check(again.kept === 'Persisted Film', 'your data is still there after restarting', String(again.kept))
  check(again.shown, 'and it is on screen')
  browser.disconnect()
  await stop(proc)
} catch (err) {
  failures++
  console.log(`  FAIL ${err.message}`)
} finally {
  fs.rmSync(dataDir, { recursive: true, force: true })
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nThe desktop app works.')
process.exit(failures ? 1 : 0)
