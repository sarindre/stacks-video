// Converts the old single-page "Family Movie Vault" data into a Stacks Video backup file.
//
//   npm run migrate:legacy                 -> migration/blockbuster-collection.json
//   npm run migrate:legacy -- --supabase   -> also pulls movies added through the old Cloud Manager
//
// Then in the app: Settings -> Import -> choose that file. Ids are stable (legacy-dvd-<page>-<slot>),
// so importing twice never duplicates anything.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const html = fs.readFileSync(path.join(root, 'legacy', 'index.html'), 'utf8')

// The old page keeps its data in plain script constants. Run just that part in a sandbox.
const start = html.indexOf('const SERIES = {')
const end = html.indexOf('const genreOrder')
if (start < 0 || end < 0) throw new Error('Could not find SERIES / genreOrder in legacy/index.html')
const { SERIES, ALL, getGenre } = vm.runInNewContext(`${html.slice(start, end)}\n({ SERIES, ALL, getGenre })`)

// ---- Title cleanup ------------------------------------------------------------------------

const PREFIXES = [
  [/^HP:/, 'Harry Potter:'],
  [/^LoR:/, 'The Lord of the Rings:'],
  [/^PotC:/, 'Pirates of the Caribbean:'],
  [/^CoN:/, 'The Chronicles of Narnia:'],
  [/^RE:/, 'Resident Evil:'],
]

function cleanTitle(raw) {
  let title = raw.trim()
  let format
  let edition
  title = title.replace(/\s*\(Prime\)$/i, '')
  title = title.replace(/\s*\(\d+\)$/, '') // "Christmas Vacation (48)" -> the 48 was a page number
  if (/\sSF$/.test(title)) {
    title = title.replace(/\sSF$/, '')
    edition = 'Special features disc'
  }
  if (/\sBR$/.test(title)) {
    title = title.replace(/\sBR$/, '')
    format = 'bluray'
  } else if (/\sDVD$/.test(title)) {
    title = title.replace(/\sDVD$/, '')
    format = 'dvd'
  }
  for (const [re, to] of PREFIXES) title = title.replace(re, to)
  return { title, format, edition }
}

// ---- Genres -------------------------------------------------------------------------------
// The old "genres" were a mix of real genres and franchise buckets. Split them: a bucket
// that is really a franchise becomes the series (when the title has none) plus a real genre.

const GENRE_MAP = {
  'Harry Potter': { genre: 'Fantasy', series: 'Harry Potter' },
  'Lord of the Rings / Hobbit': { genre: 'Fantasy' },
  'Star Wars': { genre: 'Sci-Fi', series: 'Star Wars' },
  'Resident Evil': { genre: 'Horror', series: 'Resident Evil' },
  'Alien Franchise': { genre: 'Sci-Fi', series: 'Alien' },
  'Pirates of the Caribbean': { genre: 'Adventure', series: 'Pirates of the Caribbean' },
  'Hunger Games': { genre: 'Sci-Fi', series: 'Hunger Games' },
  'Vampire & Supernatural': { genre: 'Supernatural' },
  Superhero: { genre: 'Superhero' },
  'Action / Adventure': { genre: 'Action' },
  'Sci-Fi': { genre: 'Sci-Fi' },
  Fantasy: { genre: 'Fantasy' },
  'Thriller / Crime': { genre: 'Thriller' },
  Drama: { genre: 'Drama' },
  Comedy: { genre: 'Comedy' },
  Horror: { genre: 'Horror' },
  'Horror-Comedy': { genre: 'Horror Comedy' },
  Pixar: { genre: 'Animation', tags: ['pixar'] },
  'Family / Animation': { genre: 'Family' },
  'Illumination / Animation': { genre: 'Animation' },
  'Spooky Animation': { genre: 'Animation', tags: ['spooky'] },
  'Special / Comedy': { genre: 'Comedy' },
}

function classify(rawTitle, legacyGenre) {
  const seriesInfo = SERIES[rawTitle]
  const bucket = GENRE_MAP[legacyGenre ?? getGenre(rawTitle)] ?? {}
  const out = { genre: bucket.genre, tags: bucket.tags ?? [] }
  const series = seriesInfo?.series ?? bucket.series
  if (series) out.series = series
  if (seriesInfo?.num !== undefined) out.seriesNum = String(seriesInfo.num)
  return out
}

// ---- Items --------------------------------------------------------------------------------

const pad = (n) => String(n).padStart(3, '0')

function build({ id, rawTitle, source, page, slot, legacyGenre, extra = {} }) {
  const { title, format, edition } = cleanTitle(rawTitle)
  const { genre, series, seriesNum, tags } = classify(rawTitle, legacyGenre)
  const isDigital = source === 'prime'
  const category = /^family guy/i.test(title) ? 'tv' : 'movie'
  const item = {
    id,
    category,
    format: isDigital ? 'digital' : (format ?? 'dvd'),
    title,
    status: 'owned',
    finished: false,
    favorite: false,
    rating: 0,
    tags,
    ext: {},
    ...extra,
  }
  if (genre) item.genre = genre
  if (series) item.series = series
  if (seriesNum) item.seriesNum = seriesNum
  if (edition) item.edition = edition
  if (isDigital) {
    item.location = 'Prime Video'
  } else {
    item.location = 'Main binder'
    if (page !== undefined && page !== '' && page !== null) item.position = slot ? `Page ${page} · ${slot}` : `Page ${page}`
  }
  return item
}

const items = []
let primeN = 0
for (const d of ALL) {
  if (d.s === 'prime') {
    primeN++
    items.push(build({ id: `legacy-prime-${pad(primeN)}`, rawTitle: d.t, source: 'prime' }))
  } else {
    items.push(build({ id: `legacy-dvd-${pad(d.p)}-${d.i}`, rawTitle: d.t, source: 'dvd', page: d.p, slot: d.i }))
  }
}
const fromBinder = items.length

// ---- Optional: movies added through the old Cloud Manager ---------------------------------

if (process.argv.includes('--supabase')) {
  const cfg = /const SUPABASE_URL = '([^']+)';\s*const SUPABASE_KEY = '([^']+)'/.exec(html)
  if (!cfg) throw new Error('Could not find the Supabase settings in legacy/index.html')
  const res = await fetch(`${cfg[1]}/rest/v1/movies?select=id,title,genre,source,page,slot,created_at,favorite,watched,want_to_watch&order=created_at.asc`, {
    headers: { apikey: cfg[2], Authorization: `Bearer ${cfg[2]}` },
  })
  if (!res.ok) throw new Error(`Supabase answered ${res.status}`)
  const rows = await res.json()
  for (const r of rows) {
    const tags = []
    const item = build({
      id: `legacy-cloud-${r.id}`,
      rawTitle: r.title ?? '',
      source: r.source,
      page: r.page ?? undefined,
      slot: r.slot ?? undefined,
      legacyGenre: r.genre,
      extra: { finished: !!r.watched, favorite: !!r.favorite, addedAt: r.created_at ?? undefined },
    })
    if (r.want_to_watch) tags.push('want-to-watch')
    item.tags = [...new Set([...item.tags, ...tags])]
    items.push(item)
  }
  console.log(`Pulled ${rows.length} movies from the old cloud library.`)
}

const file = { app: 'stacks-video', version: 1, exportedAt: new Date().toISOString(), items }
const outDir = path.join(root, 'migration')
fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'blockbuster-collection.json')
fs.writeFileSync(out, JSON.stringify(file, null, 2))

// Same columns as the app's CSV export (src/lib/csv.ts), for spreadsheet editing or a CSV import.
const COLS = [
  ['id', 'id'], ['category', 'category'], ['format', 'format'], ['title', 'title'], ['year', 'year'], ['creator', 'creator'],
  ['genre', 'genre'], ['series', 'series'], ['series_number', 'seriesNum'], ['edition', 'edition'], ['condition', 'condition'],
  ['location', 'location'], ['position', 'position'], ['status', 'status'], ['finished', 'finished'], ['favorite', 'favorite'],
  ['tags', 'tags'], ['notes', 'notes'],
]
const cell = (v) => {
  const s = Array.isArray(v) ? v.join(';') : String(v ?? '')
  const safe = /^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
const csv = [COLS.map(([h]) => h).join(','), ...items.map((i) => COLS.map(([, k]) => cell(i[k])).join(','))].join('\r\n') + '\r\n'
const csvOut = path.join(outDir, 'blockbuster-collection.csv')
fs.writeFileSync(csvOut, '﻿' + csv)
console.log(`Wrote ${path.relative(root, csvOut)}`)

const byFormat =items.reduce((m, i) => ((m[i.format] = (m[i.format] ?? 0) + 1), m), {})
console.log(`Wrote ${items.length} items (${fromBinder} from the binder + Prime list) to ${path.relative(root, out)}`)
console.log('By format:', byFormat)
console.log('With a series:', items.filter((i) => i.series).length, '| with a genre:', items.filter((i) => i.genre).length)
