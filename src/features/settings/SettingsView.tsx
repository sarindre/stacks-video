import { useMemo, useRef, useState, type ReactNode } from 'react'
import { ClipboardPaste, Download, FileUp, FolderSync, ImageDown, Printer, RefreshCw, Trash2 } from 'lucide-react'
import { csvToItems, itemsToCsv } from '../../lib/csv'
import { dayKey, formatDay } from '../../lib/dates'
import { THEME_PREFS } from '../../lib/theme'
import { matchCovers, needsCover, type EnrichProgress } from '../../lib/enrich'
import { keysOf } from '../../lib/settings'
import { buildExport, validateImport, type ImportPlan } from '../../lib/library'
import type { Item } from '../../lib/types'
import { useLibrary } from '../../hooks/useLibrary'
import { ScreenHelp } from '../../components/ScreenHelp'
import { TmdbCredit } from '../../components/Attribution'
import { refreshTargets, refreshTmdb, removeArtworkPatches, removeSuggestionPatches, staleItems, suggestedTagItems, tmdbArtworkItems, TMDB_MAX_AGE_DAYS, type RefreshProgress } from '../../lib/refresh'
import { PrintDialog } from '../print/PrintDialog'
import { AboutSection } from './About'
import { ExportTextDialog, PasteImportDialog } from './BackupTextDialogs'
import { readEnv } from '../../lib/environment'
import { isSample } from '../../lib/sampleData'
import { TidyDialog } from './TidyDialog'
import { useAutoBackup } from '../../hooks/useAutoBackup'
import { ageLabel } from '../../lib/backup'
import { btnDanger, btnPrimary, btnSecondary, chip, download, Field } from '../../components/ui'

interface Preview {
  fileName: string
  incoming: Item[]
  plan: ImportPlan
  dropped: number
  ignoredHeaders: string[]
}

export function SettingsView() {
  const { items, settings, updateSettings, updateMany, removeMany, exportFile, planImport, applyImport, clearAll } = useLibrary()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [tidyOpen, setTidyOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const crossOrigin = useMemo(() => readEnv().crossOrigin, [])
  const fileInput = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<EnrichProgress | null>(null)
  const [coverReport, setCoverReport] = useState<{ text: string; unmatched: string[]; ok: boolean } | null>(null)
  const abort = useRef<AbortController | null>(null)
  const [refreshProgress, setRefreshProgress] = useState<RefreshProgress | null>(null)
  const [refreshReport, setRefreshReport] = useState<{ text: string; ok: boolean } | null>(null)
  const refreshAbort = useRef<AbortController | null>(null)
  const stale = staleItems(items)
  const targets = refreshTargets(items) // the stale ones plus the ones that have never had tags suggested
  const artwork = tmdbArtworkItems(items)
  const suggested = suggestedTagItems(items)
  const keys = keysOf(settings)
  const missing = items.filter((i) => needsCover(i, keys)).length

  const findCovers = async () => {
    const ctl = new AbortController()
    abort.current = ctl
    setCoverReport(null)
    setProgress({ done: 0, total: missing, matched: 0 })
    const out = await matchCovers(items, keys, { signal: ctl.signal, onProgress: setProgress })
    updateMany(out.patches, `Added cover art to ${out.matched} item${out.matched === 1 ? '' : 's'}`)
    setProgress(null)
    abort.current = null
    const text = out.failed
      ? `Stopped early: TMDB did not answer (check your token and connection). ${out.matched} matched before that.`
      : `${out.cancelled ? 'Cancelled. ' : ''}Matched ${out.matched}; ${out.unmatched.length} could not be matched with confidence.`
    setCoverReport({ text, unmatched: out.unmatched, ok: !out.failed })
  }

  const refreshDetails = async () => {
    const ctl = new AbortController()
    refreshAbort.current = ctl
    setRefreshReport(null)
    setRefreshProgress({ done: 0, total: targets.length })
    const out = await refreshTmdb(items, keys, { signal: ctl.signal, onProgress: setRefreshProgress })
    const n = Object.keys(out.patches).length
    updateMany(out.patches, `Refreshed details and suggested tags for ${n} item${n === 1 ? '' : 's'}`)
    setRefreshProgress(null)
    refreshAbort.current = null
    setRefreshReport({
      ok: !out.failed,
      text: out.failed
        ? `Stopped early: TMDB did not answer (check your token and connection). ${n} refreshed before that.`
        : `${out.cancelled ? 'Cancelled. ' : ''}Refreshed ${out.refreshed}${out.gone ? `; ${out.gone} no longer listed by TMDB, so their artwork link was removed` : ''}.`,
    })
  }

  // Turns the text of a backup or CSV into a preview. Shared by file choosing and pasting.
  const showPreview = (text: string, name: string) => {
    setMessage(null)
    setPreview(null)
    try {
      let incoming: Item[]
      let dropped = 0
      let ignoredHeaders: string[] = []
      if (/\.csv$/i.test(name) || !/^\s*[[{]/.test(text)) {
        const parsed = csvToItems(text)
        if ('error' in parsed) return setMessage({ text: parsed.error, ok: false })
        ;({ items: incoming, dropped, ignoredHeaders } = parsed)
      } else {
        const check = validateImport(JSON.parse(text))
        if (!check.ok) return setMessage({ text: check.error, ok: false })
        ;({ items: incoming, dropped } = check)
      }
      setPreview({ fileName: name, incoming, plan: planImport(incoming), dropped, ignoredHeaders })
    } catch {
      setMessage({ text: 'That could not be read. Is it a Stacks Video backup or a CSV?', ok: false })
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      showPreview(await file.text(), file.name)
    } catch {
      setMessage({ text: 'That file could not be read.', ok: false })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const confirmImport = () => {
    if (!preview) return
    applyImport(preview.plan)
    setMessage({ text: `Imported: ${preview.plan.added} added, ${preview.plan.updated} updated, ${preview.plan.skipped} already there.`, ok: true })
    setPreview(null)
  }

  const exportJson = () => {
    download(`stacks-video-${dayKey()}.json`, JSON.stringify(exportFile(), null, 2), 'application/json')
    setMessage({ text: `Saved a backup of ${items.length} items.`, ok: true })
  }
  const exportCsv = () => {
    exportFile()
    download(`stacks-video-${dayKey()}.csv`, itemsToCsv(items), 'text/csv;charset=utf-8')
    setMessage({ text: `Saved a spreadsheet of ${items.length} items.`, ok: true })
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <ScreenHelp id="settings" />
      <Section title="Backup" id="backup">
        <p className="text-sm text-mute">
          Your collection is stored only in this browser. Nothing is uploaded, which also means it is lost if you clear site data or switch devices.
          {settings.lastBackupAt ? ` Last backup: ${ageLabel(settings.lastBackupAt)} (${formatDay(dayKey(new Date(settings.lastBackupAt)))}).` : ' You have not made a backup yet.'}
        </p>
        <FolderBackupCard />
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} onClick={exportJson} disabled={!items.length}>
            <Download size={16} /> Export backup (JSON)
          </button>
          <button className={btnSecondary} onClick={exportCsv} disabled={!items.length}>
            <Download size={16} /> Export spreadsheet (CSV)
          </button>
          <button className={btnSecondary} onClick={() => setPrintOpen(true)} disabled={!items.length}>
            <Printer size={16} /> Print or save a list (PDF)
          </button>
          {crossOrigin && (
            <button className={btnSecondary} onClick={() => setCopyOpen(true)} disabled={!items.length} title="For pages where the browser blocks file downloads">
              <ClipboardPaste size={16} /> Copy backup as text…
            </button>
          )}
        </div>
      </Section>

      <Section title="Import" id="import">
        <p className="text-sm text-mute">
          Choose a Stacks Video backup (.json) or a spreadsheet (.csv with a <b>title</b> column). Importing only adds and fills gaps; it never deletes or overwrites what you have.
        </p>
        <div>
          <input ref={fileInput} type="file" accept=".json,.csv,application/json,text/csv" className="sr-only" id="import-file" onChange={(e) => void onFile(e.target.files?.[0])} />
          <label htmlFor="import-file" className={`${btnSecondary} cursor-pointer`}>
            <FileUp size={16} /> Choose a file…
          </label>
          {crossOrigin && (
            <button className={`${btnSecondary} ml-2`} onClick={() => setPasteOpen(true)}>
              <ClipboardPaste size={16} /> Paste backup text…
            </button>
          )}
        </div>
        {preview && (
          <div className="grid gap-2 rounded-xl border border-accent/40 bg-accent/5 p-3 text-sm">
            <p>
              <b>{preview.fileName}</b>: {preview.incoming.length} items found.
            </p>
            <ul className="list-inside list-disc text-mute">
              <li>{preview.plan.added} would be added</li>
              <li>{preview.plan.updated} would be filled in with missing details</li>
              <li>{preview.plan.skipped} are already in your collection</li>
              {preview.dropped > 0 && <li>{preview.dropped} rows skipped (no title)</li>}
              {preview.ignoredHeaders.length > 0 && <li>Columns ignored: {preview.ignoredHeaders.join(', ')}</li>}
            </ul>
            <div className="flex gap-2">
              <button className={btnPrimary} onClick={confirmImport} disabled={preview.plan.added + preview.plan.updated === 0}>
                Import
              </button>
              <button className={btnSecondary} onClick={() => setPreview(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </Section>

      {message && (
        <p role="status" className={`rounded-lg border p-2.5 text-sm ${message.ok ? 'border-good/40 text-good' : 'border-bad/40 text-bad'}`}>
          {message.text}
        </p>
      )}

      <Section title="Movie and TV lookup" id="lookup">
        <p className="text-sm text-mute">
          Searching movies and TV uses The Movie Database (TMDB). It is free: create an account at themoviedb.org, open Settings → API, and paste the <b>API Read Access Token</b> here. The token stays in this browser and is only sent to TMDB. Books (Open Library) and music (MusicBrainz) need no key.
        </p>
        <Field label="TMDB Read Access Token">
          <input type="password" autoComplete="off" spellCheck={false} value={settings.tmdbToken} onChange={(e) => updateSettings({ tmdbToken: e.target.value.trim() })} placeholder="eyJhbGciOi…" />
        </Field>
        <TmdbCredit />
        <p className="text-xs text-mute">Barcode lookups for discs use UPCitemdb's free tier.</p>
      </Section>

      <Section title="Game lookup" id="games">
        <p className="text-sm text-mute">
          Searching games uses{' '}
          <a href="https://rawg.io/apidocs" target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
            RAWG
          </a>
          . It is free: create an account at rawg.io, open the API page, and paste your key here. It stays in this browser and is only sent to RAWG. RAWG cannot look up barcodes, so search games by title.
        </p>
        <Field label="RAWG API key">
          <input type="password" autoComplete="off" spellCheck={false} value={settings.rawgKey} onChange={(e) => updateSettings({ rawgKey: e.target.value.trim() })} placeholder="32-character key" />
        </Field>
      </Section>

      <Section title="Cover art" id="covers">
        <p className="text-sm text-mute">
          Looks up posters, years and genres for movies and TV (TMDB) and games (RAWG) that have none. It only fills blanks and never changes what you typed, and it skips anything it is not sure about.
          {missing > 0 ? ` ${missing} item${missing === 1 ? '' : 's'} could use it.` : ' Everything already has cover art.'}
        </p>
        {!settings.tmdbToken && !settings.rawgKey && <p className="text-sm text-accent">Add a TMDB token (movies, TV) or a RAWG key (games) above first.</p>}
        <div className="flex flex-wrap items-center gap-2">
          {progress ? (
            <>
              <span role="status" className="text-sm">
                Matching {progress.done} of {progress.total}… ({progress.matched} found)
              </span>
              <button className={btnSecondary} onClick={() => abort.current?.abort()}>
                Cancel
              </button>
            </>
          ) : (
            <button className={btnSecondary} onClick={() => void findCovers()} disabled={missing === 0}>
              <ImageDown size={16} /> Find cover art
            </button>
          )}
        </div>
        {coverReport && (
          <div className={`grid gap-2 text-sm ${coverReport.ok ? 'text-good' : 'text-bad'}`}>
            <p role="status">{coverReport.text}</p>
            {coverReport.unmatched.length > 0 && (
              <details className="text-mute">
                <summary className="cursor-pointer">Titles to check by hand</summary>
                <p className="mt-1 leading-relaxed">{[...new Set(coverReport.unmatched)].sort().join(' · ')}</p>
              </details>
            )}
          </div>
        )}
      </Section>

      <Section title="TMDB details, suggested tags and the six-month rule" id="tmdb-data">
        <p className="text-sm text-mute">
          TMDB's terms don't allow keeping its content for more than six months, so Stacks Video keeps very little: an id, a year, a genre label and a link to each poster, never descriptions or image files. Pictures saved for offline use expire after about five months, as do remembered franchise results. Refreshing re-checks the poster link from each item's id, and suggests tags from TMDB's genres and keywords (shown with a ✦ and kept apart from your own). It <b>never changes anything you typed</b>.
        </p>
        <p className="text-sm">
          {targets.length > 0
            ? `${targets.length} item${targets.length === 1 ? ' is' : 's are'} due: ${stale.length} with TMDB details older than ${Math.round(TMDB_MAX_AGE_DAYS / 30)} months (or undated), and ${targets.length - stale.length} that have not had tags suggested yet.`
            : 'All TMDB details are up to date and tagged.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {refreshProgress ? (
            <>
              <span role="status" className="text-sm">
                Refreshing {refreshProgress.done} of {refreshProgress.total}…
              </span>
              <button className={btnSecondary} onClick={() => refreshAbort.current?.abort()}>
                Cancel
              </button>
            </>
          ) : (
            <button className={btnSecondary} onClick={() => void refreshDetails()} disabled={!settings.tmdbToken || targets.length === 0}>
              <RefreshCw size={16} /> Refresh details and suggest tags ({targets.length})
            </button>
          )}
          <button
            className={btnSecondary}
            disabled={artwork.length === 0}
            onClick={() => updateMany(removeArtworkPatches(items), `Removed ${artwork.length} TMDB artwork link${artwork.length === 1 ? '' : 's'}`)}
            title="Removes the poster links to TMDB's image servers. Your items stay; Rewind brings the links back."
          >
            Remove TMDB artwork links ({artwork.length})
          </button>
        </div>
        <div>
          <button
            className={btnSecondary}
            disabled={suggested.length === 0}
            onClick={() => updateMany(removeSuggestionPatches(items), `Removed suggested tags from ${suggested.length} item${suggested.length === 1 ? '' : 's'}`)}
            title="Removes the ✦ suggested tags. Your own tags stay; Rewind brings the suggestions back."
          >
            Remove suggested tags ({suggested.length})
          </button>
        </div>
        {!settings.tmdbToken && targets.length > 0 && <p className="text-sm text-accent">Add your TMDB token above to refresh and suggest tags.</p>}
        {refreshReport && (
          <p role="status" className={`text-sm ${refreshReport.ok ? 'text-good' : 'text-bad'}`}>
            {refreshReport.text}
          </p>
        )}
      </Section>

      <Section title="Appearance" id="appearance">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
          {THEME_PREFS.map((t) => (
            <button
              key={t.id}
              aria-pressed={settings.theme === t.id}
              onClick={() => updateSettings({ theme: t.id })}
              className={`${chip} ${settings.theme === t.id ? 'border-accent bg-accent text-accent-ink' : 'border-line text-mute hover:text-ink'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Organize and reminders" id="organize">
        <p className="text-sm text-mute">
          Rename or merge genres, locations, series and tags across everything at once, for example to fix "Sci-Fi" and "Sci Fi".
        </p>
        <div>
          <button className={btnSecondary} onClick={() => setTidyOpen(true)}>
            Tidy up genres, locations, series and tags
          </button>
          {items.some(isSample) && (
            <button
              className={`${btnSecondary} ml-2`}
              onClick={() => removeMany(new Set(items.filter(isSample).map((i) => i.id)))}
            >
              Remove the sample items ({items.filter(isSample).length})
            </button>
          )}
        </div>
        <Field label="Remind me about lent items after (days)" hint="0 turns reminders off. A banner appears when something has been out this long.">
          <input
            type="number"
            min="0"
            max="365"
            inputMode="numeric"
            value={settings.loanDays}
            onChange={(e) => updateSettings({ loanDays: Math.min(365, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
          />
        </Field>
      </Section>

      <Section title="Danger zone" id="danger">
        {confirmClear ? (
          <div className="grid gap-2">
            <p className="text-sm text-bad">This removes all {items.length} items from this browser. Export a backup first if you might want them back.</p>
            <div className="flex gap-2">
              <button
                className={btnDanger}
                onClick={() => {
                  clearAll()
                  setConfirmClear(false)
                  setMessage({ text: 'Your collection was cleared.', ok: true })
                }}
              >
                Yes, delete everything
              </button>
              <button className={btnSecondary} onClick={() => setConfirmClear(false)}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button className={btnDanger} onClick={() => setConfirmClear(true)} disabled={!items.length}>
              <Trash2 size={16} /> Delete my whole collection
            </button>
          </div>
        )}
      </Section>
      <AboutSection />
      <TidyDialog open={tidyOpen} onClose={() => setTidyOpen(false)} />
      <ExportTextDialog open={copyOpen} onClose={() => setCopyOpen(false)} getText={() => JSON.stringify(buildExport(items), null, 2)} onCopied={() => updateSettings({ lastBackupAt: new Date().toISOString() })} />
      <PasteImportDialog open={pasteOpen} onClose={() => setPasteOpen(false)} onText={(t) => showPreview(t, 'pasted text')} />
      <PrintDialog open={printOpen} onClose={() => setPrintOpen(false)} />
    </div>
  )
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid gap-3 rounded-xl border border-line bg-surface p-4">
      <h2 id={`${id}-h`} className="font-display text-lg">
        {title}
      </h2>
      {children}
    </section>
  )
}

function FolderBackupCard() {
  const auto = useAutoBackup()
  const [message, setMessage] = useState<string | null>(null)
  if (auto.status === 'unsupported') {
    return (
      <p className="rounded-lg border border-line bg-bg p-3 text-sm text-mute">
        {readEnv().crossOrigin
          ? 'Automatic folder backup is not available while Stacks Video runs inside another website, because the browser blocks folder access there. Use the export buttons below.'
          : 'Automatic folder backup needs Chrome, Edge or another Chromium browser. In this browser, use the export buttons below.'}
      </p>
    )
  }
  return (
    <div className="grid gap-2 rounded-lg border border-line bg-bg p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <FolderSync size={16} className="text-accent" /> Automatic backup to a folder
      </p>
      {auto.status === 'ready' || auto.status === 'error' || auto.status === 'needs-permission' ? (
        <>
          <p className="text-sm text-mute">
            {auto.status === 'ready' && <>Saving to <b>{auto.folderName}</b> a few seconds after every change, keeping a copy for each of the last 7 days.</>}
            {auto.status === 'needs-permission' && <>The browser needs your permission again to write to <b>{auto.folderName}</b>. This is normal after restarting the browser.</>}
            {auto.status === 'error' && <>Could not write to <b>{auto.folderName}</b>: {auto.error}</>}
          </p>
          <div className="flex flex-wrap gap-2">
            {auto.status === 'needs-permission' && (
              <button className={btnPrimary} onClick={() => void auto.reconnect()}>
                Reconnect
              </button>
            )}
            {auto.status !== 'needs-permission' && (
              <button className={btnSecondary} disabled={auto.busy} onClick={() => void auto.backupNow().then((ok) => setMessage(ok ? 'Backed up.' : 'Nothing to back up yet.'))}>
                Back up now
              </button>
            )}
            <button className={btnSecondary} onClick={() => void auto.choose()}>
              Change folder
            </button>
            <button className={btnSecondary} onClick={() => void auto.disable()}>
              Stop
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-mute">
            Pick a folder, ideally inside OneDrive, Dropbox or iCloud so it is also protected if this computer is lost. Stacks Video keeps it up to date automatically. It never overwrites a backup with an empty collection.
          </p>
          <div>
            <button className={btnPrimary} disabled={auto.status === 'loading'} onClick={() => void auto.choose()}>
              Choose backup folder
            </button>
          </div>
        </>
      )}
      {auto.error && auto.status !== 'error' && <p className="text-sm text-bad">{auto.error}</p>}
      {message && <p role="status" className="text-sm text-good">{message}</p>}
    </div>
  )
}
