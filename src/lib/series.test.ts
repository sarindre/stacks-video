import { describe, expect, it, vi } from 'vitest'
import { parseCollection, parseCollectionSearch, parseMovieCollection, type CollectionPart } from './lookup/tmdb'
import { normalizeItem } from './library'
import { compareSeries, contentKey, countMissing, matchesPart, pickCollection, resolveSeries, seriesGroups, titleMatches, usualFormat, wishlistItemFor } from './series'
import type { Item } from './types'

const make = (id: string, title: string, over: Record<string, unknown> = {}): Item => normalizeItem({ id, title, ...over })!
const part = (tmdb: number, title: string, releaseDate: string, over: Partial<CollectionPart> = {}): CollectionPart => ({ tmdb, title, releaseDate, year: releaseDate ? Number(releaseDate.slice(0, 4)) : undefined, ...over })

describe('titleMatches', () => {
  it('ignores case, punctuation, little words and edition labels', () => {
    expect(titleMatches('The Avengers', 'Avengers')).toBe(true)
    expect(titleMatches('Aliens Special Edition', 'Aliens')).toBe(true)
    expect(titleMatches('The Hobbit DVD', 'The Hobbit')).toBe(true)
    expect(titleMatches("Harry Potter: The Sorcerer's Stone", "Harry Potter and the Sorcerer's Stone")).toBe(true)
    expect(titleMatches('Harry Potter: Deathly Hallows Pt 1', 'Harry Potter and the Deathly Hallows: Part 1')).toBe(true)
    expect(titleMatches('It (2017)', 'It')).toBe(true)
  })
  it('never mistakes a sequel for the original', () => {
    expect(titleMatches('Alien Resurrection', 'Alien')).toBe(false)
    expect(titleMatches('Aliens', 'Alien')).toBe(false)
    expect(titleMatches('Alien 3', 'Alien')).toBe(false)
    expect(titleMatches('Iron Man 2', 'Iron Man')).toBe(false)
    expect(titleMatches('', '')).toBe(false)
  })
  it('keeps the words that matter', () => {
    expect(contentKey("Director's Cut of The Fifth Element")).toBe('element fifth')
  })
})

describe('matchesPart', () => {
  const alien = part(348, 'Alien', '1979-05-25')
  it('uses the TMDB id when the item has one, even if the title differs', () => {
    expect(matchesPart(make('a', 'Something else', { ext: { tmdb: 348 } }), alien)).toBe(true)
    expect(matchesPart(make('a', 'Alien', { ext: { tmdb: 999 } }), alien)).toBe(false)
  })
  it('falls back to the title, and checks the year when both are known', () => {
    expect(matchesPart(make('a', 'Alien'), alien)).toBe(true)
    expect(matchesPart(make('a', 'Alien', { year: 1979 }), alien)).toBe(true)
    expect(matchesPart(make('a', 'Alien', { year: 2002 }), alien)).toBe(false)
  })
  it('only films count', () => {
    expect(matchesPart(make('a', 'Alien', { category: 'book' }), alien)).toBe(false)
  })
})

describe('seriesGroups', () => {
  it('lists series of owned films only, alphabetically', () => {
    const items = [make('1', 'B1', { series: 'Zed' }), make('2', 'B2', { series: 'Alien' }), make('3', 'B3', { series: 'Alien' }), make('4', 'W', { series: 'Wish', status: 'wishlist' }), make('5', 'Bk', { series: 'Book', category: 'book' }), make('6', 'None')]
    expect(seriesGroups(items).map((g) => `${g.name}:${g.items.length}`)).toEqual(['Alien:2', 'Zed:1'])
  })
})

describe('pickCollection', () => {
  const c = (id: number, name: string) => ({ id, name })
  it('prefers an exact name once generic words are dropped', () => {
    const list = [c(1, 'Alien vs. Predator Collection'), c(2, 'Alien Collection'), c(3, 'Alien Nation Collection')]
    expect(pickCollection('Alien', list)).toEqual(c(2, 'Alien Collection'))
    expect(pickCollection('Lord of the Rings', [c(9, 'The Lord of the Rings Collection')])).toEqual(c(9, 'The Lord of the Rings Collection'))
  })
  it('accepts a single collection containing all the words, never a guess among several', () => {
    expect(pickCollection('Spider-Man', [c(1, 'Spider-Man (Raimi) Collection')])).toEqual(c(1, 'Spider-Man (Raimi) Collection'))
    expect(pickCollection('Spider-Man', [c(1, 'Spider-Man Raimi Collection'), c(2, 'Spider-Man Homecoming Collection')])).toBeNull()
    expect(pickCollection('MCU', [c(1, 'Marvel Cinematic Universe Collection')])).toBeNull()
    expect(pickCollection('', [c(1, 'X')])).toBeNull()
  })
})

describe('compareSeries', () => {
  const parts = [part(1, 'Alien', '1979-05-25'), part(2, 'Aliens', '1986-07-18'), part(3, 'Alien 3', '1992-05-22'), part(4, 'Alien: Future', '2999-01-01'), part(5, 'Alien: TBA', '')]
  const lib = [make('a', 'Alien', { format: 'dvd' }), make('b', 'Aliens Special Edition'), make('c', 'Alien 3', { status: 'wishlist' })]

  it('marks each entry owned, wishlisted, missing or upcoming', () => {
    const e = compareSeries(parts, lib, new Set(), '2025-06-01')
    expect(e.map((x) => x.state)).toEqual(['owned', 'owned', 'wishlist', 'upcoming', 'upcoming'])
    expect(e[1]!.copies.map((c) => c.id)).toEqual(['b'])
    expect(e.map((x) => x.number)).toEqual([1, 2, 3, 4, 5])
  })
  it('counts only released, unowned, unwished entries as missing', () => {
    const e = compareSeries(parts, [lib[0]!], new Set(), '2025-06-01')
    expect(countMissing(e)).toBe(2)
  })
  it('does not call a film you own missing just because it is filed outside the series', () => {
    const e = compareSeries(parts, [make('z', 'Aliens', { series: undefined })], new Set(), '2025-06-01')
    expect(e[1]!.state).toBe('owned')
  })
  it('lets the person hide an entry', () => {
    const e = compareSeries(parts, [lib[0]!], new Set([2]), '2025-06-01')
    expect(countMissing(e)).toBe(1)
    expect(e[1]!.state).toBe('hidden')
  })
})

describe('parsing TMDB collections', () => {
  it('parses a collection and sorts by release, undated last', () => {
    const c = parseCollection({ id: 8091, name: 'Alien Collection', parts: [{ id: 3, title: 'Alien 3', release_date: '1992-05-22' }, { id: 9, title: 'Soon', release_date: '' }, { id: 1, title: 'Alien', release_date: '1979-05-25', poster_path: '/a.jpg', genre_ids: [27] }, { title: 'broken' }] })
    expect(c!.parts.map((p) => p.title)).toEqual(['Alien', 'Alien 3', 'Soon'])
    expect(c!.parts[0]).toMatchObject({ tmdb: 1, year: 1979, genre: 'Horror', posterUrl: 'https://image.tmdb.org/t/p/w342/a.jpg' })
    expect(parseCollection({ nope: 1 })).toBeNull()
  })
  it('parses searches and a film\'s collection link', () => {
    expect(parseCollectionSearch({ results: [{ id: 1, name: 'A' }, { id: 2 }] })).toEqual([{ id: 1, name: 'A' }])
    expect(parseMovieCollection({ belongs_to_collection: { id: 5, name: 'X' } })).toEqual({ id: 5, name: 'X' })
    expect(parseMovieCollection({ belongs_to_collection: null })).toBeNull()
  })
})

describe('resolveSeries', () => {
  const collection = { id: 8091, name: 'Alien Collection', parts: [{ id: 348, title: 'Alien', release_date: '1979-05-25' }, { id: 679, title: 'Aliens', release_date: '1986-07-18' }] }
  const router = (calls: string[], overrides: Record<string, unknown> = {}) =>
    vi.fn(async (url: string) => {
      calls.push(url)
      const table: Record<string, unknown> = {
        '/search/collection': { results: [{ id: 1, name: 'Alien vs. Predator Collection' }, { id: 8091, name: 'Alien Collection' }] },
        '/collection/8091': collection,
        '/movie/348': { belongs_to_collection: { id: 8091, name: 'Alien Collection' } },
        ...overrides,
      }
      const key = Object.keys(table).find((k) => url.includes(k))
      return new Response(JSON.stringify(key ? table[key] : {}))
    })

  it('finds the collection by name and confirms it holds something you own', async () => {
    const calls: string[] = []
    const r = await resolveSeries('tok', { name: 'Alien', items: [make('a', 'Alien')] }, router(calls))
    expect(r.ok && r.collection.id).toBe(8091)
    expect(calls.some((c) => c.includes('/search/collection'))).toBe(true)
  })

  it('prefers the link from a film with a known TMDB id, with no name search', async () => {
    const calls: string[] = []
    const r = await resolveSeries('tok', { name: 'Totally Different Name', items: [make('a', 'Alien', { ext: { tmdb: 348 } })] }, router(calls))
    expect(r.ok).toBe(true)
    expect(calls.some((c) => c.includes('/search/collection'))).toBe(false)
  })

  it('refuses a collection that contains nothing you own', async () => {
    const r = await resolveSeries('tok', { name: 'Alien', items: [make('x', 'Predator')] }, router([]))
    expect(r).toEqual({ ok: false, reason: 'unverified' })
  })

  it('reports no collection when none fits the name', async () => {
    const r = await resolveSeries('tok', { name: 'MCU', items: [make('x', 'Iron Man')] }, router([]))
    expect(r).toEqual({ ok: false, reason: 'none' })
  })

  it('needs a token', async () => {
    await expect(resolveSeries('', { name: 'Alien', items: [make('a', 'Alien')] }, router([]))).rejects.toMatchObject({ kind: 'needs-token' })
  })
})

describe('wishlist helpers', () => {
  it('suggests the format you mostly own, ignoring digital copies', () => {
    const g = { name: 'Alien', items: [make('1', 'A', { format: 'digital' }), make('2', 'B', { format: 'digital' }), make('3', 'C', { format: 'dvd' }), make('4', 'D', { format: 'dvd' }), make('5', 'E', { format: 'bluray' })] }
    expect(usualFormat(g)).toBe('dvd')
    expect(usualFormat({ name: 'x', items: [make('1', 'A', { format: 'digital' })] })).toBe('bluray')
  })
  it('builds a wishlist item carrying the TMDB id and place in the series', () => {
    const entry = compareSeries([part(7, 'Alien: Covenant', '2017-05-19', { genre: 'Horror', posterUrl: 'http://p' })], [], new Set(), '2025-01-01')[0]!
    const item = wishlistItemFor(entry, 'Alien', 'dvd', { id: 'w1', addedAt: 'x', updatedAt: 'x' })
    expect(item).toMatchObject({ title: 'Alien: Covenant', status: 'wishlist', series: 'Alien', seriesNum: '1', year: 2017, format: 'dvd', ext: { tmdb: 7 } })
    expect(normalizeItem(item)).not.toBeNull()
  })
})
