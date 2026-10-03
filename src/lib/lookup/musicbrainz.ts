import { getJson, yearOf, type Fetcher, type LookupResult } from './types'

interface MbRelease {
  id?: string
  title?: string
  date?: string
  barcode?: string
  'artist-credit'?: { name?: string; artist?: { name?: string } }[]
}

export function parseMusicBrainz(json: unknown, barcode?: string): LookupResult[] {
  const releases = (json as { releases?: MbRelease[] } | null)?.releases
  if (!Array.isArray(releases)) return []
  const seen = new Set<string>()
  const out: LookupResult[] = []
  for (const r of releases) {
    const title = r.title?.trim()
    if (!title || !r.id) continue
    const artist = r['artist-credit']?.[0]?.name ?? r['artist-credit']?.[0]?.artist?.name
    // The same album is released many times (regions, reissues); show it once.
    const dedupe = `${title.toLowerCase()}|${(artist ?? '').toLowerCase()}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    out.push({
      title,
      category: 'music',
      year: yearOf(r.date),
      creator: artist,
      posterUrl: `https://coverartarchive.org/release/${r.id}/front-250`,
      barcode: barcode ?? r.barcode,
      ext: { mbid: r.id },
    })
  }
  return out
}

const luceneEscape = (s: string) => s.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1')

/** MusicBrainz needs no key. Digits-only input of UPC/EAN length is searched as a barcode. */
export async function searchMusic(query: string, fetcher: Fetcher = fetch): Promise<LookupResult[]> {
  const digits = query.replace(/\s/g, '')
  const isBarcode = /^\d{8,14}$/.test(digits)
  const q = isBarcode ? `barcode:${digits}` : `release:"${luceneEscape(query)}" OR artist:"${luceneEscape(query)}"`
  const params = new URLSearchParams({ query: q, fmt: 'json', limit: '25' })
  const json = await getJson(fetcher, `https://musicbrainz.org/ws/2/release/?${params}`)
  return parseMusicBrainz(json, isBarcode ? digits : undefined).slice(0, 12)
}
