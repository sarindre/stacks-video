// A "day" is a local YYYY-MM-DD. Never pass one to `new Date(...)`: that reads it as UTC,
// which is the previous evening west of UTC. Use parseDay / dayKey instead.

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDay(s: string): Date | null {
  const m = DAY.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return dayKey(d) === s ? d : null
}

export const isDay = (s: unknown): s is string => typeof s === 'string' && parseDay(s) !== null

export function daysSince(s: string, now: Date = new Date()): number | null {
  const d = parseDay(s)
  if (!d) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today.getTime() - d.getTime()) / 86_400_000)
}

export function formatDay(s: string): string {
  const d = parseDay(s)
  return d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : s
}
