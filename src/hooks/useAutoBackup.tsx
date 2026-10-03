import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AutoBackup, type BackupState } from '../lib/autoBackup'
import { useLibrary } from './useLibrary'

interface AutoBackupApi extends BackupState {
  supported: boolean
  /** True while backups are actually being kept up to date. */
  active: boolean
  choose: () => Promise<boolean>
  reconnect: () => Promise<boolean>
  disable: () => Promise<void>
  backupNow: () => Promise<boolean>
}

const Ctx = createContext<AutoBackupApi | null>(null)

/** Must sit inside <LibraryProvider>. Writes a folder backup a few seconds after every change. */
export function AutoBackupProvider({ children }: { children: ReactNode }) {
  const { items, updateSettings } = useLibrary()
  const [ab] = useState(() => new AutoBackup())
  const state = useSyncExternalStore(ab.subscribe, ab.getState)

  useEffect(() => {
    ab.setOnBackedUp((iso) => updateSettings({ lastBackupAt: iso }))
  }, [ab, updateSettings])

  useEffect(() => {
    ab.notifyChange(items)
  }, [ab, items])

  useEffect(() => {
    void ab.init()
    const flush = () => document.visibilityState === 'hidden' && ab.flush()
    document.addEventListener('visibilitychange', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      ab.dispose()
    }
  }, [ab])

  const value: AutoBackupApi = {
    ...state,
    supported: state.status !== 'unsupported',
    active: state.status === 'ready',
    choose: () => ab.choose(),
    reconnect: () => ab.reconnect(),
    disable: () => ab.disable(),
    backupNow: () => ab.writeNow(),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAutoBackup(): AutoBackupApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAutoBackup must be used inside <AutoBackupProvider>')
  return v
}
