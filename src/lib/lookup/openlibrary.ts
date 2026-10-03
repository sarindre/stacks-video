import { getJson, type Fetcher, type LookupResult } from './types'

interface OlDoc {
  key?: string
  title?: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  subject?: string[]
  isbn?: string[]
}

export function parseOpenLibrary(json: unknown, barcode?: string): LookupResult[] {
  const docs = (json as { docs?: OlDoc[] } | null)?.docs
  if (!Array.isArray(docs)) return []
  const out: LookupResult[] = []
  for (const d of docs) {
    const title = d.title?.trim()
    if (!title) continue
    out.push({
      title,
      category: 'book',
      year: d.first_publish_year,
      creator: d.author_name?.[0],
      genre: d.subject?.[0],
      posterUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
      barcode,
      ext: d.key ? { olid: d.key.replace(/^\/works\//, '') } : {},
    })
  }
  return out
}

const FIELDS = 'key,title,author_name,first_publish_year,cover_i,subject'

/** Open Library needs no key. A barcode that looks like an ISBN is searched as one. */
export async function searchBooks(query: string, fetcher: Fetcher = fetch): Promise<LookupResult[]> {
  const digits = query.replace(/[\s-]/g, '')
  const isIsbn = /^(\d{9}[\dXx]|\d{13})$/.test(digits)
  const params = new URLSearchParams({ limit: '12', fields: FIELDS })
  params.set(isIsbn ? 'isbn' : 'q', isIsbn ? digits : query)
  const json = await getJson(fetcher, `https://openlibrary.org/search.json?${params}`)
  return parseOpenLibrary(json, isIsbn ? digits : undefined)
}
