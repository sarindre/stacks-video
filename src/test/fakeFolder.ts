import type { DirHandle, HandleStore } from '../lib/folderBackup'

/** An in-memory directory like the File System Access API's, for tests. */
export function fakeDirectory({ name = 'Backups', permission = 'granted' as PermissionState, files = {} as Record<string, string> } = {}) {
  const store = new Map(Object.entries(files))
  const calls = { requested: 0, writes: [] as string[] }
  const dir = {
    name,
    store,
    calls,
    permission,
    grantOnRequest: true,
    async queryPermission() {
      return dir.permission
    },
    async requestPermission() {
      calls.requested++
      if (dir.permission === 'prompt') dir.permission = dir.grantOnRequest ? 'granted' : 'denied'
      return dir.permission
    },
    async getFileHandle(fileName: string, { create }: { create?: boolean } = {}) {
      if (dir.permission !== 'granted') throw new DOMException('not allowed', 'NotAllowedError')
      if (!store.has(fileName) && !create) throw new DOMException('missing', 'NotFoundError')
      if (!store.has(fileName)) store.set(fileName, '')
      return {
        async createWritable() {
          let text = ''
          return {
            async write(chunk: string) {
              text += chunk
            },
            async close() {
              store.set(fileName, text)
              calls.writes.push(fileName)
            },
          }
        },
      }
    },
    async *values() {
      for (const n of [...store.keys()]) yield { kind: 'file', name: n }
    },
    async removeEntry(n: string) {
      store.delete(n)
    },
  }
  return dir satisfies DirHandle
}

export function memoryHandleStore(initial: DirHandle | null = null): HandleStore & { current: DirHandle | null } {
  const s = {
    current: initial,
    async load() {
      return s.current
    },
    async save(h: DirHandle) {
      s.current = h
    },
    async clear() {
      s.current = null
    },
  }
  return s
}
