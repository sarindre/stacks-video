import { formatLabel } from './catalog'
import { daysSince } from './dates'
import type { Category, Item } from './types'

export type SortKey = 'title' | 'added' | 'year' | 'rating' | 'location' | 'priority' | 'value'
export type GroupKey = 'none' | 'series' | 'genre' | 'location' | 'format'
export type ViewStatus = 'owned' | 'wishlist'

export interface Filters {
  q: string
  category: Category | 'all'
  format: string // 'all' or a format key
  genre: string // 'all' or a genre
  location: string // 'all' or a location
  /** all | unfinished | finished | favorite | lent */
  flag: 'all' | 'unfinished' | 'finished' | 'favorite' | 'lent'
}

export const DEFAULT_FILTERS: Filters = { q: '', category: 'all', format: 'all', genre: 'all', location: 'all', flag: 'all' }

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

function haystack(i: Item): string {
  return fold(
    [i.title, i.series, i.creator, i.genre, i.edition, i.location, i.position, i.notes, i.barcode, i.lentTo, formatLabel(i.category, i.format), ...i.tags]
      .filter(Boolean)
      .join(' \n '),
  )
}

export function filterItems(items: Item[], status: ViewStatus, f: Filters): Item[] {
  const terms = fold(f.q).split(/\s+/).filter(Boolean)
  return items.filter((i) => {
    if (i.status !== status) return false
    if (f.category !== 'all' && i.category !== f.category) return false
    if (f.format !== 'all' && i.format !== f.format) return false
    if (f.genre !== 'all' && i.genre !== f.genre) return false
    if (f.location !== 'all' && i.location !== f.location) return false
    if (f.flag === 'unfinished' && i.finished) return false
    if (f.flag === 'finished' && !i.finished) return false
    if (f.flag === 'favorite' && !i.favorite) return false
    if (f.flag === 'lent' && !i.lentTo) return false
    if (terms.length) {
      const h = haystack(i)
      if (!terms.every((t) => h.includes(t))) return false
    }
    return true
  })
}

/** "4A" -> 4, "3.5" -> 3.5, "Prequel" -> null (sorted after numbered entries). */
export function seriesOrder(n: string | undefined): number | null {
  if (!n) return null
  const m = /^\s*(\d+(?:\.\d+)?)/.exec(n)
  return m ? parseFloat(m[1]!) : null
}

// Titles sort without leading articles: "The Matrix" sits under M.
const sortTitle = (t: string) => fold(t).replace(/^(the|a|an)\s+/, '')
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** Natural-ish order for position strings so "Page 2" comes before "Page 10". */
const byLocation = (a: Item, b: Item) =>
  collator.compare(a.location ?? '￿', b.location ?? '￿') || collator.compare(a.position ?? '', b.position ?? '')

const PRIORITY_RANK = { high: 0, medium: 1, low: 2, none: 3 } as const

export function compareItems(sort: SortKey): (a: Item, b: Item) => number {
  const byTitle = (a: Item, b: Item) => collator.compare(sortTitle(a.title), sortTitle(b.title))
  switch (sort) {
    case 'added':
      return (a, b) => b.addedAt.localeCompare(a.addedAt) || byTitle(a, b)
    case 'year':
      return (a, b) => (b.year ?? 0) - (a.year ?? 0) || byTitle(a, b)
    case 'rating':
      return (a, b) => b.rating - a.rating || byTitle(a, b)
    case 'priority':
      return (a, b) => PRIORITY_RANK[a.priority ?? 'none'] - PRIORITY_RANK[b.priority ?? 'none'] || (a.targetPrice ?? Infinity) - (b.targetPrice ?? Infinity) || byTitle(a, b)
    case 'value':
      return (a, b) => (b.currentValue ?? -1) - (a.currentValue ?? -1) || byTitle(a, b)
    case 'location':
      return (a, b) => byLocation(a, b) || byTitle(a, b)
    default:
      return byTitle
  }
}

export interface Group {
  key: string
  label: string
  items: Item[]
}

function groupLabel(i: Item, by: GroupKey): string {
  switch (by) {
    case 'series':
      return i.series ?? 'Standalone'
    case 'genre':
      return i.genre ?? 'No genre'
    case 'location':
      return i.location ?? 'No location'
    case 'format':
      return formatLabel(i.category, i.format)
    default:
      return ''
  }
}

export function sortAndGroup(items: Item[], sort: SortKey, by: GroupKey): Group[] {
  const cmp = compareItems(sort)
  if (by === 'none') return [{ key: 'all', label: '', items: [...items].sort(cmp) }]
  const map = new Map<string, Item[]>()
  for (const i of items) {
    const label = groupLabel(i, by)
    const list = map.get(label)
    if (list) list.push(i)
    else map.set(label, [i])
  }
  const groups: Group[] = [...map.entries()].map(([label, list]) => ({
    key: label,
    label,
    items:
      by === 'series'
        ? list.sort((a, b) => {
            const an = seriesOrder(a.seriesNum)
            const bn = seriesOrder(b.seriesNum)
            if (an !== null && bn !== null && an !== bn) return an - bn
            if (an !== null && bn === null) return -1
            if (an === null && bn !== null) return 1
            return cmp(a, b)
          })
        : list.sort(cmp),
  }))
  const fallback = ['Standalone', 'No genre', 'No location']
  return groups.sort((a, b) => {
    const af = fallback.includes(a.label) ? 1 : 0
    const bf = fallback.includes(b.label) ? 1 : 0
    return af - bf || collator.compare(a.label, b.label)
  })
}

export function distinct(items: Item[], pick: (i: Item) => string | undefined): string[] {
  return [...new Set(items.map(pick).filter((v): v is string => !!v))].sort((a, b) => collator.compare(a, b))
}

export function lentDays(i: Item): number | null {
  return i.lentAt ? daysSince(i.lentAt) : null
}
