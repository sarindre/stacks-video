import { Check, Heart, Share2 } from 'lucide-react'
import { CATEGORIES, formatLabel } from '../../lib/catalog'
import type { Item } from '../../lib/types'
import { daysSince } from '../../lib/dates'
import { price } from '../../lib/format'
import { useLibrary } from '../../hooks/useLibrary'
import { Cover, Stars } from '../../components/ui'

const where = (i: Item) => [i.location, i.position].filter(Boolean).join(' · ')
const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' } as const
const wishLine = (i: Item) => [i.priority && PRIORITY_LABEL[i.priority], i.targetPrice !== undefined && `up to ${price(i.targetPrice)}`].filter(Boolean).join(' · ')

/** Lent out for at least the reminder threshold (Settings). */
function useOverdue(item: Item): boolean {
  const { settings } = useLibrary()
  if (!item.lentTo || !item.lentAt || settings.loanDays <= 0) return false
  const d = daysSince(item.lentAt)
  return d !== null && d >= settings.loanDays
}

interface SelectProps {
  selecting?: boolean
  selected?: boolean
}

export function ItemCard({ item, onOpen, selecting, selected }: { item: Item; onOpen: (i: Item) => void } & SelectProps) {
  const overdue = useOverdue(item)
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`fade-in group flex min-w-0 flex-col gap-1.5 rounded-xl p-1.5 text-left hover:bg-surface ${selected ? 'bg-accent/10 ring-2 ring-accent' : ''}`}
      aria-label={`${item.title}, ${formatLabel(item.category, item.format)}`}
      aria-pressed={selecting ? !!selected : undefined}
    >
      <div className="relative">
        <Cover url={item.posterUrl} title={item.title} category={item.category} />
        <span className="absolute left-1.5 top-1.5 rounded-sm bg-sticker px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sticker-ink shadow-sm">
          {formatLabel(item.category, item.format)}
        </span>
        {selecting && (
          <span className={`absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border-2 ${selected ? 'border-accent bg-accent text-accent-ink' : 'border-ink/70 bg-bg/60'}`} aria-hidden>
            {selected && <Check size={12} strokeWidth={3} />}
          </span>
        )}
        <span className="absolute bottom-1.5 right-1.5 flex gap-1">
          {item.lentTo && (
            <span className={`rounded-full bg-bg/85 p-1 ${overdue ? 'text-bad' : 'text-accent'}`} title={`Lent to ${item.lentTo}${overdue ? ' (overdue)' : ''}`}>
              <Share2 size={12} />
            </span>
          )}
          {item.favorite && (
            <span className="rounded-full bg-bg/85 p-1 text-accent" title="Favorite">
              <Heart size={12} fill="currentColor" />
            </span>
          )}
          {item.finished && (
            <span className="rounded-full bg-bg/85 p-1 text-good" title={CATEGORIES[item.category].finishedLabel}>
              <Check size={12} />
            </span>
          )}
        </span>
      </div>
      <div className="min-w-0 px-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</p>
        <p className="truncate text-xs text-mute">{(item.status === 'wishlist' ? wishLine(item) : '') || where(item) || item.year || ' '}</p>
        {item.rating > 0 && <Stars value={item.rating} />}
      </div>
    </button>
  )
}

export function ItemRow({ item, onOpen, selecting, selected }: { item: Item; onOpen: (i: Item) => void } & SelectProps) {
  const overdue = useOverdue(item)
  return (
    <button type="button" onClick={() => onOpen(item)} aria-pressed={selecting ? !!selected : undefined} className={`flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface ${selected ? 'bg-accent/10 ring-1 ring-accent' : ''}`}>
      {selecting && (
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selected ? 'border-accent bg-accent text-accent-ink' : 'border-mute'}`} aria-hidden>
          {selected && <Check size={12} strokeWidth={3} />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {item.title}
          {item.year && <span className="ml-1.5 font-normal text-mute">{item.year}</span>}
        </span>
        <span className="block truncate text-xs text-mute">{[item.series && `${item.series}${item.seriesNum ? ` #${item.seriesNum}` : ''}`, item.edition].filter(Boolean).join(' · ') || ' '}</span>
      </span>
      <span className="hidden w-48 shrink-0 truncate text-xs text-mute sm:block">{(item.status === 'wishlist' ? wishLine(item) : '') || where(item)}</span>
      <span className="w-20 shrink-0 text-right text-[11px] font-semibold uppercase tracking-wide text-mute">{formatLabel(item.category, item.format)}</span>
      <span className="flex w-14 shrink-0 justify-end gap-1.5 text-accent">
        {item.lentTo && <Share2 size={13} className={overdue ? 'text-bad' : ''} aria-label={`Lent to ${item.lentTo}${overdue ? ' (overdue)' : ''}`} />}
        {item.favorite && <Heart size={13} fill="currentColor" aria-label="Favorite" />}
        {item.finished && <Check size={13} className="text-good" aria-label="Finished" />}
      </span>
    </button>
  )
}
