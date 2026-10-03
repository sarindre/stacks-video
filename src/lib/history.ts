// A small undo stack of whole-library snapshots. Snapshots are cheap because the library is
// never mutated in place (every change makes a new array), so each entry just keeps a reference.
// Every change is recorded, not only the big ones: undoing an old delete after an unrecorded
// edit would silently throw that edit away.

export interface HistoryEntry<T> {
  id: number
  /** What the change did, written for a person: "Deleted 3 items". */
  label: string
  /** The library as it was before the change. */
  before: T
}

export interface History<T> {
  entries: HistoryEntry<T>[]
  nextId: number
}

export const MAX_HISTORY = 30

export const emptyHistory = <T>(): History<T> => ({ entries: [], nextId: 1 })

export function pushHistory<T>(h: History<T>, label: string, before: T, max: number = MAX_HISTORY): History<T> {
  const entries = [...h.entries, { id: h.nextId, label, before }]
  return { entries: entries.slice(-max), nextId: h.nextId + 1 }
}

export function popHistory<T>(h: History<T>): { history: History<T>; entry: HistoryEntry<T> | null } {
  const entry = h.entries.at(-1) ?? null
  return { history: entry ? { entries: h.entries.slice(0, -1), nextId: h.nextId } : h, entry }
}

export const peekHistory = <T>(h: History<T>): HistoryEntry<T> | null => h.entries.at(-1) ?? null
