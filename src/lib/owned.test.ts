import { describe, expect, it } from 'vitest'
import { checkOwned, guessBarcodeCategory, looksLikeBarcode } from './owned'
import { normalizeItem } from './library'

const make = (id: string, title: string, over: Record<string, unknown> = {}) => normalizeItem({ id, title, ...over })!
const lib = [
  make('1', 'Alien', { format: 'dvd', location: 'Main binder', position: 'Page 22 · G' }),
  make('2', 'Alien', { format: 'digital', location: 'Prime Video' }),
  make('3', 'Aliens', { format: 'bluray' }),
  make('4', 'Alien Resurrection'),
  make('5', 'The Hangover', { barcode: '012569500000' }),
  make('6', 'It', { year: 2017 }),
  make('7', 'It', { year: 1990, format: 'vhs' }),
  make('8', 'Dune', { status: 'wishlist' }),
  make('9', 'Abbey Road', { category: 'music', format: 'vinyl' }),
  make('10', 'Alien', { category: 'book' }),
]

const ids = (items: { id: string }[]) => items.map((i) => i.id)

describe('checkOwned', () => {
  it('says nothing for an empty query', () => {
    expect(checkOwned(lib, '   ').verdict).toBeNull()
  })

  it('finds every copy of the exact title, in any format', () => {
    const r = checkOwned(lib, 'alien', { category: 'movie' })
    expect(r.verdict).toBe('owned')
    expect(ids(r.exact).sort()).toEqual(['1', '2'])
  })

  it('does not mistake a sequel for the film', () => {
    const r = checkOwned(lib, 'Aliens', { category: 'movie' })
    expect(ids(r.exact)).toEqual(['3'])
    const r2 = checkOwned(lib, 'Alien 3')
    expect(r2.verdict).toBe('not-owned')
  })

  it('lists similar titles separately, never as the verdict', () => {
    const r = checkOwned(lib, 'alien', { category: 'movie' })
    expect(ids(r.similar)).toEqual(['4', '3'])
    expect(checkOwned(lib, 'resurrection').verdict).toBe('not-owned')
    expect(ids(checkOwned(lib, 'resurrection').similar)).toEqual(['4'])
  })

  it('ignores case, accents, punctuation and a leading article', () => {
    expect(checkOwned(lib, 'HANGOVER').verdict).toBe('owned')
    expect(checkOwned(lib, 'the  hangover!').verdict).toBe('owned')
  })

  it('separates remakes by year', () => {
    expect(ids(checkOwned(lib, 'It (2017)').exact)).toEqual(['6'])
    expect(ids(checkOwned(lib, 'It', { year: 1990 }).exact)).toEqual(['7'])
    expect(ids(checkOwned(lib, 'It').exact)).toEqual(['7', '6'].sort())
    expect(checkOwned(lib, 'It (2001)').verdict).toBe('not-owned')
  })

  it('respects the type filter', () => {
    expect(ids(checkOwned(lib, 'alien', { category: 'book' }).exact)).toEqual(['10'])
    expect(ids(checkOwned(lib, 'alien', { category: 'all' }).exact).sort()).toEqual(['1', '10', '2'])
  })

  it('reports owning it, but not in the format asked about', () => {
    const r = checkOwned(lib, 'Aliens', { format: 'uhd' })
    expect(r.verdict).toBe('other-format')
    expect(r.missingFormat).toBe('uhd')
    expect(checkOwned(lib, 'Aliens', { format: 'bluray' }).verdict).toBe('owned')
  })

  it('knows about the wishlist', () => {
    const r = checkOwned(lib, 'dune')
    expect(r.verdict).toBe('wishlist')
    expect(ids(r.wishlist)).toEqual(['8'])
    expect(r.exact).toEqual([])
  })

  it('matches a barcode, whether it was stored as UPC-A or EAN-13', () => {
    expect(ids(checkOwned(lib, '', { barcode: '012569500000' }).exact)).toEqual(['5'])
    expect(ids(checkOwned(lib, '', { barcode: '0012569500000' }).exact)).toEqual(['5'])
    expect(checkOwned(lib, '', { barcode: '999999999999' }).verdict).toBe('not-owned')
  })
})

describe('barcode helpers', () => {
  it('recognises barcodes', () => {
    expect(looksLikeBarcode('012569500000')).toBe(true)
    expect(looksLikeBarcode('0125-6950 0000')).toBe(true)
    expect(looksLikeBarcode('1408')).toBe(false)
    expect(looksLikeBarcode('Alien')).toBe(false)
  })
  it('sends ISBNs to books and everything else to films unless told otherwise', () => {
    expect(guessBarcodeCategory('9780441172719', 'all')).toBe('book')
    expect(guessBarcodeCategory('024543000000', 'all')).toBe('movie')
    expect(guessBarcodeCategory('024543000000', 'music')).toBe('music')
  })
})
