import { describe, expect, it, vi } from 'vitest'
import { matchCovers, patchFromMatch, pickBestMatch, searchTerms } from './enrich'
import { normalizeItem } from './library'
import type { LookupResult } from './lookup/types'

const r = (title: string, year?: number, id = 1): LookupResult => ({ title, category: 'movie', year, posterUrl: `http://p/${id}.jpg`, genre: 'Horror', ext: { tmdb: id } })
const KEYS = { tmdb: 'tok', rawg: 'gk' }
const item = (over: Record<string, unknown>) => normalizeItem({ title: 'X', ...over })!

describe('searchTerms', () => {
  it('pulls a trailing year out of the title', () => {
    expect(searchTerms({ title: 'It (2017)' })).toEqual({ query: 'It', year: 2017 })
    expect(searchTerms({ title: 'Alien' })).toEqual({ query: 'Alien', year: undefined })
    expect(searchTerms({ title: 'Scream (1996)', year: 1996 })).toEqual({ query: 'Scream', year: 1996 })
  })
})

describe('pickBestMatch', () => {
  it('takes an exact title, ignoring case, punctuation, "the" and "&"', () => {
    expect(pickBestMatch({ query: 'the hangover' }, [r('Hangover Square', 1945, 1), r('The Hangover', 2009, 2)])?.ext.tmdb).toBe(2)
    expect(pickBestMatch({ query: 'Crime & Punishment' }, [r('Crime and Punishment', 1935, 3)])?.ext.tmdb).toBe(3)
  })
  it('respects a known year, within one', () => {
    const results = [r('The Mummy', 2017, 1), r('The Mummy', 1999, 2)]
    expect(pickBestMatch({ query: 'The Mummy', year: 1999 }, results)?.ext.tmdb).toBe(2)
    expect(pickBestMatch({ query: 'The Mummy', year: 1932 }, results)).toBeNull()
  })
  it('matches "Harry Potter: The Sorcerer\'s Stone" to the catalog title', () => {
    const results = [r("Harry Potter and the Sorcerer's Stone", 2001, 7), r('Harry Potter 20th Anniversary: Return to Hogwarts', 2022, 8)]
    expect(pickBestMatch({ query: "Harry Potter: The Sorcerer's Stone" }, results)?.ext.tmdb).toBe(7)
  })
  it('does not guess from a single word or an unrelated list', () => {
    expect(pickBestMatch({ query: 'Mirrors' }, [r('Magic Mirrors Adventure', 2001)])).toBeNull()
    expect(pickBestMatch({ query: 'Alien' }, [r('Alien: Romulus', 2024)])).toBeNull()
    expect(pickBestMatch({ query: 'Heat' }, [])).toBeNull()
  })
})

describe('patchFromMatch', () => {
  it('only fills gaps', () => {
    const it1 = item({ year: 1990, genre: 'Mine' })
    expect(patchFromMatch(it1, r('X', 2001, 5), '2025-06-01')).toEqual({ posterUrl: 'http://p/5.jpg', ext: { tmdb: 5 }, tmdbAt: '2025-06-01' })
    expect(patchFromMatch({ ...it1, posterUrl: 'http://own', ext: { tmdb: 5 } }, r('X', 2001, 5), '2025-06-01')).toBeNull()
  })
})

describe('matchCovers', () => {
  const search = (calls: string[]) =>
    vi.fn(async (url: string) => {
      calls.push(url)
      const q = new URL(url).searchParams.get('query')
      const results = q === 'Alien' ? [{ id: 348, title: 'Alien', release_date: '1979-05-25', poster_path: '/a.jpg', genre_ids: [27] }] : []
      return new Response(JSON.stringify({ results }))
    })

  it('looks each title up once, fills copies, and lists what it could not match', async () => {
    const calls: string[] = []
    const items = [item({ id: '1', title: 'Alien', format: 'dvd' }), item({ id: '2', title: 'Alien', format: 'digital' }), item({ id: '3', title: 'Nothing Like This' }), item({ id: '4', title: 'Has', posterUrl: 'http://x' }), item({ id: '5', title: 'Abbey Road', category: 'music' })]
    const out = await matchCovers(items, KEYS, { fetcher: search(calls) })
    expect(calls).toHaveLength(2)
    expect(out.matched).toBe(2)
    expect(Object.keys(out.patches).sort()).toEqual(['1', '2'])
    expect(out.patches['1']).toMatchObject({ year: 1979, genre: 'Horror', ext: { tmdb: 348 } })
    expect(out.unmatched).toEqual(['Nothing Like This'])
    expect(out.failed).toBe(false)
  })

  it('stops at the first failure instead of retrying every title', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 401 }))
    const items = Array.from({ length: 20 }, (_, n) => item({ id: String(n), title: `T${n}` }))
    const out = await matchCovers(items, { tmdb: 'bad', rawg: '' }, { fetcher: f, concurrency: 2 })
    expect(out.failed).toBe(true)
    expect(f.mock.calls.length).toBeLessThanOrEqual(2)
  })

  it('matches games through RAWG, and leaves a kind alone when its key is missing', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.includes('rawg.io')) return new Response(JSON.stringify({ results: [{ id: 7, name: 'Hades', released: '2020-09-17', background_image: 'http://g/h.jpg', genres: [{ name: 'Action' }] }] }))
      return new Response(JSON.stringify({ results: [] }))
    })
    const items = [item({ id: 'g', title: 'Hades', category: 'game', format: 'switch' }), item({ id: 'm', title: 'Alien' })]
    const both = await matchCovers(items, KEYS, { fetcher: f })
    expect(both.patches.g).toMatchObject({ posterUrl: 'http://g/h.jpg', year: 2020, genre: 'Action', ext: { rawg: 7 } })
    const gamesOnly = await matchCovers(items, { tmdb: '', rawg: 'gk' }, { fetcher: f })
    expect(Object.keys(gamesOnly.patches)).toEqual(['g'])
    expect(gamesOnly.unmatched).toEqual([])
  })

  it('can be cancelled', async () => {
    const ctl = new AbortController()
    ctl.abort()
    const out = await matchCovers([item({ id: '1', title: 'Alien' })], KEYS, { signal: ctl.signal, fetcher: search([]) })
    expect(out.cancelled).toBe(true)
    expect(out.matched).toBe(0)
  })
})
