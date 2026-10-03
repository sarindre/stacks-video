import { describe, expect, it } from 'vitest'
import { normalizeItem } from './library'
import { computeStats } from './stats'

const make = (over: Record<string, unknown>) => normalizeItem({ title: 'T', ...over })!

describe('computeStats', () => {
  const now = new Date(2025, 5, 15)
  const items = [
    make({ id: '1', title: 'Alien', format: 'bluray', genre: 'Sci-Fi', price: 10, finished: true, addedAt: '2025-06-02T12:00:00' }),
    make({ id: '2', title: 'Alien', format: 'dvd', genre: 'Sci-Fi', price: 5.5, addedAt: '2025-05-20T12:00:00' }),
    make({ id: '5', title: 'Alien', format: 'dvd', edition: 'Special features disc', addedAt: '2025-05-21T12:00:00' }),
    make({ id: '6', title: 'alien', format: 'dvd', addedAt: '2025-05-22T12:00:00' }),
    make({ id: '3', title: 'Abbey Road', category: 'music', format: 'vinyl', location: 'Den', lentTo: 'Sam', lentAt: '2025-05-01', addedAt: '2024-01-01T12:00:00' }),
    make({ id: '4', title: 'Dune', status: 'wishlist', price: 99 }),
  ]
  const s = computeStats(items, now)

  it('counts owned apart from wishlist, and sums only owned prices', () => {
    expect(s.owned).toBe(5)
    expect(s.wishlist).toBe(1)
    expect(s.totalValue).toBe(15.5)
    expect(s.pricedCount).toBe(2)
    expect(s.finished).toBe(1)
  })
  it('breaks down by type, format, genre and place', () => {
    expect(s.byCategory).toEqual([{ category: 'movie', count: 4 }, { category: 'music', count: 1 }])
    expect(s.byFormat.map((f) => f.label).sort()).toEqual(['Blu-ray', 'DVD', 'Vinyl'])
    expect(s.byGenre).toEqual([{ label: 'Sci-Fi', count: 2 }])
    expect(s.byLocation).toEqual([{ label: 'Den', count: 1 }])
  })
  it('buckets additions into the last 12 months, oldest first', () => {
    expect(s.addedByMonth).toHaveLength(12)
    expect(s.addedByMonth.at(-1)).toMatchObject({ key: '2025-06', count: 1 })
    expect(s.addedByMonth.at(-2)).toMatchObject({ key: '2025-05', count: 3 })
    expect(s.addedByMonth[0]!.key).toBe('2024-07')
  })
  it('adds up worth today, the change against what was paid, and the wishlist target', () => {
    const v = computeStats(
      [
        make({ id: 'a', price: 10, currentValue: 25 }),
        make({ id: 'b', price: 20, currentValue: 15 }),
        make({ id: 'c', currentValue: 100 }),
        make({ id: 'd', price: 8 }),
        make({ id: 'w1', status: 'wishlist', targetPrice: 12, currentValue: 999 }),
        make({ id: 'w2', status: 'wishlist', targetPrice: 8 }),
      ],
      now,
    )
    expect(v).toMatchObject({ estValue: 140, valuedCount: 3, valueChange: 10, changeCount: 2, wishlistTarget: 20, wishlistTargetCount: 2 })
    expect(v.mostValuable.map((i) => i.id)).toEqual(['c', 'a', 'b'])
  })
  it('finds lent items and double copies', () => {
    expect(s.lent.map((i) => i.id)).toEqual(['3'])
    // Alien on Blu-ray, two plain DVDs and a special-features disc: only the two DVDs are duplicates.
    expect(s.duplicates).toEqual([{ label: 'Alien', count: 2 }])
  })
})
