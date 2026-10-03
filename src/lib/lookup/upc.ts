import { getJson, LookupError, type Fetcher } from './types'

/**
 * Retail listings name discs like "The Matrix (Blu-ray + Digital) [Widescreen]". Strip the
 * packaging noise so what's left works as a search term.
 */
export function cleanProductTitle(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\((?:[^)]*(?:blu-?ray|dvd|4k|uhd|digital|widescreen|fullscreen|combo|edition|disc|steelbook|region|bd|hd)[^)]*)\)/gi, ' ')
    .replace(/\b(?:blu-?ray|dvd|4k ultra hd|4k uhd|ultra hd|uhd|digital copy|digital hd|combo pack|special edition|widescreen|fullscreen|steelbook)\b/gi, ' ')
    .replace(/[-–—:/,+]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[-–—:/,+\s]+$/g, '')
    .trim()
}

/** Guess the disc format from the product name so the add form can preselect it. */
export function guessFormat(raw: string): 'uhd' | 'bluray' | 'dvd' | null {
  if (/4k|ultra hd|uhd/i.test(raw)) return 'uhd'
  if (/blu-?ray/i.test(raw)) return 'bluray'
  if (/\bdvd\b/i.test(raw)) return 'dvd'
  return null
}

export interface UpcProduct {
  rawTitle: string
  title: string
  format: 'uhd' | 'bluray' | 'dvd' | null
  image?: string
}

export function parseUpc(json: unknown): UpcProduct | null {
  const item = (json as { items?: { title?: string; images?: string[] }[] } | null)?.items?.[0]
  const rawTitle = item?.title?.trim()
  if (!rawTitle) return null
  return { rawTitle, title: cleanProductTitle(rawTitle) || rawTitle, format: guessFormat(rawTitle), image: item?.images?.[0] }
}

/**
 * UPCitemdb's free trial endpoint (about 100 lookups a day, no key). Coverage of older
 * discs is patchy, so a miss is normal and the form falls back to typing the title.
 */
export async function lookupUpc(code: string, fetcher: Fetcher = fetch): Promise<UpcProduct | null> {
  const digits = code.replace(/\D/g, '')
  if (digits.length < 8) throw new LookupError('That does not look like a barcode.', 'rejected')
  const json = await getJson(fetcher, `https://api.upcitemdb.com/prod/trial/lookup?upc=${digits}`)
  return parseUpc(json)
}
