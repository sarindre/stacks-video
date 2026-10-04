import { useMemo, useRef, useState } from 'react'
import { Barcode, CircleAlert, CircleCheck, CircleX, Heart, Loader2, Plus } from 'lucide-react'
import { CATEGORIES, CATEGORY_ORDER, formatLabel } from '../../lib/catalog'
import { lookupBarcode, LookupError } from '../../lib/lookup'
import { keysOf } from '../../lib/settings'
import { checkOwned, guessBarcodeCategory, looksLikeBarcode, type CheckResult } from '../../lib/owned'
import type { Category, Item, Status } from '../../lib/types'
import { useLibrary } from '../../hooks/useLibrary'
import { btnPrimary, btnSecondary, chip, Dialog } from '../../components/ui'
import { ScreenHelp } from '../../components/ScreenHelp'
import { TmdbCredit } from '../../components/Attribution'
import { BarcodeScanner, canScan } from '../add/BarcodeScanner'

export interface AddRequest {
  status: Status
  query: string
  category?: Category
}

interface Props {
  open: boolean
  onClose: () => void
  onOpenItem: (i: Item) => void
  onAdd: (r: AddRequest) => void
}

export function CheckDialog(props: Props) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title="Is it in stock?">
      <Checker {...props} />
    </Dialog>
  )
}

interface Resolved {
  title: string
  year?: number
  format?: string
  note?: string
  error?: string
}

const where = (i: Item) => [i.location, i.position].filter(Boolean).join(' · ')

function Checker({ onClose, onOpenItem, onAdd }: Props) {
  const { items, settings } = useLibrary()
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [query, setQuery] = useState('')
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)
  const request = useRef(0)

  const digits = query.replace(/[\s-]/g, '')
  const isCode = looksLikeBarcode(query)

  const localCode = useMemo(() => (isCode ? checkOwned(items, '', { barcode: digits, category }) : null), [items, isCode, digits, category])
  const hasLocalCode = !!localCode && (localCode.exact.length > 0 || localCode.wishlist.length > 0)

  const result: CheckResult | null = useMemo(() => {
    if (isCode) {
      if (hasLocalCode) return localCode
      if (resolved?.title) return checkOwned(items, resolved.title, { category, format: resolved.format, year: resolved.year })
      return null
    }
    return checkOwned(items, query, { category })
  }, [items, isCode, hasLocalCode, localCode, resolved, query, category])

  const lookup = async (code: string) => {
    const id = ++request.current
    setBusy(true)
    setResolved(null)
    try {
      const out = await lookupBarcode(guessBarcodeCategory(code, category), code, keysOf(settings))
      if (id !== request.current) return
      const first = out.results[0]
      setResolved(first ? { title: first.title, year: first.year, format: out.format ?? undefined, note: out.note } : { title: '', error: out.note ?? 'No match for that barcode. Type the title instead.' })
    } catch (e) {
      if (id !== request.current) return
      setResolved({ title: '', error: e instanceof LookupError ? e.message : 'The barcode lookup failed. Type the title instead.' })
    } finally {
      if (id === request.current) setBusy(false)
    }
  }

  const change = (q: string) => {
    request.current++
    setBusy(false)
    setResolved(null)
    setQuery(q)
  }

  const submit = () => {
    if (isCode && !hasLocalCode && !busy) void lookup(digits)
  }

  const subject = isCode ? (resolved?.title || result?.exact[0]?.title || '') : query.trim()
  const askedFormat = result?.missingFormat ? formatLabel((result.exact[0]?.category ?? 'movie') as Category, result.missingFormat) : ''
  const ownedFormats = result ? [...new Set(result.exact.map((i) => formatLabel(i.category, i.format)))].join(', ') : ''

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Type">
        {(['all', ...CATEGORY_ORDER] as const).map((c) => (
          <button
            key={c}
            aria-pressed={c === category}
            onClick={() => {
              setCategory(c)
              setResolved(null)
            }}
            className={`${chip} ${c === category ? 'border-accent bg-accent text-accent-ink' : 'border-line text-mute hover:text-ink'}`}
          >
            {c === 'all' ? 'Anything' : CATEGORIES[c].label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="grid gap-2"
      >
        <div className="flex gap-2">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => change(e.target.value)}
            placeholder="Type a title, or type or scan a barcode"
            aria-label="Title or barcode"
            enterKeyHint="search"
            className="!py-3 !text-base"
          />
          {canScan() && (
            <button type="button" className={btnSecondary} aria-pressed={scanning} onClick={() => setScanning((s) => !s)} title="Scan a barcode with the camera">
              <Barcode size={18} />
              <span className="hidden sm:inline">Scan</span>
            </button>
          )}
        </div>
        {scanning && (
          <BarcodeScanner
            onClose={() => setScanning(false)}
            onDetect={(code) => {
              setScanning(false)
              change(code)
              if (!checkOwned(items, '', { barcode: code, category }).exact.length) void lookup(code.replace(/\D/g, ''))
            }}
          />
        )}
      </form>

      {isCode && !hasLocalCode && !resolved && !busy && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-mute">
          <span>No item of yours has this barcode.</span>
          <button className={btnPrimary} onClick={() => void lookup(digits)}>
            Look it up online
          </button>
        </div>
      )}
      {busy && (
        <p className="flex items-center gap-2 text-sm text-mute" role="status">
          <Loader2 size={16} className="animate-spin" /> Looking up the barcode…
        </p>
      )}
      {resolved?.error && (
        <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-2.5 text-sm text-bad">
          {resolved.error}
        </p>
      )}
      {resolved?.title && resolved.note && <p className="text-sm text-mute">{resolved.note}</p>}
      {resolved?.title && <TmdbCredit compact />}

      {result?.verdict && (
        <div className="grid gap-3">
          <Banner result={result} askedFormat={askedFormat} ownedFormats={ownedFormats} subject={subject} />

          {result.exact.length > 0 && (
            <ul className="grid gap-2" aria-label="Your copies">
              {result.exact.map((i) => (
                <li key={i.id}>
                  <button
                    onClick={() => {
                      onClose()
                      onOpenItem(i)
                    }}
                    className="grid w-full gap-0.5 rounded-xl border border-line bg-bg p-3 text-left hover:border-accent"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {i.title}
                        {i.year && <span className="ml-1.5 font-normal text-mute">{i.year}</span>}
                      </span>
                      <span className="shrink-0 rounded bg-raised px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">{formatLabel(i.category, i.format)}</span>
                    </span>
                    <span className="text-base font-semibold text-accent">{where(i) || 'No location saved'}</span>
                    {(i.edition || i.lentTo || i.condition) && (
                      <span className="text-xs text-mute">
                        {[i.edition, i.condition && `Condition: ${i.condition}`, i.lentTo && `Lent to ${i.lentTo}`].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {result.verdict !== 'owned' && (
            <div className="flex flex-wrap gap-2">
              {result.verdict !== 'wishlist' && (
                <button className={btnSecondary} onClick={() => onAdd({ status: 'wishlist', query: subject || query, category: category === 'all' ? undefined : category })}>
                  <Heart size={14} /> Add to wishlist
                </button>
              )}
              <button className={btnSecondary} onClick={() => onAdd({ status: 'owned', query: subject || query, category: category === 'all' ? undefined : category })}>
                <Plus size={14} /> {result.verdict === 'not-owned' ? 'I own it: add to collection' : 'Add to collection'}
              </button>
            </div>
          )}

          {result.similar.length > 0 && (
            <details className="rounded-xl border border-line bg-bg px-3 py-2 text-sm" open={result.verdict === 'not-owned'}>
              <summary className="cursor-pointer text-mute">
                {result.exact.length ? 'Also similar' : 'Not the same title, but you own'} ({result.similar.length})
              </summary>
              <ul className="mt-2 grid gap-1">
                {result.similar.map((i) => (
                  <li key={i.id}>
                    <button
                      className="flex w-full items-baseline justify-between gap-3 text-left hover:text-accent"
                      onClick={() => {
                        onClose()
                        onOpenItem(i)
                      }}
                    >
                      <span className="min-w-0 truncate">{i.title}</span>
                      <span className="shrink-0 text-xs text-mute">
                        {formatLabel(i.category, i.format)}
                        {where(i) ? ` · ${where(i)}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <ScreenHelp id="check" defaultOpen={false} />
    </div>
  )
}

function Banner({ result, askedFormat, ownedFormats, subject }: { result: CheckResult; askedFormat: string; ownedFormats: string; subject: string }) {
  const n = result.exact.length
  const spec = {
    owned: { Icon: CircleCheck, tone: 'border-good/60 bg-good/10 text-good', head: 'In stock', sub: `You own this: ${n} cop${n === 1 ? 'y' : 'ies'}, ${ownedFormats}` },
    'other-format': { Icon: CircleAlert, tone: 'border-accent/60 bg-accent/10 text-accent', head: `Not on ${askedFormat}`, sub: `You own it on ${ownedFormats}, but not ${askedFormat}.` },
    wishlist: { Icon: Heart, tone: 'border-accent/60 bg-accent/10 text-accent', head: 'Coming soon', sub: 'On your wishlist; you do not own it yet.' },
    'not-owned': { Icon: CircleX, tone: 'border-bad/60 bg-bad/10 text-bad', head: 'Not in stock', sub: result.similar.length ? 'Not in your collection. You own similar titles, see below.' : 'Not in your collection.' },
  }[result.verdict!]
  return (
    <div role="status" aria-live="polite" className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${spec.tone}`}>
      <spec.Icon size={36} className="shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-sign text-xl leading-tight tracking-wide">{spec.head.toUpperCase()}</p>
        {subject && <p className="truncate text-sm text-ink">“{subject}”</p>}
        {spec.sub && <p className="text-sm text-mute">{spec.sub}</p>}
      </div>
    </div>
  )
}
