export const APP_NAME = 'Stacks Video'
export const TAGLINE = 'Be kind, rewind.'

/** The project page. Used for the privacy statement, the licence list and bug reports. */
export const REPO_URL = 'https://github.com/sarindre/Blockbuster-App'
export const PRIVACY_URL = `${REPO_URL}/blob/main/PRIVACY.md`
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`
export const NOTICES_URL = `${REPO_URL}/blob/main/THIRD_PARTY_NOTICES.md`
export const ISSUES_URL = `${REPO_URL}/issues`

// TMDB's terms require this wording wherever its data is used.
export const TMDB_NOTICE = 'This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.'

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'

export interface Credit {
  name: string
  url: string
  what: string
}

export const CREDITS: Credit[] = [
  { name: 'TMDB', url: 'https://www.themoviedb.org/', what: 'Movie and TV details, posters and franchises' },
  { name: 'RAWG', url: 'https://rawg.io/', what: 'Game details' },
  { name: 'Open Library', url: 'https://openlibrary.org/', what: 'Book details and covers' },
  { name: 'MusicBrainz', url: 'https://musicbrainz.org/', what: 'Music details (with the Cover Art Archive for covers)' },
  { name: 'UPCitemdb', url: 'https://www.upcitemdb.com/', what: 'Disc barcode lookups (free tier)' },
]
