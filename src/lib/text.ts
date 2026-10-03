// Shared title normalising, so matching behaves the same in cover lookup and the
// "do I own this?" check: case, accents, punctuation and a leading "the/a/an" don't matter.

export const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'in', 'on', 's'])

export const words = (s: string): string[] =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

/** "The Hangover" -> "hangover"; "Crime & Punishment" -> "crime and punishment". */
export const normTitle = (s: string): string => words(s).filter((w, n) => !(n === 0 && STOP.has(w))).join(' ')

/** "It (2017)" -> { title: "It", year: 2017 }. */
export function splitYear(raw: string): { title: string; year?: number } {
  const m = /^(.*?)\s*\((\d{4})\)\s*$/.exec(raw.trim())
  return m && m[1] ? { title: m[1].trim(), year: Number(m[2]) } : { title: raw.trim() }
}
