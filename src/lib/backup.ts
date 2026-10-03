import { dayKey, parseDay } from './dates'

// Backup rules that don't touch the browser's file APIs: file names, which old copies to
// delete, and how to describe "last backed up". The folder writing is in folderBackup.ts.

export const LATEST_BACKUP_NAME = 'stacks-video-backup.json'
export const KEEP_DATED_BACKUPS = 7

// Copies made before the rename (shelfkeeper-…) still count, so they are trimmed along with the new ones.
const DATED = /^(?:stacks-video|shelfkeeper)-backup-(\d{4}-\d{2}-\d{2})\.json$/

export const datedBackupName = (date: Date = new Date()) => `stacks-video-backup-${dayKey(date)}.json`

/** Dated copies to delete so only the newest `keep` remain. Files that aren't ours are never touched. */
export function datedBackupsToDelete(names: string[], keep: number = KEEP_DATED_BACKUPS): string[] {
  return names
    .flatMap((name) => {
      const m = DATED.exec(name)
      return m ? [{ name, day: m[1]! }] : []
    })
    .sort((a, b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name))
    .slice(keep)
    .map((x) => x.name)
}

/** "never", "today", "yesterday", "3 days ago", "2 weeks ago"… */
export function ageLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const at = iso ? new Date(iso) : null
  if (!at || Number.isNaN(at.getTime())) return 'never'
  const a = parseDay(dayKey(at))!
  const b = parseDay(dayKey(now))!
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}
