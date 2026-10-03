import { useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { listValues, removeValue, renameValue, wouldMerge, type TidyField } from '../../lib/tidy'
import { useLibrary } from '../../hooks/useLibrary'
import { btnDanger, btnPrimary, btnSecondary, chip, Dialog } from '../../components/ui'

const FIELDS: { id: TidyField; label: string; singular: string }[] = [
  { id: 'genre', label: 'Genres', singular: 'genre' },
  { id: 'location', label: 'Locations', singular: 'location' },
  { id: 'series', label: 'Series', singular: 'series' },
  { id: 'tags', label: 'Tags', singular: 'tag' },
]

export function TidyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Tidy up" wide>
      <Tidy />
    </Dialog>
  )
}

function Tidy() {
  const { items, updateMany } = useLibrary()
  const [field, setField] = useState<TidyField>('genre')
  const [onlySimilar, setOnlySimilar] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const info = FIELDS.find((f) => f.id === field)!
  const rows = useMemo(() => listValues(items, field), [items, field])
  const shown = onlySimilar ? rows.filter((r) => r.similar.length > 0) : rows
  const dupes = rows.filter((r) => r.similar.length > 0).length

  const switchField = (f: TidyField) => {
    setField(f)
    setEditing(null)
    setDeleting(null)
    setMessage(null)
  }

  const apply = (patches: Record<string, object>, text: string) => {
    updateMany(patches, text.replace(/\.$/, ''))
    setMessage(text)
    setEditing(null)
    setDeleting(null)
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-mute">
        Rename or merge the names you have typed over time. Renaming to a name that already exists merges them. Changes apply to your collection and wishlist, and cannot be undone, so export a backup first if unsure.
      </p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="What to tidy">
        {FIELDS.map((f) => (
          <button key={f.id} aria-pressed={f.id === field} onClick={() => switchField(f.id)} className={`${chip} ${f.id === field ? 'border-accent bg-accent text-accent-ink' : 'border-line text-mute hover:text-ink'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlySimilar} onChange={(e) => setOnlySimilar(e.target.checked)} />
        Only possible duplicates ({dupes})
      </label>

      {message && (
        <p role="status" className="rounded-lg border border-good/40 p-2.5 text-sm text-good">
          {message}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="py-6 text-center text-mute">{onlySimilar ? 'No similar spellings found.' : `No ${info.label.toLowerCase()} yet.`}</p>
      ) : (
        <ul className="grid gap-1.5" aria-label={info.label}>
          {shown.map((r) => (
            <li key={r.value} className="rounded-lg border border-line bg-bg px-3 py-2">
              {editing === r.value ? (
                <form
                  className="grid gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const res = renameValue(items, field, r.value, draft)
                    apply(res.patches, `Renamed “${r.value}” to “${draft.trim()}” on ${res.changed} item${res.changed === 1 ? '' : 's'}.`)
                  }}
                >
                  <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`New name for ${r.value}`} />
                  {draft.trim() !== '' && draft.trim() !== r.value && wouldMerge(items, field, r.value, draft) && <p className="text-xs text-accent">“{draft.trim()}” already exists, so these will be merged into it.</p>}
                  <div className="flex gap-2">
                    <button type="submit" className={btnPrimary} disabled={draft.trim() === '' || draft.trim() === r.value}>
                      Rename
                    </button>
                    <button type="button" className={btnSecondary} onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : deleting === r.value ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-bad">
                    Remove {info.singular} “{r.value}” from {r.count} item{r.count === 1 ? '' : 's'}? The items stay.
                  </span>
                  <button
                    className={btnDanger}
                    onClick={() => {
                      const res = removeValue(items, field, r.value)
                      apply(res.patches, `Removed “${r.value}” from ${res.changed} item${res.changed === 1 ? '' : 's'}.`)
                    }}
                  >
                    Yes, remove
                  </button>
                  <button className={btnSecondary} onClick={() => setDeleting(null)}>
                    Keep
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1 truncate font-medium" title={r.value}>
                    {r.value}
                  </span>
                  {r.similar.length > 0 && (
                    <span className="rounded-full border border-accent/50 px-2 py-0.5 text-[11px] text-accent" title={`Similar: ${r.similar.join(', ')}`}>
                      Similar to {r.similar.slice(0, 2).join(', ')}
                      {r.similar.length > 2 ? '…' : ''}
                    </span>
                  )}
                  <span className="w-12 text-right text-sm tabular-nums text-mute">{r.count}</span>
                  <button
                    className="text-mute hover:text-ink"
                    aria-label={`Rename ${r.value}`}
                    onClick={() => {
                      setEditing(r.value)
                      setDraft(r.value)
                      setDeleting(null)
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button className="text-mute hover:text-bad" aria-label={`Remove ${r.value}`} onClick={() => { setDeleting(r.value); setEditing(null) }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
