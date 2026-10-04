import { useEffect, useState } from 'react'
import { ExternalLink, Info, User } from 'lucide-react'
import { getTmdbInfo, parseTmdbLink, type TmdbInfo } from '../../lib/lookup/tmdb'
import { LookupError } from '../../lib/lookup/types'
import { useLibrary } from '../../hooks/useLibrary'
import type { Item } from '../../lib/types'
import { TmdbCredit } from '../../components/Attribution'
import { btnPrimary, btnSecondary } from '../../components/ui'

// Kept for this visit only. TMDB does not allow its content to be stored for more than six
// months, so the synopsis and cast are never written to the collection or to disk.
const seen = new Map<string, TmdbInfo | null>()

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'done'; info: TmdbInfo | null }

export const hasDetails = (i: Pick<Item, 'category' | 'ext'>) => (i.category === 'movie' || i.category === 'tv') && !!i.ext.tmdb

/** "About this title": synopsis, director and cast from TMDB, fetched when asked for. */
export function TitleDetails({ item, onFix }: { item: Item; onFix: (category: 'movie' | 'tv', id: number) => void }) {
  const { settings } = useLibrary()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<State>({ kind: 'idle' })
  const category = item.category as 'movie' | 'tv'
  const id = item.ext.tmdb!
  const key = `${category}:${id}`

  useEffect(() => {
    if (!open || !settings.tmdbToken) return
    if (seen.has(key)) {
      setState({ kind: 'done', info: seen.get(key) ?? null })
      return
    }
    const ctl = new AbortController()
    setState({ kind: 'loading' })
    getTmdbInfo(settings.tmdbToken, category, id, (u, init) => fetch(u, { ...init, signal: ctl.signal }))
      .then((info) => {
        seen.set(key, info)
        setState({ kind: 'done', info })
      })
      .catch((e) => {
        if (ctl.signal.aborted) return
        setState({ kind: 'error', message: e instanceof LookupError ? e.message : 'Could not load the details.' })
      })
    return () => ctl.abort()
  }, [open, key, category, id, settings.tmdbToken])

  return (
    <section aria-label="About this title" className="grid gap-3 rounded-lg border border-line bg-raised/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnSecondary} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Info size={14} /> {open ? 'Hide synopsis and cast' : 'Synopsis and cast'}
        </button>
        {!open && <span className="text-xs text-mute">Looked up from TMDB when you open it.</span>}
      </div>
      {open && (
        <div className="grid gap-3 text-sm" aria-live="polite">
          {!settings.tmdbToken ? (
            <p className="text-accent">Add your free TMDB token in Settings to see the synopsis and cast.</p>
          ) : state.kind === 'loading' || state.kind === 'idle' ? (
            <p className="text-mute">Loading…</p>
          ) : state.kind === 'error' ? (
            <p role="alert" className="text-bad">
              {state.message}
            </p>
          ) : state.info === null ? (
            <p className="text-mute">TMDB no longer lists this title.</p>
          ) : (
            <Info_ info={state.info} category={category} />
          )}
          <WrongMatch item={item} onFix={onFix} />
          <TmdbCredit compact />
        </div>
      )}
    </section>
  )
}

function Info_({ info, category }: { info: TmdbInfo; category: 'movie' | 'tv' }) {
  const facts = [
    info.runtime ? `${info.runtime} min${category === 'tv' ? ' per episode' : ''}` : '',
    info.seasons ? `${info.seasons} season${info.seasons === 1 ? '' : 's'}` : '',
  ].filter(Boolean)
  return (
    <>
      {info.tagline && <p className="italic text-mute">“{info.tagline}”</p>}
      <p>{info.overview ?? 'TMDB has no synopsis for this title.'}</p>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-mute">
        {info.directors.length > 0 && (
          <div className="flex gap-1">
            <dt>{category === 'movie' ? 'Directed by' : 'Created by'}</dt>
            <dd className="text-ink">{info.directors.join(', ')}</dd>
          </div>
        )}
        {facts.length > 0 && (
          <div>
            <dt className="sr-only">Length</dt>
            <dd>{facts.join(' · ')}</dd>
          </div>
        )}
      </dl>
      {info.cast.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-mute">Cast</h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {info.cast.map((c, n) => (
              <li key={`${c.name}-${n}`} className="flex items-center gap-2">
                {c.photoUrl ? (
                  <img src={c.photoUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-raised text-mute">
                    <User size={18} aria-hidden />
                  </span>
                )}
                <span className="min-w-0 leading-tight">
                  <span className="block truncate font-medium">{c.name}</span>
                  {c.character && <span className="block truncate text-xs text-mute">{c.character}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <a href={info.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline">
        Full cast and more on TMDB <ExternalLink size={12} aria-hidden />
      </a>
    </>
  )
}

/** Lets the person point the item at the right TMDB page when the automatic match was wrong. */
function WrongMatch({ item, onFix }: { item: Item; onFix: (category: 'movie' | 'tv', id: number) => void }) {
  const { settings } = useLibrary()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [found, setFound] = useState<{ category: 'movie' | 'tv'; id: number; info: TmdbInfo } | null>(null)

  if (!settings.tmdbToken) return null
  if (!open) {
    return (
      <button type="button" className="justify-self-start text-xs text-accent underline-offset-2 hover:underline" onClick={() => setOpen(true)}>
        Wrong title? Use a different TMDB page
      </button>
    )
  }

  const check = async () => {
    const ref = parseTmdbLink(text, item.category as 'movie' | 'tv')
    setFound(null)
    if (!ref) {
      setError('Paste the address of the title’s page on themoviedb.org (it looks like themoviedb.org/movie/8077), or just its number.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const info = await getTmdbInfo(settings.tmdbToken, ref.category, ref.id)
      if (!info) setError('TMDB has no title with that address.')
      else setFound({ ...ref, info })
    } catch (e) {
      setError(e instanceof LookupError ? e.message : 'Could not check that address.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-2 rounded-md border border-line p-3">
      <label className="grid gap-1">
        <span className="text-xs text-mute">
          Find the right title on{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
            themoviedb.org
          </a>
          , then paste its address here.
        </span>
        <input
          className="rounded-md border border-line bg-surface px-2 py-1.5"
          value={text}
          placeholder="https://www.themoviedb.org/movie/8077-alien-3"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void check()
            }
          }}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnSecondary} disabled={busy || !text.trim()} onClick={() => void check()}>
          {busy ? 'Checking…' : 'Check'}
        </button>
        <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
      {found && (
        <div role="status" className="grid gap-2 text-sm">
          <p>
            That is <b>{found.info.title ?? 'an untitled entry'}</b>
            {found.info.year ? ` (${found.info.year})` : ''}
            {found.info.directors.length ? `, ${found.category === 'movie' ? 'directed by' : 'created by'} ${found.info.directors.join(', ')}` : ''}.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                onFix(found.category, found.id)
                setOpen(false)
                setText('')
                setFound(null)
              }}
            >
              Use this one
            </button>
            <span className="text-xs text-mute">Your title, cover and notes stay as they are. Press Save to keep the change.</span>
          </div>
        </div>
      )}
    </div>
  )
}
