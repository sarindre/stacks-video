import { defaultFormat, isCategory, isCondition, parseFormat } from './catalog'
import { isDay } from './dates'
import type { Priority } from './types'
import type { Category, ExternalIds, Item, LibraryFile } from './types'

// Schema versions
//   v1: { version: 1, items: [...] } under "shelfkeeper.library.v1"
// When the shape changes, bump LIBRARY_VERSION/LIBRARY_KEY and migrate in loadLibrary.
export const LIBRARY_VERSION = 1
export const LIBRARY_KEY = 'shelfkeeper.library.v1'

const str = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t ? t : undefined
}

const num = (v: unknown): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

const bool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return ['true', 'yes', 'y', '1', 'x'].includes(v.trim().toLowerCase())
  return v === 1
}

export function normalizeTags(tags: unknown): string[] {
  const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(/[;,]/) : []
  const out: string[] = []
  for (const t of list) {
    const v = String(t ?? '').trim().toLowerCase().replace(/\s+/g, '-')
    if (v && !out.includes(v)) out.push(v)
  }
  return out
}

function normalizeExt(raw: unknown): ExternalIds {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const ext: ExternalIds = {}
  const tmdb = num(r.tmdb)
  if (tmdb !== undefined) ext.tmdb = tmdb
  const mbid = str(r.mbid)
  if (mbid) ext.mbid = mbid
  const olid = str(r.olid)
  if (olid) ext.olid = olid
  const rawg = num(r.rawg)
  if (rawg !== undefined) ext.rawg = rawg
  return ext
}

export function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `i_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Coerces anything item-shaped into the canonical Item, or null when there is no usable
 * title. Missing ids are generated, unknown fields are dropped, bad values fall back.
 */
export function normalizeItem(raw: unknown, now: string = new Date().toISOString()): Item | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const title = str(r.title)
  if (!title) return null

  const category: Category = isCategory(r.category) ? r.category : 'movie'
  const rawFormat = str(r.format)
  const format = rawFormat ? (parseFormat(category, rawFormat) ?? rawFormat.toLowerCase()) : defaultFormat(category)

  const year = num(r.year)
  const price = num(r.price)
  const targetPrice = num(r.targetPrice)
  const currentValue = num(r.currentValue)
  const valueAt = str(r.valueAt)
  const rating = Math.min(5, Math.max(0, Math.round(num(r.rating) ?? 0)))
  const purchasedAt = str(r.purchasedAt)
  const lentAt = str(r.lentAt)
  const addedAt = str(r.addedAt)

  const item: Item = {
    id: str(r.id) ?? newId(),
    category,
    format,
    title,
    status: r.status === 'wishlist' ? 'wishlist' : 'owned',
    finished: bool(r.finished),
    favorite: bool(r.favorite),
    rating,
    tags: normalizeTags(r.tags),
    ext: normalizeExt(r.ext),
    addedAt: addedAt && !Number.isNaN(new Date(addedAt).getTime()) ? addedAt : now,
    updatedAt: str(r.updatedAt) ?? now,
  }
  if (year !== undefined && year >= 1800 && year <= 2200) item.year = Math.trunc(year)
  if (price !== undefined && price >= 0) item.price = price
  if (targetPrice !== undefined && targetPrice >= 0) item.targetPrice = targetPrice
  if (currentValue !== undefined && currentValue >= 0) item.currentValue = currentValue
  if (valueAt && isDay(valueAt)) item.valueAt = valueAt
  const priority = typeof r.priority === 'string' ? (r.priority.trim().toLowerCase() as Priority) : undefined
  if (priority === 'high' || priority === 'medium' || priority === 'low') item.priority = priority
  if (purchasedAt && isDay(purchasedAt)) item.purchasedAt = purchasedAt
  if (lentAt && isDay(lentAt)) item.lentAt = lentAt
  if (isCondition(r.condition)) item.condition = r.condition
  for (const key of ['creator', 'genre', 'series', 'edition', 'location', 'position', 'notes', 'posterUrl', 'barcode', 'lentTo'] as const) {
    const v = str(r[key])
    if (v) item[key] = v
  }
  // Series numbers arrive as numbers from some sources and as "4A" / "Prequel" from others.
  const seriesNum = str(typeof r.seriesNum === 'number' ? String(r.seriesNum) : r.seriesNum)
  if (seriesNum) item.seriesNum = seriesNum
  return item
}

export function blankItem(category: Category = 'movie'): Item {
  const now = new Date().toISOString()
  return {
    id: newId(),
    category,
    format: defaultFormat(category),
    title: '',
    status: 'owned',
    finished: false,
    favorite: false,
    rating: 0,
    tags: [],
    ext: {},
    addedAt: now,
    updatedAt: now,
  }
}

// ---- Duplicate detection -----------------------------------------------------------------

const squash = (s: string | undefined) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Two items with the same key are the same product; owning two copies is still allowed. */
export function itemKey(i: Pick<Item, 'category' | 'format' | 'title' | 'year' | 'edition'>): string {
  return [i.category, i.format, squash(i.title), i.year ?? '', squash(i.edition)].join('|')
}

/** Titles you already own in any format, so adding a second one can warn about it. */
export function findSameTitle(items: Item[], candidate: Pick<Item, 'category' | 'title' | 'year'>, ignoreId?: string): Item[] {
  const t = squash(candidate.title)
  if (!t) return []
  return items.filter(
    (i) => i.id !== ignoreId && i.category === candidate.category && squash(i.title) === t && (!candidate.year || !i.year || i.year === candidate.year),
  )
}

// ---- Import / merge ----------------------------------------------------------------------

export interface ImportPlan {
  merged: Item[]
  added: number
  updated: number
  skipped: number
}

const FILL_FIELDS = [
  'year', 'creator', 'genre', 'series', 'seriesNum', 'edition', 'condition', 'location', 'position', 'notes',
  'posterUrl', 'barcode', 'price', 'purchasedAt', 'lentTo', 'lentAt', 'targetPrice', 'priority', 'currentValue', 'valueAt',
] as const

/**
 * Merges incoming items into the library. Never deletes anything and never lets an empty
 * field overwrite one you filled in.
 *  - Same id: fill the gaps, combine tags and external ids, keep your flags and rating.
 *  - No id match: it is new, unless it is a copy-for-copy repeat of something you already own
 *    (same product key) – owning two copies is legitimate, so only the surplus is added.
 */
export function mergeLibraries(existing: Item[], incoming: Item[]): ImportPlan {
  const byId = new Map(existing.map((i) => [i.id, i]))
  const keyCounts = new Map<string, number>()
  for (const i of existing) keyCounts.set(itemKey(i), (keyCounts.get(itemKey(i)) ?? 0) + 1)

  const merged = [...existing]
  const idToIndex = new Map(existing.map((i, n) => [i.id, n]))
  const incomingKeyCounts = new Map<string, number>()
  let added = 0
  let updated = 0
  let skipped = 0

  for (const inc of incoming) {
    const have = byId.get(inc.id)
    if (have) {
      const next: Item = { ...have, tags: [...new Set([...have.tags, ...inc.tags])], ext: { ...inc.ext, ...have.ext } }
      let changed = next.tags.length !== have.tags.length || Object.keys(next.ext).length !== Object.keys(have.ext).length
      for (const f of FILL_FIELDS) {
        if (have[f] === undefined && inc[f] !== undefined) {
          ;(next as unknown as Record<string, unknown>)[f] = inc[f]
          changed = true
        }
      }
      if (changed) {
        next.updatedAt = new Date().toISOString()
        merged[idToIndex.get(inc.id)!] = next
        updated++
      } else {
        skipped++
      }
      continue
    }
    const k = itemKey(inc)
    const seen = (incomingKeyCounts.get(k) ?? 0) + 1
    incomingKeyCounts.set(k, seen)
    if (seen <= (keyCounts.get(k) ?? 0)) {
      skipped++
      continue
    }
    merged.push(inc)
    added++
  }
  return { merged, added, updated, skipped }
}

export type ImportCheck = { ok: true; items: Item[]; dropped: number } | { ok: false; error: string }

/** Validates a parsed backup file (our own JSON export, or a bare array of items). */
export function validateImport(data: unknown): ImportCheck {
  let rawItems: unknown[] | null = null
  if (Array.isArray(data)) rawItems = data
  else if (data && typeof data === 'object' && Array.isArray((data as LibraryFile).items)) {
    const file = data as Partial<LibraryFile>
    if (typeof file.version === 'number' && file.version > LIBRARY_VERSION) {
      return { ok: false, error: 'This file was made by a newer version of Stacks Video. Update the app and try again.' }
    }
    rawItems = file.items as unknown[]
  }
  if (!rawItems) return { ok: false, error: 'This does not look like a Stacks Video backup.' }
  const items: Item[] = []
  let dropped = 0
  for (const raw of rawItems) {
    const item = normalizeItem(raw)
    if (item) items.push(item)
    else dropped++
  }
  if (!items.length && dropped) return { ok: false, error: 'None of the entries had a title.' }
  return { ok: true, items, dropped }
}

// ---- Persistence -------------------------------------------------------------------------

export function parseStoredLibrary(stored: unknown): Item[] {
  const raw = Array.isArray(stored) ? stored : (stored as { items?: unknown } | null)?.items
  if (!Array.isArray(raw)) return []
  return raw.map((r) => normalizeItem(r)).filter((i): i is Item => i !== null)
}

export function buildExport(items: Item[]): LibraryFile {
  return { app: 'stacks-video', version: LIBRARY_VERSION, exportedAt: new Date().toISOString(), items }
}
