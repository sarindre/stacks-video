import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AutoBackup } from './autoBackup'
import { ageLabel, datedBackupName, datedBackupsToDelete } from './backup'
import { writeFolderBackup } from './folderBackup'
import { normalizeItem } from './library'
import { fakeDirectory, memoryHandleStore } from '../test/fakeFolder'
import type { Item } from './types'

const items = (n: number): Item[] => Array.from({ length: n }, (_, i) => normalizeItem({ id: `i${i}`, title: `T${i}` })!)
const NOW = new Date(2025, 5, 15, 12)

describe('backup rules', () => {
  it('names dated copies by local day and only deletes our own old ones', () => {
    expect(datedBackupName(NOW)).toBe('stacks-video-backup-2025-06-15.json')
    const names = ['stacks-video-backup.json', 'notes.txt', 'stacks-video-backup-2025-06-01.json', 'stacks-video-backup-2025-06-03.json', 'stacks-video-backup-2025-06-02.json']
    expect(datedBackupsToDelete(names, 2)).toEqual(['stacks-video-backup-2025-06-01.json'])
  })
  it('describes how long ago', () => {
    expect(ageLabel(null)).toBe('never')
    expect(ageLabel(new Date(2025, 5, 15, 1).toISOString(), NOW)).toBe('today')
    expect(ageLabel(new Date(2025, 5, 14).toISOString(), NOW)).toBe('yesterday')
    expect(ageLabel(new Date(2025, 5, 5).toISOString(), NOW)).toBe('10 days ago')
    expect(ageLabel(new Date(2025, 4, 1).toISOString(), NOW)).toBe('6 weeks ago')
  })
})

describe('writeFolderBackup', () => {
  it('writes latest plus a dated copy and keeps only the newest dated ones', async () => {
    const files: Record<string, string> = { 'keep-me.txt': 'x' }
    for (let d = 1; d <= 9; d++) files[`stacks-video-backup-2025-06-0${d}.json`] = 'old'
    const dir = fakeDirectory({ files })
    await writeFolderBackup(dir, '{"a":1}', { now: NOW, keep: 3 })
    expect(dir.store.get('stacks-video-backup.json')).toBe('{"a":1}')
    expect([...dir.store.keys()].filter((k) => k.startsWith('stacks-video-backup-')).sort()).toEqual([
      'stacks-video-backup-2025-06-08.json',
      'stacks-video-backup-2025-06-09.json',
      'stacks-video-backup-2025-06-15.json',
    ])
    expect(dir.store.has('keep-me.txt')).toBe(true)
  })
})

describe('AutoBackup', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const make = (dir = fakeDirectory(), opts: { remembered?: boolean } = {}) => {
    const store = memoryHandleStore(opts.remembered === false ? null : dir)
    const backedUp: string[] = []
    const ab = new AutoBackup({ supported: true, store, pick: async () => dir, onBackedUp: (i) => backedUp.push(i), debounceMs: 1000, now: () => NOW })
    return { ab, dir, store, backedUp }
  }

  it('is unsupported where the browser has no folder API', () => {
    expect(new AutoBackup({ supported: false }).getState().status).toBe('unsupported')
  })

  it('starts off with no folder, and ready with a remembered one', async () => {
    const a = make(fakeDirectory(), { remembered: false })
    await a.ab.init()
    expect(a.ab.getState().status).toBe('off')
    const b = make()
    await b.ab.init()
    expect(b.ab.getState()).toMatchObject({ status: 'ready', folderName: 'Backups' })
  })

  it('waits for the debounce, writes once for a burst of changes, and reports it', async () => {
    const { ab, dir, backedUp } = make()
    await ab.init()
    ab.notifyChange(items(1))
    ab.notifyChange(items(2))
    await vi.advanceTimersByTimeAsync(900)
    expect(dir.calls.writes).toEqual([])
    await vi.advanceTimersByTimeAsync(200)
    expect(dir.calls.writes).toEqual(['stacks-video-backup.json', 'stacks-video-backup-2025-06-15.json'])
    expect(JSON.parse(dir.store.get('stacks-video-backup.json')!).items).toHaveLength(2)
    expect(backedUp).toHaveLength(1)
  })

  it('does not rewrite data it already saved', async () => {
    const { ab, dir } = make()
    await ab.init()
    const data = items(2)
    ab.notifyChange(data)
    await vi.advanceTimersByTimeAsync(1500)
    ab.notifyChange(data)
    await vi.advanceTimersByTimeAsync(1500)
    expect(dir.calls.writes).toHaveLength(2) // one backup = latest + dated
  })

  it('flush writes at once when a change is waiting, and does nothing otherwise', async () => {
    const { ab, dir } = make()
    await ab.init()
    ab.flush()
    expect(dir.calls.writes).toEqual([])
    ab.notifyChange(items(1))
    ab.flush()
    await vi.advanceTimersByTimeAsync(0)
    expect(dir.calls.writes).toHaveLength(2)
  })

  it('never overwrites a backup with an empty library', async () => {
    const { ab, dir } = make(fakeDirectory({ files: { 'stacks-video-backup.json': 'precious' } }))
    await ab.init()
    ab.notifyChange([])
    await vi.advanceTimersByTimeAsync(5000)
    expect(await ab.writeNow()).toBe(false)
    expect(dir.store.get('stacks-video-backup.json')).toBe('precious')
  })

  it('asks to reconnect when the browser forgot access, then resumes', async () => {
    const dir = fakeDirectory({ permission: 'prompt' })
    const { ab } = make(dir)
    await ab.init()
    expect(ab.getState().status).toBe('needs-permission')
    ab.notifyChange(items(1))
    await vi.advanceTimersByTimeAsync(2000)
    expect(dir.calls.writes).toEqual([])
    expect(await ab.reconnect()).toBe(true)
    expect(ab.getState().status).toBe('ready')
    expect(dir.calls.requested).toBe(1)
  })

  it('stays disconnected if access is refused', async () => {
    const dir = fakeDirectory({ permission: 'prompt' })
    dir.grantOnRequest = false
    const { ab } = make(dir)
    await ab.init()
    expect(await ab.reconnect()).toBe(false)
    expect(ab.getState().status).toBe('needs-permission')
  })

  it('choosing a folder remembers it and writes straight away', async () => {
    const { ab, dir, store } = make(fakeDirectory(), { remembered: false })
    await ab.init()
    ab.notifyChange(items(3))
    expect(await ab.choose()).toBe(true)
    expect(store.current).toBe(dir)
    expect(ab.getState()).toMatchObject({ status: 'ready', folderName: 'Backups' })
    expect(dir.calls.writes).toHaveLength(2)
  })

  it('treats cancelling the picker as nothing happening', async () => {
    const store = memoryHandleStore()
    const ab = new AutoBackup({ supported: true, store, pick: async () => Promise.reject(new DOMException('cancelled', 'AbortError')) })
    await ab.init()
    expect(await ab.choose()).toBe(false)
    expect(ab.getState()).toMatchObject({ status: 'off', error: null })
  })

  it('reports a write error without losing the folder', async () => {
    const dir = fakeDirectory()
    const { ab } = make(dir)
    await ab.init()
    dir.getFileHandle = async () => Promise.reject(new Error('disk full'))
    ab.notifyChange(items(1))
    await vi.advanceTimersByTimeAsync(1500)
    expect(ab.getState()).toMatchObject({ status: 'error', error: 'disk full' })
  })

  it('can be turned off, forgetting the folder', async () => {
    const { ab, store } = make()
    await ab.init()
    await ab.disable()
    expect(store.current).toBeNull()
    expect(ab.getState().status).toBe('off')
  })
})
