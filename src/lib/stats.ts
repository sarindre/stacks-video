import { CATEGORY_ORDER, formatLabel } from './catalog'
import type { Category, Item } from './types'

export interface Count {
  label: string
  count: number
}

export interface Stats {
  owned: number
  wishlist: number
  finished: number
  favorites: number
  totalValue: number
  pricedCount: number
  /** Sum of the worth-today values you entered, and how many items have one. */
  estValue: number
  valuedCount: number
  /** Worth today minus price paid, across items that have both. */
  valueChange: number
  changeCount: number
  mostValuable: Item[]
  /** Wishlist: total of the target prices set, and how many have one. */
  wishlistTarget: number
  wishlistTargetCount: number
  byCategory: { category: Category; count: number }[]
  byFormat: Count[]
  byGenre: Count[]
  byLocation: Count[]
  /** Last 12 calendar months ending now, oldest first. */
  addedByMonth: { key: string; label: string; count: number }[]
  recent: Item[]
  lent: Item[]
  /** Products owned more than once (same title, format and edition), with how many copies. */
  duplicates: Count[]
}

const tally = (labels: string[], limit = 8): Count[] => {
  const map = new Map<string, number>()
  for (const l of labels) map.set(l, (map.get(l) ?? 0) + 1)
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function computeStats(items: Item[], now: Date = new Date()): Stats {
  const owned = items.filter((i) => i.status === 'owned')
  const priced = owned.filter((i) => typeof i.price === 'number')
  const valued = owned.filter((i) => typeof i.currentValue === 'number')
  const both = owned.filter((i) => typeof i.price === 'number' && typeof i.currentValue === 'number')
  const wishTargets = items.filter((i) => i.status === 'wishlist' && typeof i.targetPrice === 'number')

  const months: Stats['addedByMonth'] = []
  for (let n = 11; n >= 0; n--) {
    const d = new Date(now.getFullYear(), now.getMonth() - n, 1)
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      count: 0,
    })
  }
  for (const i of owned) {
    const d = new Date(i.addedAt)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const m = months.find((x) => x.key === key)
    if (m) m.count++
  }

  // A duplicate is the same product twice: same title, format and edition. A DVD plus a digital
  // copy, or a film plus its special-features disc, are different things on purpose.
  const titleCounts = new Map<string, { title: string; count: number }>()
  for (const i of owned) {
    const k = `${i.category}|${i.format}|${squash(i.title)}|${squash(i.edition ?? '')}`
    const cur = titleCounts.get(k)
    if (cur) cur.count++
    else titleCounts.set(k, { title: i.title, count: 1 })
  }

  return {
    owned: owned.length,
    wishlist: items.length - owned.length,
    finished: owned.filter((i) => i.finished).length,
    favorites: owned.filter((i) => i.favorite).length,
    totalValue: priced.reduce((sum, i) => sum + (i.price ?? 0), 0),
    pricedCount: priced.length,
    estValue: valued.reduce((sum, i) => sum + (i.currentValue ?? 0), 0),
    valuedCount: valued.length,
    valueChange: both.reduce((sum, i) => sum + ((i.currentValue ?? 0) - (i.price ?? 0)), 0),
    changeCount: both.length,
    mostValuable: [...valued].sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0)).slice(0, 5),
    wishlistTarget: wishTargets.reduce((sum, i) => sum + (i.targetPrice ?? 0), 0),
    wishlistTargetCount: wishTargets.length,
    byCategory: CATEGORY_ORDER.map((category) => ({ category, count: owned.filter((i) => i.category === category).length })).filter((c) => c.count > 0),
    byFormat: tally(owned.map((i) => formatLabel(i.category, i.format)), 10),
    byGenre: tally(owned.filter((i) => i.genre).map((i) => i.genre!), 8),
    byLocation: tally(owned.filter((i) => i.location).map((i) => i.location!), 8),
    addedByMonth: months,
    recent: [...owned].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 6),
    lent: owned.filter((i) => i.lentTo),
    duplicates: [...titleCounts.values()]
      .filter((t) => t.count > 1)
      .map((t) => ({ label: t.title, count: t.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 12),
  }
}
