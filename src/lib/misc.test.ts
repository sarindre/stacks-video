import { describe, expect, it } from 'vitest'
import { parseFormat } from './catalog'
import { dayKey, daysSince, parseDay } from './dates'
import { backupDue, normalizeSettings } from './settings'

describe('dates', () => {
  it('reads a day in local time, not UTC', () => {
    const d = parseDay('2024-03-02')!
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2024, 2, 2])
    expect(dayKey(d)).toBe('2024-03-02')
  })
  it('rejects impossible days', () => {
    expect(parseDay('2024-02-31')).toBeNull()
    expect(parseDay('March 2')).toBeNull()
  })
  it('counts whole days', () => {
    expect(daysSince('2024-03-01', new Date(2024, 2, 11, 23, 59))).toBe(10)
  })
})

describe('settings', () => {
  it('survives garbage', () => {
    expect(normalizeSettings(null)).toEqual({ tmdbToken: '', rawgKey: '', loanDays: 30, theme: 'system', lastBackupAt: null })
    expect(normalizeSettings({ tmdbToken: ' abc ', rawgKey: ' k ', lastBackupAt: 'nope' })).toEqual({ tmdbToken: 'abc', rawgKey: 'k', loanDays: 30, theme: 'system', lastBackupAt: null })
  })
  it('only accepts known themes', () => {
    expect(normalizeSettings({ theme: 'light' }).theme).toBe('light')
    expect(normalizeSettings({ theme: 'sepia' }).theme).toBe('system')
  })
  it('keeps the loan reminder within range, and allows turning it off', () => {
    expect(normalizeSettings({ loanDays: 0 }).loanDays).toBe(0)
    expect(normalizeSettings({ loanDays: 9999 }).loanDays).toBe(365)
    expect(normalizeSettings({ loanDays: -5 }).loanDays).toBe(0)
    expect(normalizeSettings({ loanDays: 'x' }).loanDays).toBe(30)
  })
  it('reminds about backups only when there is something to lose', () => {
    const now = new Date('2025-06-30T12:00:00Z')
    expect(backupDue(null, 0, now)).toBe(false)
    expect(backupDue(null, 3, now)).toBe(true)
    expect(backupDue('2025-06-20T12:00:00Z', 3, now)).toBe(false)
    expect(backupDue('2025-05-01T12:00:00Z', 3, now)).toBe(true)
  })
})

describe('formats', () => {
  it('is strict about what belongs to a category', () => {
    expect(parseFormat('movie', 'vinyl')).toBeNull()
    expect(parseFormat('music', 'Vinyl')).toBe('vinyl')
    expect(parseFormat('book', 'Kindle')).toBe('ebook')
  })
})
