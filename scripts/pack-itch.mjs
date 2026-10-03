// Packs the production build for itch.io's HTML5 player.
//
//   npm run pack:itch      (builds first, then writes release/stacks-video-html5-v<version>.zip)
//
// itch.io wants a ZIP with index.html at its root, and serves it from an address that is not the
// domain root, so nothing may assume "/" (absolute paths). This checks that before zipping.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

const fail = (msg) => {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

if (!fs.existsSync(path.join(dist, 'index.html'))) fail('dist/index.html is missing. Run "npm run build" first (or use "npm run pack:itch", which does).')

const walk = (dir, base = '') =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), `${base}${e.name}/`) : [`${base}${e.name}`]))
const files = walk(dist).filter((f) => !f.endsWith('.map'))

// ---- Checks ---------------------------------------------------------------------------------
const problems = []

// 1. Every reference in the page, the stylesheet and the manifest must be relative.
const text = (f) => fs.readFileSync(path.join(dist, f), 'utf8')
const absoluteRefs = []
for (const f of files.filter((f) => /\.(html|css|webmanifest)$/.test(f))) {
  const src = text(f)
  for (const m of src.matchAll(/(?:src|href|start_url|scope)\s*[=:]\s*["']?(\/(?!\/)[^"'\s>)]*)/g)) absoluteRefs.push(`${f}: ${m[1]}`)
  for (const m of src.matchAll(/url\(\s*["']?(\/(?!\/)[^"')]+)/g)) absoluteRefs.push(`${f}: url(${m[1]})`)
}
if (absoluteRefs.length) problems.push(`Absolute paths found (they break when served from a sub-folder):\n   ${absoluteRefs.join('\n   ')}`)

// 2. Nothing may be loaded from the network at start-up except the lookup services (fonts are bundled).
const external = []
for (const f of files.filter((f) => /\.(html|css)$/.test(f))) {
  for (const m of text(f).matchAll(/https?:\/\/[^\s"')]+/g)) {
    if (!/w3\.org|themoviedb|rawg|openlibrary|musicbrainz|upcitemdb/.test(m[0])) external.push(`${f}: ${m[0]}`)
  }
}
if (external.length) problems.push(`Unexpected external addresses in the page or styles:\n   ${external.join('\n   ')}`)

// 3. itch limits: at most 1000 files, 200 MB unpacked.
const total = files.reduce((n, f) => n + fs.statSync(path.join(dist, f)).size, 0)
if (files.length > 1000) problems.push(`${files.length} files (itch allows 1000).`)
if (total > 200 * 1024 * 1024) problems.push(`${(total / 1048576).toFixed(0)} MB unpacked (itch allows 200 MB).`)

// 4. The service worker's file list must have been filled in by the build.
if (fs.existsSync(path.join(dist, 'sw.js')) && /const PRECACHE = \/\*__PRECACHE__\*\/\[\]/.test(text('sw.js'))) problems.push('sw.js was not processed by the build (its file list is empty).')

if (problems.length) fail(problems.join('\n\n'))

// ---- Zip ------------------------------------------------------------------------------------
const entries = {}
for (const f of files) entries[f] = [new Uint8Array(fs.readFileSync(path.join(dist, f))), { level: 9, mtime: new Date(2020, 0, 1) }]
const zip = zipSync(entries)

const outDir = path.join(root, 'release')
fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, `stacks-video-html5-v${pkg.version}.zip`)
fs.writeFileSync(out, zip)

console.log(`✓ index.html is at the root, all paths are relative, nothing external is loaded at start-up`)
console.log(`✓ ${files.length} files, ${(total / 1024).toFixed(0)} KB unpacked`)
console.log(`✓ wrote ${path.relative(root, out)} (${(zip.length / 1024).toFixed(0)} KB)`)
