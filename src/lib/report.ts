import { CONDITIONS, formatLabel } from './catalog'
import { price } from './format'
import { sortAndGroup, type GroupKey } from './filters'
import type { Item, Status } from './types'

// Content for the printable shelf list (insurance, selling, a paper backup). Pure: the dialog
// renders it and the browser prints or saves it as a PDF.

export type ReportColumn = 'title' | 'year' | 'format' | 'where' | 'condition' | 'paid' | 'worth' | 'target' | 'notes'

export const COLUMN_LABEL: Record<ReportColumn, string> = {
  title: 'Title',
  year: 'Year',
  format: 'Format',
  where: 'Location',
  condition: 'Condition',
  paid: 'Paid',
  worth: 'Worth today',
  target: 'Target price',
  notes: 'Notes',
}

/** Columns that make sense for each list. */
export const COLUMNS_FOR: Record<Status, ReportColumn[]> = {
  owned: ['title', 'year', 'format', 'where', 'condition', 'paid', 'worth', 'notes'],
  wishlist: ['title', 'year', 'format', 'target', 'notes'],
}

export const DEFAULT_COLUMNS: Record<Status, ReportColumn[]> = {
  owned: ['title', 'year', 'format', 'where'],
  wishlist: ['title', 'year', 'format', 'target'],
}

export interface ReportOptions {
  status: Status
  group: GroupKey
  columns: ReportColumn[]
  title: string
}

export interface ReportSection {
  heading: string
  rows: string[][]
  count: number
  paid: number
  worth: number
}

export interface Report {
  title: string
  generated: string
  headers: string[]
  numeric: boolean[]
  sections: ReportSection[]
  totals: { count: number; paid: number; paidCount: number; worth: number; worthCount: number; target: number }
  showTotals: boolean
}

const NUMERIC = new Set<ReportColumn>(['year', 'paid', 'worth', 'target'])

function cell(i: Item, col: ReportColumn, group: ReportOptions['group']): string {
  switch (col) {
    case 'title':
      return i.edition ? `${i.title} (${i.edition})` : i.title
    case 'year':
      return i.year ? String(i.year) : ''
    case 'format':
      return formatLabel(i.category, i.format)
    case 'where':
      // Under a location heading the location is already said once; just give the spot.
      return (group === 'location' ? [i.position] : [i.location, i.position]).filter(Boolean).join(' · ')
    case 'condition':
      return i.condition ? CONDITIONS[i.condition] : ''
    case 'paid':
      return i.price !== undefined ? price(i.price) : ''
    case 'worth':
      return i.currentValue !== undefined ? price(i.currentValue) : ''
    case 'target':
      return i.targetPrice !== undefined ? price(i.targetPrice) : ''
    case 'notes':
      return (i.notes ?? '').replace(/\s+/g, ' ').trim()
  }
}

export function buildReport(items: Item[], opts: ReportOptions, now: Date = new Date()): Report {
  const columns = opts.columns.length ? opts.columns : (['title'] as ReportColumn[])
  const list = items.filter((i) => i.status === opts.status)
  // Grouping by location keeps binder pages in order; everything else is alphabetical.
  const groups = sortAndGroup(list, opts.group === 'location' ? 'location' : 'title', opts.group)

  const sections: ReportSection[] = groups.map((g) => ({
    heading: g.label,
    rows: g.items.map((i) => columns.map((c) => cell(i, c, opts.group))),
    count: g.items.length,
    paid: g.items.reduce((n, i) => n + (i.price ?? 0), 0),
    worth: g.items.reduce((n, i) => n + (i.currentValue ?? 0), 0),
  }))

  const priced = list.filter((i) => i.price !== undefined)
  const valued = list.filter((i) => i.currentValue !== undefined)
  return {
    title: opts.title.trim() || (opts.status === 'owned' ? 'My collection' : 'My wishlist'),
    generated: now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    headers: columns.map((c) => COLUMN_LABEL[c]),
    numeric: columns.map((c) => NUMERIC.has(c)),
    sections,
    totals: {
      count: list.length,
      paid: priced.reduce((n, i) => n + (i.price ?? 0), 0),
      paidCount: priced.length,
      worth: valued.reduce((n, i) => n + (i.currentValue ?? 0), 0),
      worthCount: valued.length,
      target: list.reduce((n, i) => n + (i.targetPrice ?? 0), 0),
    },
    showTotals: columns.includes('paid') || columns.includes('worth') || columns.includes('target'),
  }
}

