import { getCollection, getMovieCollection, searchCollections, type Collection, type CollectionPart } from './lookup/tmdb'
import type { Fetcher } from './lookup/types'
import { readJSON, writeJSON } from './storage'
import { splitYear, STOP, words } from './text'
import type { Item } from './types'

// "Which entries of this series am I missing?" Entries come from TMDB's collections. Every
// step is conservative: a wrong "you are missing X" is worse than saying nothing, so a
// collection is only used if it demonstrably contains something the person owns.

// ---- Matching a film you own to an entry ---------------------------------------------------

const EDITION_WORDS = new Set([
  'special', 'edition', 'extended', 'cut', 'director', 'directors', 'unrated', 'theatrical', 'remastered', 'collectors', 'collector',
  'anniversary', 'ultimate', 'deluxe', 'widescreen', 'fullscreen', 'steelbook', 'version', 'expanded', 'imax', 'dvd', 'br', 'bd', 'sf', 'uhd', '4k',
])
const ALIASES: Record<string, string> = { pt: 'part' }

/** The words that identify a film: no "the/and/of", no edition labels, no trailing year. */
export function contentKey(title: string): string {
  const { title: bare } = splitYear(title)
  const set = new Set(
    words(bare)
      .map((w) => ALIASES[w] ?? w)
      .filter((w) => !STOP.has(w) && !EDITION_WORDS.has(w)),
  )
  return [...set].sort().join(' ')
}

/**
 * Same film? Equal once edition labels and little words are ignored, so "Aliens Special Edition"
 * is "Aliens" and "Harry Potter: The Sorcerer's Stone" is "Harry Potter and the Sorcerer's Stone",
 * but "Alien Resurrection" is not "Alien".
 */
export function titleMatches(itemTitle: string, partTitle: string): boolean {
  const a = contentKey(itemTitle)
  return a !== '' && a === contentKey(partTitle)
}

const yearClose = (item: Item, part: CollectionPart) => item.year === undefined || part.year === undefined || Math.abs(item.year - part.year) <= 1

export function matchesPart(item: Item, part: CollectionPart): boolean {
  if (item.category !== 'movie') return false
  if (item.ext.tmdb !== undefined) return item.ext.tmdb === part.tmdb
  return titleMatches(item.title, part.title) && yearClose(item, part)
}

// ---- Which series exist --------------------------------------------------------------------

export interface SeriesGroup {
  name: string
  items: Item[]
}

/** Series with at least one film you own. Only films: TMDB has no collections for the rest. */
export function seriesGroups(items: Item[]): SeriesGroup[] {
  const map = new Map<string, Item[]>()
  for (const i of items) {
    if (i.status !== 'owned' || i.category !== 'movie' || !i.series) continue
    const list = map.get(i.series)
    if (list) list.push(i)
    else map.set(i.series, [i])
  }
  return [...map.entries()].map(([name, list]) => ({ name, items: list })).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

// ---- Choosing the right TMDB collection ----------------------------------------------------

const GENERIC = new Set(['collection', 'saga', 'series', 'trilogy', 'franchise', 'film', 'films', 'movie', 'movies', 'anthology'])
const nameWords = (s: string) => words(s).filter((w) => !STOP.has(w) && !GENERIC.has(w))

/** A candidate whose name equals the series name, else the only one that contains all its words. */
export function pickCollection(seriesName: string, candidates: { id: number; name: string }[]): { id: number; name: string } | null {
  const want = nameWords(seriesName)
  if (want.length === 0) return null
  const key = want.join(' ')
  const equal = candidates.find((c) => nameWords(c.name).join(' ') === key)
  if (equal) return equal
  const containing = candidates.filter((c) => {
    const have = nameWords(c.name)
    return want.every((w) => have.includes(w))
  })
  return containing.length === 1 ? containing[0]! : null
}

export type Resolution = { ok: true; collection: Collection } | { ok: false; reason: 'none' | 'unverified' }

/**
 * Finds the collection for a series. Prefers TMDB's own link from a film you own (once its
 * TMDB id is known), otherwise searches by the series name. Either way the result is rejected
 * unless one of your films in the series is actually in it.
 */
export async function resolveSeries(token: string, group: SeriesGroup, fetcher?: Fetcher): Promise<Resolution> {
  let ref: { id: number; name: string } | null = null

  const ids = group.items.flatMap((i) => (i.ext.tmdb !== undefined ? [i.ext.tmdb] : [])).slice(0, 3)
  const votes = new Map<number, number>()
  for (const id of ids) {
    const c = await getMovieCollection(token, id, fetcher)
    if (c) votes.set(c.id, (votes.get(c.id) ?? 0) + 1)
  }
  const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]
  if (best) ref = { id: best[0], name: '' }

  if (!ref) ref = pickCollection(group.name, await searchCollections(token, group.name, fetcher))
  if (!ref) return { ok: false, reason: 'none' }

  const collection = await getCollection(token, ref.id, fetcher)
  if (!collection || collection.parts.length === 0) return { ok: false, reason: 'none' }
  const confirmed = group.items.some((i) => collection.parts.some((p) => matchesPart(i, p)))
  return confirmed ? { ok: true, collection } : { ok: false, reason: 'unverified' }
}

// ---- Owned vs missing ----------------------------------------------------------------------

export type EntryState = 'owned' | 'wishlist' | 'missing' | 'upcoming' | 'hidden'

export interface SeriesEntry {
  part: CollectionPart
  /** 1-based place in release order. */
  number: number
  state: EntryState
  copies: Item[]
}

export function compareSeries(parts: CollectionPart[], library: Item[], ignored: ReadonlySet<number> = new Set(), today: string = new Date().toISOString().slice(0, 10)): SeriesEntry[] {
  return parts.map((part, n) => {
    const copies = library.filter((i) => i.status === 'owned' && matchesPart(i, part))
    const wished = library.some((i) => i.status === 'wishlist' && matchesPart(i, part))
    const unreleased = !part.releaseDate || part.releaseDate > today
    let state: EntryState
    if (copies.length) state = 'owned'
    else if (wished) state = 'wishlist'
    else if (unreleased) state = 'upcoming'
    else if (ignored.has(part.tmdb)) state = 'hidden' // the person said this is not a gap
    else state = 'missing'
    return { part, number: n + 1, state, copies }
  })
}

export const countMissing = (entries: SeriesEntry[]) => entries.filter((e) => e.state === 'missing').length

// ---- Remembering results -------------------------------------------------------------------

export interface CachedSeries {
  fetchedAt: string
  /** Null when no collection was found or trusted. */
  collection: Collection | null
  reason?: 'none' | 'unverified'
}

const CACHE_KEY = 'shelfkeeper.series.v1'
const IGNORED_KEY = 'shelfkeeper.seriesIgnored.v1'
export const CACHE_DAYS = 30

/** Stored franchise results are dropped after this long (TMDB's terms: nothing cached beyond six months). */
export const CACHE_PURGE_DAYS = 150

/** The remembered results, minus any that have passed the time limit (which are also erased from storage). */
export function loadSeriesCache(now: Date = new Date()): Record<string, CachedSeries> {
  const all = readJSON<Record<string, CachedSeries>>(CACHE_KEY, {})
  const kept: Record<string, CachedSeries> = {}
  for (const [name, c] of Object.entries(all)) {
    const age = (now.getTime() - new Date(c?.fetchedAt).getTime()) / 86_400_000
    if (Number.isFinite(age) && age <= CACHE_PURGE_DAYS) kept[name] = c
  }
  if (Object.keys(kept).length !== Object.keys(all).length) writeJSON(CACHE_KEY, kept)
  return kept
}
export const saveSeriesCache = (c: Record<string, CachedSeries>) => writeJSON(CACHE_KEY, c)
export const loadIgnored = () => new Set(readJSON<number[]>(IGNORED_KEY, []))
export const saveIgnored = (s: ReadonlySet<number>) => writeJSON(IGNORED_KEY, [...s])

export const isFresh = (c: CachedSeries, now: Date = new Date()) => now.getTime() - new Date(c.fetchedAt).getTime() < CACHE_DAYS * 86_400_000

/** The format to give wishlist entries: whatever you mostly own in this series, else Blu-ray. */
export function usualFormat(group: SeriesGroup): string {
  const counts = new Map<string, number>()
  for (const i of group.items) if (i.format !== 'digital') counts.set(i.format, (counts.get(i.format) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'bluray'
}

/** A wishlist item for a missing entry. */
export function wishlistItemFor(entry: SeriesEntry, seriesName: string, format: string, base: Pick<Item, 'id' | 'addedAt' | 'updatedAt'> & { tmdbAt?: string }): Item {
  const { part } = entry
  return {
    ...base,
    category: 'movie',
    format,
    title: part.title,
    year: part.year,
    genre: part.genre,
    series: seriesName,
    seriesNum: String(entry.number),
    status: 'wishlist',
    finished: false,
    favorite: false,
    rating: 0,
    tags: [],
    posterUrl: part.posterUrl,
    ext: { tmdb: part.tmdb },
    tmdbAt: base.tmdbAt ?? new Date().toISOString().slice(0, 10),
  }
}
