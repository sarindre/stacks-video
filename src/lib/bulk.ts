import { normalizeTags } from './library'
import type { Condition, Item, Priority, Status } from './types'

/**
 * What to change on many items at once. A missing key leaves the field alone;
 * `null` clears it (for text fields and condition); tags are added and removed, never replaced.
 */
export interface BulkChanges {
  status?: Status
  format?: string
  condition?: Condition | null
  location?: string | null
  genre?: string | null
  series?: string | null
  finished?: boolean
  favorite?: boolean
  priority?: Priority | null
  addTags?: string[]
  removeTags?: string[]
}

export interface BulkResult {
  patches: Record<string, Partial<Item>>
  /** Items that actually change. */
  changed: number
  /** Items left alone because the chosen format doesn't exist for their type (a vinyl format on a DVD). */
  formatSkipped: number
}

const TEXT_FIELDS = ['location', 'genre', 'series', 'condition'] as const

export function applyBulk(items: Item[], ids: ReadonlySet<string>, changes: BulkChanges, formatsFor: (item: Item) => string[]): BulkResult {
  const patches: Record<string, Partial<Item>> = {}
  let formatSkipped = 0
  const add = normalizeTags(changes.addTags ?? [])
  const remove = new Set(normalizeTags(changes.removeTags ?? []))

  for (const item of items) {
    if (!ids.has(item.id)) continue
    const patch: Partial<Item> = {}
    const set = <K extends keyof Item>(key: K, value: Item[K]) => {
      if (item[key] !== value) patch[key] = value
    }

    if (changes.status !== undefined) set('status', changes.status)
    if (changes.finished !== undefined) set('finished', changes.finished)
    if (changes.favorite !== undefined) set('favorite', changes.favorite)
    if (changes.priority !== undefined) set('priority', changes.priority ?? undefined)
    if (changes.format !== undefined) {
      if (formatsFor(item).includes(changes.format)) set('format', changes.format)
      else formatSkipped++
    }
    for (const f of TEXT_FIELDS) {
      const v = changes[f]
      if (v === undefined) continue
      const next = v === null || (typeof v === 'string' && v.trim() === '') ? undefined : typeof v === 'string' ? v.trim() : v
      set(f, next as never)
    }
    if (add.length || remove.size) {
      const tags = [...new Set([...item.tags, ...add])].filter((t) => !remove.has(t))
      if (tags.length !== item.tags.length || tags.some((t, n) => t !== item.tags[n])) patch.tags = tags
    }
    if (Object.keys(patch).length) patches[item.id] = patch
  }
  return { patches, changed: Object.keys(patches).length, formatSkipped }
}
