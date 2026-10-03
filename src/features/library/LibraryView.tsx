import { useDeferredValue, useMemo, useState } from 'react'
import { CheckSquare, Layers, LayoutGrid, List, Plus, Search, SlidersHorizontal, Upload } from 'lucide-react'
import { CATEGORIES, CATEGORY_ORDER, formatLabel } from '../../lib/catalog'
import { price } from '../../lib/format'
import { DEFAULT_FILTERS, distinct, filterItems, sortAndGroup, type Filters, type GroupKey, type SortKey } from '../../lib/filters'
import type { Item, Status } from '../../lib/types'
import { useLibrary } from '../../hooks/useLibrary'
import { usePref } from '../../hooks/usePref'
import { btnPrimary, btnSecondary, chip } from '../../components/ui'
import { ScreenHelp } from '../../components/ScreenHelp'
import { SeriesDialog } from '../series/SeriesDialog'
import { BulkEditDialog, SelectionBar } from './BulkEdit'
import { ItemCard, ItemRow } from './ItemCard'

const SORTS: [SortKey, string][] = [['title', 'Title'], ['added', 'Recently added'], ['year', 'Year'], ['rating', 'Rating'], ['location', 'Location'], ['priority', 'Wishlist priority'], ['value', 'Worth today']]
const GROUPS: [GroupKey, string][] = [['none', 'No grouping'], ['series', 'Series'], ['genre', 'Genre'], ['location', 'Location'], ['format', 'Format']]
const VIEWS = ['grid', 'list'] as const

interface Props {
  status: Status
  onOpen: (i: Item) => void
  onAdd: () => void
  onImport: () => void
}

export function LibraryView({ status, onOpen, onAdd, onImport }: Props) {
  const { items, removeMany } = useLibrary()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [seriesOpen, setSeriesOpen] = useState(false)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [sort, setSort] = usePref<SortKey>(`sort.${status}`, status === 'wishlist' ? 'priority' : 'title', SORTS.map((s) => s[0]))
  const [group, setGroup] = usePref<GroupKey>(`group.${status}`, 'none',GROUPS.map((g) => g[0]))
  const [view, setView] = usePref<(typeof VIEWS)[number]>('view', 'grid', VIEWS)
  const [showFilters, setShowFilters] = useState(false)
  const deferredQ = useDeferredValue(filters.q)

  const here = useMemo(() => items.filter((i) => i.status === status), [items, status])
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))

  const effective = useMemo(() => ({ ...filters, q: deferredQ }), [filters, deferredQ])
  const groups = useMemo(() => sortAndGroup(filterItems(items, status, effective), sort, group), [items, status, effective, sort, group])
  const shown = groups.reduce((n, g) => n + g.items.length, 0)

  const formats = useMemo(() => {
    const cats = filters.category === 'all' ? CATEGORY_ORDER : [filters.category]
    const seen = new Map<string, string>()
    for (const i of here) if (cats.includes(i.category)) seen.set(i.format, formatLabel(i.category, i.format))
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [here, filters.category])
  const genres = useMemo(() => distinct(here, (i) => i.genre), [here])
  const locations = useMemo(() => distinct(here, (i) => i.location), [here])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of here) m.set(i.category, (m.get(i.category) ?? 0) + 1)
    return m
  }, [here])

  const shownIds = useMemo(() => groups.flatMap((g) => g.items.map((i) => i.id)), [groups])
  // Only things still on screen count as selected: filtering or deleting must not leave hidden picks behind.
  const live = useMemo(() => new Set(shownIds.filter((id) => selected.has(id))), [shownIds, selected])
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })
  const toggleGroup = (ids: string[]) =>
    setSelected((s) => {
      const n = new Set(s)
      const all = ids.every((id) => n.has(id))
      for (const id of ids) {
        if (all) n.delete(id)
        else n.add(id)
      }
      return n
    })
  const stopSelecting = () => {
    setSelecting(false)
    setSelected(new Set())
  }
  const open = (i: Item) => (selecting ? toggle(i.id) : onOpen(i))

  const targets = useMemo(() => here.filter((i) => i.targetPrice !== undefined), [here])
  const targetTotal = targets.reduce((n, i) => n + (i.targetPrice ?? 0), 0)

  const filtered = JSON.stringify({ ...filters, q: '' }) !== JSON.stringify(DEFAULT_FILTERS) || filters.q !== ''

  if (here.length === 0) {
    return (
      <div className="mx-auto grid max-w-md place-items-center gap-4 py-16 text-center">
        <h2 className="font-display text-2xl">{status === 'owned' ? 'The shelves are empty' : 'Nothing coming soon'}</h2>
        <p className="text-mute">
          {status === 'owned'
            ? 'Time to stock up. Add a title by searching, scanning its barcode, or typing it in. Everything stays on this device.'
            : 'Keep track of what you want to buy next (your wishlist). Move items to your collection when they come in.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className={btnPrimary} onClick={onAdd}>
            <Plus size={16} /> {status === 'owned' ? 'Stock your first title' : 'Add a wish'}
          </button>
          {status === 'owned' && (
            <button className={btnSecondary} onClick={onImport}>
              <Upload size={16} /> Import a backup or CSV
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <ScreenHelp id={status === 'owned' ? 'collection' : 'wishlist'} />
      <div className="grid gap-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search titles, series, people, places, notes…"
            aria-label="Search your collection"
            className="!pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
          <button onClick={() => set({ category: 'all', format: 'all' })} aria-pressed={filters.category === 'all'} className={`${chip} ${filters.category === 'all' ? 'border-accent bg-accent text-accent-ink' : 'border-line text-mute hover:text-ink'}`}>
            All {here.length}
          </button>
          {CATEGORY_ORDER.filter((c) => counts.has(c)).map((c) => (
            <button key={c} onClick={() => set({ category: c, format: 'all' })} aria-pressed={filters.category === c} className={`${chip} ${filters.category === c ? 'border-accent bg-accent text-accent-ink' : 'border-line text-mute hover:text-ink'}`}>
              {CATEGORIES[c].label} {counts.get(c)}
            </button>
          ))}
        </div>

        <button className={`${btnSecondary} justify-between sm:hidden`} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} aria-controls="filter-grid">
          <span className="inline-flex items-center gap-1.5">
            <SlidersHorizontal size={14} /> Filters, sort and grouping
          </span>
          {filtered && <span className="rounded-full bg-accent px-2 text-xs text-accent-ink">on</span>}
        </button>
        <div id="filter-grid" className={`${showFilters ? 'grid' : 'hidden'} grid-cols-2 gap-2 sm:grid sm:grid-cols-3 lg:grid-cols-6`}>
          <Select label="Format" value={filters.format} onChange={(v) => set({ format: v })} options={formats} />
          <Select label="Genre" value={filters.genre} onChange={(v) => set({ genre: v })} options={genres.map((g) => [g, g])} />
          <Select label="Location" value={filters.location} onChange={(v) => set({ location: v })} options={locations.map((g) => [g, g])} />
          <Select
            label="Show"
            value={filters.flag}
            onChange={(v) => set({ flag: v as Filters['flag'] })}
            all="Everything"
            options={[['unfinished', 'Not yet finished'], ['finished', 'Finished'], ['favorite', 'Favorites'], ['lent', 'Lent out']]}
          />
          <Select label="Sort" value={sort} onChange={(v) => setSort(v as SortKey)} options={SORTS} all={null} />
          <Select label="Group" value={group} onChange={(v) => setGroup(v as GroupKey)} options={GROUPS} all={null} />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-mute">
          <span role="status" aria-live="polite">
            {shown === here.length ? `${shown} item${shown === 1 ? '' : 's'}` : `${shown} of ${here.length}`}
            {status === 'wishlist' && targets.length > 0 && ` · targets total ${price(targetTotal)}${targets.length < here.length ? ` (${targets.length} priced)` : ''}`}
          </span>
          {filtered && (
            <button className="text-accent underline-offset-2 hover:underline" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear filters
            </button>
          )}
          <span className="flex-1" />
          {status === 'owned' && (
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:text-ink" onClick={() => setSeriesOpen(true)}>
              <Layers size={15} /> Series gaps
            </button>
          )}
          <button
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm ${selecting ? 'border-accent bg-accent/10 text-accent' : 'border-line hover:text-ink'}`}
            aria-pressed={selecting}
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
          >
            <CheckSquare size={15} /> Select
          </button>
          <div className="inline-flex overflow-hidden rounded-lg border border-line" role="group" aria-label="View">
            {([['grid', LayoutGrid, 'Grid'], ['list', List, 'List']] as const).map(([v, Icon, label]) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} aria-label={`${label} view`} className={`p-2 ${view === v ? 'bg-raised text-ink' : 'text-mute hover:text-ink'}`}>
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {notice && (
        <p role="status" className="flex items-center justify-between gap-3 rounded-lg border border-good/40 p-2.5 text-sm text-good">
          {notice}
          <button className="text-mute hover:text-ink" onClick={() => setNotice(null)} aria-label="Dismiss">
            ✕
          </button>
        </p>
      )}
      {shown === 0 ? (
        <p className="py-12 text-center text-mute">Nothing matches. Try clearing a filter.</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-label={g.label || 'Items'} className="grid gap-2">
            {g.label && (
              <h3 className="sticky top-14 z-10 flex items-baseline gap-2 border-b border-line bg-bg/95 py-1.5 font-display text-lg backdrop-blur">
                {g.label} <span className="font-sans text-xs text-mute">{g.items.length}</span>
                {selecting && (
                  <button className="ml-auto font-sans text-xs text-accent hover:underline" onClick={() => toggleGroup(g.items.map((i) => i.id))}>
                    {g.items.every((i) => live.has(i.id)) ? 'Unselect group' : 'Select group'}
                  </button>
                )}
              </h3>
            )}
            {view === 'grid' ? (
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                {g.items.map((i) => (
                  <ItemCard key={i.id} item={i} onOpen={open} selecting={selecting} selected={live.has(i.id)} />
                ))}
              </div>
            ) : (
              <div className="grid">
                {g.items.map((i) => (
                  <ItemRow key={i.id} item={i} onOpen={open} selecting={selecting} selected={live.has(i.id)} />
                ))}
              </div>
            )}
          </section>
        ))
      )}

      {selecting && (
        <SelectionBar
          count={live.size}
          shown={shown}
          onSelectAll={() => setSelected(new Set(shownIds))}
          onClear={() => setSelected(new Set())}
          onEdit={() => setEditing(true)}
          onDelete={() => {
            removeMany(live)
            setNotice(`Deleted ${live.size} item${live.size === 1 ? '' : 's'}.`)
            stopSelecting()
          }}
          onDone={stopSelecting}
        />
      )}
      <SeriesDialog open={seriesOpen} onClose={() => setSeriesOpen(false)} />
      <BulkEditDialog
        ids={editing ? live : null}
        onClose={() => setEditing(false)}
        onDone={(m) => {
          setNotice(m)
          stopSelecting()
        }}
      />
    </div>
  )
}

function Select({ label, value, onChange, options, all = 'All' }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] | readonly (readonly [string, string])[]; all?: string | null }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] uppercase tracking-wide text-mute">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="!normal-case">
        {all !== null && <option value="all">{all}</option>}
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}
