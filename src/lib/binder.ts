import type { Item } from './types'

// A binder is a location whose items have positions like "Page 12 · C": a page number and a
// slot letter (A is the first pocket). This turns those strings into a grid with the empty
// pockets visible, and finds the next free one.

export const MAX_SLOTS = 26
export const SLOT_CHOICES = [4, 6, 8, 9, 12, 16, 18, 20] as const
export const DEFAULT_SLOTS = 8

const POSITION = /^\s*(?:page|pg\.?|p\.?)\s*(\d+)\s*(?:[·\-–—,:/]\s*|\s+)?([A-Za-z])?\s*$/i

export interface Place {
  page: number
  /** Zero-based slot index (A = 0), or null for "Page 12" with no slot. */
  slot: number | null
}

export const slotLabel = (index: number) => String.fromCharCode(65 + index)

export function parsePosition(position: string | undefined): Place | null {
  if (!position) return null
  const m = POSITION.exec(position)
  if (!m) return null
  const page = Number(m[1])
  if (!Number.isInteger(page) || page < 1) return null
  return { page, slot: m[2] ? m[2].toUpperCase().charCodeAt(0) - 65 : null }
}

export const formatPosition = (page: number, slot: number) => `Page ${page} · ${slotLabel(slot)}`

export interface BinderSlot {
  index: number
  label: string
  items: Item[]
}
export interface BinderPage {
  page: number
  slots: BinderSlot[]
}
export interface Binder {
  location: string
  slotsPerPage: number
  pages: BinderPage[]
  /** Items at this location whose position isn't a page and slot (or is outside the grid). */
  unplaced: Item[]
  placed: number
  empty: number
  /** Slots holding more than one item, which usually means a typo. */
  crowded: number
}

/** Locations that look like binders (some item has a page/slot position), most items first. */
export function binderLocations(items: Item[]): string[] {
  const counts = new Map<string, number>()
  for (const i of items) {
    if (i.status !== 'owned' || !i.location) continue
    const place = parsePosition(i.position)
    if (place && place.slot !== null) counts.set(i.location, (counts.get(i.location) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l)
}

/** The smallest slots-per-page that fits every placed item, so a pocket is never silently dropped. */
export function slotsNeeded(items: Item[], location: string): number {
  let max = -1
  for (const i of items) {
    if (i.status !== 'owned' || i.location !== location) continue
    const p = parsePosition(i.position)
    if (p && p.slot !== null && p.slot < MAX_SLOTS) max = Math.max(max, p.slot)
  }
  return max + 1
}

export function buildBinder(items: Item[], location: string, slotsPerPage: number = DEFAULT_SLOTS): Binder {
  const slots = Math.min(MAX_SLOTS, Math.max(1, Math.max(slotsPerPage, slotsNeeded(items, location))))
  const byPage = new Map<number, Item[][]>()
  const unplaced: Item[] = []
  let maxPage = 0
  let placed = 0

  for (const i of items) {
    if (i.status !== 'owned' || i.location !== location) continue
    const p = parsePosition(i.position)
    if (!p || p.slot === null || p.slot >= MAX_SLOTS) {
      unplaced.push(i)
      continue
    }
    let page = byPage.get(p.page)
    if (!page) byPage.set(p.page, (page = Array.from({ length: slots }, () => [])))
    page[p.slot]!.push(i)
    maxPage = Math.max(maxPage, p.page)
    placed++
  }

  const pages: BinderPage[] = []
  let empty = 0
  let crowded = 0
  for (let page = 1; page <= maxPage; page++) {
    const cells = byPage.get(page) ?? Array.from({ length: slots }, () => [])
    pages.push({
      page,
      slots: cells.map((its, index) => {
        if (its.length === 0) empty++
        if (its.length > 1) crowded++
        return { index, label: slotLabel(index), items: its }
      }),
    })
  }
  return { location, slotsPerPage: slots, pages, unplaced, placed, empty, crowded }
}

/** First empty pocket in page order, or the first pocket of a new page after the last. */
export function nextFreeSlot(binder: Binder): { page: number; slot: number } {
  for (const p of binder.pages) {
    const free = p.slots.find((s) => s.items.length === 0)
    if (free) return { page: p.page, slot: free.index }
  }
  return { page: (binder.pages.at(-1)?.page ?? 0) + 1, slot: 0 }
}

/** Number of columns that looks like a real binder page for this many pockets (8 → 2×4, 9 → 3×3). */
export const pageColumns = (slots: number) => (slots >= 9 && slots % 3 === 0 ? 3 : slots >= 16 ? 4 : 2)
