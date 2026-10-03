import { normTitle, splitYear, STOP, words } from './text'
import type { Category, Item } from './types'

export type Verdict = 'owned' | 'other-format' | 'wishlist' | 'not-owned'

export interface CheckOptions {
  category?: Category | 'all'
  /** A format hint (from a barcode listing): owning it, but not in this format, is its own answer. */
  format?: string
  year?: number
  /** Digits from a barcode. Matches items that stored the same code. */
  barcode?: string
}

export interface CheckResult {
  verdict: Verdict | null
  /** Same product title you own (any format). */
  exact: Item[]
  /** Different titles that share the words typed ("Aliens" for "Alien"). Never part of the verdict. */
  similar: Item[]
  wishlist: Item[]
  /** The format asked about, when you own the title but not in that format. */
  missingFormat?: string
}

/** UPC-A (12) and EAN-13 (13, leading 0) are the same code; compare without leading zeros. */
const code = (s: string | undefined) => (s ?? '').replace(/\D/g, '').replace(/^0+/, '')

const byTitle = (a: Item, b: Item) => normTitle(a.title).localeCompare(normTitle(b.title)) || a.format.localeCompare(b.format)

/** Every typed word is a word of the title, or starts one (so "alien" finds "Aliens", "hang" finds "Hangover"). */
const matchesWords = (i: Item, need: string[]) => {
  const have = words(i.title)
  return need.every((w) => have.some((h) => h === w || (w.length >= 3 && h.startsWith(w))))
}

const EMPTY: CheckResult = { verdict: null, exact: [], similar: [], wishlist: [] }

export function checkOwned(items: Item[], query: string, opts: CheckOptions = {}): CheckResult {
  const bc = code(opts.barcode)
  const parsed = splitYear(query)
  const want = normTitle(parsed.title)
  const year = opts.year ?? parsed.year
  if (!want && !bc) return EMPTY

  const inScope = items.filter((i) => !opts.category || opts.category === 'all' || i.category === opts.category)
  const yearOk = (i: Item) => year === undefined || i.year === undefined || Math.abs(i.year - year) <= 1
  const needWords = words(parsed.title).filter((w) => !STOP.has(w))

  const exactOf = (status: Item['status']) =>
    inScope.filter((i) => i.status === status && ((bc && code(i.barcode) === bc) || (want && normTitle(i.title) === want && yearOk(i))))
  const exact = exactOf('owned').sort(byTitle)
  const wishlist = exactOf('wishlist').sort(byTitle)
  const exactIds = new Set(exact.map((i) => i.id))

  const similar =
    needWords.length === 0
      ? []
      : inScope
          .filter((i) => i.status === 'owned' && !exactIds.has(i.id) && matchesWords(i, needWords))
          .sort(byTitle)
          .slice(0, 12)

  let verdict: Verdict
  let missingFormat: string | undefined
  if (exact.length) {
    if (opts.format && !exact.some((i) => i.format === opts.format)) {
      verdict = 'other-format'
      missingFormat = opts.format
    } else verdict = 'owned'
  } else if (wishlist.length) verdict = 'wishlist'
  else verdict = 'not-owned'

  return { verdict, exact, similar, wishlist, missingFormat }
}

/** Whether what was typed is a barcode (8 to 14 digits). */
export const looksLikeBarcode = (q: string) => /^\d{8,14}$/.test(q.replace(/[\s-]/g, ''))

/** ISBNs start 978/979; anything else defaults to a film or TV disc. */
export function guessBarcodeCategory(digits: string, chosen: Category | 'all'): Category {
  if (chosen !== 'all') return chosen
  return /^97[89]/.test(digits) ? 'book' : 'movie'
}
