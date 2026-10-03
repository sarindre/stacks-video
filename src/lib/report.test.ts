import { describe, expect, it } from 'vitest'
import { normalizeItem } from './library'
import { buildReport, DEFAULT_COLUMNS, type ReportOptions } from './report'

const make = (id: string, title: string, over: Record<string, unknown> = {}) => normalizeItem({ id, title, ...over })!
const NOW = new Date(2025, 5, 15)

const items = [
  make('1', 'The Matrix', { year: 1999, format: 'bluray', location: 'Main binder', position: 'Page 10 · A', price: 10, currentValue: 25, condition: 'good' }),
  make('2', 'Alien', { year: 1979, format: 'dvd', location: 'Main binder', position: 'Page 2 · C', price: 5.5, edition: "Director's cut" }),
  make('3', 'Abbey Road', { category: 'music', format: 'vinyl', location: 'Den', currentValue: 40, notes: 'first\npressing' }),
  make('4', 'Dune', { status: 'wishlist', targetPrice: 12, format: 'uhd' }),
  make('5', 'Loose', { year: 2001 }),
]
const base: ReportOptions = { status: 'owned', group: 'none', columns: DEFAULT_COLUMNS.owned, title: '' }

describe('buildReport', () => {
  it('lists only the chosen list, with the columns asked for, in order', () => {
    const r = buildReport(items, base, NOW)
    expect(r.headers).toEqual(['Title', 'Year', 'Format', 'Location'])
    expect(r.sections).toHaveLength(1)
    expect(r.sections[0]!.rows.map((x) => x[0])).toEqual(['Abbey Road', "Alien (Director's cut)", 'Loose', 'The Matrix'])
    expect(r.title).toBe('My collection')
  })

  it('formats each cell', () => {
    const r = buildReport(items, { ...base, columns: ['title', 'format', 'where', 'condition', 'paid', 'worth', 'notes'] }, NOW)
    const matrix = r.sections[0]!.rows.find((x) => x[0] === 'The Matrix')!
    expect(matrix).toEqual(['The Matrix', 'Blu-ray', 'Main binder · Page 10 · A', 'Good', '$10', '$25', ''])
    expect(r.sections[0]!.rows.find((x) => x[0] === 'Abbey Road')!.at(-1)).toBe('first pressing')
    expect(r.sections[0]!.rows.find((x) => x[0]?.startsWith('Alien'))![4]).toBe('$5.50')
  })

  it('groups by location with binder pages in natural order', () => {
    const r = buildReport(items, { ...base, group: 'location', columns: ['title', 'where'] }, NOW)
    expect(r.sections.map((s) => s.heading)).toEqual(['Den', 'Main binder', 'No location'])
    expect(r.sections[1]!.rows.map((x) => x[1])).toEqual(['Page 2 · C', 'Page 10 · A'])
    // ...but an ungrouped list names the location on every row
    expect(buildReport(items, { ...base, columns: ['title', 'where'] }, NOW).sections[0]!.rows.find((x) => x[0] === 'The Matrix')![1]).toBe('Main binder · Page 10 · A')
  })

  it('totals what was paid and what it is worth, overall and per section', () => {
    const r = buildReport(items, { ...base, group: 'location', columns: ['title', 'paid', 'worth'] }, NOW)
    expect(r.totals).toMatchObject({ count: 4, paid: 15.5, paidCount: 2, worth: 65, worthCount: 2 })
    expect(r.sections.find((s) => s.heading === 'Main binder')).toMatchObject({ count: 2, paid: 15.5, worth: 25 })
    expect(r.showTotals).toBe(true)
    expect(buildReport(items, base, NOW).showTotals).toBe(false)
  })

  it('reports on the wishlist with target prices', () => {
    const r = buildReport(items, { status: 'wishlist', group: 'none', columns: DEFAULT_COLUMNS.wishlist, title: 'Wants' }, NOW)
    expect(r.title).toBe('Wants')
    expect(r.sections[0]!.rows).toEqual([['Dune', '', '4K UHD', '$12']])
    expect(r.totals.target).toBe(12)
  })

  it('always has at least a title column and marks number columns for right alignment', () => {
    expect(buildReport(items, { ...base, columns: [] }, NOW).headers).toEqual(['Title'])
    expect(buildReport(items, { ...base, columns: ['title', 'year', 'paid'] }, NOW).numeric).toEqual([false, true, true])
  })

  it('copes with an empty list', () => {
    const r = buildReport([], base, NOW)
    expect(r.sections.flatMap((s) => s.rows)).toEqual([])
    expect(r.totals.count).toBe(0)
  })
})
