import { useMemo, useRef, useState } from 'react'
import { CircleCheck, EyeOff, Loader2, Plus, RefreshCw } from 'lucide-react'
import { formatLabel } from '../../lib/catalog'
import { LookupError } from '../../lib/lookup'
import { newId } from '../../lib/library'
import {
  compareSeries, countMissing, isFresh, loadIgnored, loadSeriesCache, resolveSeries, saveIgnored, saveSeriesCache, seriesGroups, usualFormat, wishlistItemFor,
  type CachedSeries, type SeriesEntry, type SeriesGroup,
} from '../../lib/series'
import type { Item } from '../../lib/types'
import { useLibrary } from '../../hooks/useLibrary'
import { btnPrimary, btnSecondary, Dialog } from '../../components/ui'
import { ScreenHelp } from '../../components/ScreenHelp'

export function SeriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Series gaps" wide>
      <Series />
    </Dialog>
  )
}

const BADGE: Record<SeriesEntry['state'], string> = {
  owned: 'border-good/50 text-good',
  wishlist: 'border-accent/50 text-accent',
  missing: 'border-bad/50 bg-bad/10 text-bad',
  upcoming: 'border-line text-mute',
  hidden: 'border-line text-mute',
}
const LABEL: Record<SeriesEntry['state'], string> = { owned: 'Owned', wishlist: 'On wishlist', missing: 'Missing', upcoming: 'Upcoming', hidden: 'Hidden' }

function Series() {
  const { items, settings, addMany } = useLibrary()
  const groups = useMemo(() => seriesGroups(items), [items])
  const [cache, setCache] = useState(loadSeriesCache)
  const [ignored, setIgnored] = useState(loadIgnored)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [onlyGaps, setOnlyGaps] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const cacheRef = useRef(cache)
  cacheRef.current = cache

  const store = (name: string, value: CachedSeries) => {
    const next = { ...cacheRef.current, [name]: value }
    cacheRef.current = next
    setCache(next)
    saveSeriesCache(next)
  }

  const check = async (g: SeriesGroup): Promise<boolean> => {
    setBusy((b) => new Set(b).add(g.name))
    try {
      const r = await resolveSeries(settings.tmdbToken, g)
      store(g.name, { fetchedAt: new Date().toISOString(), collection: r.ok ? r.collection : null, reason: r.ok ? undefined : r.reason })
      return true
    } catch (e) {
      setError(e instanceof LookupError ? e.message : 'Something went wrong while checking.')
      return false
    } finally {
      setBusy((b) => {
        const n = new Set(b)
        n.delete(g.name)
        return n
      })
    }
  }

  const checkAll = async () => {
    const todo = groups.filter((g) => !cacheRef.current[g.name] || !isFresh(cacheRef.current[g.name]!))
    const ctl = new AbortController()
    abort.current = ctl
    setError(null)
    setProgress({ done: 0, total: todo.length })
    let next = 0
    let done = 0
    let stop = false
    const worker = async () => {
      while (!stop && !ctl.signal.aborted) {
        const g = todo[next++]
        if (!g) return
        if (!(await check(g))) stop = true // a bad token or no connection fails everything; stop instead of repeating it
        setProgress({ done: ++done, total: todo.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, todo.length) }, worker))
    setProgress(null)
    abort.current = null
  }

  const toggleHidden = (id: number) => {
    const next = new Set(ignored)
    if (!next.delete(id)) next.add(id)
    setIgnored(next)
    saveIgnored(next)
  }

  const addToWishlist = (g: SeriesGroup, entries: SeriesEntry[]) => {
    const format = usualFormat(g)
    const now = new Date().toISOString()
    addMany(entries.map((e) => wishlistItemFor(e, g.name, format, { id: newId(), addedAt: now, updatedAt: now })), `Added ${entries.length} ${g.name} film${entries.length === 1 ? '' : 's'} to the wishlist`)
  }

  const rows = groups.map((g) => {
    const cached = cache[g.name]
    const entries = cached?.collection ? compareSeries(cached.collection.parts, items, ignored) : null
    return { g, cached, entries, missing: entries ? countMissing(entries) : 0 }
  })
  const shown = onlyGaps ? rows.filter((r) => r.missing > 0) : rows
  const checked = rows.filter((r) => r.cached).length
  const totalMissing = rows.reduce((n, r) => n + r.missing, 0)

  if (groups.length === 0) {
    return (
      <div className="grid gap-4">
        <ScreenHelp id="series" defaultOpen={false} />
        <p className="py-8 text-center text-mute">Give your films a <b>Series</b> (for example "Alien") and they will be listed here.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <ScreenHelp id="series" defaultOpen={false} />

      {!settings.tmdbToken && (
        <p className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm text-accent">
          Checking series needs your free TMDB token. Add it in Settings first. Results you have already fetched are still shown.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {progress ? (
          <>
            <span role="status" className="flex items-center gap-2 text-sm">
              <Loader2 size={16} className="animate-spin" /> Checking {progress.done} of {progress.total}…
            </span>
            <button className={btnSecondary} onClick={() => abort.current?.abort()}>
              Cancel
            </button>
          </>
        ) : (
          <button className={btnPrimary} onClick={() => void checkAll()} disabled={!settings.tmdbToken}>
            <RefreshCw size={14} /> Check all ({groups.length})
          </button>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} />
          Only series with gaps
        </label>
        <span className="text-sm text-mute" role="status">
          {checked} of {groups.length} checked{checked > 0 ? ` · ${totalMissing} film${totalMissing === 1 ? '' : 's'} missing` : ''}
        </span>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-2.5 text-sm text-bad">
          {error}
        </p>
      )}

      {shown.length === 0 && <p className="py-6 text-center text-mute">{onlyGaps ? 'No gaps found in the series checked so far.' : 'Nothing to show.'}</p>}

      <ul className="grid gap-2">
        {shown.map(({ g, cached, entries, missing }) => (
          <li key={g.name}>
            <details className="rounded-xl border border-line bg-bg">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                <span className="font-medium">{g.name}</span>
                <span className="text-xs text-mute">{g.items.length} owned</span>
                <span className="flex-1" />
                <span className={`text-sm ${missing > 0 ? 'text-bad' : 'text-mute'}`}>
                  {busy.has(g.name) ? (
                    <Loader2 size={14} className="inline animate-spin" />
                  ) : entries ? (
                    missing > 0 ? (
                      `${missing} missing of ${entries.length}`
                    ) : (
                      <span className="inline-flex items-center gap-1 text-good">
                        <CircleCheck size={14} /> Complete
                      </span>
                    )
                  ) : cached ? (
                    cached.reason === 'unverified' ? "Couldn't confirm a match" : 'No franchise found'
                  ) : (
                    'Not checked'
                  )}
                </span>
              </summary>
              <div className="grid gap-2 border-t border-line p-3">
                {entries ? (
                  <>
                    <p className="text-xs text-mute">
                      {cached!.collection!.name} · checked {new Date(cached!.fetchedAt).toLocaleDateString()}
                    </p>
                    <ul className="grid gap-1">
                      {entries.map((e) => (
                        <li key={e.part.tmdb} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <span className="w-6 shrink-0 text-right text-xs text-mute">{e.number}</span>
                          <span className="min-w-0 flex-1">
                            {e.part.title}
                            {e.part.year && <span className="ml-1.5 text-mute">{e.part.year}</span>}
                            {e.copies.length > 0 && <span className="ml-2 text-xs text-mute">{[...new Set(e.copies.map((c: Item) => formatLabel(c.category, c.format)))].join(', ')}</span>}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${BADGE[e.state]}`}>{LABEL[e.state]}</span>
                          {e.state === 'missing' && (
                            <>
                              <button className="text-xs text-accent hover:underline" onClick={() => addToWishlist(g, [e])}>
                                Add to wishlist
                              </button>
                              <button className="text-mute hover:text-ink" onClick={() => toggleHidden(e.part.tmdb)} title="I already have this, or don't want it" aria-label={`Hide ${e.part.title}`}>
                                <EyeOff size={14} />
                              </button>
                            </>
                          )}
                          {e.state === 'hidden' && (
                            <button className="text-xs text-accent hover:underline" onClick={() => toggleHidden(e.part.tmdb)}>
                              Unhide
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : cached ? (
                  <p className="text-sm text-mute">
                    {cached.reason === 'unverified'
                      ? 'TMDB has a franchise with a similar name, but none of your films in this series is in it, so it was not used. Set the TMDB match by running Find cover art in Settings, then check again.'
                      : 'TMDB has no franchise listed under this series name (large crossover series often are not one franchise there).'}
                  </p>
                ) : (
                  <p className="text-sm text-mute">Not checked yet.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button className={btnSecondary} disabled={!settings.tmdbToken || busy.has(g.name)} onClick={() => void check(g)}>
                    <RefreshCw size={14} /> {cached ? 'Check again' : 'Check'}
                  </button>
                  {entries && missing > 1 && (
                    <button className={btnPrimary} onClick={() => addToWishlist(g, entries.filter((e) => e.state === 'missing'))}>
                      <Plus size={14} /> Add all missing ({missing})
                    </button>
                  )}
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
      <p className="text-xs text-mute">Franchise data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    </div>
  )
}
