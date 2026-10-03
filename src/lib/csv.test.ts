import { describe, expect, it } from 'vitest'
import { csvToItems, itemsToCsv, parseCsv } from './csv'
import { normalizeItem } from './library'

describe('parseCsv', () => {
  it('handles quotes, commas, doubled quotes, embedded newlines and CRLF', () => {
    const rows = parseCsv('a,b\r\n"x, y","say ""hi"""\r\n"line1\nline2",z\r\n')
    expect(rows).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['line1\nline2', 'z']])
  })
  it('skips blank lines and a BOM', () => {
    expect(parseCsv('﻿a\n\n1\n')).toEqual([['a'], ['1']])
  })
})

describe('csv round trip', () => {
  it('keeps every field', () => {
    const item = normalizeItem({
      id: 'a1', title: 'Aliens, "Special" Edition', category: 'movie', format: 'bluray', year: 1986, creator: 'James Cameron',
      genre: 'Sci-Fi', series: 'Alien', seriesNum: '2', edition: 'Director\'s cut', condition: 'good', location: 'Binder', position: 'Page 3 · A',
      finished: true, favorite: true, rating: 4, price: 12.5, purchasedAt: '2024-03-02', priority: 'high', targetPrice: 9.99, currentValue: 20, valueAt: '2025-01-15', barcode: '012345678905', tags: ['classic', 'space'],
      lentTo: 'Sam', lentAt: '2024-05-01', notes: 'line one\nline two',
    })!
    const parsed = csvToItems(itemsToCsv([item]))
    expect('error' in parsed).toBe(false)
    if ('error' in parsed) return
    expect(parsed.items).toHaveLength(1)
    // updatedAt is bookkeeping and isn't a CSV column; everything the person entered is.
    expect({ ...parsed.items[0], updatedAt: '' }).toEqual({ ...item, updatedAt: '' })
  })

  it('does not let spreadsheet formulas run', () => {
    const csv = itemsToCsv([normalizeItem({ title: '=HYPERLINK("http://x")' })!])
    expect(csv).toContain(`'=HYPERLINK`)
    const back = csvToItems(csv)
    expect('items' in back && back.items[0]?.title).toBe('=HYPERLINK("http://x")')
  })
})

describe('csvToItems', () => {
  it('maps common header spellings and values from other tools', () => {
    const out = csvToItems('Name,Type,Platform,Director,Watched,Cost,Page,Shelf\nHeat,Film,Blu-ray,Michael Mann,yes,$9.99,12,Living room')
    if ('error' in out) throw new Error(out.error)
    expect(out.items[0]).toMatchObject({ title: 'Heat', category: 'movie', format: 'bluray', creator: 'Michael Mann', finished: true, price: 9.99, position: '12', location: 'Living room' })
  })

  it('maps wishlist status and reports ignored columns and empty titles', () => {
    const out = csvToItems('title,status,mystery\nA,Wish list,1\n,owned,2')
    if ('error' in out) throw new Error(out.error)
    expect(out.items).toHaveLength(1)
    expect(out.items[0]!.status).toBe('wishlist')
    expect(out.dropped).toBe(1)
    expect(out.ignoredHeaders).toEqual(['mystery'])
  })

  it('explains what is wrong', () => {
    expect(csvToItems('title\n')).toEqual({ error: 'The file has no rows to import.' })
    expect(csvToItems('a,b\n1,2')).toEqual({ error: 'The file needs a "title" column.' })
  })
})
