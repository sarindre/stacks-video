import { useMemo, useRef, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { binderLocations, buildBinder, DEFAULT_SLOTS, formatPosition, nextFreeSlot, pageColumns, SLOT_CHOICES, type Binder } from '../../lib/binder'
import { formatLabel } from '../../lib/catalog'
import type { Item } from '../../lib/types'
import { useLibrary } from '../../hooks/useLibrary'
import { usePref } from '../../hooks/usePref'
import { btnPrimary, btnSecondary } from '../../components/ui'
import { ScreenHelp } from '../../components/ScreenHelp'
import type { Prefill } from '../add/AddDialog'

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

interface Props {
  onOpen: (i: Item) => void
  onAdd: (prefill?: Prefill) => void
}

/** A binder is a location whose positions look like "Page 12 · C". */
export function BinderView({ onOpen, onAdd }: Props) {
  const { items } = useLibrary()
  const locations = useMemo(() => binderLocations(items), [items])
  const [chosen, setChosen] = usePref<string>('binder.location', '')
  const [slotPref, setSlotPref] = usePref<string>('binder.slots', String(DEFAULT_SLOTS))
  const [find, setFind] = useState('')
  const pageRefs = useRef(new Map<number, HTMLElement>())

  const location = locations.includes(chosen) ? chosen : (locations[0] ?? '')
  const binder = useMemo(() => (location ? buildBinder(items, location, Number(slotPref) || DEFAULT_SLOTS) : null), [items, location, slotPref])
  const cols = binder ? pageColumns(binder.slotsPerPage) : 2

  const needle = fold(find.trim())
  const matches = useMemo(() => {
    if (!binder || !needle) return new Set<string>()
    const ids = new Set<string>()
    for (const p of binder.pages) for (const s of p.slots) for (const i of s.items) if (fold(`${i.title} ${i.edition ?? ''}`).includes(needle)) ids.add(i.id)
    return ids
  }, [binder, needle])

  const jumpToFirstMatch = () => {
    if (!binder) return
    const page = binder.pages.find((p) => p.slots.some((s) => s.items.some((i) => matches.has(i.id))))
    if (page) pageRefs.current.get(page.page)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
  }

  // Each time the Add dialog starts a new item it asks for the next free pocket, so adding
  // several in a row walks along the binder.
  const prefillFor = (b: Binder, startAt?: { page: number; slot: number }): Prefill => (current) => {
    const live = buildBinder(current, b.location, b.slotsPerPage)
    const spot = startAt && !live.pages.find((p) => p.page === startAt.page)?.slots[startAt.slot]?.items.length ? startAt : nextFreeSlot(live)
    return { location: b.location, position: formatPosition(spot.page, spot.slot) }
  }

  if (!binder) {
    return (
      <div className="grid gap-4">
        <ScreenHelp id="binder" />
        <div className="mx-auto grid max-w-md place-items-center gap-3 py-12 text-center">
          <h2 className="font-display text-2xl">No binders yet</h2>
          <p className="text-mute">
            A binder is any location where items have positions like <b>Page 12 · C</b>. Add an item with a location such as "Main binder" and a position like that, and it will appear here as a page of pockets.
          </p>
          <button className={btnPrimary} onClick={() => onAdd({ location: 'Main binder', position: 'Page 1 · A' })}>
            <Plus size={16} /> Add the first item
          </button>
        </div>
      </div>
    )
  }

  const total = binder.pages.length * binder.slotsPerPage
  return (
    <div className="grid gap-4">
      <ScreenHelp id="binder" />
      <div className="flex flex-wrap items-end gap-3">
        {locations.length > 1 && (
          <label className="grid min-w-0 gap-1 text-[11px] uppercase tracking-wide text-mute">
            Binder
            <select value={location} onChange={(e) => setChosen(e.target.value)} className="!normal-case">
              {locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-[11px] uppercase tracking-wide text-mute">
          Pockets per page
          <select value={String(binder.slotsPerPage)} onChange={(e) => setSlotPref(e.target.value)} className="!normal-case">
            {[...new Set<number>([...SLOT_CHOICES, binder.slotsPerPage])].sort((a, b) => a - b).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="relative order-last grid min-w-0 basis-full gap-1 text-[11px] uppercase tracking-wide text-mute sm:order-none sm:min-w-40 sm:basis-0 sm:flex-1">
          Find in this binder
          <Search size={15} className="pointer-events-none absolute bottom-2.5 left-3 text-mute" />
          <input
            type="search"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && jumpToFirstMatch()}
            placeholder="Where is…?"
            className="!pl-9 normal-case"
          />
        </label>
        <button className={btnPrimary} onClick={() => onAdd(prefillFor(binder))}>
          <Plus size={16} /> Add to next free pocket
        </button>
      </div>

      <p className="text-sm text-mute" role="status" aria-live="polite">
        {binder.pages.length} pages · {binder.placed} items · {binder.empty} of {total} pockets empty
        {binder.crowded > 0 && <span className="text-accent"> · {binder.crowded} pocket{binder.crowded === 1 ? '' : 's'} hold more than one item</span>}
        {needle && (
          <span className="text-accent">
            {' '}
            · {matches.size} match{matches.size === 1 ? '' : 'es'}{' '}
            {matches.size > 0 && (
              <button className="underline-offset-2 hover:underline" onClick={jumpToFirstMatch}>
                Jump to first
              </button>
            )}
          </span>
        )}
      </p>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr))]">
        {binder.pages.map((p) => (
          <section
            key={p.page}
            ref={(el) => {
              if (el) pageRefs.current.set(p.page, el)
              else pageRefs.current.delete(p.page)
            }}
            aria-label={`Page ${p.page}`}
            className="min-w-0 rounded-xl border border-line bg-surface p-2"
          >
            <h3 className="mb-1.5 px-1 font-display text-sm text-mute">Page {p.page}</h3>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {p.slots.map((s) => {
                const first = s.items[0]
                if (!first) {
                  return (
                    <button
                      key={s.index}
                      onClick={() => onAdd(prefillFor(binder, { page: p.page, slot: s.index }))}
                      aria-label={`Empty pocket, page ${p.page} ${s.label}. Add an item here`}
                      className="group grid min-h-14 place-items-center rounded-lg border border-dashed border-line text-xs text-mute hover:border-accent hover:text-accent"
                    >
                      <span className="group-hover:hidden">{s.label}</span>
                      <Plus size={14} className="hidden group-hover:block" />
                    </button>
                  )
                }
                const hit = matches.has(first.id) || s.items.some((i) => matches.has(i.id))
                return (
                  <button
                    key={s.index}
                    onClick={() => onOpen(first)}
                    aria-label={`${first.title}, page ${p.page} ${s.label}${s.items.length > 1 ? ` and ${s.items.length - 1} more` : ''}`}
                    className={`relative grid min-h-14 min-w-0 content-between gap-0.5 rounded-lg border p-1.5 text-left text-xs transition-colors hover:border-accent ${
                      hit ? 'border-accent bg-accent/20 ring-2 ring-accent' : s.items.length > 1 ? 'border-accent/60 bg-raised' : 'border-line bg-raised'
                    } ${needle && !hit ? 'opacity-40' : ''}`}
                  >
                    <span className="flex items-center justify-between text-[10px] text-mute">
                      {s.label}
                      <span className="uppercase tracking-wide">{formatLabel(first.category, first.format)}</span>
                    </span>
                    <span className="line-clamp-2 break-words font-medium leading-tight">{first.title}</span>
                    {s.items.length > 1 && <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-ink">+{s.items.length - 1}</span>}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {binder.unplaced.length > 0 && (
        <details className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
          <summary className="cursor-pointer text-mute">
            {binder.unplaced.length} item{binder.unplaced.length === 1 ? '' : 's'} in “{binder.location}” without a page and pocket
          </summary>
          <ul className="mt-2 grid gap-1">
            {binder.unplaced.map((i) => (
              <li key={i.id}>
                <button className="text-left hover:text-accent" onClick={() => onOpen(i)}>
                  {i.title}
                </button>{' '}
                <span className="text-mute">{i.position ? `(${i.position})` : '(no position)'}</span>
              </li>
            ))}
          </ul>
          <button className={`${btnSecondary} mt-2`} onClick={() => onAdd(prefillFor(binder))}>
            <Plus size={14} /> Add a new one
          </button>
        </details>
      )}
    </div>
  )
}
