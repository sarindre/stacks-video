import { describe, expect, it } from 'vitest'
import { binderLocations, buildBinder, formatPosition, nextFreeSlot, pageColumns, parsePosition, slotsNeeded } from './binder'
import { normalizeItem } from './library'

const at = (title: string, position: string | undefined, over: Record<string, unknown> = {}) =>
  normalizeItem({ id: `${title}-${position}`, title, location: 'Main binder', position, ...over })!

describe('parsePosition', () => {
  it('reads the formats people type', () => {
    expect(parsePosition('Page 12 · C')).toEqual({ page: 12, slot: 2 })
    expect(parsePosition('page 3 - a')).toEqual({ page: 3, slot: 0 })
    expect(parsePosition('Pg. 7, H')).toEqual({ page: 7, slot: 7 })
    expect(parsePosition('p4 b')).toEqual({ page: 4, slot: 1 })
    expect(parsePosition('Page 9')).toEqual({ page: 9, slot: null })
  })
  it('rejects things that are not pages', () => {
    for (const bad of ['Shelf 3', '', undefined, 'Page 0 · A', 'Page x', 'Page 3 · AB']) expect(parsePosition(bad), String(bad)).toBeNull()
  })
  it('round trips', () => {
    expect(parsePosition(formatPosition(21, 3))).toEqual({ page: 21, slot: 3 })
  })
})

describe('buildBinder', () => {
  const items = [at('A', 'Page 1 · A'), at('B', 'Page 1 · B'), at('G', 'Page 3 · C'), at('Loose', 'Shelf 2'), at('Pageonly', 'Page 2'), at('Elsewhere', 'Page 1 · D', { location: 'Other' }), at('Wish', 'Page 1 · E', { status: 'wishlist' })]

  it('lays items out by page and slot, with gaps visible', () => {
    const b = buildBinder(items, 'Main binder', 4)
    expect(b.pages.map((p) => p.page)).toEqual([1, 2, 3])
    expect(b.pages[0]!.slots.map((s) => s.items[0]?.title ?? null)).toEqual(['A', 'B', null, null])
    expect(b.pages[1]!.slots.every((s) => s.items.length === 0)).toBe(true)
    expect(b.placed).toBe(3)
    expect(b.empty).toBe(9)
  })

  it('keeps other locations, the wishlist and non-grid positions out of the grid', () => {
    const b = buildBinder(items, 'Main binder', 4)
    expect(b.unplaced.map((i) => i.title).sort()).toEqual(['Loose', 'Pageonly'])
  })

  it('widens the page rather than dropping a pocket that does not fit', () => {
    const b = buildBinder([at('Far', 'Page 1 · J')], 'Main binder', 4)
    expect(b.slotsPerPage).toBe(10)
    expect(slotsNeeded([at('Far', 'Page 1 · J')], 'Main binder')).toBe(10)
  })

  it('flags a pocket holding two items', () => {
    const b = buildBinder([at('One', 'Page 1 · A'), at('Two', 'Page 1 · A')], 'Main binder', 4)
    expect(b.crowded).toBe(1)
    expect(b.pages[0]!.slots[0]!.items).toHaveLength(2)
  })
})

describe('nextFreeSlot', () => {
  it('finds the first gap, in page order', () => {
    const b = buildBinder([at('A', 'Page 1 · A'), at('B', 'Page 1 · B'), at('C', 'Page 1 · C'), at('D', 'Page 1 · D'), at('E', 'Page 2 · A'), at('F', 'Page 2 · C')], 'Main binder', 4)
    expect(nextFreeSlot(b)).toEqual({ page: 2, slot: 1 })
  })
  it('starts a new page when every pocket is full, and page 1 for an empty binder', () => {
    const full = buildBinder(['A', 'B'].map((s) => at(s, `Page 1 · ${s}`)), 'Main binder', 2)
    expect(nextFreeSlot(full)).toEqual({ page: 2, slot: 0 })
    expect(nextFreeSlot(buildBinder([], 'Nowhere', 8))).toEqual({ page: 1, slot: 0 })
  })
})

describe('binder helpers', () => {
  it('lists only locations that have page-and-slot positions, biggest first', () => {
    const items = [at('A', 'Page 1 · A'), at('B', 'Page 1 · B'), at('C', 'Page 1 · A', { location: 'Small binder' }), at('D', 'Shelf 1', { location: 'Shelf' }), at('E', 'Page 1 · A', { location: 'Wish', status: 'wishlist' })]
    expect(binderLocations(items)).toEqual(['Main binder', 'Small binder'])
  })
  it('lays pages out like real binder pages', () => {
    expect([4, 6, 8, 9, 12].map(pageColumns)).toEqual([2, 2, 2, 3, 3])
  })
})
