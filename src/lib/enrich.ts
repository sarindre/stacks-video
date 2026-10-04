import { dayKey } from './dates'
import { searchRawg } from './lookup/rawg'
import { isTmdbImage } from './refresh'
import { searchTmdb } from './lookup/tmdb'
import type { Fetcher, LookupKeys, LookupResult } from './lookup/types'
import { normTitle, STOP, words } from './text'
import type { Item } from './types'

// Fills in cover art, year, genre and the TMDB id for items you typed in or imported.
// It is deliberately cautious: a wrong poster is worse than none, so anything it is not
// sure about is left alone and reported as "unmatched" for you to fix by hand.

const norm = normTitle

/** "It (2017)" -> search "It", expect 2017. */
export function searchTerms(item: Pick<Item, 'title' | 'year'>): { query: string; year?: number } {
  const m = /^(.*?)\s*\((\d{4})\)\s*$/.exec(item.title)
  if (m && m[1]) return { query: m[1].trim(), year: item.year ?? Number(m[2]) }
  return { query: item.title.trim(), year: item.year }
}

export function pickBestMatch(term: { query: string; year?: number }, results: LookupResult[]): LookupResult | null {
  const yearOk = (r: LookupResult) => term.year === undefined || (r.year !== undefined && Math.abs(r.year - term.year) <= 1)
  const want = norm(term.query)
  if (!want) return null

  const exact = results.filter((r) => norm(r.title) === want && yearOk(r))
  if (exact.length) return exact[0]!

  // "Harry Potter: The Sorcerer's Stone" vs "Harry Potter and the Sorcerer's Stone":
  // every meaningful word of ours appears, with only a few extra words in theirs.
  const need = words(term.query).filter((w) => !STOP.has(w))
  if (need.length < 2) return null
  for (const r of results) {
    if (!yearOk(r)) continue
    const have = words(r.title)
    if (need.every((w) => have.includes(w)) && have.length <= need.length + 3) return r
  }
  return null
}

/** What a match is allowed to change: only gaps, never anything you entered. */
export function patchFromMatch(item: Item, match: LookupResult, today: string = dayKey()): Partial<Item> | null {
  const patch: Partial<Item> = {}
  if (!item.posterUrl && match.posterUrl) patch.posterUrl = match.posterUrl
  if (item.year === undefined && match.year !== undefined) patch.year = match.year
  if (!item.genre && match.genre) patch.genre = match.genre
  if (match.ext.tmdb !== undefined && item.ext.tmdb === undefined) patch.ext = { ...item.ext, tmdb: match.ext.tmdb }
  if (match.ext.rawg !== undefined && item.ext.rawg === undefined) patch.ext = { ...item.ext, ...patch.ext, rawg: match.ext.rawg }
  // Anything taken from TMDB is dated, so it can be refreshed before it gets old (see lib/refresh.ts).
  if (Object.keys(patch).length && (match.ext.tmdb !== undefined || isTmdbImage(patch.posterUrl))) patch.tmdbAt = today
  return Object.keys(patch).length ? patch : null
}

/** Films, TV and games can be matched online; music and books are added from search instead. */
export const needsCover = (i: Item, keys?: LookupKeys) => {
  if (i.posterUrl) return false
  if (i.category === 'movie' || i.category === 'tv') return keys ? !!keys.tmdb : true
  if (i.category === 'game') return keys ? !!keys.rawg : true
  return false
}

export interface EnrichProgress {
  done: number
  total: number
  matched: number
}

export interface EnrichResult {
  patches: Record<string, Partial<Item>>
  matched: number
  unmatched: string[]
  failed: boolean
  cancelled: boolean
}

export async function matchCovers(
  items: Item[],
  keys: LookupKeys,
  opts: { fetcher?: Fetcher; onProgress?: (p: EnrichProgress) => void; signal?: AbortSignal; concurrency?: number } = {},
): Promise<EnrichResult> {
  const todo = items.filter((i) => needsCover(i, keys))
  const patches: Record<string, Partial<Item>> = {}
  const unmatched: string[] = []
  const cache = new Map<string, Promise<LookupResult | null>>()
  let done = 0
  let matched = 0
  let failed = false
  let next = 0

  const lookup = (item: Item): Promise<LookupResult | null> => {
    const term = searchTerms(item)
    const category = item.category === 'tv' ? 'tv' : item.category === 'game' ? 'game' : 'movie'
    const key = `${category}|${norm(term.query)}|${term.year ?? ''}`
    let p = cache.get(key)
    if (!p) {
      const found = category === 'game' ? searchRawg(keys.rawg, term.query, opts.fetcher) : searchTmdb(keys.tmdb, term.query, category, opts.fetcher, term.year)
      p = found.then((r) => pickBestMatch(term, r))
      cache.set(key, p)
    }
    return p
  }

  const worker = async () => {
    while (!failed && !opts.signal?.aborted) {
      const item = todo[next++]
      if (!item) return
      try {
        const match = await lookup(item)
        const patch = match ? patchFromMatch(item, match) : null
        if (patch) {
          patches[item.id] = patch
          matched++
        } else if (!match) unmatched.push(item.title)
      } catch {
        // A bad token or being offline fails every request; stop instead of hammering the service.
        failed = true
        return
      }
      done++
      opts.onProgress?.({ done, total: todo.length, matched })
    }
  }
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 4, todo.length) }, worker))
  return { patches, matched, unmatched, failed, cancelled: !!opts.signal?.aborted }
}
