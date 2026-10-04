import { useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { dayKey } from '../../lib/dates'
import { newId } from '../../lib/library'
import { storeLinks } from '../../lib/stores'
import { useLibrary } from '../../hooks/useLibrary'
import type { Item } from '../../lib/types'
import { btnDanger, btnPrimary, btnSecondary, Cover, Dialog } from '../../components/ui'
import { ItemForm } from './ItemForm'
import { hasDetails, TitleDetails } from './TitleDetails'

export function ItemDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  return (
    <Dialog open={!!item} onClose={onClose} title={item ? item.title : 'Item'} wide>
      {item && <Editor key={item.id} item={item} onClose={onClose} />}
    </Dialog>
  )
}

function Editor({ item, onClose }: { item: Item; onClose: () => void }) {
  const { items, updateItem, addItem, removeItem } = useLibrary()
  const [draft, setDraft] = useState(item)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = () => {
    if (!draft.title.trim()) return
    updateItem(item.id, { ...draft, title: draft.title.trim() })
    onClose()
  }

  const copy = () => {
    const now = new Date().toISOString()
    addItem({ ...item, id: newId(), addedAt: now, updatedAt: now, finished: false, rating: 0, favorite: false, lentTo: undefined, lentAt: undefined })
    onClose()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="grid gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <div className="hidden sm:block">
          <Cover url={item.posterUrl} title={item.title} category={item.category} />
        </div>
        <div className="grid gap-4">
          {hasDetails(item) && (
            <TitleDetails
              item={draft}
              onFix={(category, id) =>
                // Point at the right TMDB page. Typed fields and the cover are untouched; suggested tags are re-worked from the new page.
                setDraft({ ...draft, category, ext: { ...draft.ext, tmdb: id }, tmdbAt: dayKey(), autoTags: undefined })
              }
            />
          )}
          <ItemForm draft={draft} onChange={setDraft} items={items} isNew={false} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            {draft.status === 'wishlist' && (
              <button type="button" className={btnSecondary} onClick={() => setDraft({ ...draft, status: 'owned', purchasedAt: dayKey(), priority: undefined, targetPrice: undefined })}>
                Mark as bought
              </button>
            )}
            {draft.lentTo && (
              <button type="button" className={btnSecondary} onClick={() => setDraft({ ...draft, lentTo: undefined, lentAt: undefined })}>
                Mark returned
              </button>
            )}
            <span className="text-mute">{draft.status === 'wishlist' ? 'Find a copy:' : 'Check prices:'}</span>
            {storeLinks(draft).map((l) => (
              <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
                {l.name}
              </a>
            ))}
          </div>
          {item.status === 'wishlist' && draft.status === 'owned' && (
            <p role="status" className="text-sm text-good">
              Marked as bought. Add what you paid and where it lives, then Save.
            </p>
          )}
        </div>
      </div>
      <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center gap-2 border-t border-line bg-surface px-4 py-3">
        <button type="submit" className={btnPrimary} disabled={!draft.title.trim()}>
          Save
        </button>
        <button type="button" className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={btnSecondary} onClick={copy} title="Add another copy of this item">
          <Copy size={14} /> Add a copy
        </button>
        <span className="flex-1" />
        {confirmDelete ? (
          <>
            <span className="text-xs text-mute">Delete for good?</span>
            <button
              type="button"
              className={btnDanger}
              onClick={() => {
                removeItem(item.id)
                onClose()
              }}
            >
              Yes, delete
            </button>
            <button type="button" className={btnSecondary} onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
          </>
        ) : (
          <button type="button" className={btnDanger} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>
    </form>
  )
}
