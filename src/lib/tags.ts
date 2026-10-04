import type { Item } from './types'

// The person's own tags and the suggested ones are stored apart (`tags` and `autoTags`) so suggestions
// can be refreshed, replaced or removed without ever touching what the person typed. Everywhere that
// searches, filters or counts tags uses `allTags`.

export const allTags = (i: Pick<Item, 'tags' | 'autoTags'>): string[] => [...new Set([...i.tags, ...(i.autoTags ?? [])])]

/** Dismiss a suggestion: it disappears and is remembered, so a later refresh doesn't bring it back. */
export function dismissSuggestion(item: Pick<Item, 'autoTags' | 'removedTags'>, tag: string): Partial<Item> {
  return { autoTags: (item.autoTags ?? []).filter((t) => t !== tag), removedTags: [...new Set([...(item.removedTags ?? []), tag])] }
}

/** Keep a suggestion: it becomes one of the person's own tags, so it is never changed or dropped by a refresh. */
export function keepSuggestion(item: Pick<Item, 'tags' | 'autoTags'>, tag: string): Partial<Item> {
  return { tags: [...new Set([...item.tags, tag])], autoTags: (item.autoTags ?? []).filter((t) => t !== tag) }
}
