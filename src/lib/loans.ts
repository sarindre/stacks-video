import { daysSince } from './dates'
import type { Item } from './types'

export interface Loan {
  item: Item
  /** Whole days since it was lent; null when no date was recorded. */
  days: number | null
}

/** Everything currently lent out, longest first (undated loans last). */
export function currentLoans(items: Item[], now: Date = new Date()): Loan[] {
  return items
    .filter((i) => i.status === 'owned' && i.lentTo)
    .map((item) => ({ item, days: item.lentAt ? daysSince(item.lentAt, now) : null }))
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1) || a.item.title.localeCompare(b.item.title))
}

/** Loans out for at least `threshold` days. A threshold of 0 turns reminders off. */
export function overdueLoans(items: Item[], threshold: number, now: Date = new Date()): Loan[] {
  if (threshold <= 0) return []
  return currentLoans(items, now).filter((l) => l.days !== null && l.days >= threshold)
}

export function loanLabel(days: number | null): string {
  if (days === null) return 'date not recorded'
  if (days <= 0) return 'today'
  if (days === 1) return '1 day'
  if (days < 60) return `${days} days`
  return `${Math.floor(days / 30)} months`
}
