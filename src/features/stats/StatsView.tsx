import { useMemo, type ReactNode } from 'react'
import { CATEGORIES } from '../../lib/catalog'
import { formatDay } from '../../lib/dates'
import { money, signedMoney } from '../../lib/format'
import { currentLoans, loanLabel } from '../../lib/loans'
import { computeStats, type Count } from '../../lib/stats'
import type { Item } from '../../lib/types'
import { useLibrary } from '../../hooks/useLibrary'
import { Cover } from '../../components/ui'
import { ScreenHelp } from '../../components/ScreenHelp'


export function StatsView({ onOpen }: { onOpen: (i: Item) => void }) {
  const { items, settings } = useLibrary()
  const s = useMemo(() => computeStats(items), [items])

  if (items.length === 0) return <p className="py-16 text-center text-mute">Stats appear once you have added a few items.</p>

  const peak = Math.max(1, ...s.addedByMonth.map((m) => m.count))
  return (
    <div className="grid gap-6">
      <ScreenHelp id="stats" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Owned" value={s.owned.toLocaleString()} />
        <Tile label="Finished" value={s.owned ? `${Math.round((s.finished / s.owned) * 100)}%` : '–'} sub={`${s.finished} of ${s.owned}`} />
        <Tile label="Wishlist" value={s.wishlist.toLocaleString()} sub={s.wishlistTargetCount ? `targets total ${money(s.wishlistTarget)}` : undefined} />
        <Tile label="Value paid" value={s.pricedCount ? money(s.totalValue) : '–'} sub={s.pricedCount ? `${s.pricedCount} priced` : 'Add prices to see this'} />
        <Tile
          label="Worth today"
          value={s.valuedCount ? money(s.estValue) : '–'}
          sub={s.changeCount ? `${signedMoney(s.valueChange)} vs paid, on ${s.changeCount}` : s.valuedCount ? `${s.valuedCount} valued` : 'Enter a value on an item'}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="By type">
          <Bars rows={s.byCategory.map((c) => ({ label: CATEGORIES[c.category].label, count: c.count }))} />
        </Panel>
        <Panel title="By format">
          <Bars rows={s.byFormat} />
        </Panel>
        <Panel title="Top genres">{s.byGenre.length ? <Bars rows={s.byGenre} /> : <Empty>Add genres to see them here.</Empty>}</Panel>
        <Panel title="Where it lives">{s.byLocation.length ? <Bars rows={s.byLocation} /> : <Empty>Add locations to see them here.</Empty>}</Panel>
      </div>

      <Panel title="Added in the last 12 months">
        <div className="flex h-32 items-end gap-1.5" role="img" aria-label={`Items added per month, most recent month ${s.addedByMonth.at(-1)?.count ?? 0}`}>
          {s.addedByMonth.map((m) => (
            <div key={m.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] text-mute">{m.count || ''}</span>
              <div className="w-full rounded-t bg-accent/80" style={{ height: `${(m.count / peak) * 100}%`, minHeight: m.count ? 2 : 0 }} />
              <span className="text-[10px] text-mute">{m.label}</span>
            </div>
          ))}
        </div>
      </Panel>

      {s.recent.length > 0 && (
        <Panel title="Recently added">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {s.recent.map((i) => (
              <button key={i.id} onClick={() => onOpen(i)} className="min-w-0 text-left" aria-label={i.title}>
                <Cover url={i.posterUrl} title={i.title} category={i.category} />
                <p className="mt-1 truncate text-xs">{i.title}</p>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {s.mostValuable.length > 0 && (
        <Panel title="Most valuable">
          <ul className="grid gap-1.5 text-sm">
            {s.mostValuable.map((i) => (
              <li key={i.id} className="flex items-baseline justify-between gap-3">
                <button onClick={() => onOpen(i)} className="min-w-0 truncate text-left hover:text-accent">
                  {i.title}
                </button>
                <span className="shrink-0 tabular-nums">
                  {money(i.currentValue ?? 0)}
                  {i.price !== undefined && <span className="ml-2 text-xs text-mute">paid {money(i.price)}</span>}
                  {i.valueAt && <span className="ml-2 text-xs text-mute">as of {formatDay(i.valueAt)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {s.lent.length > 0 && (
        <Panel title="Rented out">
          <ul className="grid gap-1.5 text-sm">
            {currentLoans(items).map(({ item: i, days }) => (
              <li key={i.id}>
                <button onClick={() => onOpen(i)} className="text-left hover:text-accent">
                  {i.title}
                </button>{' '}
                <span className={settings.loanDays > 0 && days !== null && days >= settings.loanDays ? 'text-bad' : 'text-mute'}>
                  with {i.lentTo}
                  {i.lentAt ? ` since ${formatDay(i.lentAt)}` : ''} ({loanLabel(days)})
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {s.duplicates.length > 0 && (
        <Panel title="Duplicate copies">
          <Bars rows={s.duplicates} suffix="×" />
        </Panel>
      )}
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-xs uppercase tracking-wide text-mute">{label}</p>
      <p className="font-display text-3xl">{value}</p>
      {sub && <p className="text-xs text-mute">{sub}</p>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <h3 className="mb-3 font-display text-lg">{title}</h3>
      {children}
    </section>
  )
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-mute">{children}</p>

function Bars({ rows, suffix = '' }: { rows: Count[]; suffix?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="grid gap-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate" title={r.label}>
            {r.label}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-raised">
            <span className="block h-full rounded-full bg-accent/80" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="w-8 text-right tabular-nums text-mute">
            {r.count}
            {suffix}
          </span>
        </li>
      ))}
    </ul>
  )
}
