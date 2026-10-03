import { normalizeItem } from './library'
import type { Item } from './types'

// RFC 4180: quoted fields, doubled quotes, newlines inside quotes, CRLF or LF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  return rows
}

function escapeCell(v: string): string {
  // Cells starting with = + - @ are formulas in Excel/Sheets; a leading quote makes them text.
  const safe = /^[=+\-@]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

const COLUMNS: { header: string; get: (i: Item) => string | number | boolean | undefined }[] = [
  { header: 'id', get: (i) => i.id },
  { header: 'category', get: (i) => i.category },
  { header: 'format', get: (i) => i.format },
  { header: 'title', get: (i) => i.title },
  { header: 'year', get: (i) => i.year },
  { header: 'creator', get: (i) => i.creator },
  { header: 'genre', get: (i) => i.genre },
  { header: 'series', get: (i) => i.series },
  { header: 'series_number', get: (i) => i.seriesNum },
  { header: 'edition', get: (i) => i.edition },
  { header: 'condition', get: (i) => i.condition },
  { header: 'location', get: (i) => i.location },
  { header: 'position', get: (i) => i.position },
  { header: 'status', get: (i) => i.status },
  { header: 'finished', get: (i) => i.finished },
  { header: 'favorite', get: (i) => i.favorite },
  { header: 'rating', get: (i) => i.rating || undefined },
  { header: 'price', get: (i) => i.price },
  { header: 'purchased', get: (i) => i.purchasedAt },
  { header: 'priority', get: (i) => i.priority },
  { header: 'target_price', get: (i) => i.targetPrice },
  { header: 'current_value', get: (i) => i.currentValue },
  { header: 'value_as_of', get: (i) => i.valueAt },
  { header: 'barcode', get: (i) => i.barcode },
  { header: 'tags', get: (i) => i.tags.join(';') },
  { header: 'lent_to', get: (i) => i.lentTo },
  { header: 'lent_on', get: (i) => i.lentAt },
  { header: 'notes', get: (i) => i.notes },
  { header: 'added', get: (i) => i.addedAt },
]

export function itemsToCsv(items: Item[]): string {
  const lines = [COLUMNS.map((c) => c.header).join(',')]
  for (const item of items) {
    lines.push(COLUMNS.map((c) => escapeCell(String(c.get(item) ?? ''))).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

// Header spellings people (and other apps) use, mapped to our field names.
const HEADER_ALIASES: Record<string, string> = {
  name: 'title', movie: 'title', album: 'title', game: 'title',
  type: 'category', media: 'category', kind: 'category',
  platform: 'format', medium: 'format',
  director: 'creator', artist: 'creator', author: 'creator', developer: 'creator',
  seriesnumber: 'seriesNum', seriesnum: 'seriesNum', number: 'seriesNum', entry: 'seriesNum',
  purchaseddate: 'purchasedAt', purchased: 'purchasedAt', purchasedate: 'purchasedAt', boughton: 'purchasedAt',
  lentto: 'lentTo', lenton: 'lentAt', lentdate: 'lentAt',
  added: 'addedAt', dateadded: 'addedAt',
  watched: 'finished', played: 'finished', read: 'finished', listened: 'finished', finished: 'finished',
  isbn: 'barcode', upc: 'barcode', ean: 'barcode',
  where: 'location', shelf: 'location', binder: 'location', page: 'position', slot: 'position',
  comments: 'notes', note: 'notes',
  genres: 'genre',
  stars: 'rating',
  cost: 'price',
  targetprice: 'targetPrice', target: 'targetPrice', maxprice: 'targetPrice',
  value: 'currentValue', marketvalue: 'currentValue', worth: 'currentValue', valueasof: 'valueAt',
}

const KNOWN = new Set([
  'id', 'category', 'format', 'title', 'year', 'creator', 'genre', 'series', 'seriesNum', 'edition', 'condition',
  'location', 'position', 'status', 'finished', 'favorite', 'rating', 'price', 'purchasedAt', 'barcode', 'tags',
  'lentTo', 'lentAt', 'notes', 'addedAt', 'posterUrl', 'priority', 'targetPrice', 'currentValue', 'valueAt',
])

function headerToField(h: string): string | null {
  const key = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!key) return null
  const alias = HEADER_ALIASES[key]
  if (alias) return alias
  for (const k of KNOWN) if (k.toLowerCase() === key) return k
  return null
}

const CATEGORY_WORDS: Record<string, string> = {
  film: 'movie', films: 'movie', movies: 'movie', movie: 'movie',
  show: 'tv', series: 'tv', tv: 'tv', television: 'tv',
  games: 'game', game: 'game', videogame: 'game',
  album: 'music', albums: 'music', music: 'music', record: 'music', records: 'music', cd: 'music', vinyl: 'music',
  books: 'book', book: 'book',
}

export interface CsvImport {
  items: Item[]
  dropped: number
  /** Headers we could not map, so the preview can say what was ignored. */
  ignoredHeaders: string[]
}

export function csvToItems(text: string): CsvImport | { error: string } {
  const rows = parseCsv(text)
  if (rows.length < 2) return { error: 'The file has no rows to import.' }
  const headerRow = rows[0]!
  const fields = headerRow.map(headerToField)
  if (!fields.includes('title')) return { error: 'The file needs a "title" column.' }
  const ignoredHeaders = headerRow.filter((h, n) => fields[n] === null && h.trim() !== '')

  const items: Item[] = []
  let dropped = 0
  for (const row of rows.slice(1)) {
    const raw: Record<string, unknown> = {}
    fields.forEach((f, n) => {
      if (!f) return
      const v = (row[n] ?? '').trim()
      if (v !== '' && raw[f] === undefined) raw[f] = f === 'price' || f === 'targetPrice' || f === 'currentValue' ? v.replace(/[$,\s]/g, '') : v
    })
    if (typeof raw.category === 'string') {
      raw.category = CATEGORY_WORDS[raw.category.toLowerCase().replace(/[^a-z]/g, '')] ?? raw.category.toLowerCase()
    }
    if (typeof raw.status === 'string') raw.status = /wish|want/i.test(raw.status) ? 'wishlist' : 'owned'
    if (typeof raw.condition === 'string') raw.condition = raw.condition.toLowerCase().replace(/[\s_]+/g, '-')
    if (typeof raw.title === 'string') raw.title = raw.title.replace(/^'/, '')
    const item = normalizeItem(raw)
    if (item) items.push(item)
    else dropped++
  }
  return { items, dropped, ignoredHeaders }
}
