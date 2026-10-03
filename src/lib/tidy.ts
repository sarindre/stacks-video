import { normalizeTags } from './library'
import type { Item } from './types'

// Housekeeping for the free-text fields that drift over time: "Sci-Fi" vs "Sci Fi", a binder
// renamed, two spellings of a series. Rename merges into an existing value when the new name
// already exists, and every change is returned as patches so it applies in one save.

export type TidyField = 'genre' | 'location' | 'series' | 'tags'

export interface ValueRow {
  value: string
  count: number
  /** Other spellings that look like the same thing (differ only by case, spacing or punctuation). */
  similar: string[]
}

const key = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '')

const valuesOf = (i: Item, field: TidyField): string[] => (field === 'tags' ? i.tags : i[field] ? [i[field] as string] : [])

export function listValues(items: Item[], field: TidyField): ValueRow[] {
  const counts = new Map<string, number>()
  for (const i of items) for (const v of valuesOf(i, field)) counts.set(v, (counts.get(v) ?? 0) + 1)
  const byKey = new Map<string, string[]>()
  for (const v of counts.keys()) {
    const k = key(v)
    if (!k) continue
    const list = byKey.get(k)
    if (list) list.push(v)
    else byKey.set(k, [v])
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, similar: (byKey.get(key(value)) ?? []).filter((v) => v !== value) }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, undefined, { sensitivity: 'base' }))
}

const clean = (field: TidyField, v: string): string => (field === 'tags' ? (normalizeTags([v])[0] ?? '') : v.trim())

export interface TidyResult {
  patches: Record<string, Partial<Item>>
  changed: number
}

/** Renames `from` to `to` on every item. An empty `to` removes the value. */
export function renameValue(items: Item[], field: TidyField, from: string, to: string): TidyResult {
  const target = clean(field, to)
  const patches: Record<string, Partial<Item>> = {}
  for (const i of items) {
    if (field === 'tags') {
      if (!i.tags.includes(from)) continue
      const tags = [...new Set(i.tags.map((t) => (t === from ? target : t)).filter(Boolean))]
      patches[i.id] = { tags }
    } else if (i[field] === from) {
      patches[i.id] = { [field]: target || undefined }
    }
  }
  return { patches, changed: Object.keys(patches).length }
}

export const removeValue = (items: Item[], field: TidyField, value: string): TidyResult => renameValue(items, field, value, '')

/** Whether renaming to `to` would merge into a value that already exists (so the UI can say so). */
export const wouldMerge = (items: Item[], field: TidyField, from: string, to: string): boolean => {
  const target = clean(field, to)
  return !!target && target !== from && listValues(items, field).some((r) => r.value === target)
}
