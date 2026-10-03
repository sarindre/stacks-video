import { readJSON, writeJSON } from './storage'
import { isThemePref } from './theme'
import type { Settings } from './types'

export const SETTINGS_KEY = 'shelfkeeper.settings.v1'

export const DEFAULT_LOAN_DAYS = 30

export const DEFAULT_SETTINGS: Settings = { tmdbToken: '', rawgKey: '', loanDays: DEFAULT_LOAN_DAYS, theme: 'system', lastBackupAt: null }

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const last = typeof r.lastBackupAt === 'string' && !Number.isNaN(new Date(r.lastBackupAt).getTime()) ? r.lastBackupAt : null
  return {
    tmdbToken: typeof r.tmdbToken === 'string' ? r.tmdbToken.trim() : '',
    rawgKey: typeof r.rawgKey === 'string' ? r.rawgKey.trim() : '',
    loanDays: typeof r.loanDays === 'number' && Number.isFinite(r.loanDays) ? Math.min(365, Math.max(0, Math.round(r.loanDays))) : DEFAULT_LOAN_DAYS,
    theme: isThemePref(r.theme) ? r.theme : 'system',
    lastBackupAt: last,
  }
}

/** The lookup keys, in the shape the lookup layer takes. */
export const keysOf = (s: Settings) => ({ tmdb: s.tmdbToken, rawg: s.rawgKey })

export const loadSettings = (): Settings => normalizeSettings(readJSON<unknown>(SETTINGS_KEY, null))
export const saveSettings = (s: Settings): boolean => writeJSON(SETTINGS_KEY, s)

/** Days after which the backup reminder appears (when the library isn't empty). */
export const BACKUP_REMINDER_DAYS = 30

export function backupDue(lastBackupAt: string | null, itemCount: number, now: Date = new Date()): boolean {
  if (itemCount === 0) return false
  if (!lastBackupAt) return true
  const ms = now.getTime() - new Date(lastBackupAt).getTime()
  return ms > BACKUP_REMINDER_DAYS * 86_400_000
}
