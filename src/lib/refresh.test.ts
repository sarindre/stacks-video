import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeItem } from './library'
import { parseDetails } from './lookup/tmdb'
import { isTmdbStale, needsTags, refreshTargets, refreshTmdb, removeArtworkPatches, removeSuggestionPatches, staleItems, TMDB_MAX_AGE_DAYS, tmdbArtworkItems } from './refresh'
import { CACHE_PURGE_DAYS, loadSeriesCache } from './series'

const NOW = new Date(2026, 5, 1, 12)
const make = (id: string, over: Record<string, unknown> = {}) => normalizeItem({ id, title: `T${id}`, ...over })!
const TM = 'https://image.tmdb.org/t/p/w342'
const KEYS = { tmdb: 'tok', rawg: '' }
const day = (n: number) => {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('which items are due a refresh', () => {
  it('keeps the limit under six months', () => {
    expect(TMDB_MAX_AGE_DAYS).toBeLessThan(180)
  })
  it('flags an item with a TMDB id whose details are old or undated', () => {
    expect(isTmdbStale(make('a', { ext: { tmdb: 1 }, tmdbAt: day(10) }), NOW)).toBe(false)
    expect(isTmdbStale(make('a', { ext: { tmdb: 1 }, tmdbAt: day(TMDB_MAX_AGE_DAYS) }), NOW)).toBe(false)
    expect(isTmdbStale(make('a', { ext: { tmdb: 1 }, tmdbAt: day(TMDB_MAX_AGE_DAYS + 1) }), NOW)).toBe(true)
    expect(isTmdbStale(make('a', { ext: { tmdb: 1 } }), NOW)).toBe(true)
  })
  it('ignores things TMDB has nothing to say about', () => {
    expect(isTmdbStale(make('a'), NOW)).toBe(false)
    expect(isTmdbStale(make('a', { category: 'book', ext: { tmdb: 1 } }), NOW)).toBe(false)
    expect(isTmdbStale(make('a', { category: 'game', ext: { rawg: 1 } }), NOW)).toBe(false)
    expect(staleItems([make('a', { ext: { tmdb: 1 } }), make('b'), make('c', { ext: { tmdb: 2 }, tmdbAt: day(1), autoTags: [] })], NOW).map((i) => i.id)).toEqual(['a'])
  })
})

describe('refreshTmdb', () => {
  const reply = (table: Record<string, { status: number; body?: unknown }>) =>
    vi.fn(async (url: string) => {
      const key = Object.keys(table).find((k) => url.includes(k))!
      const { status, body } = table[key]!
      return new Response(JSON.stringify(body ?? {}), { status })
    })

  it('replaces a TMDB poster link, stamps the day, and leaves everything the person typed alone', async () => {
    const item = make('a', { title: 'My own title', year: 1999, genre: 'My genre', notes: 'mine', ext: { tmdb: 10 }, posterUrl: `${TM}/old.jpg` })
    const f = reply({ '/movie/10': { status: 200, body: { poster_path: '/new.jpg', release_date: '2001-01-01' } } })
    const out = await refreshTmdb([item], KEYS, { fetcher: f, now: NOW })
    expect(out.patches.a).toEqual({ tmdbAt: day(0), posterUrl: `${TM}/new.jpg`, autoTags: [] })
    expect(Object.keys(out.patches.a!).sort()).toEqual(['autoTags', 'posterUrl', 'tmdbAt']) // no title, year, genre, notes or the person's own tags
    expect(out.refreshed).toBe(1)
  })

  it("keeps a poster the person set by hand", async () => {
    const item = make('a', { ext: { tmdb: 10 }, posterUrl: 'https://example.com/mine.jpg' })
    const out = await refreshTmdb([item], KEYS, { fetcher: reply({ '/movie/10': { status: 200, body: { poster_path: '/new.jpg' } } }), now: NOW })
    expect(out.patches.a).toEqual({ tmdbAt: day(0), autoTags: [] })
  })

  it('uses the TV endpoint for TV', async () => {
    const f = reply({ '/tv/5': { status: 200, body: { poster_path: '/t.jpg', first_air_date: '2004-09-22' } } })
    const out = await refreshTmdb([make('a', { category: 'tv', ext: { tmdb: 5 } })], KEYS, { fetcher: f, now: NOW })
    expect(out.patches.a).toMatchObject({ posterUrl: `${TM}/t.jpg` })
  })

  it('drops the TMDB poster link when TMDB no longer lists the title', async () => {
    const item = make('a', { ext: { tmdb: 10 }, posterUrl: `${TM}/old.jpg` })
    const out = await refreshTmdb([item], KEYS, { fetcher: reply({ '/movie/10': { status: 404 } }), now: NOW })
    expect(out.patches.a).toEqual({ tmdbAt: day(0), posterUrl: undefined, autoTags: [] })
    expect(out.gone).toBe(1)
    expect(out.failed).toBe(false)
  })

  it('does nothing without a token or when nothing is due', async () => {
    const f = reply({})
    expect((await refreshTmdb([make('a', { ext: { tmdb: 1 } })], { tmdb: '', rawg: '' }, { fetcher: f, now: NOW })).patches).toEqual({})
    expect((await refreshTmdb([make('a', { ext: { tmdb: 1 }, tmdbAt: day(1), autoTags: [] })], KEYS, { fetcher: f, now: NOW })).patches).toEqual({})
    expect(f).not.toHaveBeenCalled()
  })

  it('stops at the first real failure instead of retrying everything', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 401 }))
    const items = Array.from({ length: 20 }, (_, n) => make(String(n), { ext: { tmdb: n + 1 } }))
    const out = await refreshTmdb(items, KEYS, { fetcher: f, now: NOW, concurrency: 2 })
    expect(out.failed).toBe(true)
    expect(f.mock.calls.length).toBeLessThanOrEqual(2)
  })
})

describe('removing the artwork links', () => {
  it('clears only links to TMDB, leaving hand-set pictures and other sources', () => {
    const items = [make('a', { posterUrl: `${TM}/a.jpg` }), make('b', { posterUrl: 'https://covers.openlibrary.org/b/id/1-M.jpg' }), make('c', { posterUrl: 'https://example.com/x.jpg' }), make('d')]
    expect(tmdbArtworkItems(items).map((i) => i.id)).toEqual(['a'])
    expect(removeArtworkPatches(items)).toEqual({ a: { posterUrl: undefined } })
  })
})

describe('parseDetails', () => {
  it('reads the poster and year, for movies and TV', () => {
    expect(parseDetails({ poster_path: '/p.jpg', release_date: '1979-05-25' }, 'movie')).toEqual({ posterUrl: `${TM}/p.jpg`, year: 1979, genres: [], keywords: [] })
    expect(parseDetails({ poster_path: null, first_air_date: '2004-09-22' }, 'tv')).toEqual({ posterUrl: undefined, year: 2004, genres: [], keywords: [] })
    expect(parseDetails(null, 'movie')).toEqual({ posterUrl: undefined, year: undefined, genres: [], keywords: [] })
    // genres use our wording, keywords come from the right place for movies and TV
    expect(parseDetails({ genres: [{ id: 878, name: 'Science Fiction' }, { id: 999, name: 'Mystery Genre' }], keywords: { keywords: [{ name: 'alien' }, {}] } }, 'movie')).toMatchObject({ genres: ['Sci-Fi', 'Mystery Genre'], keywords: ['alien'] })
    expect(parseDetails({ keywords: { results: [{ name: 'heist' }], keywords: [{ name: 'wrong one' }] } }, 'tv').keywords).toEqual(['heist'])
  })
})

describe('the remembered franchise results expire too', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('drops results past the limit when they are loaded, and erases them from storage', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
    const iso = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()
    store.set('shelfkeeper.series.v1', JSON.stringify({ Fresh: { fetchedAt: iso(10), collection: null }, Edge: { fetchedAt: iso(CACHE_PURGE_DAYS - 1), collection: null }, Old: { fetchedAt: iso(CACHE_PURGE_DAYS + 5), collection: null }, Broken: { collection: null } }))
    expect(Object.keys(loadSeriesCache(NOW)).sort()).toEqual(['Edge', 'Fresh'])
    expect(Object.keys(JSON.parse(store.get('shelfkeeper.series.v1')!)).sort()).toEqual(['Edge', 'Fresh'])
    expect(CACHE_PURGE_DAYS).toBeLessThan(180)
  })
})

describe('suggested tags come from the same pass', () => {
  const body = (keywords: string[], genres = [{ id: 27, name: 'Horror' }]) => ({ poster_path: '/p.jpg', genres, keywords: { keywords: keywords.map((name) => ({ name })) } })
  const ok = (b: unknown) => vi.fn(async () => new Response(JSON.stringify(b)))

  it('picks out which items are due: stale ones and ones never tagged', () => {
    const items = [
      make('fresh', { ext: { tmdb: 1 }, tmdbAt: day(1), autoTags: ['x'] }),
      make('untagged', { ext: { tmdb: 2 }, tmdbAt: day(1) }),
      make('old', { ext: { tmdb: 3 }, tmdbAt: day(400), autoTags: [] }),
      make('book', { category: 'book', ext: { tmdb: 4 } }),
      make('no id'),
    ]
    expect(items.map((i) => needsTags(i))).toEqual([false, true, false, false, false])
    expect(refreshTargets(items, NOW).map((i) => i.id)).toEqual(['untagged', 'old'])
  })

  it('suggests tags from the keywords and the other genres', async () => {
    const item = make('a', { ext: { tmdb: 10 }, genre: 'Horror' })
    const out = await refreshTmdb([item], KEYS, { fetcher: ok(body(['final girl', 'haunted house'], [{ id: 27, name: 'Horror' }, { id: 53, name: 'Thriller' }])), now: NOW })
    expect(out.patches.a!.autoTags).toEqual(['slasher', 'haunted', 'thriller'])
  })

  it("never touches the person's own tags, never repeats them, and never brings back a dismissed suggestion", async () => {
    const item = make('a', { ext: { tmdb: 10 }, genre: 'Horror', tags: ['slasher', 'mine'], removedTags: ['haunted'] })
    const out = await refreshTmdb([item], KEYS, { fetcher: ok(body(['final girl', 'haunted house', 'ghost'])), now: NOW })
    expect(out.patches.a).not.toHaveProperty('tags')
    expect(out.patches.a!.autoTags).toEqual([]) // slasher is already theirs; haunted was dismissed
  })

  it('replaces old suggestions with fresh ones (and drops them if TMDB no longer lists the title)', async () => {
    const item = make('a', { ext: { tmdb: 10 }, genre: 'Horror', autoTags: ['stale-tag'], tmdbAt: day(400) })
    const out = await refreshTmdb([item], KEYS, { fetcher: ok(body(['zombie'])), now: NOW })
    expect(out.patches.a!.autoTags).toEqual(['zombie'])
    const gone = await refreshTmdb([item], KEYS, { fetcher: vi.fn(async () => new Response('{}', { status: 404 })), now: NOW })
    expect(gone.patches.a!.autoTags).toEqual([])
  })

  it('reads TV keywords, which TMDB nests differently', async () => {
    const tv = { poster_path: '/t.jpg', genres: [{ id: 18, name: 'Drama' }], keywords: { results: [{ name: 'heist' }] } }
    const out = await refreshTmdb([make('a', { category: 'tv', ext: { tmdb: 5 }, genre: 'Drama' })], KEYS, { fetcher: ok(tv), now: NOW })
    expect(out.patches.a!.autoTags).toEqual(['heist'])
  })

  it('removing suggestions leaves your own tags alone and clears them so they can be regenerated', () => {
    const items = [make('a', { tags: ['mine'], autoTags: ['heist'] }), make('b', { autoTags: [] }), make('c')]
    expect(removeSuggestionPatches(items)).toEqual({ a: { autoTags: undefined } })
  })
})
