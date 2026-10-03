import { useEffect } from 'react'
import { Rewind, X } from 'lucide-react'
import { useLibrary } from '../hooks/useLibrary'

const VISIBLE_MS = 9000

/** "Deleted 3 items · Rewind", shown after a notable change and gone after a few seconds. */
export function UndoToast() {
  const { toast, undo, dismissToast } = useLibrary()
  const id = toast?.id

  useEffect(() => {
    if (id === undefined) return
    const t = setTimeout(dismissToast, VISIBLE_MS)
    return () => clearTimeout(t)
  }, [id, dismissToast])

  if (!toast) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[4.5rem] z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-raised p-3 shadow-2xl sm:bottom-4"
    >
      <span className="min-w-0 flex-1 truncate text-sm">{toast.label}</span>
      <button onClick={undo} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:brightness-110">
        <Rewind size={14} /> Rewind
      </button>
      <button onClick={dismissToast} aria-label="Dismiss" className="text-mute hover:text-ink">
        <X size={16} />
      </button>
    </div>
  )
}
