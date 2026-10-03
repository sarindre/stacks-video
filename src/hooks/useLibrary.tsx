import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { emptyHistory, peekHistory, popHistory, pushHistory, type History } from '../lib/history'
import { buildExport, LIBRARY_KEY, LIBRARY_VERSION, mergeLibraries, parseStoredLibrary, type ImportPlan } from '../lib/library'
import { loadSettings, saveSettings } from '../lib/settings'
import { readJSON, removeKey, writeJSON } from '../lib/storage'
import type { Item, LibraryFile, Settings } from '../lib/types'

export interface Toast {
  id: number
  label: string
}

interface LibraryApi {
  items: Item[]
  settings: Settings
  /** True when the browser refused to save (storage full or blocked). */
  saveFailed: boolean
  addItem: (item: Item) => void
  addMany: (items: Item[], label?: string) => void
  updateItem: (id: string, patch: Partial<Item>) => void
  removeItem: (id: string) => void
  removeMany: (ids: ReadonlySet<string>) => void
  /** Applies many field patches at once (one save), keyed by item id. */
  updateMany: (patches: Record<string, Partial<Item>>, label?: string) => void
  planImport: (incoming: Item[]) => ImportPlan
  applyImport: (plan: ImportPlan) => void
  clearAll: () => void
  updateSettings: (patch: Partial<Settings>) => void
  /** Builds the export file and records that a backup was just made. */
  exportFile: () => LibraryFile
  /** What Undo would undo ("Deleted 3 items"), or null when there is nothing to undo. */
  undoLabel: string | null
  undo: () => void
  /** The latest notable change (a delete, bulk edit, import…), for the "Undo" toast. */
  toast: Toast | null
  dismissToast: () => void
}

const Ctx = createContext<LibraryApi | null>(null)

const load = (): Item[] => parseStoredLibrary(readJSON<unknown>(LIBRARY_KEY, null))
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>(load)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [saveFailed, setSaveFailed] = useState(false)
  const [history, setHistory] = useState<History<Item[]>>(emptyHistory)
  const [toast, setToast] = useState<Toast | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const skipFirstSave = useRef(true)
  const toastSeq = useRef(0)

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false
      return
    }
    setSaveFailed(!writeJSON(LIBRARY_KEY, { version: LIBRARY_VERSION, items }))
  }, [items])

  // Ask the browser not to evict our storage under pressure; harmless if refused.
  useEffect(() => {
    if (items.length > 0) void navigator.storage?.persist?.().catch(() => undefined)
  }, [items.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // Another tab changed the library: pick it up instead of overwriting it later. Snapshots
  // from before that change would be stale, so undo starts over.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LIBRARY_KEY) {
        skipFirstSave.current = true
        setItems(load())
        setHistory(emptyHistory())
        setToast(null)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /**
   * Every change to the library goes through here so it can be undone. `next` gets the
   * current items and returns the new ones (return the same array for "nothing changed").
   * A `notable` change also shows the "Undo" toast.
   */
  const commit = useCallback((label: string, notable: boolean, next: (cur: Item[]) => Item[]) => {
    const before = itemsRef.current
    const after = next(before)
    if (after === before) return
    itemsRef.current = after // so two changes in one event see each other
    setItems(after)
    setHistory((h) => pushHistory(h, label, before))
    if (notable) setToast({ id: ++toastSeq.current, label })
  }, [])

  const addItem = useCallback((item: Item) => commit(`Added “${item.title}”`, false, (cur) => [item, ...cur]), [commit])
  const addMany = useCallback((added: Item[], label?: string) => commit(label ?? `Added ${plural(added.length, 'item')}`, true, (cur) => (added.length ? [...added, ...cur] : cur)), [commit])
  const updateItem = useCallback(
    (id: string, patch: Partial<Item>) => {
      const title = itemsRef.current.find((i) => i.id === id)?.title ?? 'item'
      commit(`Edited “${title}”`, false, (cur) => cur.map((i) => (i.id === id ? { ...i, ...patch, id: i.id, updatedAt: new Date().toISOString() } : i)))
    },
    [commit],
  )
  const updateMany = useCallback(
    (patches: Record<string, Partial<Item>>, label?: string) => {
      const ids = Object.keys(patches)
      if (!ids.length) return
      const now = new Date().toISOString()
      commit(label ?? `Edited ${plural(ids.length, 'item')}`, true, (cur) => cur.map((i) => (patches[i.id] ? { ...i, ...patches[i.id], id: i.id, updatedAt: now } : i)))
    },
    [commit],
  )
  const removeItem = useCallback(
    (id: string) => {
      const title = itemsRef.current.find((i) => i.id === id)?.title ?? 'item'
      commit(`Deleted “${title}”`, true, (cur) => cur.filter((i) => i.id !== id))
    },
    [commit],
  )
  const removeMany = useCallback((ids: ReadonlySet<string>) => commit(`Deleted ${plural(ids.size, 'item')}`, true, (cur) => cur.filter((i) => !ids.has(i.id))), [commit])
  const planImport = useCallback((incoming: Item[]) => mergeLibraries(itemsRef.current, incoming), [])
  const applyImport = useCallback((plan: ImportPlan) => commit(`Imported ${plural(plan.added + plan.updated, 'item')}`, true, () => plan.merged), [commit])
  const clearAll = useCallback(() => {
    if (itemsRef.current.length === 0) return
    skipFirstSave.current = true // clearing removes the stored copy itself, rather than saving an empty one
    removeKey(LIBRARY_KEY)
    commit('Deleted the whole collection', true, () => [])
  }, [commit])

  const undo = useCallback(() => {
    const { history: rest, entry } = popHistory(history)
    if (!entry) return
    itemsRef.current = entry.before
    setItems(entry.before)
    setHistory(rest)
    setToast(null)
  }, [history])

  const dismissToast = useCallback(() => setToast(null), [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((cur) => {
      const next = { ...cur, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  const exportFile = useCallback(() => {
    updateSettings({ lastBackupAt: new Date().toISOString() })
    return buildExport(itemsRef.current)
  }, [updateSettings])

  const undoLabel = peekHistory(history)?.label ?? null

  const value = useMemo<LibraryApi>(
    () => ({
      items, settings, saveFailed, addItem, addMany, updateItem, updateMany, removeItem, removeMany, planImport, applyImport, clearAll,
      updateSettings, exportFile, undoLabel, undo, toast, dismissToast,
    }),
    [items, settings, saveFailed, addItem, addMany, updateItem, updateMany, removeItem, removeMany, planImport, applyImport, clearAll, updateSettings, exportFile, undoLabel, undo, toast, dismissToast],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLibrary(): LibraryApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLibrary must be used inside <LibraryProvider>')
  return v
}
