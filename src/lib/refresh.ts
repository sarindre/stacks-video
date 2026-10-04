import { daysSince, dayKey } from './dates'
import { inferTags } from './autotags'
import { getTmdbDetails } from './lookup/tmdb'
import type { Fetcher, LookupKeys } from './lookup/types'
import type { Item } from './types'

// TMDB's terms don't allow keeping its content cached for more than six months. The collection itself
// holds very little of it (an id, a year, a genre label and a link to the poster, never descriptions
// or image files), but those details are re-checked from the item's id before they reach five months,
// and the person can also remove the artwork links altogether. All of this stays inside what the
// person entered themselves: refreshing never touches titles, years, genres or notes.

/** Refresh when details are older than this (comfortably inside six months). */
export const TMDB_MAX_AGE_DAYS = 150

const TMDB_IMAGE = 'https://image.tmdb.org/'
export const isTmdbImage = (url: string | undefined): boolean => !!url && url.startsWith(TMDB_IMAGE)

/** Has a TMDB id (so it can be re-checked) and was last refreshed too long ago, or never recorded. */
export function isTmdbStale(item: Item, now: Date = new Date()): boolean {
  if (item.category !== 'movie' && item.category !== 'tv') return false
  if (item.ext.tmdb === undefined) return false
  if (!item.tmdbAt) return true
  const age = daysSince(item.tmdbAt, now)
  return age === null || age > TMDB_MAX_AGE_DAYS
}

export const staleItems = (items: Item[], now: Date = new Date()): Item[] => items.filter((i) => isTmdbStale(i, now))

/** Has a TMDB id but has never had tags suggested. */
export const needsTags = (item: Item): boolean => (item.category === 'movie' || item.category === 'tv') && item.ext.tmdb !== undefined && item.autoTags === undefined

/** What one pass of "refresh details and suggest tags" will do: the stale ones plus the never-tagged ones. */
export const refreshTargets = (items: Item[], now: Date = new Date()): Item[] => items.filter((i) => isTmdbStale(i, now) || needsTags(i))

export const suggestedTagItems = (items: Item[]): Item[] => items.filter((i) => (i.autoTags?.length ?? 0) > 0)

/** Patches that remove every suggested tag, so TMDB-derived tags can be dropped on demand. Your own tags stay. */
export function removeSuggestionPatches(items: Item[]): Record<string, Partial<Item>> {
  const patches: Record<string, Partial<Item>> = {}
  for (const i of suggestedTagItems(items)) patches[i.id] = { autoTags: undefined }
  return patches
}

export const tmdbArtworkItems = (items: Item[]): Item[] => items.filter((i) => isTmdbImage(i.posterUrl))

/** Patches that remove every link to TMDB's image servers, so the artwork can be dropped on demand. */
export function removeArtworkPatches(items: Item[]): Record<string, Partial<Item>> {
  const patches: Record<string, Partial<Item>> = {}
  for (const i of tmdbArtworkItems(items)) patches[i.id] = { posterUrl: undefined }
  return patches
}

export interface RefreshProgress {
  done: number
  total: number
}

export interface RefreshResult {
  patches: Record<string, Partial<Item>>
  refreshed: number
  /** TMDB no longer lists these; their poster link was dropped. */
  gone: number
  failed: boolean
  cancelled: boolean
}

/**
 * Re-checks stale items from their TMDB id, and suggests tags for ones that never had any. The poster link is
 * replaced (only if it is one of TMDB's own, so a picture the person set by hand is left alone), the suggested
 * tags are recomputed (dismissed ones stay dismissed, the person's own tags are never touched), and the
 * "refreshed on" date is stamped.
 */
export async function refreshTmdb(
  items: Item[],
  keys: LookupKeys,
  opts: { now?: Date; fetcher?: Fetcher; onProgress?: (p: RefreshProgress) => void; signal?: AbortSignal; concurrency?: number } = {},
): Promise<RefreshResult> {
  const now = opts.now ?? new Date()
  const today = dayKey(now)
  const todo = keys.tmdb ? refreshTargets(items, now) : []
  const patches: Record<string, Partial<Item>> = {}
  let done = 0
  let refreshed = 0
  let gone = 0
  let failed = false
  let next = 0

  const worker = async () => {
    while (!failed && !opts.signal?.aborted) {
      const item = todo[next++]
      if (!item) return
      try {
        const details = await getTmdbDetails(keys.tmdb, item.category as 'movie' | 'tv', item.ext.tmdb!, opts.fetcher)
        const patch: Partial<Item> = { tmdbAt: today }
        if (details === null) {
          gone++
          patch.autoTags = [] // TMDB no longer lists it: nothing derived from it is kept
          if (isTmdbImage(item.posterUrl)) patch.posterUrl = undefined
        } else {
          refreshed++
          patch.autoTags = inferTags({ genres: details.genres, keywords: details.keywords }, { primaryGenre: item.genre, dismissed: item.removedTags, own: item.tags })
          if (details.posterUrl && (!item.posterUrl || isTmdbImage(item.posterUrl))) patch.posterUrl = details.posterUrl
          else if (!details.posterUrl && isTmdbImage(item.posterUrl)) patch.posterUrl = undefined
        }
        patches[item.id] = patch
      } catch {
        // A bad token or being offline fails every request; stop instead of repeating it.
        failed = true
        return
      }
      done++
      opts.onProgress?.({ done, total: todo.length })
    }
  }
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 4, todo.length) }, worker))
  return { patches, refreshed, gone, failed, cancelled: !!opts.signal?.aborted }
}
