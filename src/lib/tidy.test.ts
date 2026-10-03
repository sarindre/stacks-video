import { describe, expect, it } from 'vitest'
import { listValues, removeValue, renameValue, wouldMerge } from './tidy'
import { normalizeItem } from './library'
import type { Item } from './types'

const make = (id: string, over: Record<string, unknown> = {}): Item => normalizeItem({ id, title: `T${id}`, ...over })!
const items = [
  make('1', { genre: 'Sci-Fi', location: 'Main binder', tags: ['classic', 'space'], series: 'Alien' }),
  make('2', { genre: 'Sci-Fi', location: 'Main binder' }),
  make('3', { genre: 'Sci Fi', location: 'Shelf' }),
  make('4', { genre: 'SciFi', tags: ['Classic'] }),
  make('5', { genre: 'Horror', tags: ['space'] }),
  make('6'),
]

describe('listValues', () => {
  it('counts each value, most used first, flagging spellings of the same thing', () => {
    const rows = listValues(items, 'genre')
    expect(rows.map((r) => `${r.value}:${r.count}`)).toEqual(['Sci-Fi:2', 'Horror:1', 'Sci Fi:1', 'SciFi:1'])
    expect(rows.find((r) => r.value === 'Sci-Fi')!.similar.sort()).toEqual(['Sci Fi', 'SciFi'])
    expect(rows.find((r) => r.value === 'Horror')!.similar).toEqual([])
  })
  it('works for locations, series and tags', () => {
    expect(listValues(items, 'location').map((r) => r.value)).toEqual(['Main binder', 'Shelf'])
    expect(listValues(items, 'series')).toEqual([{ value: 'Alien', count: 1, similar: [] }])
    expect(listValues(items, 'tags').map((r) => `${r.value}:${r.count}`)).toEqual(['classic:2', 'space:2'])
  })
})

describe('renameValue', () => {
  it('renames on every item that has it and leaves the rest alone', () => {
    const r = renameValue(items, 'location', 'Main binder', 'Big binder')
    expect(Object.keys(r.patches).sort()).toEqual(['1', '2'])
    expect(r.patches['1']).toEqual({ location: 'Big binder' })
    expect(r.changed).toBe(2)
  })
  it('merges when the new name already exists', () => {
    expect(wouldMerge(items, 'genre', 'Sci Fi', 'Sci-Fi')).toBe(true)
    expect(wouldMerge(items, 'genre', 'Sci Fi', 'Space Opera')).toBe(false)
    expect(wouldMerge(items, 'genre', 'Sci Fi', 'Sci Fi')).toBe(false)
    const r = renameValue(items, 'genre', 'Sci Fi', 'Sci-Fi')
    expect(r.patches['3']).toEqual({ genre: 'Sci-Fi' })
  })
  it('renames a tag without duplicating it on items that already have the target', () => {
    const two = [make('a', { tags: ['old', 'new', 'x'] }), make('b', { tags: ['old'] })]
    const r = renameValue(two, 'tags', 'old', 'New')
    expect(r.patches.a).toEqual({ tags: ['new', 'x'] })
    expect(r.patches.b).toEqual({ tags: ['new'] })
  })
})

describe('removeValue', () => {
  it('clears a text field', () => {
    const r = removeValue(items, 'genre', 'Horror')
    expect(r.patches['5']).toEqual({ genre: undefined })
    expect(r.changed).toBe(1)
  })
  it('removes a tag from every item', () => {
    const r = removeValue(items, 'tags', 'space')
    expect(r.patches['1']).toEqual({ tags: ['classic'] })
    expect(r.patches['5']).toEqual({ tags: [] })
  })
})
