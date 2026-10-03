import { describe, expect, it } from 'vitest'
import { storeLinks } from './stores'

const names = (links: { name: string }[]) => links.map((l) => l.name)

describe('storeLinks', () => {
  it('searches discs by title and format, encoding awkward characters', () => {
    const links = storeLinks({ category: 'movie', format: 'bluray', title: "Valkyrie: Director's Cut & More", year: 2008 })
    expect(names(links)).toEqual(['Amazon', 'eBay', 'Blu-ray.com', 'Google Shopping'])
    expect(links[0]!.url).toBe("https://www.amazon.com/s?k=Valkyrie%3A%20Director's%20Cut%20%26%20More%20Blu-ray")
    for (const l of links) expect(() => new URL(l.url)).not.toThrow()
  })
  it('picks specialists per type', () => {
    expect(names(storeLinks({ category: 'game', format: 'ps5', title: 'Hades' }))).toContain('PriceCharting')
    const music = storeLinks({ category: 'music', format: 'vinyl', title: 'Abbey Road', creator: 'The Beatles' })
    expect(names(music)[0]).toBe('Discogs')
    expect(music[0]!.url).toContain('Abbey%20Road%20The%20Beatles')
    const book = storeLinks({ category: 'book', format: 'paperback', title: 'Dune', creator: 'Frank Herbert' })
    expect(names(book)).toEqual(['AbeBooks', 'Bookshop.org', 'Amazon', 'eBay'])
  })
  it('only ever links to https', () => {
    for (const category of ['movie', 'tv', 'game', 'music', 'book'] as const) {
      for (const l of storeLinks({ category, format: 'dvd', title: 'x' })) expect(l.url.startsWith('https://')).toBe(true)
    }
  })
})
