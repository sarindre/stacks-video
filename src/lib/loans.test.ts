import { describe, expect, it } from 'vitest'
import { currentLoans, loanLabel, overdueLoans } from './loans'
import { normalizeItem } from './library'

const make = (id: string, over: Record<string, unknown> = {}) => normalizeItem({ id, title: `T${id}`, ...over })!
const NOW = new Date(2025, 5, 30, 12)

const items = [
  make('a', { lentTo: 'Sam', lentAt: '2025-06-25' }), // 5 days
  make('b', { lentTo: 'Jo', lentAt: '2025-04-01' }), // 90 days
  make('c', { lentTo: 'Kim' }), // no date
  make('d', { lentTo: 'Al', lentAt: '2025-05-20' }), // 41 days
  make('e'), // not lent
  make('f', { lentTo: 'Wish', lentAt: '2025-01-01', status: 'wishlist' }), // wishlist items are not loans
]

describe('loans', () => {
  it('lists current loans longest first, undated last', () => {
    expect(currentLoans(items, NOW).map((l) => [l.item.id, l.days])).toEqual([['b', 90], ['d', 41], ['a', 5], ['c', null]])
  })
  it('flags only loans at or past the threshold', () => {
    expect(overdueLoans(items, 30, NOW).map((l) => l.item.id)).toEqual(['b', 'd'])
    expect(overdueLoans(items, 41, NOW).map((l) => l.item.id)).toEqual(['b', 'd'])
    expect(overdueLoans(items, 42, NOW).map((l) => l.item.id)).toEqual(['b'])
  })
  it('never nags about an undated loan, and 0 turns reminders off', () => {
    expect(overdueLoans([make('c', { lentTo: 'Kim' })], 1, NOW)).toEqual([])
    expect(overdueLoans(items, 0, NOW)).toEqual([])
  })
  it('describes durations', () => {
    expect([null, 0, 1, 12, 59, 95].map(loanLabel)).toEqual(['date not recorded', 'today', '1 day', '12 days', '59 days', '3 months'])
  })
})
