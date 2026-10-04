import type { Category, ExternalIds } from '../types'

/** What a lookup service knows about a title; becomes the prefilled add form. */
export interface LookupResult {
  title: string
  category: Category
  year?: number
  creator?: string
  genre?: string
  posterUrl?: string
  barcode?: string
  overview?: string
  /** Game platforms this exists on, as our format keys (ps5, switch…); the first is preselected. */
  formats?: string[]
  ext: ExternalIds
}

/** The API keys the person has pasted into Settings. */
export interface LookupKeys {
  tmdb: string
  rawg: string
}

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

export class LookupError extends Error {
  constructor(
    message: string,
    readonly kind: 'needs-token' | 'network' | 'rejected' | 'rate-limit',
    readonly status?: number,
  ) {
    super(message)
  }
}

export async function getJson(fetcher: Fetcher, url: string, init?: RequestInit): Promise<unknown> {
  let res: Response
  try {
    res = await fetcher(url, init)
  } catch {
    throw new LookupError('Could not reach the lookup service. Check your connection.', 'network')
  }
  if (res.status === 401 || res.status === 403) throw new LookupError('The lookup service rejected the request. Check your key in Settings.', 'rejected')
  if (res.status === 429) throw new LookupError('Too many lookups right now. Try again in a minute.', 'rate-limit')
  if (!res.ok) throw new LookupError(`The lookup service answered with an error (${res.status}).`, 'network', res.status)
  try {
    return await res.json()
  } catch {
    throw new LookupError('The lookup service sent something unreadable.', 'network')
  }
}

export const yearOf = (date: unknown): number | undefined => {
  const m = typeof date === 'string' ? /^(\d{4})/.exec(date) : null
  return m ? Number(m[1]) : undefined
}
