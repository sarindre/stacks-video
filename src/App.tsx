import { useEffect, useMemo, useState } from 'react'
import { BarChart3, BookOpen, Bookmark, CircleHelp, Library, Plus, ScanSearch, Settings as Gear, TriangleAlert, Rewind } from 'lucide-react'
import type { Category, Item, Status } from './lib/types'
import { overdueLoans, loanLabel } from './lib/loans'
import { noticesFor, readEnv } from './lib/environment'
import { applyTheme, watchSystemTheme } from './lib/theme'
import { backupDue } from './lib/settings'
import { useAutoBackup } from './hooks/useAutoBackup'
import { useLibrary } from './hooks/useLibrary'
import { AddDialog, type Prefill } from './features/add/AddDialog'
import { BinderView } from './features/binder/BinderView'
import { CheckDialog, type AddRequest } from './features/check/CheckDialog'
import { ItemDialog } from './features/library/ItemDialog'
import { HelpView } from './features/help/HelpView'
import { LibraryView } from './features/library/LibraryView'
import { SettingsView } from './features/settings/SettingsView'
import { StatsView } from './features/stats/StatsView'
import { btnPrimary, btnSecondary } from './components/ui'
import { UndoToast } from './components/UndoToast'

type Tab = 'collection' | 'wishlist' | 'binder' | 'stats' | 'settings' | 'help'

const TABS: { id: Tab; label: string; icon: typeof Library }[] = [
  { id: 'collection', label: 'Collection', icon: Library },
  { id: 'wishlist', label: 'Coming soon', icon: Bookmark },
  { id: 'binder', label: 'Binder', icon: BookOpen },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Gear },
  { id: 'help', label: 'Help', icon: CircleHelp },
]

export default function App() {
  const { items, settings, saveFailed, undo, undoLabel, updateSettings } = useLibrary()
  const auto = useAutoBackup()
  const [tab, setTab] = useState<Tab>('collection')
  const [adding, setAdding] = useState(false)
  const [prefill, setPrefill] = useState<Prefill | undefined>(undefined)
  const [addOpts, setAddOpts] = useState<{ status?: Status; query?: string; category?: Category }>({})
  const [checking, setChecking] = useState(false)
  const openAdd = (p?: Prefill, opts: { status?: Status; query?: string; category?: Category } = {}) => {
    setPrefill(p ? () => p : undefined)
    setAddOpts(opts)
    setAdding(true)
  }
  const addFromCheck = (r: AddRequest) => {
    setChecking(false)
    openAdd(undefined, r)
  }
  const [openId, setOpenId] = useState<string | null>(null)
  const open: Item | null = items.find((i) => i.id === openId) ?? null
  const showBackup = tab !== 'settings' && !saveFailed && !auto.active && auto.status !== 'loading' && backupDue(settings.lastBackupAt, items.length)
  const status = tab === 'wishlist' ? 'wishlist' : 'owned'
  const [loansDismissed, setLoansDismissed] = useState(false)
  const notice = useMemo(() => noticesFor(readEnv()).find((n) => !settings.dismissedNotices.includes(n.id)), [settings.dismissedNotices])

  // Apply the chosen theme, and follow the device if the choice is "match my device".
  useEffect(() => {
    applyTheme(settings.theme)
    return settings.theme === 'system' ? watchSystemTheme(() => applyTheme('system')) : undefined
  }, [settings.theme])

  // Ctrl/Cmd+Z undoes the last change, but never steals the shortcut from a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      if (document.querySelector('dialog[open]')) return
      e.preventDefault()
      undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])
  const overdue = useMemo(() => overdueLoans(items, settings.loanDays), [items, settings.loanDays])

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-3 pb-24 sm:px-5 sm:pb-8">
      <header className="sticky top-0 z-20 -mx-3 flex h-14 items-center gap-3 border-b border-line bg-bg/95 px-3 backdrop-blur sm:-mx-5 sm:px-5">
        <h1 className="flex items-baseline gap-2 whitespace-nowrap leading-none" aria-label="Stacks Video">
          <span className="font-sign text-xl tracking-wide" aria-hidden>
            STACKS<span className="text-accent"> VIDEO</span>
          </span>
          <span className="hidden font-display text-sm font-semibold uppercase tracking-widest text-mute xl:inline">Be kind, rewind.</span>
        </h1>
        <nav aria-label="Main" className="ml-4 hidden gap-1 sm:flex">
          {TABS.map((t) => (
            <TabButton key={t.id} tab={t} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
        </nav>
        <span className="flex-1" />
        {undoLabel && (
          <button className={btnSecondary} onClick={undo} title={`Rewind (undo): ${undoLabel}`} aria-label={`Rewind (undo): ${undoLabel}`}>
            <Rewind size={16} />
            <span className="hidden lg:inline">Rewind</span>
          </button>
        )}
        <button className={btnSecondary} onClick={() => setChecking(true)} title="Is it in stock? (Do I own this?)" aria-label="Is it in stock? (Do I own this?)">
          <ScanSearch size={16} />
          <span className="hidden sm:inline">In stock?</span>
        </button>
        <button className={btnPrimary} onClick={() => openAdd()}>
          <Plus size={16} /> Add
        </button>
      </header>

      {saveFailed && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            Your browser would not save the last change (storage may be full or blocked). Export a backup from Settings so nothing is lost.
          </span>
        </p>
      )}
      {notice && (
        <p role="note" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface p-3 text-sm text-mute">
          <span className="min-w-0 flex-1">{notice.text}</span>
          <button className="text-accent underline-offset-2 hover:underline" onClick={() => updateSettings({ dismissedNotices: [...settings.dismissedNotices, notice.id] })}>
            Got it
          </button>
        </p>
      )}
      {overdue.length > 0 && !loansDismissed && (
        <p role="status" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm text-accent">
          <span>
            <b>Overdue:</b> {overdue.length === 1 ? '1 item has' : `${overdue.length} items have`} been out for {settings.loanDays}+ days:{' '}
            {overdue.slice(0, 3).map((l) => `${l.item.title} (${l.item.lentTo}, ${loanLabel(l.days)})`).join('; ')}
            {overdue.length > 3 ? `; and ${overdue.length - 3} more` : ''}.
          </span>
          <button className="underline-offset-2 hover:underline" onClick={() => setTab('stats')}>
            See who has what
          </button>
          <button className="underline-offset-2 hover:underline" onClick={() => setLoansDismissed(true)}>
            Dismiss
          </button>
        </p>
      )}
      {showBackup && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface p-3 text-sm text-mute">
          <span>Your collection lives only in this browser. {settings.lastBackupAt ? 'It has been a while since your last backup.' : 'You have not made a backup yet.'}</span>
          <button className="text-accent underline-offset-2 hover:underline" onClick={() => setTab('settings')}>
            Back up now
          </button>
        </p>
      )}

      <main className="flex-1 pt-4">
        {(tab === 'collection' || tab === 'wishlist') && (
          <LibraryView key={tab} status={status} onOpen={(i) => setOpenId(i.id)} onAdd={() => openAdd()} onImport={() => setTab('settings')} />
        )}
        {tab === 'binder' && <BinderView onOpen={(i) => setOpenId(i.id)} onAdd={openAdd} />}
        {tab === 'stats' && <StatsView onOpen={(i) => setOpenId(i.id)} />}
        {tab === 'settings' && <SettingsView />}
        {tab === 'help' && <HelpView />}
      </main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {TABS.map((t) => (
          <TabButton key={t.id} tab={t} active={tab === t.id} onClick={() => setTab(t.id)} stacked />
        ))}
      </nav>

      <AddDialog
        key={`${addOpts.status}|${addOpts.query}`}
        open={adding}
        onClose={() => setAdding(false)}
        status={addOpts.status ?? (tab === 'binder' ? 'owned' : status)}
        prefill={prefill}
        initialQuery={addOpts.query}
        initialCategory={addOpts.category}
      />
      <UndoToast />
      <CheckDialog open={checking} onClose={() => setChecking(false)} onOpenItem={(i) => setOpenId(i.id)} onAdd={addFromCheck} />
      <ItemDialog item={open} onClose={() => setOpenId(null)} />
    </div>
  )
}

function TabButton({ tab, active, onClick, stacked = false }: { tab: (typeof TABS)[number]; active: boolean; onClick: () => void; stacked?: boolean }) {
  const Icon = tab.icon
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center justify-center gap-1.5 text-sm transition-colors ${
        stacked ? 'flex-1 flex-col py-2.5 text-[11px]' : 'rounded-lg px-3 py-1.5'
      } ${active ? 'text-accent' : 'text-mute hover:text-ink'} ${active && !stacked ? 'bg-surface' : ''}`}
    >
      <Icon size={stacked ? 20 : 16} />
      {tab.label}
    </button>
  )
}
