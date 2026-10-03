import { useMemo, useState, type ReactNode } from 'react'
import { Pencil, Trash2, X } from 'lucide-react'
import { applyBulk, type BulkChanges } from '../../lib/bulk'
import { CATEGORIES, CONDITIONS } from '../../lib/catalog'
import { distinct } from '../../lib/filters'
import { normalizeTags } from '../../lib/library'
import type { Condition, Item, Priority, Status } from '../../lib/types'
import { useLibrary } from '../../hooks/useLibrary'
import { btnDanger, btnPrimary, btnSecondary, Dialog } from '../../components/ui'

const formatsFor = (i: Item) => Object.keys(CATEGORIES[i.category].formats)

/** The sticky bar shown while selecting. */
export function SelectionBar({
  count,
  shown,
  onSelectAll,
  onClear,
  onEdit,
  onDelete,
  onDone,
}: {
  count: number
  shown: number
  onSelectAll: () => void
  onClear: () => void
  onEdit: () => void
  onDelete: () => void
  onDone: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      className="fixed inset-x-0 bottom-[3.75rem] z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-accent/50 bg-surface p-2.5 shadow-2xl sm:bottom-4 sm:w-[calc(100%-2rem)]"
    >
      <span role="status" className="px-1 text-sm font-medium">
        {count} selected
      </span>
      {confirm ? (
        <>
          <span className="text-sm text-bad">Delete {count} item{count === 1 ? '' : 's'} for good?</span>
          <button className={btnDanger} onClick={() => { onDelete(); setConfirm(false) }}>
            Yes, delete
          </button>
          <button className={btnSecondary} onClick={() => setConfirm(false)}>
            Keep
          </button>
        </>
      ) : (
        <>
          <button className={btnSecondary} onClick={onSelectAll} disabled={count >= shown}>
            Select all {shown}
          </button>
          <button className={btnSecondary} onClick={onClear} disabled={count === 0}>
            Clear
          </button>
          <span className="flex-1" />
          <button className={btnPrimary} onClick={onEdit} disabled={count === 0}>
            <Pencil size={14} /> Edit
          </button>
          <button className={btnDanger} onClick={() => setConfirm(true)} disabled={count === 0} aria-label="Delete selected">
            <Trash2 size={14} />
          </button>
          <button className={btnSecondary} onClick={onDone} aria-label="Done selecting">
            <X size={14} /> Done
          </button>
        </>
      )}
    </div>
  )
}

type Field = 'status' | 'format' | 'location' | 'genre' | 'series' | 'condition' | 'finished' | 'favorite' | 'priority'

export function BulkEditDialog({ ids, onClose, onDone }: { ids: Set<string> | null; onClose: () => void; onDone: (message: string) => void }) {
  return (
    <Dialog open={!!ids} onClose={onClose} title={ids ? `Edit ${ids.size} item${ids.size === 1 ? '' : 's'}` : 'Edit'}>
      {ids && <Form ids={ids} onClose={onClose} onDone={onDone} />}
    </Dialog>
  )
}

function Form({ ids, onClose, onDone }: { ids: Set<string>; onClose: () => void; onDone: (m: string) => void }) {
  const { items, updateMany } = useLibrary()
  const [on, setOn] = useState<Partial<Record<Field, boolean>>>({})
  const [v, setV] = useState({
    status: 'owned' as Status, format: '', location: '', genre: '', series: '', condition: '' as Condition | '',
    finished: true, favorite: true, priority: '' as Priority | '', addTags: '', removeTags: '',
  })
  const selected = useMemo(() => items.filter((i) => ids.has(i.id)), [items, ids])
  const categories = useMemo(() => [...new Set(selected.map((i) => i.category))], [selected])
  const formatOptions = categories.length === 1 ? Object.entries(CATEGORIES[categories[0]!].formats) : []
  const locations = useMemo(() => distinct(items, (i) => i.location), [items])
  const genres = useMemo(() => distinct(items, (i) => i.genre), [items])
  const series = useMemo(() => distinct(items, (i) => i.series), [items])

  const toggle = (f: Field) => setOn((o) => ({ ...o, [f]: !o[f] }))
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }))

  const changes: BulkChanges = {}
  if (on.status) changes.status = v.status
  if (on.format && v.format) changes.format = v.format
  if (on.location) changes.location = v.location.trim() || null
  if (on.genre) changes.genre = v.genre.trim() || null
  if (on.series) changes.series = v.series.trim() || null
  if (on.condition) changes.condition = v.condition || null
  if (on.finished) changes.finished = v.finished
  if (on.favorite) changes.favorite = v.favorite
  if (on.priority) changes.priority = v.priority || null
  const addTags = normalizeTags(v.addTags)
  const removeTags = normalizeTags(v.removeTags)
  if (addTags.length) changes.addTags = addTags
  if (removeTags.length) changes.removeTags = removeTags

  const preview = useMemo(() => applyBulk(items, ids, changes, formatsFor), [items, ids, changes]) // eslint-disable-line react-hooks/exhaustive-deps
  const hasChanges = Object.keys(changes).length > 0

  const apply = () => {
    updateMany(preview.patches, `Bulk edit of ${preview.changed} item${preview.changed === 1 ? '' : 's'}`)
    onDone(
      `Updated ${preview.changed} item${preview.changed === 1 ? '' : 's'}.` +
        (preview.formatSkipped ? ` ${preview.formatSkipped} kept their format because it does not exist for their type.` : ''),
    )
    onClose()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (hasChanges) apply()
      }}
      className="grid gap-3"
    >
      <p className="text-sm text-mute">Tick only the things you want to change. Everything else stays as it is.</p>

      <Row label="Status" checked={!!on.status} onToggle={() => toggle('status')}>
        <select value={v.status} onChange={(e) => set('status', e.target.value as Status)} disabled={!on.status} aria-label="New status">
          <option value="owned">Owned</option>
          <option value="wishlist">Wishlist</option>
        </select>
      </Row>
      <Row label="Format" checked={!!on.format} onToggle={() => toggle('format')} disabled={formatOptions.length === 0} note={formatOptions.length === 0 ? 'Select items of one type to change format' : undefined}>
        <select value={v.format} onChange={(e) => set('format', e.target.value)} disabled={!on.format} aria-label="New format">
          <option value="">Choose…</option>
          {formatOptions.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Location" checked={!!on.location} onToggle={() => toggle('location')} note="Leave empty to clear it">
        <input list="bulk-locations" value={v.location} onChange={(e) => set('location', e.target.value)} disabled={!on.location} aria-label="New location" />
      </Row>
      <Row label="Genre" checked={!!on.genre} onToggle={() => toggle('genre')} note="Leave empty to clear it">
        <input list="bulk-genres" value={v.genre} onChange={(e) => set('genre', e.target.value)} disabled={!on.genre} aria-label="New genre" />
      </Row>
      <Row label="Series" checked={!!on.series} onToggle={() => toggle('series')} note="Leave empty to clear it">
        <input list="bulk-series" value={v.series} onChange={(e) => set('series', e.target.value)} disabled={!on.series} aria-label="New series" />
      </Row>
      <Row label="Condition" checked={!!on.condition} onToggle={() => toggle('condition')}>
        <select value={v.condition} onChange={(e) => set('condition', e.target.value as Condition | '')} disabled={!on.condition} aria-label="New condition">
          <option value="">Not set</option>
          {Object.entries(CONDITIONS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Finished" checked={!!on.finished} onToggle={() => toggle('finished')}>
        <select value={String(v.finished)} onChange={(e) => set('finished', e.target.value === 'true')} disabled={!on.finished} aria-label="Finished">
          <option value="true">Mark as finished</option>
          <option value="false">Mark as not finished</option>
        </select>
      </Row>
      <Row label="Favorite" checked={!!on.favorite} onToggle={() => toggle('favorite')}>
        <select value={String(v.favorite)} onChange={(e) => set('favorite', e.target.value === 'true')} disabled={!on.favorite} aria-label="Favorite">
          <option value="true">Mark as favorite</option>
          <option value="false">Remove favorite</option>
        </select>
      </Row>

      <Row label="Priority" checked={!!on.priority} onToggle={() => toggle('priority')} note="For wishlist items">
        <select value={v.priority} onChange={(e) => set('priority', e.target.value as Priority | '')} disabled={!on.priority} aria-label="New priority">
          <option value="">Not set</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </Row>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-mute">
          Add tags
          <input value={v.addTags} onChange={(e) => set('addTags', e.target.value)} placeholder="classic, horror" />
        </label>
        <label className="grid gap-1 text-xs text-mute">
          Remove tags
          <input value={v.removeTags} onChange={(e) => set('removeTags', e.target.value)} />
        </label>
      </div>

      <datalist id="bulk-locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
      <datalist id="bulk-genres">{genres.map((l) => <option key={l} value={l} />)}</datalist>
      <datalist id="bulk-series">{series.map((l) => <option key={l} value={l} />)}</datalist>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center gap-2 border-t border-line bg-surface px-4 py-3">
        <button type="submit" className={btnPrimary} disabled={!hasChanges || preview.changed === 0}>
          Apply to {preview.changed} item{preview.changed === 1 ? '' : 's'}
        </button>
        <button type="button" className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
        <span className="text-xs text-mute" role="status">
          {!hasChanges ? 'Nothing chosen yet.' : preview.changed === 0 ? 'Those items already look like that.' : preview.changed < ids.size ? `${ids.size - preview.changed} already match.` : ''}
        </span>
      </div>
    </form>
  )
}

function Row({ label, checked, onToggle, children, note, disabled = false }: { label: string; checked: boolean; onToggle: () => void; children: ReactNode; note?: string; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={checked} onChange={onToggle} disabled={disabled} />
        {label}
      </label>
      <div className="grid gap-0.5">
        {children}
        {note && <span className="text-[11px] text-mute/80">{note}</span>}
      </div>
    </div>
  )
}
