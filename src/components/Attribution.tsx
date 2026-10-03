import tmdbLogo from '../assets/tmdb-logo.svg'
import { TMDB_NOTICE } from '../lib/about'

/**
 * TMDB's terms ask for their logo and this notice wherever their data is used. The logo is
 * TMDB's own file, unmodified, and links to their site.
 */
export function TmdbCredit({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
      <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" aria-label="TMDB (opens The Movie Database)" className="inline-flex shrink-0">
        <img src={tmdbLogo} alt="TMDB" style={{ height: compact ? 12 : 14, width: 'auto' }} />
      </a>
      <span className="min-w-0">{compact ? 'Movie and TV data from TMDB.' : `Movie and TV data from The Movie Database. ${TMDB_NOTICE}`}</span>
    </div>
  )
}
