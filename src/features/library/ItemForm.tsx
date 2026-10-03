import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { CATEGORIES, CATEGORY_ORDER, CONDITIONS, defaultFormat, formatLabel } from '../../lib/catalog'
import { dayKey } from '../../lib/dates'
import { distinct } from '../../lib/filters'
import { findSameTitle, normalizeTags } from '../../lib/library'
import type { Category, Condition, Item, Priority } from '../../lib/types'
import { Field, Stars } from '../../components/ui'

interface Props {
  draft: Item
  onChange: (next: Item) => void
  /** The whole library, for suggestions and the "you already own this" notice. */
  items: Item[]
  isNew: boolean
}

/** Keeps what was typed ("a, b, ") while the draft holds the cleaned-up list. */
function TagsInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState(value.join(', '))
  return (
    <input
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onChange(normalizeTags(e.target.value))
      }}
    />
  )
}

const toNumber = (v: string): number | undefined => (v.trim() === '' || !Number.isFinite(Number(v)) ? undefined : Number(v))

export function ItemForm({ draft, onChange, items, isNew }: Props) {
  const cat = CATEGORIES[draft.category]
  const set = <K extends keyof Item>(key: K, value: Item[K]) => onChange({ ...draft, [key]: value })
  const setText = (key: 'creator' | 'posterUrl' | 'genre' | 'series' | 'seriesNum' | 'edition' | 'location' | 'position' | 'notes' | 'barcode' | 'lentTo') => (v: string) =>
    onChange({ ...draft, [key]: v === '' ? undefined : v })

  const locations = useMemo(() => distinct(items, (i) => i.location), [items])
  const genres = useMemo(() => distinct(items, (i) => i.genre), [items])
  const series = useMemo(() => distinct(items, (i) => i.series), [items])
  const same = useMemo(() => (isNew ? findSameTitle(items, draft) : []), [isNew, items, draft])

  const changeCategory = (category: Category) => {
    const formatOk = draft.format in CATEGORIES[category].formats
    onChange({ ...draft, category, format: formatOk ? draft.format : defaultFormat(category) })
  }

  return (
    <div className="grid gap-4">
      {same.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 p-2.5 text-xs text-accent">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            You already have this: {same.map((s) => `${formatLabel(s.category, s.format)}${s.location ? ` (${s.location})` : ''}`).join(', ')}. Save anyway if this is another copy.
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Title" className="col-span-2 sm:col-span-4">
          <input value={draft.title} onChange={(e) => set('title', e.target.value)} required autoFocus={isNew} />
        </Field>
        <Field label="Type">
          <select value={draft.category} onChange={(e) => changeCategory(e.target.value as Category)}>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].singular}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Format">
          <select value={draft.format} onChange={(e) => set('format', e.target.value)}>
            {Object.entries(cat.formats).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
            {!(draft.format in cat.formats) && <option value={draft.format}>{draft.format}</option>}
          </select>
        </Field>
        <Field label="Year">
          <input inputMode="numeric" value={draft.year ?? ''} onChange={(e) => set('year', toNumber(e.target.value))} />
        </Field>
        <Field label={cat.creatorLabel}>
          <input value={draft.creator ?? ''} onChange={(e) => setText('creator')(e.target.value)} />
        </Field>
      </div>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-mute">Where it is</legend>
        <Field label="Status">
          <select value={draft.status} onChange={(e) => set('status', e.target.value as Item['status'])}>
            <option value="owned">Owned</option>
            <option value="wishlist">Wishlist</option>
          </select>
        </Field>
        <Field label="Location" hint="Binder, shelf, room, service">
          <input list="dl-locations" value={draft.location ?? ''} onChange={(e) => setText('location')(e.target.value)} placeholder="Main binder" />
        </Field>
        <Field label="Position" hint="Page · slot, shelf number">
          <input value={draft.position ?? ''} onChange={(e) => setText('position')(e.target.value)} placeholder="Page 12 · C" />
        </Field>
        <Field label="Condition">
          <select value={draft.condition ?? ''} onChange={(e) => set('condition', (e.target.value || undefined) as Condition | undefined)}>
            <option value="">Not set</option>
            {Object.entries(CONDITIONS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Edition" className="col-span-2" hint="Director's cut, steelbook, first pressing…">
          <input value={draft.edition ?? ''} onChange={(e) => setText('edition')(e.target.value)} />
        </Field>
        <Field label="Genre">
          <input list="dl-genres" value={draft.genre ?? ''} onChange={(e) => setText('genre')(e.target.value)} />
        </Field>
        <Field label="Barcode">
          <input inputMode="numeric" value={draft.barcode ?? ''} onChange={(e) => setText('barcode')(e.target.value)} />
        </Field>
        <Field label="Cover image URL" className="col-span-2 sm:col-span-4" hint="Paste an image address, or clear it to remove the cover">
          <input type="url" inputMode="url" value={draft.posterUrl ?? ''} onChange={(e) => setText('posterUrl')(e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Series" className="col-span-2">
          <input list="dl-series" value={draft.series ?? ''} onChange={(e) => setText('series')(e.target.value)} placeholder="Alien" />
        </Field>
        <Field label="Entry #" hint="1, 4A, 3.5…">
          <input value={draft.seriesNum ?? ''} onChange={(e) => setText('seriesNum')(e.target.value)} />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-mute">Purchase, value and lending</legend>
        <Field label="Price paid">
          <input type="number" min="0" step="0.01" inputMode="decimal" value={draft.price ?? ''} onChange={(e) => set('price', toNumber(e.target.value))} />
        </Field>
        <Field label="Bought on">
          <input type="date" max={dayKey()} value={draft.purchasedAt ?? ''} onChange={(e) => set('purchasedAt', e.target.value || undefined)} />
        </Field>
        <Field label="Lent to">
          <input value={draft.lentTo ?? ''} onChange={(e) => onChange({ ...draft, lentTo: e.target.value || undefined, lentAt: e.target.value ? (draft.lentAt ?? dayKey()) : undefined })} />
        </Field>
        <Field label="Lent on">
          <input type="date" max={dayKey()} disabled={!draft.lentTo} value={draft.lentAt ?? ''} onChange={(e) => set('lentAt', e.target.value || undefined)} />
        </Field>
        <Field label="Worth today" hint={draft.valueAt ? `Set ${draft.valueAt}` : 'Your estimate'}>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={draft.currentValue ?? ''}
            onChange={(e) => {
              const n = toNumber(e.target.value)
              onChange({ ...draft, currentValue: n, valueAt: n === undefined ? undefined : dayKey() })
            }}
          />
        </Field>
        {draft.status === 'wishlist' && (
          <>
            <Field label="Priority">
              <select value={draft.priority ?? ''} onChange={(e) => set('priority', (e.target.value || undefined) as Priority | undefined)}>
                <option value="">Not set</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <Field label="Target price" hint="The most you would pay">
              <input type="number" min="0" step="0.01" inputMode="decimal" value={draft.targetPrice ?? ''} onChange={(e) => set('targetPrice', toNumber(e.target.value))} />
            </Field>
          </>
        )}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-mute">Your take</legend>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.finished} onChange={(e) => set('finished', e.target.checked)} />
            {cat.finishedLabel}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.favorite} onChange={(e) => set('favorite', e.target.checked)} />
            Favorite
          </label>
          <Stars value={draft.rating} onChange={(v) => set('rating', v)} />
        </div>
        <Field label="Tags" hint="Separate with commas">
          <TagsInput value={draft.tags} onChange={(tags) => set('tags', tags)} />
        </Field>
        <Field label="Notes">
          <textarea rows={3} value={draft.notes ?? ''} onChange={(e) => setText('notes')(e.target.value)} />
        </Field>
      </fieldset>

      <datalist id="dl-locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
      <datalist id="dl-genres">{genres.map((l) => <option key={l} value={l} />)}</datalist>
      <datalist id="dl-series">{series.map((l) => <option key={l} value={l} />)}</datalist>
    </div>
  )
}
