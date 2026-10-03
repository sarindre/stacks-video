import { getJson, LookupError, yearOf, type Fetcher, type LookupResult } from './types'

const API = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p/w342'

// TMDB's search results carry genre ids only; these are stable and public.
const GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama',
  10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Sci-Fi', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
  10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
}

interface TmdbRow {
  id?: number
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  genre_ids?: number[]
  overview?: string
}

export function parseTmdb(json: unknown, category: 'movie' | 'tv'): LookupResult[] {
  const rows = (json as { results?: TmdbRow[] } | null)?.results
  if (!Array.isArray(rows)) return []
  const out: LookupResult[] = []
  for (const r of rows) {
    const title = (category === 'movie' ? r.title : r.name)?.trim()
    if (!title || typeof r.id !== 'number') continue
    const genre = r.genre_ids?.map((g) => GENRES[g]).find(Boolean)
    out.push({
      title,
      category,
      year: yearOf(category === 'movie' ? r.release_date : r.first_air_date),
      genre,
      posterUrl: r.poster_path ? `${IMG}${r.poster_path}` : undefined,
      overview: r.overview?.trim() || undefined,
      ext: { tmdb: r.id },
    })
  }
  return out
}

/** TMDB needs a (free) v4 "Read Access Token", pasted once in Settings. */
export async function searchTmdb(token: string, query: string, category: 'movie' | 'tv', fetcher: Fetcher = fetch, year?: number): Promise<LookupResult[]> {
  if (!token) throw new LookupError('Add your free TMDB token in Settings to search movies and TV.', 'needs-token')
  const params = new URLSearchParams({ query, include_adult: 'false', language: 'en-US', page: '1' })
  if (year) params.set(category === 'movie' ? 'year' : 'first_air_date_year', String(year))
  const json = await getJson(fetcher, `${API}/search/${category}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  })
  return parseTmdb(json, category).slice(0, 12)
}

// ---- Collections (franchises) -------------------------------------------------------------
// TMDB groups films into collections ("Alien Collection"). Used to find which entries of a
// series you are missing.

export interface CollectionPart {
  tmdb: number
  title: string
  year?: number
  /** YYYY-MM-DD, or empty for an unreleased film with no date yet. */
  releaseDate: string
  posterUrl?: string
  genre?: string
}

export interface Collection {
  id: number
  name: string
  parts: CollectionPart[]
}

export function parseCollectionSearch(json: unknown): { id: number; name: string }[] {
  const rows = (json as { results?: { id?: number; name?: string }[] } | null)?.results
  if (!Array.isArray(rows)) return []
  return rows.flatMap((r) => (typeof r.id === 'number' && r.name ? [{ id: r.id, name: r.name }] : []))
}

export function parseMovieCollection(json: unknown): { id: number; name: string } | null {
  const c = (json as { belongs_to_collection?: { id?: number; name?: string } | null } | null)?.belongs_to_collection
  return c && typeof c.id === 'number' ? { id: c.id, name: c.name ?? '' } : null
}

export function parseCollection(json: unknown): Collection | null {
  const j = json as { id?: number; name?: string; parts?: TmdbRow[] } | null
  if (!j || typeof j.id !== 'number' || !Array.isArray(j.parts)) return null
  const parts: CollectionPart[] = []
  for (const r of j.parts) {
    const title = r.title?.trim()
    if (!title || typeof r.id !== 'number') continue
    parts.push({
      tmdb: r.id,
      title,
      year: yearOf(r.release_date),
      releaseDate: r.release_date ?? '',
      posterUrl: r.poster_path ? `${IMG}${r.poster_path}` : undefined,
      genre: r.genre_ids?.map((g) => GENRES[g]).find(Boolean),
    })
  }
  // Release order; films without a date yet go last.
  parts.sort((a, b) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999'))
  return { id: j.id, name: j.name ?? '', parts }
}

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } })
function needToken(token: string) {
  if (!token) throw new LookupError('Add your free TMDB token in Settings to check series.', 'needs-token')
}

export async function searchCollections(token: string, query: string, fetcher: Fetcher = fetch) {
  needToken(token)
  const params = new URLSearchParams({ query, language: 'en-US', page: '1' })
  return parseCollectionSearch(await getJson(fetcher, `${API}/search/collection?${params}`, auth(token)))
}

export async function getCollection(token: string, id: number, fetcher: Fetcher = fetch) {
  needToken(token)
  return parseCollection(await getJson(fetcher, `${API}/collection/${id}?language=en-US`, auth(token)))
}

/** The collection a film belongs to, if any: the most reliable link once an item has its TMDB id. */
export async function getMovieCollection(token: string, movieId: number, fetcher: Fetcher = fetch) {
  needToken(token)
  return parseMovieCollection(await getJson(fetcher, `${API}/movie/${movieId}?language=en-US`, auth(token)))
}
