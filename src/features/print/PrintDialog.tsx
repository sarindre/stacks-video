import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import { price } from '../../lib/format'
import type { GroupKey } from '../../lib/filters'
import { buildReport, COLUMN_LABEL, COLUMNS_FOR, DEFAULT_COLUMNS, type Report, type ReportColumn } from '../../lib/report'
import type { Status } from '../../lib/types'
import { useLibrary } from '../../hooks/useLibrary'
import { btnPrimary, chip, Dialog, Field } from '../../components/ui'
import { ScreenHelp } from '../../components/ScreenHelp'

export function PrintDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Print or save a list" wide>
      <Options />
    </Dialog>
  )
}

const GROUPS: [GroupKey, string][] = [['none', 'One list'], ['location', 'By location'], ['genre', 'By genre'], ['series', 'By series'], ['format', 'By format']]

function Options() {
  const { items } = useLibrary()
  const [status, setStatus] = useState<Status>('owned')
  const [group, setGroup] = useState<GroupKey>('location')
  const [columns, setColumns] = useState<Record<Status, ReportColumn[]>>(DEFAULT_COLUMNS)
  const [title, setTitle] = useState('')

  const chosen = columns[status]
  // Keep the columns in their natural order whatever order they were ticked in.
  const report = useMemo(
    () => buildReport(items, { status, group, columns: COLUMNS_FOR[status].filter((c) => chosen.includes(c)), title }),
    [items, status, group, chosen, title],
  )
  const toggle = (c: ReportColumn) => setColumns((cur) => ({ ...cur, [status]: cur[status].includes(c) ? cur[status].filter((x) => x !== c) : [...cur[status], c] }))

  return (
    <div className="grid gap-4">
      <ScreenHelp id="print" defaultOpen={false} />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Which list">
        {(['owned', 'wishlist'] as const).map((s) => (
          <button key={s} aria-pressed={s === status} onClick={() => setStatus(s)} className={`${chip} ${s === status ? 'border-accent bg-accent text-accent-ink' : 'border-line text-mute hover:text-ink'}`}>
            {s === 'owned' ? 'Collection' : 'Wishlist'}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Heading">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={status === 'owned' ? 'My collection' : 'My wishlist'} />
        </Field>
        <Field label="Layout">
          <select value={group} onChange={(e) => setGroup(e.target.value as GroupKey)}>
            {GROUPS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="mb-1 text-xs text-mute">Columns</legend>
        {COLUMNS_FOR[status].map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={chosen.includes(c)} onChange={() => toggle(c)} />
            {COLUMN_LABEL[c]}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button className={btnPrimary} onClick={() => window.print()} disabled={report.totals.count === 0}>
          <Printer size={16} /> Print or save as PDF
        </button>
        <span className="text-sm text-mute">{report.totals.count} item{report.totals.count === 1 ? '' : 's'}. In the print window, choose “Save as PDF” as the printer to make a file.</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <Sheet report={report} />
      </div>

      {/* The copy that is actually printed: lives outside the app so the print stylesheet can show only it. */}
      {createPortal(
        <div className="print-sheet">
          <Sheet report={report} />
        </div>,
        document.body,
      )}
    </div>
  )
}

/** The paper: always black on white, whatever theme the app is in. */
export function Sheet({ report }: { report: Report }) {
  const t = report.totals
  return (
    <article className="sheet bg-white p-6 text-sm text-neutral-900">
      <header className="mb-4 border-b border-neutral-300 pb-3">
        <h1 className="text-2xl font-bold">{report.title}</h1>
        <p className="text-neutral-600">
          {t.count} item{t.count === 1 ? '' : 's'} · {report.generated}
          {report.showTotals && t.paidCount > 0 && ` · paid ${price(t.paid)}`}
          {report.showTotals && t.worthCount > 0 && ` · worth today ${price(t.worth)}`}
          {report.showTotals && t.target > 0 && ` · targets ${price(t.target)}`}
        </p>
      </header>

      {report.sections.map((s, n) => (
        <section key={s.heading + n} className="mb-5">
          {s.heading && (
            <h2 className="mb-1 flex items-baseline justify-between border-b border-neutral-400 pb-0.5 text-base font-semibold">
              <span>{s.heading}</span>
              <span className="text-xs font-normal text-neutral-600">
                {s.count} item{s.count === 1 ? '' : 's'}
                {report.showTotals && s.paid > 0 && ` · paid ${price(s.paid)}`}
                {report.showTotals && s.worth > 0 && ` · worth ${price(s.worth)}`}
              </span>
            </h2>
          )}
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {report.headers.map((h, i) => (
                  <th key={h} className={`border-b border-neutral-300 py-1 pr-3 text-xs font-semibold text-neutral-600 ${report.numeric[i] ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.rows.map((row, r) => (
                <tr key={r} className="align-top">
                  {row.map((c, i) => (
                    <td key={i} className={`border-b border-neutral-100 py-0.5 pr-3 ${report.numeric[i] ? 'text-right tabular-nums' : ''}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {t.count === 0 && <p className="text-neutral-600">Nothing on this list yet.</p>}
    </article>
  )
}
