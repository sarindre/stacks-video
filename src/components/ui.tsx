import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { CATEGORIES } from '../lib/catalog'
import type { Category } from '../lib/types'

export const btn = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors'
export const btnPrimary = `${btn} bg-accent text-accent-ink hover:brightness-110`
export const btnSecondary = `${btn} border border-line bg-surface text-ink hover:bg-raised`
export const btnDanger = `${btn} border border-bad/40 text-bad hover:bg-bad/10`
export const chip = 'rounded-full border px-3 py-1 text-xs font-medium transition-colors'

export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 text-xs text-mute ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-[11px] text-mute/80">{hint}</span>}
    </label>
  )
}

/** Native <dialog>: focus trapping, Escape and the backdrop come from the browser. */
export function Dialog({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] overflow-hidden rounded-2xl border border-line bg-surface p-0 shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-xl'}`}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="font-display text-lg">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-mute hover:bg-raised hover:text-ink">
              <X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto p-4">{children}</div>
        </div>
      )}
    </dialog>
  )
}

const TINTS: Record<Category, string> = {
  movie: 'from-amber-900/50 to-stone-900 light:from-amber-200 light:to-stone-100',
  tv: 'from-sky-900/50 to-stone-900 light:from-sky-200 light:to-stone-100',
  game: 'from-emerald-900/50 to-stone-900 light:from-emerald-200 light:to-stone-100',
  music: 'from-fuchsia-900/50 to-stone-900 light:from-fuchsia-200 light:to-stone-100',
  book: 'from-orange-900/50 to-stone-900 light:from-orange-200 light:to-stone-100',
}

/** Cover art with a tinted placeholder when there is none (or it fails to load). */
export function Cover({ url, title, category, className = '' }: { url?: string; title: string; category: Category; className?: string }) {
  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-lg bg-gradient-to-b ${TINTS[category]} ${className}`}>
      <div className="absolute inset-0 flex items-center justify-center p-2 text-center font-display text-xs leading-tight text-ink/70">{title}</div>
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => (e.currentTarget.style.display = 'none')}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  )
}

export function Stars({ value, onChange, label = 'Rating' }: { value: number; onChange?: (v: number) => void; label?: string }) {
  return (
    <div role={onChange ? 'radiogroup' : 'img'} aria-label={`${label}: ${value ? `${value} of 5` : 'unrated'}`} className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => {
        const star = (
          <span className={n <= value ? 'text-accent' : 'text-line'} aria-hidden>
            ★
          </span>
        )
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n === value ? 0 : n)} className="px-0.5 text-xl leading-none">
            {star}
          </button>
        ) : (
          <span key={n} className="text-sm leading-none">
            {star}
          </span>
        )
      })}
    </div>
  )
}

export const categoryLabel = (c: Category) => CATEGORIES[c].label

export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
