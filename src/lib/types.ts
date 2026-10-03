export type Category = 'movie' | 'tv' | 'game' | 'music' | 'book'
export type Status = 'owned' | 'wishlist'
export type Condition = 'new' | 'like-new' | 'good' | 'fair' | 'poor'
export type Priority = 'high' | 'medium' | 'low'
export type ThemePref = 'system' | 'dark' | 'light'

export interface ExternalIds {
  tmdb?: number
  mbid?: string
  olid?: string
  rawg?: number
}

/** One physical (or digital) copy of something. Two copies of a film are two items. */
export interface Item {
  id: string
  category: Category
  /** Key into FORMATS[category], e.g. "bluray", "vinyl". */
  format: string
  title: string
  year?: number
  /** Director, artist or author. */
  creator?: string
  genre?: string
  series?: string
  /** Free text so "4A", "3.5" and "Prequel" all work; sorted numerically when possible. */
  seriesNum?: string
  edition?: string
  condition?: Condition
  /** Where it lives: "Main binder", "Living room shelf", "Prime Video". */
  location?: string
  /** Where inside the location: "Page 12 · C", "Shelf 3". */
  position?: string
  status: Status
  /** Watched / played / listened / read. */
  finished: boolean
  favorite: boolean
  /** 0 = unrated, 1-5 stars. */
  rating: number
  notes?: string
  tags: string[]
  posterUrl?: string
  barcode?: string
  ext: ExternalIds
  price?: number
  /** Wishlist: the most you would pay. */
  targetPrice?: number
  /** Wishlist: how much you want it. */
  priority?: Priority
  /** What it is worth today, entered by hand. */
  currentValue?: number
  /** Local day the value was last set, YYYY-MM-DD. */
  valueAt?: string
  /** Local day, YYYY-MM-DD. */
  purchasedAt?: string
  lentTo?: string
  /** Local day, YYYY-MM-DD. */
  lentAt?: string
  addedAt: string
  updatedAt: string
}

export interface LibraryFile {
  app: 'stacks-video'
  version: number
  exportedAt: string
  items: Item[]
}

export interface Settings {
  tmdbToken: string
  rawgKey: string
  /** Remind about loans out this many days; 0 turns reminders off. */
  loanDays: number
  theme: ThemePref
  /** Ids of one-time notices the person has dismissed (see lib/environment.ts). */
  dismissedNotices: string[]
  lastBackupAt: string | null
}
