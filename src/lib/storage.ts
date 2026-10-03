// NOTE: stored keys keep their original "shelfkeeper." prefix (and the IndexedDB name stays "shelfkeeper")
// on purpose. The app was renamed, but renaming keys would orphan everyone's saved collection.

// Thin, failure-tolerant wrapper around localStorage. It can throw (private mode, blocked
// site data, quota exceeded), so every access goes through here.

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

/** Returns true when the value was persisted, false if the browser refused it. */
export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* nothing to do */
  }
}
