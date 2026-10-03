import { describe, expect, it } from 'vitest'
import { applyBulk } from './bulk'
import { CATEGORIES } from './catalog'
import { normalizeItem } from './library'

const make = (over: Record<string, unknown>) => normalizeItem({ title: 'T', ...over })!
const formatsFor = (i: { category: keyof typeof CATEGORIES }) => Object.keys(CATEGORIES[i.category].formats)

const items = [
  make({ id: 'a', title: 'Alien', location: 'Binder', genre: 'Sci-Fi', tags: ['classic'] }),
  make({ id: 'b', title: 'Aliens', location: 'Shelf' }),
  make({ id: 'c', title: 'Abbey Road', category: 'music', format: 'vinyl' }),
  make({ id: 'd', title: 'Untouched' }),
]
const ids = (...v: string[]) => new Set(v)

describe('applyBulk', () => {
  it('only touches selected items', () => {
    const r = applyBulk(items, ids('a', 'b'), { genre: 'Horror' }, formatsFor)
    expect(Object.keys(r.patches)).toEqual(['a', 'b'])
    expect(r.patches.a).toEqual({ genre: 'Horror' })
  })

  it('skips items that already have the value, so the count is honest', () => {
    const r = applyBulk(items, ids('a', 'b'), { location: 'Shelf' }, formatsFor)
    expect(r.changed).toBe(1)
    expect(r.patches.b).toBeUndefined()
  })

  it('clears a field with null or an empty string, and trims text', () => {
    expect(applyBulk(items, ids('a'), { location: null }, formatsFor).patches.a).toEqual({ location: undefined })
    expect(applyBulk(items, ids('a'), { genre: '  ' }, formatsFor).patches.a).toEqual({ genre: undefined })
    expect(applyBulk(items, ids('b'), { genre: '  Horror ' }, formatsFor).patches.b).toEqual({ genre: 'Horror' })
  })

  it('sets flags and status', () => {
    const r = applyBulk(items, ids('a'), { finished: true, favorite: true, status: 'wishlist' }, formatsFor)
    expect(r.patches.a).toEqual({ finished: true, favorite: true, status: 'wishlist' })
  })

  it('sets and clears wishlist priority', () => {
    expect(applyBulk(items, ids('a'), { priority: 'high' }, formatsFor).patches.a).toEqual({ priority: 'high' })
    const withPriority = [make({ id: 'p', priority: 'low' })]
    expect(applyBulk(withPriority, ids('p'), { priority: null }, formatsFor).patches.p).toEqual({ priority: undefined })
    expect(applyBulk(withPriority, ids('p'), { priority: 'low' }, formatsFor).changed).toBe(0)
  })

  it('adds and removes tags without replacing the rest', () => {
    const r = applyBulk(items, ids('a', 'b'), { addTags: ['Horror Classic', 'classic'], removeTags: ['nope'] }, formatsFor)
    expect(r.patches.a?.tags).toEqual(['classic', 'horror-classic'])
    expect(r.patches.b?.tags).toEqual(['horror-classic', 'classic'])
    expect(applyBulk(items, ids('a'), { removeTags: ['Classic'] }, formatsFor).patches.a?.tags).toEqual([])
  })

  it('applies a format only where it exists for the type', () => {
    const r = applyBulk(items, ids('a', 'c'), { format: 'bluray' }, formatsFor)
    expect(r.patches.a).toEqual({ format: 'bluray' })
    expect(r.patches.c).toBeUndefined()
    expect(r.formatSkipped).toBe(1)
  })

  it('does nothing with no changes', () => {
    expect(applyBulk(items, ids('a', 'b', 'c'), {}, formatsFor)).toEqual({ patches: {}, changed: 0, formatSkipped: 0 })
  })
})
