import { useEffect, useRef, useState } from 'react'
import { Barcode, Loader2, PencilLine, Search } from 'lucide-react'
import { CATEGORIES, CATEGORY_ORDER, defaultFormat, formatLabel } from '../../lib/catalog'
import { dayKey } from '../../lib/dates'
import { blankItem } from '../../lib/library'
import { canSearch, lookupBarcode, LookupError, search, type LookupResult } from '../../lib/lookup'
import { inferTags } from '../../lib/autotags'
import { getTmdbDetails } from '../../lib/lookup/tmdb'
import { keysOf } from '../../lib/settings'
import { readJSON, writeJSON } from '../../lib/storage'
import type { Category, Item, Status } from '../../lib/types'
import { useLibrary } from '../../hooks/useLibrary'
import { btnPrimary, btnSecondary, chip, Cover, Dialog } from '../../components/ui'
import { ScreenHelp } from '../../components/ScreenHelp'
import { TmdbCredit } from '../../components/Attribution'
import { ItemForm } from '../library/ItemForm'
import { BarcodeScanner, canScan } from './BarcodeScanner'

const DEFAULTS_KEY = 'shelfkeeper.addDefaults.v1'
interface Defaults {
  category: Category
  location?: string
  formats: Partial<Record<Category, string>>
}

const loadDefaults = (): Defaults => {
  const d = readJSON<Partial<Defaults>>(DEFAULTS_KEY, {})
  return { category: d.category && d.category in CATEGORIES ? d.category : 'movie', location: d.location, formats: d.formats ?? {} }
}

const looksLikeBarcode = (q: string) => /^\d{8,14}$/.test(q.replace(/[\s-]/g, ''))

/** Where a new item should go. A function so that "save and add another" can move to the next pocket. */
export type Prefill = ((items: Item[]) => { location: string; position: string }) | { location: string; position: string }

export function AddDialog({ open, onClose, status, prefill, initialQuery, initialCategory }: { open: boolean; onClose: () => void; status: Status; prefill?: Prefill; initialQuery?: string; initialCategory?: Category }) {
  return (
    <Dialog open={open} onClose={onClose} title={status === 'wishlist' ? 'Add to wishlist' : 'Add to collection'} wide>
      <AddFlow status={status} onDone={onClose} prefill={prefill} initialQuery={initialQuery} initialCategory={initialCategory} />
    </Dialog>
  )
}

function AddFlow({ status, onDone, prefill, initialQuery, initialCategory }: { status: Status; onDone: () => void; prefill?: Prefill; initialQuery?: string; initialCategory?: Category }) {
  const { items, settings, addItem } = useLibrary()
  const [defaults, setDefaults] = useState(() => ({ ...loadDefaults(), ...(initialCategory ? { category: initialCategory } : {}) }))
  const { category } = defaults
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<LookupResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [draft, setDraft] = useState<Item | null>(null)
  const [added, setAdded] = useState<string[]>([])
  const guessedFormat = useRef<string | null>(null)
  const requestId = useRef(0)

  const searchable = canSearch(category)

  // Arriving from "Do I own this?" with a title: search for it straight away.
  const autoRan = useRef(false)
  useEffect(() => {
    if (autoRan.current || !initialQuery || !canSearch(category)) return
    autoRan.current = true
    void run(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setCategory = (c: Category) => {
    setDefaults((d) => ({ ...d, category: c }))
    setResults(null)
    setError(null)
    setNote(null)
    setScanning(false)
  }

  const run = async (q: string) => {
    const text = q.trim()
    if (!text) return
    const id = ++requestId.current
    setBusy(true)
    setError(null)
    setNote(null)
    setResults(null)
    guessedFormat.current = null
    try {
      if (looksLikeBarcode(text)) {
        const out = await lookupBarcode(category, text, keysOf(settings))
        if (id !== requestId.current) return
        guessedFormat.current = out.format
        setResults(out.results)
        setNote(out.note ?? null)
      } else {
        const out = await search(category, text, keysOf(settings))
        if (id !== requestId.current) return
        setResults(out)
      }
    } catch (e) {
      if (id !== requestId.current) return
      setError(e instanceof LookupError ? e.message : 'Something went wrong with the lookup.')
    } finally {
      if (id === requestId.current) setBusy(false)
    }
  }

  // Chosen from TMDB: fetch its keywords (one request) and fill in suggested tags when they arrive.
  const suggestFor = (r: LookupResult) => {
    const category = r.category
    if (r.ext.tmdb === undefined || (category !== 'movie' && category !== 'tv') || !settings.tmdbToken) return
    const id = r.ext.tmdb
    getTmdbDetails(settings.tmdbToken, category, id)
      .then((d) => {
        if (!d) return
        setDraft((cur) => (cur && cur.ext.tmdb === id ? { ...cur, autoTags: inferTags({ genres: d.genres, keywords: d.keywords }, { primaryGenre: cur.genre, dismissed: cur.removedTags, own: cur.tags }) } : cur))
      })
      .catch(() => undefined) // suggestions are a bonus; a failed lookup just means none
  }

  const startDraft = (r?: LookupResult, typedTitle = '') => {
    const base = blankItem(r?.category ?? category)
    // A game exists on several platforms: prefer the one used last if it is among them, else the first.
    const remembered = defaults.formats[base.category]
    const fromResult = r?.formats ? (remembered && r.formats.includes(remembered) ? remembered : r.formats[0]) : undefined
    const formatPref = guessedFormat.current ?? fromResult ?? remembered ?? defaultFormat(base.category)
    setDraft({
      ...base,
      status,
      title: r?.title ?? typedTitle,
      year: r?.year,
      creator: r?.creator,
      genre: r?.genre,
      posterUrl: r?.posterUrl,
      barcode: r?.barcode ?? (looksLikeBarcode(typedTitle) ? typedTitle : undefined),
      ext: r?.ext ?? {},
      tmdbAt: r?.ext.tmdb !== undefined ? dayKey() : undefined,
      format: formatPref in CATEGORIES[base.category].formats ? formatPref : defaultFormat(base.category),
      location: status === 'owned' ? defaults.location : undefined,
      ...(prefill && status === 'owned' ? (typeof prefill === 'function' ? prefill(items) : prefill) : {}),
    })
    if (r) suggestFor(r)
  }

  const save = (another: boolean) => {
    if (!draft || !draft.title.trim()) return
    const item = { ...draft, title: draft.title.trim() }
    addItem(item)
    const next: Defaults = { category: item.category, location: item.location ?? defaults.location, formats: { ...defaults.formats, [item.category]: item.format } }
    setDefaults(next)
    writeJSON(DEFAULTS_KEY, next)
    setAdded((a) => [item.title, ...a])
    setDraft(null)
    setQuery('')
    setResults(null)
    setNote(null)
    if (!another) onDone()
  }

  if (draft) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save(false)
        }}
        className="grid gap-4"
      >
        <div className="flex gap-3">
          <Cover url={draft.posterUrl} title={draft.title} category={draft.category} className="w-20 shrink-0" />
          <p className="text-sm text-mute">Check the details, then say where it lives. Everything can be changed later.</p>
        </div>
        <ItemForm draft={draft} onChange={setDraft} items={items} isNew />
        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap gap-2 border-t border-line bg-surface px-4 py-3">
          <button type="submit" className={btnPrimary} disabled={!draft.title.trim()}>
            Save
          </button>
          <button type="button" className={btnSecondary} onClick={() => save(true)} disabled={!draft.title.trim()}>
            Save and add another
          </button>
          <button type="button" className={btnSecondary} onClick={() => setDraft(null)}>
            Back
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="grid gap-4">
      <ScreenHelp id="add" />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="What are you adding?">
        {CATEGORY_ORDER.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={c === category}
            onClick={() => setCategory(c)}
            className={`${chip} ${c === category ? 'border-accent bg-accent text-accent-ink' : 'border-line text-mute hover:text-ink'}`}
          >
            {CATEGORIES[c].label}
          </button>
        ))}
      </div>

      {searchable ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void run(query)
          }}
          className="grid gap-2"
        >
          <div className="flex gap-2">
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={category === 'game' ? 'Search games by title' : `Search ${CATEGORIES[category].label.toLowerCase()} by title, or type or scan a barcode`}
              aria-label="Search"
              enterKeyHint="search"
            />
            <button type="submit" className={btnPrimary} disabled={busy || !query.trim()}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span className="hidden sm:inline">Search</span>
            </button>
            {canScan() && (
              <button type="button" className={btnSecondary} onClick={() => setScanning((s) => !s)} aria-pressed={scanning} title="Scan a barcode with the camera">
                <Barcode size={16} />
                <span className="hidden sm:inline">Scan</span>
              </button>
            )}
          </div>
          {scanning && (
            <BarcodeScanner
              onClose={() => setScanning(false)}
              onDetect={(code) => {
                setScanning(false)
                setQuery(code)
                void run(code)
              }}
            />
          )}
        </form>
      ) : (
        <p className="rounded-lg border border-line bg-bg p-3 text-sm text-mute">
          There is no online catalog for {CATEGORIES[category].label.toLowerCase()}, so enter them by hand.
        </p>
      )}

      {(category === 'movie' || category === 'tv') && <TmdbCredit compact />}
      {category === 'game' && (
        <p className="text-xs text-mute">
          Game data from{' '}
          <a href="https://rawg.io" target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
            RAWG
          </a>
          .
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-2.5 text-sm text-bad">
          {error}
        </p>
      )}
      {note && <p className="text-sm text-mute">{note}</p>}

      {results && results.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Search results">
          {results.map((r, n) => (
            <li key={`${r.ext.tmdb ?? r.ext.mbid ?? r.ext.olid ?? n}`}>
              <button type="button" onClick={() => startDraft(r)} className="flex w-full gap-3 rounded-xl border border-line bg-bg p-2 text-left hover:border-accent">
                <Cover url={r.posterUrl} title={r.title} category={r.category} className="w-14 shrink-0" />
                <span className="min-w-0 text-sm">
                  <span className="block font-medium leading-snug">{r.title}</span>
                  <span className="block text-xs text-mute">{[r.year, r.creator, r.genre].filter(Boolean).join(' · ')}</span>
                  {r.formats && <span className="block text-xs text-mute/80">{r.formats.map((f) => formatLabel('game', f)).join(' · ')}</span>}
                  {r.overview && <span className="mt-1 line-clamp-2 block text-xs text-mute/80">{r.overview}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && results.length === 0 && !error && <p className="text-sm text-mute">Nothing found. Try fewer words, or enter it by hand.</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <button type="button" className={btnSecondary} onClick={() => startDraft(undefined, looksLikeBarcode(query) ? query : query.trim())}>
          <PencilLine size={14} /> Enter by hand{query.trim() && !looksLikeBarcode(query) ? ` as “${query.trim()}”` : ''}
        </button>
        {added.length > 0 && (
          <p role="status" className="text-sm text-good">
            Added {added.length}: {added.slice(0, 3).join(', ')}
            {added.length > 3 ? '…' : ''}
          </p>
        )}
        <span className="flex-1" />
        {added.length > 0 && (
          <button type="button" className={btnPrimary} onClick={onDone}>
            Done
          </button>
        )}
      </div>
    </div>
  )
}
