# CLAUDE.md

## Project overview
Stacks Video is a private, local-first tracker for physical media (movies, TV, games, music, books). It started as a single-page "Family Movie Vault" for one family's DVD binder (now in `legacy/`) and is being turned into an app anyone can use. Modeled on the sibling project HorrorHub (`../../Horror Hub/horrorhub`): static PWA, no backend, data in the browser, JSON/CSV backup.

## Stack
React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Vite 7, Tailwind CSS 4 (`@tailwindcss/vite`), lucide-react icons, Vitest. Keep runtime dependencies minimal: no router, state library or chart library (stats are plain CSS bars).

## Layout
- `src/lib/*` pure, tested logic. New logic goes here, not in components. `library.ts` (normalize/merge/validate), `csv.ts`, `filters.ts` (filter/sort/group), `stats.ts`, `enrich.ts` (cover matching), `catalog.ts` (categories, formats), `dates.ts`, `settings.ts`, `storage.ts`.
- `src/lib/lookup/*` one file per service (TMDB, Open Library, MusicBrainz, UPC). Each exposes a pure `parse*` function plus a `search*` that takes an injectable `fetcher` so tests never hit the network.
- `src/lib/autoBackup.ts` the folder-backup controller (plain class, tested with `src/test/fakeFolder.ts`); `folderBackup.ts` is the File System Access wrapper; `useAutoBackup.tsx` is its React provider. `bulk.ts` is the pure bulk-edit logic. `binder.ts` (page/pocket grid) and `owned.ts` ("do I own this?") are pure too; `text.ts` holds the shared title normalising. `history.ts` (undo stack), `report.ts` (printable list), `theme.ts`, `loans.ts`, `stores.ts` (shop links) and `tidy.ts` (rename/merge values) are pure too; `format.ts` holds money formatting (USD only). `series.ts` is series-gap logic: strict title matching, picking and verifying a TMDB collection, and the 30-day cache. A series is only trusted if the franchise contains a film the person owns.
- `src/hooks/useLibrary.tsx` the single state owner (context). `usePref.ts` for UI preferences.
- `src/features/<area>/` screens; `src/components/ui.tsx` shared primitives (Dialog on native `<dialog>`, Cover, Stars, Field, button classes).

## Data rules
- Never touch `localStorage` directly; use `src/lib/storage.ts`, `useLibrary` or `usePref`.
- Items are shaped by `normalizeItem`. Everything entering the library (storage, JSON import, CSV import) goes through it. Imports use `validateImport`/`csvToItems` then `mergeLibraries`, which never deletes and never lets an empty field overwrite a filled one.
- When the stored shape changes, bump `LIBRARY_VERSION` and `LIBRARY_KEY` and migrate in `parseStoredLibrary`/the loader. Old keys are left in place as a backup.
- One `Item` = one physical copy. "Duplicate" means same category, format, title and edition; a DVD plus a digital copy is not a duplicate.
- Dates: a "day" is local `YYYY-MM-DD`. Never `new Date('YYYY-MM-DD')` (parsed as UTC); use `parseDay`/`dayKey`. Tests run in `America/Los_Angeles` to catch this.
- CSV export prefixes cells starting with `= + - @` with `'` so spreadsheets don't run them as formulas; import strips it.

## Look and voice
- **Identity:** "Stacks Video", tagline "Be kind, rewind." Corner-video-store look: charcoal and cream, signage red accent, yellow "rental sticker" for format badges, Bungee for the wordmark and big verdicts only, Barlow Condensed for headings (both self-hosted via `@fontsource`, so the app works offline). Icon: a VHS tape with a sticker (`public/icons/icon.svg`; the PNGs were rendered from it).
- **Voice is light and never costs clarity.** Retro names are used for a few features: Rewind = undo, In stock? = "do I own this?", Coming soon = wishlist, Rented out / Overdue = lending. Anywhere the retro word could be unclear, the plain word sits beside it (tooltips, `aria-label`s such as "Rewind (undo)", and the help text, which stays plain and says both). Don't rename more features without the same care.
- Internal storage keys keep the old `shelfkeeper.` prefix and the IndexedDB is still `shelfkeeper`, on purpose: renaming them would orphan saved collections. Don't "fix" them without a migration.

## Distribution (itch.io)
- The browser build must work from any sub-folder and when embedded in a page on another site: **no absolute paths** (`base` is `./`), nothing loaded from third parties at start-up (fonts are bundled). `npm run pack:itch` fails if either is violated.
- Embedded frames differ: no folder picker, downloads may be blocked, camera needs permission. `lib/environment.ts` detects this; keep features degrading gracefully (see the table in `docs/ITCH.md`). A render must never have side effects (an earlier text-backup dialog froze the page by updating a setting while rendering).
- The listing stays **free with no payment option** because of TMDB's terms (`docs/ITCH.md`). TMDB's logo and notice must be shown wherever its data is (`components/Attribution.tsx`, Settings → About).
- `sampleData.ts` is the demo collection used by the "Try a sample collection" button and by the store screenshots. Its ids start with `sample-`.

## Desktop app (Electron)
- `electron/main.cjs` (the window), `preload.cjs` (tells the page it's the desktop app) and `policy.cjs` (which addresses load, which links open externally, which permissions are granted; tested in `src/desktop/policy.test.ts`). The web app is the single source of truth: desktop only changes behaviour through `src/lib/desktop.ts` (`isDesktopApp()`), e.g. no service worker. Don't add Node access to the page. Electron and electron-builder are devDependencies only.
- Permissions are an allow-list: clipboard write, notifications, file system (backup folder) and the **camera only** (never the microphone). Keep it that way; change `policy.cjs` and its tests together.
- The app is served from `app://stacksvideo/`, so its stored data is separate from the browser versions. Storage keys keep the old `shelfkeeper.` prefix there too.
- Check changes with `npm run audit:desktop` (add `-- --packed=<exe>` for a built package). Building installers inside OneDrive can fail (file locks): build to a folder outside it. If Electron starts as plain Node, `ELECTRON_RUN_AS_NODE` is set (`npm run desktop` strips it).
- `.github/workflows/desktop.yml` builds Windows, macOS and Linux installers plus the itch.io zip on a version tag, and pushes to itch.io once `BUTLER_API_KEY` and `ITCH_TARGET` are set.

## Conventions
- **Every change to the library goes through `commit()` in `useLibrary.tsx`** so it lands on the undo stack (`lib/history.ts`). Don't call `setItems` directly elsewhere. Pass a human label for bulk operations (`updateMany(patches, label)`, `addMany(items, label)`); big changes show the Undo toast.
- **Theming:** colours are tokens in `src/index.css` (`@theme` is dark; `:root[data-theme="light"]` overrides it). Use the tokens (`bg-surface`, `text-mute`, `text-accent`…), never fixed colours, except for the printable sheet which is always black on white. Use the `light:` variant for one-off differences. `theme.test.ts` parses the stylesheet and fails if any text/background pair drops below WCAG AA, so adjust values there if you retune the palette. `index.html` has a tiny inline script that sets the theme before first paint; keep it in step with `lib/theme.ts`.
- **Printing:** `PrintDialog` renders the sheet twice, once in the dialog and once in a portal on `<body>` (`.print-sheet`); the `@media print` rules in `index.css` hide `#root` and dialogs so only that copy prints.
- Local-first: don't add a backend or accounts. Lookups are optional and the app must be fully usable offline and with no keys.
- API keys live only in settings (browser) and are sent only to their own service.
- Layout: rows of controls need `flex-wrap`; grid children that hold text need `min-w-0`. Check phone width (390px) after layout changes: no horizontal page scroll.
- Anything that animates must respect `prefers-reduced-motion` (see `index.css`).
- `public/sw.js` gets its file list injected at build time by `vite.config.ts`; never hard-code file names in it.

## Commands
`npm run dev` · `npm test` · `npm run typecheck` · `npm run build` · `npm run migrate:legacy`. Run tests and build before committing.

## Known gaps / ideas
- Planned work is tracked in `BACKLOG.md`; keep it current.
- Auto backup never writes an empty library (so a fresh browser can't wipe a good backup); keep that rule.
- Game lookup is by title only (RAWG has no barcode search); barcode scanning needs `BarcodeDetector` (Chromium).
- Lookup keys travel as `LookupKeys` ({ tmdb, rawg }) from `keysOf(settings)`; never pass a bare token.

- Icons in `public/icons` are still the old "BB" artwork.
- Cover matching is conservative by design; unmatched titles are listed for hand-fixing.
