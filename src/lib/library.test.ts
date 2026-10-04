import { describe, expect, it } from 'vitest'
import { findSameTitle, itemKey, mergeLibraries, normalizeItem, validateImport } from './library'
import type { Item } from './types'

const make = (over: Record<string, unknown>): Item => normalizeItem({ title: 'Alien', ...over })!

describe('normalizeItem', () => {
  it('rejects things without a title', () => {
    expect(normalizeItem(null)).toBeNull()
    expect(normalizeItem({ title: '   ' })).toBeNull()
    expect(normalizeItem({ id: 'x' })).toBeNull()
  })

  it('fills defaults and generates an id', () => {
    const i = normalizeItem({ title: ' Alien ' })!
    expect(i).toMatchObject({ title: 'Alien', category: 'movie', format: 'dvd', status: 'owned', finished: false, rating: 0, tags: [] })
    expect(i.id).toBeTruthy()
  })

  it('understands format spellings per category', () => {
    expect(make({ format: 'Blu-ray' }).format).toBe('bluray')
    expect(make({ format: '4K' }).format).toBe('uhd')
    expect(make({ category: 'music', format: 'LP' }).format).toBe('vinyl')
    expect(make({ category: 'music' }).format).toBe('vinyl')
    expect(make({ category: 'game', format: 'PlayStation 5' }).format).toBe('ps5')
  })

  it('drops bad values instead of keeping them', () => {
    const i = make({ year: 'soon', rating: 99, price: -4, purchasedAt: '2024-02-31', condition: 'mint', category: 'vhs-tape' })
    expect(i.year).toBeUndefined()
    expect(i.rating).toBe(5)
    expect(i.price).toBeUndefined()
    expect(i.purchasedAt).toBeUndefined()
    expect(i.condition).toBeUndefined()
    expect(i.category).toBe('movie')
  })

  it('keeps numeric series numbers as text', () => {
    expect(make({ seriesNum: 4 }).seriesNum).toBe('4')
    expect(make({ seriesNum: '4A' }).seriesNum).toBe('4A')
  })

  it('cleans tags', () => {
    expect(make({ tags: ['Space Horror', 'space-horror', ' ', 'Classic'] }).tags).toEqual(['space-horror', 'classic'])
    expect(make({ tags: 'a, b;c' }).tags).toEqual(['a', 'b', 'c'])
  })
})

describe('suggested tags in stored items', () => {
  it('keeps suggestions apart from tags, distinguishing "none found" from "never suggested"', () => {
    expect(make({ autoTags: ['Heist', 'spy'], removedTags: ['x'] }).autoTags).toEqual(['heist', 'spy'])
    expect(make({ autoTags: [] }).autoTags).toEqual([])
    expect(make({}).autoTags).toBeUndefined()
    expect(make({}).removedTags).toBeUndefined()
  })
  it('combines suggestions and dismissals when importing, and a dismissal wins', () => {
    const have = [make({ id: 'a', autoTags: ['heist', 'spy'], tags: ['mine'] })]
    const plan = mergeLibraries(have, [make({ id: 'a', autoTags: ['heist', 'zombie'], removedTags: ['spy'] })])
    const merged = plan.merged[0]!
    expect(merged.tags).toEqual(['mine'])
    expect(merged.autoTags).toEqual(['heist', 'zombie'])
    expect(merged.removedTags).toEqual(['spy'])
    expect(plan.updated).toBe(1)
  })
})

describe('mergeLibraries', () => {
  it('adds new items and never deletes', () => {
    const have = [make({ id: 'a' })]
    const plan = mergeLibraries(have, [make({ id: 'b', title: 'Aliens' })])
    expect(plan.merged.map((i) => i.id)).toEqual(['a', 'b'])
    expect(plan).toMatchObject({ added: 1, updated: 0, skipped: 0 })
  })

  it('fills gaps but keeps what you wrote', () => {
    const have = [make({ id: 'a', notes: 'mine', rating: 4, tags: ['x'] })]
    const plan = mergeLibraries(have, [make({ id: 'a', notes: 'theirs', rating: 1, genre: 'Sci-Fi', tags: ['y'] })])
    const merged = plan.merged[0]!
    expect(merged.notes).toBe('mine')
    expect(merged.rating).toBe(4)
    expect(merged.genre).toBe('Sci-Fi')
    expect(merged.tags).toEqual(['x', 'y'])
    expect(plan.updated).toBe(1)
  })

  it('treats an unchanged re-import as nothing to do', () => {
    const have = [make({ id: 'a', genre: 'Sci-Fi' })]
    const plan = mergeLibraries(have, [make({ id: 'a', genre: 'Sci-Fi' })])
    expect(plan).toMatchObject({ added: 0, updated: 0, skipped: 1 })
  })

  it('does not duplicate id-less repeats, but adds a genuine second copy', () => {
    const have = [make({ id: 'a' })]
    // A CSV exported elsewhere: same product twice. One is already owned, so only one is new.
    const plan = mergeLibraries(have, [make({ id: 'n1' }), make({ id: 'n2' })])
    expect(plan.added).toBe(1)
    expect(plan.skipped).toBe(1)
  })

  it('does not collapse the same title in different formats', () => {
    const plan = mergeLibraries([make({ id: 'a', format: 'dvd' })], [make({ id: 'b', format: 'bluray' })])
    expect(plan.added).toBe(1)
  })
})

describe('validateImport', () => {
  it('accepts our file and a bare array', () => {
    expect(validateImport({ app: 'shelfkeeper', version: 1, items: [{ title: 'A' }] })).toMatchObject({ ok: true })
    expect(validateImport([{ title: 'A' }, { nope: 1 }])).toMatchObject({ ok: true, dropped: 1 })
  })
  it('rejects junk and files from the future', () => {
    expect(validateImport({ hello: 1 }).ok).toBe(false)
    expect(validateImport({ version: 99, items: [{ title: 'A' }] }).ok).toBe(false)
    expect(validateImport([{ nope: 1 }]).ok).toBe(false)
  })
})

describe('duplicates', () => {
  it('ignores case, punctuation and accents', () => {
    expect(itemKey(make({ title: 'Amélie!' }))).toBe(itemKey(make({ title: 'amelie' })))
  })
  it('finds the same title in any format', () => {
    const items = [make({ id: 'a', format: 'dvd' }), make({ id: 'b', format: 'bluray' }), make({ id: 'c', title: 'Aliens' })]
    expect(findSameTitle(items, { category: 'movie', title: 'alien', year: undefined }).map((i) => i.id)).toEqual(['a', 'b'])
    expect(findSameTitle(items, { category: 'movie', title: 'alien' }, 'a').map((i) => i.id)).toEqual(['b'])
  })
})
