import type { Category, Condition } from './types'

export interface CategoryInfo {
  label: string
  singular: string
  finishedLabel: string
  unfinishedLabel: string
  creatorLabel: string
  formats: Record<string, string>
}

export const CATEGORIES: Record<Category, CategoryInfo> = {
  movie: {
    label: 'Movies',
    singular: 'Movie',
    finishedLabel: 'Watched',
    unfinishedLabel: 'Unwatched',
    creatorLabel: 'Director',
    formats: { dvd: 'DVD', bluray: 'Blu-ray', uhd: '4K UHD', vhs: 'VHS', laserdisc: 'LaserDisc', digital: 'Digital' },
  },
  tv: {
    label: 'TV',
    singular: 'TV show',
    finishedLabel: 'Watched',
    unfinishedLabel: 'Unwatched',
    creatorLabel: 'Creator',
    formats: { dvd: 'DVD', bluray: 'Blu-ray', uhd: '4K UHD', vhs: 'VHS', digital: 'Digital' },
  },
  game: {
    label: 'Games',
    singular: 'Game',
    finishedLabel: 'Played',
    unfinishedLabel: 'Unplayed',
    creatorLabel: 'Developer',
    formats: {
      ps5: 'PS5', ps4: 'PS4', ps3: 'PS3', ps2: 'PS2', ps1: 'PS1', xbox: 'Xbox', switch: 'Switch',
      nintendo: 'Other Nintendo', pc: 'PC', retro: 'Retro', digital: 'Digital',
    },
  },
  music: {
    label: 'Music',
    singular: 'Album',
    finishedLabel: 'Listened',
    unfinishedLabel: 'Unlistened',
    creatorLabel: 'Artist',
    formats: { vinyl: 'Vinyl', cd: 'CD', cassette: 'Cassette', digital: 'Digital' },
  },
  book: {
    label: 'Books',
    singular: 'Book',
    finishedLabel: 'Read',
    unfinishedLabel: 'Unread',
    creatorLabel: 'Author',
    formats: { hardcover: 'Hardcover', paperback: 'Paperback', ebook: 'eBook', audiobook: 'Audiobook' },
  },
}

export const CATEGORY_ORDER: Category[] = ['movie', 'tv', 'game', 'music', 'book']

export const CONDITIONS: Record<Condition, string> = {
  new: 'New / sealed',
  'like-new': 'Like new',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
}

export const isCategory = (v: unknown): v is Category => typeof v === 'string' && v in CATEGORIES
export const isCondition = (v: unknown): v is Condition => typeof v === 'string' && v in CONDITIONS

export function formatLabel(category: Category, format: string): string {
  return CATEGORIES[category].formats[format] ?? format
}

export function defaultFormat(category: Category): string {
  return Object.keys(CATEGORIES[category].formats)[0] ?? 'other'
}

/**
 * Turns whatever a person typed or a file contained ("Blu-ray", "bluray", "BD", "4K")
 * into a format key for the category, or null when it isn't recognised.
 */
const FORMAT_ALIASES: Record<string, string> = {
  bd: 'bluray', blu: 'bluray', bluray: 'bluray', blu_ray: 'bluray',
  '4k': 'uhd', uhd: 'uhd', '4kuhd': 'uhd', '4kbluray': 'uhd',
  record: 'vinyl', lp: 'vinyl', tape: 'cassette',
  hc: 'hardcover', pb: 'paperback', softcover: 'paperback', kindle: 'ebook',
  playstation5: 'ps5', playstation4: 'ps4', playstation3: 'ps3', playstation2: 'ps2', playstation: 'ps1', psx: 'ps1',
  xboxone: 'xbox', xbox360: 'xbox', xboxseriesx: 'xbox', nintendoswitch: 'switch',
  digitalcopy: 'digital', streaming: 'digital',
}

export function parseFormat(category: Category, raw: string): string | null {
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!key) return null
  const formats = CATEGORIES[category].formats
  for (const [k, label] of Object.entries(formats)) {
    if (k === key || label.toLowerCase().replace(/[^a-z0-9]/g, '') === key) return k
  }
  const alias = FORMAT_ALIASES[key]
  return alias && alias in formats ? alias : null
}
