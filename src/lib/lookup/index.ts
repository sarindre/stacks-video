import type { Category } from '../types'
import { searchBooks } from './openlibrary'
import { searchMusic } from './musicbrainz'
import { searchRawg } from './rawg'
import { searchTmdb } from './tmdb'
import { lookupUpc } from './upc'
import type { Fetcher, LookupKeys, LookupResult } from './types'

export { LookupError } from './types'
export type { LookupKeys, LookupResult } from './types'
export { guessFormat } from './upc'

/** Categories with an online catalog. */
export const SEARCHABLE: Category[] = ['movie', 'tv', 'game', 'music', 'book']

export const canSearch = (c: Category) => SEARCHABLE.includes(c)

export async function search(category: Category, query: string, keys: LookupKeys, fetcher?: Fetcher): Promise<LookupResult[]> {
  const q = query.trim()
  if (!q) return []
  switch (category) {
    case 'movie':
    case 'tv':
      return searchTmdb(keys.tmdb, q, category, fetcher)
    case 'game':
      return searchRawg(keys.rawg, q, fetcher)
    case 'music':
      return searchMusic(q, fetcher)
    case 'book':
      return searchBooks(q, fetcher)
    default:
      return []
  }
}

export interface BarcodeOutcome {
  results: LookupResult[]
  /** Disc format read from the product name, when the listing said so. */
  format: 'uhd' | 'bluray' | 'dvd' | null
  note?: string
}

/**
 * Barcode -> candidates. Books and music have catalogs keyed by barcode; film and TV discs
 * go through a UPC product database, then a title search on what it calls the product.
 */
export async function lookupBarcode(category: Category, code: string, keys: LookupKeys, fetcher?: Fetcher): Promise<BarcodeOutcome> {
  if (category === 'book' || category === 'music') {
    const results = await search(category, code, keys, fetcher)
    return { results, format: null, note: results.length ? undefined : 'No match for that barcode. Search by title instead.' }
  }
  if (category === 'movie' || category === 'tv') {
    const product = await lookupUpc(code, fetcher)
    if (!product) return { results: [], format: null, note: 'That barcode is not in the product database. Search by title instead.' }
    const results = await searchTmdb(keys.tmdb, product.title, category, fetcher)
    return {
      results: results.map((r) => ({ ...r, barcode: code })),
      format: product.format,
      note: results.length ? `Barcode matched "${product.rawTitle}".` : `Barcode matched "${product.rawTitle}", but no catalog entry. Search by title instead.`,
    }
  }
  return { results: [], format: null, note: 'Game databases cannot look up barcodes. Search by title instead; type the barcode into the form to save it.' }
}
