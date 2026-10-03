import { describe, expect, it, vi } from 'vitest'
import { lookupBarcode, LookupError, search } from './index'
import { parseRawg, searchRawg } from './rawg'
import { parseMusicBrainz, searchMusic } from './musicbrainz'
import { parseOpenLibrary, searchBooks } from './openlibrary'
import { parseTmdb, searchTmdb } from './tmdb'
import { cleanProductTitle, guessFormat, parseUpc } from './upc'

const KEYS = { tmdb: 'tok', rawg: 'gk' }
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('TMDB', () => {
  const json = {
    results: [
      { id: 348, title: 'Alien', release_date: '1979-05-25', poster_path: '/a.jpg', genre_ids: [27, 878], overview: ' Space. ' },
      { id: 1, title: '', release_date: '2000-01-01' },
      { title: 'No id' },
    ],
  }
  it('parses movies, skipping rows it cannot use', () => {
    expect(parseTmdb(json, 'movie')).toEqual([
      { title: 'Alien', category: 'movie', year: 1979, genre: 'Horror', posterUrl: 'https://image.tmdb.org/t/p/w342/a.jpg', overview: 'Space.', ext: { tmdb: 348 } },
    ])
  })
  it('uses name and first_air_date for TV', () => {
    expect(parseTmdb({ results: [{ id: 2, name: 'Lost', first_air_date: '2004-09-22', genre_ids: [10765] }] }, 'tv')[0]).toMatchObject({ title: 'Lost', year: 2004, genre: 'Sci-Fi & Fantasy' })
  })
  it('asks for a token instead of calling out without one', async () => {
    const f = reply(json)
    await expect(searchTmdb('', 'alien', 'movie', f)).rejects.toMatchObject({ kind: 'needs-token' })
    expect(f).not.toHaveBeenCalled()
  })
  it('sends the token as a bearer header and the query encoded', async () => {
    const f = reply(json)
    await searchTmdb('tok', 'alien & co', 'movie', f)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/search/movie?query=alien+%26+co')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })
  it('turns HTTP failures into friendly errors', async () => {
    await expect(searchTmdb('t', 'x', 'movie', reply({}, 401))).rejects.toMatchObject({ kind: 'rejected' })
    await expect(searchTmdb('t', 'x', 'movie', reply({}, 429))).rejects.toMatchObject({ kind: 'rate-limit' })
    await expect(searchTmdb('t', 'x', 'movie', vi.fn(async () => Promise.reject(new TypeError('offline'))))).rejects.toBeInstanceOf(LookupError)
  })
})

describe('Open Library', () => {
  const json = { docs: [{ key: '/works/OL1W', title: 'Dune', author_name: ['Frank Herbert'], first_publish_year: 1965, cover_i: 9, subject: ['Science fiction'] }, { title: '' }] }
  it('parses books', () => {
    expect(parseOpenLibrary(json)).toEqual([
      { title: 'Dune', category: 'book', year: 1965, creator: 'Frank Herbert', genre: 'Science fiction', posterUrl: 'https://covers.openlibrary.org/b/id/9-M.jpg', barcode: undefined, ext: { olid: 'OL1W' } },
    ])
  })
  it('searches by isbn when given one', async () => {
    const f = reply(json)
    const out = await searchBooks('978-0-441-17271-9', f)
    expect((f.mock.calls[0] as unknown as [string])[0]).toContain('isbn=9780441172719')
    expect(out[0]!.barcode).toBe('9780441172719')
  })
})

describe('MusicBrainz', () => {
  const json = {
    releases: [
      { id: 'r1', title: 'Abbey Road', date: '1969-09-26', 'artist-credit': [{ name: 'The Beatles' }] },
      { id: 'r2', title: 'Abbey Road', date: '1987', 'artist-credit': [{ name: 'The Beatles' }] },
      { id: 'r3', title: 'Revolver', date: '1966-08-05', 'artist-credit': [{ artist: { name: 'The Beatles' } }] },
    ],
  }
  it('shows each album once', () => {
    const out = parseMusicBrainz(json)
    expect(out.map((r) => r.title)).toEqual(['Abbey Road', 'Revolver'])
    expect(out[0]).toMatchObject({ creator: 'The Beatles', year: 1969, ext: { mbid: 'r1' } })
  })
  it('searches digits as a barcode and escapes free text', async () => {
    const f = reply(json)
    await searchMusic('0602547', f)
    expect(decodeURIComponent((f.mock.calls[0] as unknown as [string])[0])).not.toContain('barcode:')
    await searchMusic('602547202154', f)
    expect(decodeURIComponent((f.mock.calls[1] as unknown as [string])[0].replace(/\+/g, ' '))).toContain('barcode:602547202154')
    await searchMusic('AC/DC "live"', f)
    expect(decodeURIComponent((f.mock.calls[2] as unknown as [string])[0].replace(/\+/g, ' '))).toContain('AC\\/DC \\"live\\"')
  })
})

describe('UPC', () => {
  it('strips packaging noise from retail titles', () => {
    expect(cleanProductTitle('The Matrix (Blu-ray + Digital Copy) [Widescreen]')).toBe('The Matrix')
    expect(cleanProductTitle('Alien - 4K Ultra HD')).toBe('Alien')
    expect(cleanProductTitle('Heat (DVD)')).toBe('Heat')
    expect(cleanProductTitle('Saving Private Ryan: Special Edition DVD')).toBe('Saving Private Ryan')
  })
  it('guesses the disc format', () => {
    expect(guessFormat('Alien 4K UHD')).toBe('uhd')
    expect(guessFormat('Alien Blu-ray')).toBe('bluray')
    expect(guessFormat('Alien DVD')).toBe('dvd')
    expect(guessFormat('Alien')).toBeNull()
  })
  it('parses a product', () => {
    expect(parseUpc({ items: [{ title: 'Alien (Blu-ray)', images: ['http://i/1.jpg'] }] })).toEqual({ rawTitle: 'Alien (Blu-ray)', title: 'Alien', format: 'bluray', image: 'http://i/1.jpg' })
    expect(parseUpc({ items: [] })).toBeNull()
  })
})

describe('barcode lookup', () => {
  it('sends disc barcodes through UPC and then the film catalog', async () => {
    const f = vi.fn(async (url: string) =>
      url.includes('upcitemdb')
        ? new Response(JSON.stringify({ items: [{ title: 'Alien (4K UHD)' }] }))
        : new Response(JSON.stringify({ results: [{ id: 348, title: 'Alien', release_date: '1979-05-25' }] })),
    )
    const out = await lookupBarcode('movie', '024543000000', KEYS, f)
    expect(out.format).toBe('uhd')
    expect(out.results[0]).toMatchObject({ title: 'Alien', barcode: '024543000000' })
    expect((f.mock.calls[1] as unknown as [string])[0]).toContain('query=Alien')
  })
  it('says so when the barcode is unknown', async () => {
    const out = await lookupBarcode('movie', '024543000000', KEYS, reply({ items: [] }))
    expect(out.results).toEqual([])
    expect(out.note).toMatch(/not in the product database/)
  })
  it('has no lookup for games and returns nothing for blank searches', async () => {
    expect((await lookupBarcode('game', '045496000000', { tmdb: '', rawg: '' })).note).toMatch(/cannot look up barcodes/)
    expect(await search('movie', '   ', { tmdb: '', rawg: '' })).toEqual([])
  })
})

describe('RAWG', () => {
  const json = {
    results: [
      {
        id: 3498, name: 'Grand Theft Auto V', released: '2013-09-17', background_image: 'http://g/1.jpg', genres: [{ name: 'Action' }],
        platforms: [{ platform: { slug: 'pc' } }, { platform: { slug: 'playstation4' } }, { platform: { slug: 'xbox360' } }, { platform: { slug: 'xbox-one' } }, { platform: { slug: 'ios' } }],
      },
      { id: 1, name: 'Old Thing', released: null, background_image: null, genres: null, platforms: null },
      { name: 'No id' },
    ],
  }
  it('parses games and maps platforms to our formats once each', () => {
    const out = parseRawg(json)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ title: 'Grand Theft Auto V', category: 'game', year: 2013, genre: 'Action', posterUrl: 'http://g/1.jpg', formats: ['pc', 'ps4', 'xbox'], ext: { rawg: 3498 } })
    expect(out[1]).toMatchObject({ title: 'Old Thing', year: undefined, formats: undefined, posterUrl: undefined })
  })
  it('needs a key, and sends it with the query', async () => {
    await expect(searchRawg('', 'gta', reply(json))).rejects.toMatchObject({ kind: 'needs-token' })
    const f = reply(json)
    await searchRawg('gk', 'grand theft & auto', f)
    const url = (f.mock.calls[0] as unknown as [string])[0]
    expect(url).toContain('key=gk')
    expect(url).toContain('search=grand+theft+%26+auto')
  })
  it('is what the game category searches', async () => {
    const out = await search('game', 'gta', KEYS, reply(json))
    expect(out[0]!.title).toBe('Grand Theft Auto V')
    await expect(search('game', 'gta', { tmdb: 'tok', rawg: '' }, reply(json))).rejects.toMatchObject({ kind: 'needs-token' })
  })
})
