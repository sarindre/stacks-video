import { buildExport } from './library'
import type { Item } from './types'
import { folderPermission, idbHandleStore, pickFolder, supportsFolderBackup, writeFolderBackup, type DirHandle, type HandleStore } from './folderBackup'

export type BackupStatus = 'unsupported' | 'loading' | 'off' | 'needs-permission' | 'ready' | 'error'

export interface BackupState {
  status: BackupStatus
  folderName: string
  error: string | null
  busy: boolean
}

export interface Deps {
  supported: boolean
  store: HandleStore
  pick: () => Promise<DirHandle>
  /** Called after every successful write, so "last backup" can be remembered. */
  onBackedUp: (iso: string) => void
  debounceMs: number
  now: () => Date
}

const DEFAULT_DEPS: Deps = {
  supported: supportsFolderBackup(),
  store: idbHandleStore,
  pick: pickFolder,
  onBackedUp: () => undefined,
  debounceMs: 4000,
  now: () => new Date(),
}

/**
 * Keeps a folder backup up to date. Plain class (no React) so the timing and permission
 * handling can be tested; useAutoBackup wraps it. `notifyChange(items)` is called whenever
 * the library changes; a write happens `debounceMs` later, or right away on `flush()`.
 */
export class AutoBackup {
  private deps: Deps
  private state: BackupState
  private listeners = new Set<() => void>()
  private dir: DirHandle | null = null
  private items: Item[] = []
  private saved: Item[] | null = null // what was last written, so unchanged data isn't rewritten
  private timer: ReturnType<typeof setTimeout> | null = null
  private initToken = 0

  constructor(deps: Partial<Deps> = {}) {
    this.deps = { ...DEFAULT_DEPS, ...deps }
    this.state = { status: this.deps.supported ? 'loading' : 'unsupported', folderName: '', error: null, busy: false }
  }

  setOnBackedUp(fn: (iso: string) => void) {
    this.deps.onBackedUp = fn
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }
  getState = () => this.state

  private set(patch: Partial<BackupState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  /** Picks up a folder chosen on an earlier visit. */
  async init() {
    if (!this.deps.supported) return
    const token = ++this.initToken
    const dir = await this.deps.store.load()
    if (token !== this.initToken) return
    if (!dir) return this.set({ status: 'off' })
    this.dir = dir
    if ((await folderPermission(dir)) === 'granted') {
      this.saved = this.items // assume the folder is current; the next change writes
      this.set({ status: 'ready', folderName: dir.name })
    } else this.set({ status: 'needs-permission', folderName: dir.name })
  }

  dispose() {
    this.initToken++
    this.cancelTimer()
  }

  notifyChange(items: Item[]) {
    this.items = items
    if (this.state.status !== 'ready' || this.saved === items || items.length === 0) return
    this.cancelTimer()
    this.timer = setTimeout(() => void this.writeNow(), this.deps.debounceMs)
  }

  /** Writes immediately if a change is waiting (used when the tab is about to be hidden). */
  flush() {
    if (this.timer) void this.writeNow()
  }

  private cancelTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  async writeNow(): Promise<boolean> {
    const dir = this.dir
    if (!dir) return false
    this.cancelTimer()
    const snapshot = this.items
    // Never overwrite a backup with nothing: a fresh browser pointed at an existing backup
    // folder, or "delete everything", must not wipe the copies that could restore it.
    if (snapshot.length === 0) return false
    this.set({ busy: true })
    try {
      await writeFolderBackup(dir, JSON.stringify(buildExport(snapshot), null, 2), { now: this.deps.now() })
      this.saved = snapshot
      this.deps.onBackedUp(this.deps.now().toISOString())
      this.set({ status: 'ready', error: null, busy: false })
      // The library changed while we were writing: queue another pass.
      if (this.items !== snapshot) this.notifyChange(this.items)
      return true
    } catch (err) {
      if ((await folderPermission(dir)) !== 'granted') this.set({ status: 'needs-permission', busy: false })
      else this.set({ status: 'error', error: err instanceof Error && err.message ? err.message : "The backup folder couldn't be written to.", busy: false })
      return false
    }
  }

  /** Must be called from a click: opens the browser's folder picker. */
  async choose(): Promise<boolean> {
    let dir: DirHandle
    try {
      dir = await this.deps.pick()
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') this.set({ error: (err as Error)?.message || "Couldn't open the folder picker." })
      return false // cancelled
    }
    if ((await folderPermission(dir, { ask: true })) !== 'granted') {
      this.set({ error: 'Stacks Video needs permission to write to that folder.' })
      return false
    }
    await this.deps.store.save(dir)
    this.dir = dir
    this.set({ folderName: dir.name, error: null, status: 'ready' })
    return this.writeNow()
  }

  /** Must be called from a click: re-asks the browser for access to the remembered folder. */
  async reconnect(): Promise<boolean> {
    const dir = this.dir
    if (!dir) return false
    if ((await folderPermission(dir, { ask: true })) !== 'granted') return false
    this.set({ status: 'ready' })
    return this.writeNow()
  }

  async disable() {
    this.cancelTimer()
    this.dir = null
    this.saved = null
    await this.deps.store.clear().catch(() => undefined)
    this.set({ folderName: '', error: null, status: 'off' })
  }
}
