import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, filterItems, seriesOrder, sortAndGroup } from './filters'
import { normalizeItem } from './library'
import type { Item } from './types'

const make = (over: Record<string, unknown>): Item => normalizeItem({ id: String(over.title), ...over })!

const lib = [
  make({ title: 'The Matrix', year: 1999, location: 'Binder', position: 'Page 10 · A', genre: 'Sci-Fi' }),
  make({ title: 'Alien', series: 'Alien', seriesNum: '1', location: 'Binder', position: 'Page 2 · C', genre: 'Sci-Fi', finished: true }),
  make({ title: 'Alien Resurrection', series: 'Alien', seriesNum: '4' }),
  make({ title: 'Aliens', series: 'Alien', seriesNum: '2', favorite: true }),
  make({ title: 'Breaking Dawn Part 2', series: 'Twilight', seriesNum: '4B' }),
  make({ title: 'Breaking Dawn Part 1', series: 'Twilight', seriesNum: '4A' }),
  make({ title: 'Abbey Road', category: 'music', format: 'vinyl', creator: 'The Beatles' }),
  make({ title: 'Dune', status: 'wishlist' }),
]

const titles = (items: Item[]) => items.map((i) => i.title)

describe('filterItems', () => {
  it('separates owned from wishlist', () => {
    expect(titles(filterItems(lib, 'wishlist', DEFAULT_FILTERS))).toEqual(['Dune'])
    expect(filterItems(lib, 'owned', DEFAULT_FILTERS)).toHaveLength(7)
  })
  it('searches every word across fields, ignoring case and accents', () => {
    expect(titles(filterItems(lib, 'owned', { ...DEFAULT_FILTERS, q: 'beatles vinyl' }))).toEqual(['Abbey Road'])
    expect(titles(filterItems(lib, 'owned', { ...DEFAULT_FILTERS, q: 'page 2' }))).toEqual(['Alien'])
  })
  it('combines type, flag and genre filters', () => {
    expect(titles(filterItems(lib, 'owned', { ...DEFAULT_FILTERS, flag: 'favorite' }))).toEqual(['Aliens'])
    expect(titles(filterItems(lib, 'owned', { ...DEFAULT_FILTERS, flag: 'finished', genre: 'Sci-Fi' }))).toEqual(['Alien'])
    expect(titles(filterItems(lib, 'owned', { ...DEFAULT_FILTERS, category: 'music' }))).toEqual(['Abbey Road'])
  })
})

describe('sorting', () => {
  it('sorts titles without leading articles', () => {
    const [g] = sortAndGroup(filterItems(lib, 'owned', DEFAULT_FILTERS), 'title', 'none')
    expect(titles(g!.items).slice(0, 3)).toEqual(['Abbey Road', 'Alien', 'Alien Resurrection'])
    expect(titles(g!.items)).toContain('The Matrix')
    expect(titles(g!.items).indexOf('The Matrix')).toBeGreaterThan(titles(g!.items).indexOf('Breaking Dawn Part 2'))
  })
  it('orders locations naturally so page 2 precedes page 10', () => {
    const [g] = sortAndGroup(filterItems(lib, 'owned', DEFAULT_FILTERS), 'location', 'none')
    expect(titles(g!.items).slice(0, 2)).toEqual(['Alien', 'The Matrix'])
  })
})

describe('tags (yours and suggested)', () => {
  const tagged = [
    make({ title: 'Mine', tags: ['heist'] }),
    make({ title: 'Suggested', autoTags: ['heist', 'spy'] }),
    make({ title: 'Neither' }),
  ]
  it('finds both kinds by search', () => {
    expect(titles(filterItems(tagged, 'owned', { ...DEFAULT_FILTERS, q: 'heist' })).sort()).toEqual(['Mine', 'Suggested'])
    expect(titles(filterItems(tagged, 'owned', { ...DEFAULT_FILTERS, q: 'spy' }))).toEqual(['Suggested'])
  })
  it('filters by a tag of either kind', () => {
    expect(titles(filterItems(tagged, 'owned', { ...DEFAULT_FILTERS, tag: 'heist' })).sort()).toEqual(['Mine', 'Suggested'])
    expect(titles(filterItems(tagged, 'owned', { ...DEFAULT_FILTERS, tag: 'nope' }))).toEqual([])
  })
})

describe('wishlist and value sorting', () => {
  const wish = [
    make({ title: 'Low', status: 'wishlist', priority: 'low' }),
    make({ title: 'None', status: 'wishlist' }),
    make({ title: 'High cheap', status: 'wishlist', priority: 'high', targetPrice: 5 }),
    make({ title: 'High dear', status: 'wishlist', priority: 'high', targetPrice: 30 }),
    make({ title: 'High open', status: 'wishlist', priority: 'high' }),
    make({ title: 'Medium', status: 'wishlist', priority: 'medium' }),
  ]
  it('sorts the wishlist by priority, then the lowest target price', () => {
    const [g] = sortAndGroup(filterItems(wish, 'wishlist', DEFAULT_FILTERS), 'priority', 'none')
    expect(titles(g!.items)).toEqual(['High cheap', 'High dear', 'High open', 'Medium', 'Low', 'None'])
  })
  it('sorts by what things are worth, unvalued last', () => {
    const owned = [make({ title: 'A', currentValue: 5 }), make({ title: 'B' }), make({ title: 'C', currentValue: 50 })]
    const [g] = sortAndGroup(filterItems(owned, 'owned', DEFAULT_FILTERS), 'value', 'none')
    expect(titles(g!.items)).toEqual(['C', 'A', 'B'])
  })
})

describe('series grouping', () => {
  it('orders entries by number, 4A before 4B, and puts standalone last', () => {
    const groups = sortAndGroup(filterItems(lib, 'owned', DEFAULT_FILTERS), 'title', 'series')
    expect(groups.map((g) => g.label)).toEqual(['Alien', 'Twilight', 'Standalone'])
    expect(titles(groups[0]!.items)).toEqual(['Alien', 'Aliens', 'Alien Resurrection'])
    expect(titles(groups[1]!.items)).toEqual(['Breaking Dawn Part 1', 'Breaking Dawn Part 2'])
  })
  it('reads the number out of messy entries', () => {
    expect(seriesOrder('4A')).toBe(4)
    expect(seriesOrder('3.5')).toBe(3.5)
    expect(seriesOrder('Prequel')).toBeNull()
    expect(seriesOrder(undefined)).toBeNull()
  })
})
