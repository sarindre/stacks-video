import { dayKey } from './dates'
import { normalizeItem } from './library'
import type { Item } from './types'

// A small made-up collection so a first-time visitor can try every screen without typing anything.
// Mostly silent-era and public-domain films, plus invented VHS-era titles, games, records and books.
// Every id starts with "sample-" so the sample can be removed again in one go.

export const SAMPLE_PREFIX = 'sample-'
export const isSample = (i: Pick<Item, 'id'>) => i.id.startsWith(SAMPLE_PREFIX)

type Raw = Record<string, unknown>

const BINDER = 'Main binder'
const page = (p: number, slot: string) => ({ location: BINDER, position: `Page ${p} · ${slot}` })

const daysAgo = (n: number, now: Date) => dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n))

export function sampleItems(now: Date = new Date()): Item[] {
  const rows: Raw[] = [
    // ---- Binder page 1
    { title: 'Nosferatu', year: 1922, creator: 'F. W. Murnau', genre: 'Horror', format: 'dvd', ...page(1, 'A'), price: 8, currentValue: 14, finished: true, rating: 5, favorite: true },
    { title: 'Metropolis', year: 1927, creator: 'Fritz Lang', genre: 'Sci-Fi', format: 'bluray', ...page(1, 'B'), price: 15, currentValue: 22, finished: true, rating: 5 },
    { title: 'The General', year: 1926, creator: 'Buster Keaton', genre: 'Comedy', format: 'dvd', ...page(1, 'C'), price: 6, finished: true, rating: 4 },
    { title: 'Sherlock Jr.', year: 1924, creator: 'Buster Keaton', genre: 'Comedy', format: 'dvd', ...page(1, 'D'), price: 6, rating: 4 },
    { title: 'The Cabinet of Dr. Caligari', year: 1920, creator: 'Robert Wiene', genre: 'Horror', format: 'dvd', ...page(1, 'E') },
    { title: 'A Trip to the Moon', year: 1902, creator: 'Georges Méliès', genre: 'Sci-Fi', format: 'dvd', ...page(1, 'F'), finished: true },
    { title: 'The Phantom of the Opera', year: 1925, creator: 'Rupert Julian', genre: 'Horror', format: 'dvd', ...page(1, 'G') },
    { title: 'Safety Last!', year: 1923, creator: 'Fred C. Newmeyer', genre: 'Comedy', format: 'dvd', ...page(1, 'H'), rating: 4 },
    // ---- Binder page 2
    { title: 'Night of the Living Dead', year: 1968, creator: 'George A. Romero', genre: 'Horror', format: 'dvd', ...page(2, 'A'), price: 5, currentValue: 9, finished: true, rating: 4 },
    { title: 'Carnival of Souls', year: 1962, creator: 'Herk Harvey', genre: 'Horror', format: 'dvd', ...page(2, 'B') },
    { title: 'Plan 9 from Outer Space', year: 1957, creator: 'Ed Wood', genre: 'Sci-Fi', format: 'dvd', ...page(2, 'C'), favorite: true, finished: true, rating: 3, tags: ['so-bad-its-good'] },
    { title: 'Charade', year: 1963, creator: 'Stanley Donen', genre: 'Thriller', format: 'bluray', ...page(2, 'D'), price: 12, rating: 5 },
    { title: 'D.O.A.', year: 1950, creator: 'Rudolph Maté', genre: 'Thriller', format: 'dvd', ...page(2, 'E') },
    { title: 'His Girl Friday', year: 1940, creator: 'Howard Hawks', genre: 'Comedy', format: 'dvd', ...page(2, 'G'), finished: true },
    // ---- Binder page 3 (a pocket or two left empty on purpose)
    { title: 'Little Shop of Horrors', year: 1960, creator: 'Roger Corman', genre: 'Comedy', format: 'dvd', ...page(3, 'A') },
    { title: 'Nosferatu', year: 1922, creator: 'F. W. Murnau', genre: 'Horror', format: 'uhd', ...page(3, 'B'), edition: 'Restored', price: 25, currentValue: 30 },
    // ---- Made-up VHS-era series, so series grouping has something to show
    { title: 'Laser Ninja Academy', year: 1988, genre: 'Action', format: 'dvd', series: 'Laser Ninja', seriesNum: '1', ...page(3, 'D'), favorite: true, rating: 5 },
    { title: 'Laser Ninja Academy 2: Graduation Day', year: 1990, genre: 'Action', format: 'dvd', series: 'Laser Ninja', seriesNum: '2', ...page(3, 'E'), rating: 4 },
    { title: 'Mall Cops of Mars', year: 1991, genre: 'Sci-Fi', format: 'dvd', ...page(3, 'F'), lentTo: 'Sam', lentAt: daysAgo(45, now), price: 7 },
    { title: 'Gridlock Express', year: 1994, genre: 'Action', format: 'dvd', ...page(3, 'G'), finished: true },
    // ---- Other places, other formats
    { title: 'Slumber Party Slasher', year: 1986, genre: 'Horror', format: 'vhs', location: 'Garage shelf', position: 'Box 2', condition: 'fair', edition: 'Big-box rental copy', price: 3, currentValue: 18 },
    { title: 'Turbo Teen Detective', year: 1993, genre: 'Family', format: 'vhs', location: 'Garage shelf', position: 'Box 2', condition: 'good' },
    { title: 'Neon Nights', category: 'tv', year: 1989, genre: 'Drama', format: 'dvd', location: 'Living room shelf', position: 'Shelf 2', edition: 'Complete series' },
    { title: 'Pixel Quest', category: 'game', year: 1993, genre: 'Adventure', format: 'retro', location: 'Living room shelf', position: 'Shelf 3', condition: 'good', price: 20, currentValue: 55, favorite: true },
    { title: 'Cosmic Courier', category: 'game', year: 2002, genre: 'Action', format: 'ps2', location: 'Living room shelf', position: 'Shelf 3', finished: true },
    { title: 'Tiny Dungeon', category: 'game', year: 2021, genre: 'Strategy', format: 'switch', location: 'Living room shelf', position: 'Shelf 3', price: 15 },
    { title: 'Midnight Static', category: 'music', year: 1984, creator: 'The Late Fees', genre: 'Synthpop', format: 'vinyl', location: 'Den', position: 'Crate 1', condition: 'good', price: 11, currentValue: 24, rating: 5 },
    { title: 'Be Kind', category: 'music', year: 1992, creator: 'Rewind Rangers', genre: 'Alternative', format: 'cd', location: 'Den', position: 'Crate 2' },
    { title: 'Tape Hiss', category: 'music', year: 1987, creator: 'Dolby Dreams', genre: 'Pop', format: 'cassette', location: 'Den', position: 'Crate 2' },
    { title: 'Dracula', category: 'book', year: 1897, creator: 'Bram Stoker', genre: 'Horror', format: 'paperback', location: 'Bookcase', position: 'Shelf 1', finished: true, rating: 4 },
    { title: 'Frankenstein', category: 'book', year: 1818, creator: 'Mary Shelley', genre: 'Horror', format: 'hardcover', location: 'Bookcase', position: 'Shelf 1', finished: true, rating: 5, favorite: true },
    { title: 'The Time Machine', category: 'book', year: 1895, creator: 'H. G. Wells', genre: 'Sci-Fi', format: 'paperback', location: 'Bookcase', position: 'Shelf 2' },
    // ---- Coming soon (the wishlist)
    { title: 'Laser Ninja Academy 3', status: 'wishlist', year: 1993, genre: 'Action', format: 'dvd', series: 'Laser Ninja', seriesNum: '3', priority: 'high', targetPrice: 14.99 },
    { title: 'Mall Cops of Mars 2', status: 'wishlist', year: 1995, genre: 'Sci-Fi', format: 'dvd', priority: 'medium', targetPrice: 9 },
    { title: 'Hollow Knight Descent', status: 'wishlist', category: 'game', format: 'switch', priority: 'low', targetPrice: 25 },
  ]
  const stamp = now.toISOString()
  return rows.flatMap((r, n) => {
    const item = normalizeItem({ id: `${SAMPLE_PREFIX}${String(n + 1).padStart(3, '0')}`, ...r, tags: ['sample', ...((r.tags as string[] | undefined) ?? [])], addedAt: stamp, updatedAt: stamp }, stamp)
    return item ? [item] : []
  })
}
