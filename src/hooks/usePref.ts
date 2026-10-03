import { useCallback, useState } from 'react'
import { readJSON, writeJSON } from '../lib/storage'

const PREFS_KEY = 'shelfkeeper.prefs.v1'

/** A UI preference (view mode, sort...) kept in one shared object in localStorage. */
export function usePref<T extends string>(name: string, fallback: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const stored = readJSON<Record<string, unknown>>(PREFS_KEY, {})[name]
    return typeof stored === 'string' && (!allowed || (allowed as readonly string[]).includes(stored)) ? (stored as T) : fallback
  })
  const set = useCallback(
    (v: T) => {
      setValue(v)
      writeJSON(PREFS_KEY, { ...readJSON<Record<string, unknown>>(PREFS_KEY, {}), [name]: v })
    },
    [name],
  )
  return [value, set]
}
