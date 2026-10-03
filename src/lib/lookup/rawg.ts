import { getJson, LookupError, yearOf, type Fetcher, type LookupResult } from './types'

// RAWG (rawg.io) has a free API key. Its data requires a visible link back to rawg.io
// wherever it is shown, which the Add dialog and Settings do.

interface RawgGame {
  id?: number
  name?: string
  released?: string | null
  background_image?: string | null
  genres?: { name?: string }[] | null
  platforms?: { platform?: { slug?: string } }[] | null
}

// RAWG platform slugs -> our game formats (catalog.ts). Anything unlisted (phones, browsers…) is ignored.
const PLATFORM_FORMAT: Record<string, string> = {
  playstation5: 'ps5', playstation4: 'ps4', playstation3: 'ps3', playstation2: 'ps2', playstation1: 'ps1',
  'xbox-one': 'xbox', xbox360: 'xbox', 'xbox-series-x': 'xbox', 'xbox-old': 'xbox',
  'nintendo-switch': 'switch', pc: 'pc',
  wii: 'nintendo', 'wii-u': 'nintendo', 'nintendo-3ds': 'nintendo', 'nintendo-ds': 'nintendo', 'nintendo-dsi': 'nintendo',
  'nintendo-64': 'nintendo', gamecube: 'nintendo', snes: 'nintendo', nes: 'nintendo', 'game-boy': 'nintendo',
  'game-boy-advance': 'nintendo', 'game-boy-color': 'nintendo',
  genesis: 'retro', 'sega-saturn': 'retro', dreamcast: 'retro', 'sega-master-system': 'retro', 'sega-cd': 'retro',
  atari2600: 'retro', atari7800: 'retro', 'neo-geo': 'retro', 'commodore-amiga': 'retro', '3do': 'retro',
}

export function parseRawg(json: unknown): LookupResult[] {
  const rows = (json as { results?: RawgGame[] } | null)?.results
  if (!Array.isArray(rows)) return []
  const out: LookupResult[] = []
  for (const r of rows) {
    const title = r.name?.trim()
    if (!title || typeof r.id !== 'number') continue
    const formats = [...new Set((r.platforms ?? []).map((p) => PLATFORM_FORMAT[p.platform?.slug ?? '']).filter((f): f is string => !!f))]
    out.push({
      title,
      category: 'game',
      year: yearOf(r.released),
      genre: r.genres?.[0]?.name,
      posterUrl: r.background_image || undefined,
      formats: formats.length ? formats : undefined,
      ext: { rawg: r.id },
    })
  }
  return out
}

export async function searchRawg(key: string, query: string, fetcher: Fetcher = fetch): Promise<LookupResult[]> {
  if (!key) throw new LookupError('Add your free RAWG key in Settings to search games.', 'needs-token')
  const params = new URLSearchParams({ key, search: query, page_size: '12', search_precise: 'false' })
  return parseRawg(await getJson(fetcher, `https://api.rawg.io/api/games?${params}`)).slice(0, 12)
}
