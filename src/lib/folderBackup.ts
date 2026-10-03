import { readEnv } from './environment'
import { datedBackupName, datedBackupsToDelete, KEEP_DATED_BACKUPS, LATEST_BACKUP_NAME } from './backup'

// Automatic backups to a folder you choose, using the File System Access API (Chrome, Edge
// and other Chromium browsers; Firefox and Safari don't have it). The folder handle is
// remembered in IndexedDB. After a browser restart the browser may need you to allow access
// again, which can only happen from a click, so the app shows a "Reconnect" button.

// TypeScript's DOM lib doesn't describe these yet.
export interface FileHandleLike {
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>
}
export interface DirHandle {
  name: string
  queryPermission: (o: { mode: 'readwrite' }) => Promise<PermissionState>
  requestPermission: (o: { mode: 'readwrite' }) => Promise<PermissionState>
  getFileHandle: (name: string, o?: { create?: boolean }) => Promise<FileHandleLike>
  values: () => AsyncIterable<{ kind: string; name: string }>
  removeEntry: (name: string) => Promise<void>
}

type PickerWindow = { showDirectoryPicker?: (o: { id: string; mode: 'readwrite' }) => Promise<DirHandle> }

// Browsers refuse the folder picker inside a frame on another site (itch.io's player, for one), so
// there it is treated as unavailable rather than offered and then failing.
export const supportsFolderBackup = (): boolean =>
  typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function' && typeof indexedDB !== 'undefined' && !readEnv().crossOrigin

export const pickFolder = (): Promise<DirHandle> => (window as PickerWindow).showDirectoryPicker!({ id: 'stacks-video-backups', mode: 'readwrite' })

// ---- remembering the folder ----

export interface HandleStore {
  load: () => Promise<DirHandle | null>
  save: (h: DirHandle) => Promise<void>
  clear: () => Promise<void>
}

const DB_NAME = 'shelfkeeper'
const STORE = 'handles'
const KEY = 'backup-folder'

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

async function withStore<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    return await new Promise<T>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export const idbHandleStore: HandleStore = {
  async load() {
    try {
      return ((await withStore('readonly', (s) => s.get(KEY))) as DirHandle | undefined) ?? null
    } catch {
      return null // private mode or blocked storage: behave as "no folder chosen"
    }
  },
  async save(h) {
    await withStore('readwrite', (s) => s.put(h, KEY))
  },
  async clear() {
    await withStore('readwrite', (s) => s.delete(KEY))
  },
}

// ---- permission ----

/** With { ask: true } (only from a click) the browser may show its permission prompt. */
export async function folderPermission(handle: DirHandle, { ask = false } = {}): Promise<PermissionState> {
  const options = { mode: 'readwrite' } as const
  try {
    let state = await handle.queryPermission(options)
    if (state !== 'granted' && ask) state = await handle.requestPermission(options)
    return state
  } catch {
    return 'denied'
  }
}

// ---- writing ----

async function writeFile(dir: DirHandle, name: string, text: string) {
  const file = await dir.getFileHandle(name, { create: true })
  const writable = await file.createWritable()
  try {
    await writable.write(text)
  } finally {
    await writable.close()
  }
}

/** Writes the latest copy plus one copy per day, then trims dated copies past the newest `keep`. */
export async function writeFolderBackup(dir: DirHandle, text: string, { now = new Date(), keep = KEEP_DATED_BACKUPS } = {}) {
  await writeFile(dir, LATEST_BACKUP_NAME, text)
  await writeFile(dir, datedBackupName(now), text)
  const names: string[] = []
  for await (const entry of dir.values()) if (entry.kind === 'file') names.push(entry.name)
  for (const name of datedBackupsToDelete(names, keep)) {
    try {
      await dir.removeEntry(name)
    } catch {
      /* already gone, or not allowed: a stray old copy is harmless */
    }
  }
}
