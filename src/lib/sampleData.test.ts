import { describe, expect, it } from 'vitest'
import { dayKey } from './dates'
import { binderLocations, buildBinder } from './binder'
import { CATEGORY_ORDER } from './catalog'
import { checkOwned } from './owned'
import { isSample, sampleItems } from './sampleData'
import { validateImport } from './library'

const NOW = new Date(2025, 5, 30, 12)
const items = sampleItems(NOW)

describe('sample collection', () => {
  it('is valid and every entry survives normalising', () => {
    const check = validateImport({ items })
    expect(check.ok && check.dropped).toBe(0)
    expect(items.length).toBeGreaterThan(30)
  })

  it('has unique ids that all mark it as sample data', () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
    expect(items.every(isSample)).toBe(true)
    expect(items.every((i) => i.tags.includes('sample'))).toBe(true)
  })

  it('shows off every kind of media, both lists, and several locations', () => {
    expect(new Set(items.map((i) => i.category))).toEqual(new Set(CATEGORY_ORDER))
    expect(items.some((i) => i.status === 'wishlist')).toBe(true)
    expect(new Set(items.filter((i) => i.status === 'owned').map((i) => i.location)).size).toBeGreaterThan(3)
    expect(items.some((i) => i.series)).toBe(true)
  })

  it('gives the binder view a real binder with a few empty pockets and no clashes', () => {
    expect(binderLocations(items)).toContain('Main binder')
    const b = buildBinder(items, 'Main binder', 8)
    expect(b.pages.length).toBe(3)
    expect(b.empty).toBeGreaterThan(0)
    expect(b.crowded).toBe(0)
    expect(b.unplaced).toEqual([])
  })

  it('has one overdue loan relative to the date it was made', () => {
    const lent = items.filter((i) => i.lentTo)
    expect(lent).toHaveLength(1)
    expect(lent[0]!.lentAt).toBe(dayKey(new Date(2025, 4, 16))) // 45 days before 30 June
  })

  it('has a title in two formats, so the in-stock check has something to say', () => {
    expect(checkOwned(items, 'Nosferatu').exact.map((i) => i.format).sort()).toEqual(['dvd', 'uhd'])
  })

  it('never claims a purchase in the future', () => {
    expect(items.every((i) => !i.purchasedAt || i.purchasedAt <= dayKey(NOW))).toBe(true)
  })
})
