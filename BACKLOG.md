# Backlog

Status: `[ ]` todo · `[~]` in progress · `[x]` done. Keep this file current: move items as they ship and note the date.

## Next up
- [x] **1. Automatic folder backup.** *(done 2026-10-03; never writes an empty library over a backup; browser-tested with a stubbed picker, the real folder picker dialog is untested)* Pick a folder (e.g. inside OneDrive) and the app saves a backup there a few seconds after every change: latest file plus daily copies. Chromium only (File System Access API); manual export stays as the fallback. *Why: data lives only in the browser, so this is the biggest risk.*
- [x] **2. Bulk edit.** *(done 2026-10-03)* Select many items and set location, position, genre, series, format, status or tags in one step; bulk delete. *Why: the migrated library has 147 items with no genre and nearly all need locations/covers sorted.*
- [x] **3. Shelf / binder view.** *(done 2026-10-03; browser-tested against the real migrated binder: 49 pages, 379 items, 13 empty pockets)* Show a location as a grid of pages and slots (page 12, slots A–H) with empty slots visible; add into the next free slot. *Why: the old app was built around the binder and a plain list loses it.*
- [x] **4. "Do I own this?" quick check.** *(done 2026-10-03; browser-tested with mocked UPC/TMDB; real camera scanning and live services untested)* Fast search or barcode scan with a big OWNED / NOT OWNED answer, usable offline in a shop. Show which formats you own.

## Worth having
- [x] **5. Games lookup.** *(done 2026-10-03; browser-tested with a mocked RAWG, live service untested)* RAWG (free key in Settings) for search, covers and platforms; barcode to title.
- [x] **6. Series completeness.** *(done 2026-10-03; browser-tested with mocked TMDB collections, live service untested. Large crossover series such as MCU have no single TMDB collection and report "no franchise found")* For each series, show owned vs missing entries (TMDB collections) and offer "add missing to wishlist".
- [x] **7. Wishlist upgrades.** *(done 2026-10-03: priority, target price, store-search links, "Mark as bought", priority sort, targets total)* Target price, priority, store-search link.
- [x] **8. Loan reminders.** *(done 2026-10-03: configurable days in Settings, banner, red overdue markers, "Mark returned")* Flag items lent out longer than N days, in the app (no push).
- [x] **9. Value tracking.** *(done 2026-10-03: manual "Worth today", stats tiles and most-valuable list. Amounts are shown in USD; there is no currency setting or conversion)* Manual current-value field next to price paid; stats show the difference. (No good free price API.)
- [x] **10. Manage tags, genres and locations.** *(done 2026-10-03: Settings → Tidy up; also covers series)* One place to rename or merge them across the whole library.

## Polish
- [x] **11. New name, icon and artwork.** *(done 2026-10-03: renamed to Stacks Video, rental-shop look, VHS-tape icon, light retro voice. Trademark and domain availability of the name have NOT been checked)* Icons are still the old "BB" art; "Stacks Video" is a placeholder name.
- [x] **12. Printable shelf list / PDF** for insurance or selling. *(done 2026-10-03: Settings → Print or save a list; uses the browser's print, "Save as PDF" makes the file. Verified in print mode and by generating a 25-page PDF of the migrated library; the PDF itself could not be rendered to an image here)*
- [x] **13. Light theme.** *(done 2026-10-03: Settings → Appearance; follows the device by default; contrast of both palettes is checked by a test)*
- [x] **14. Undo** after delete, bulk edit and import. *(done 2026-10-03: every change is undoable, last 30, in memory only; header button, toast and Ctrl+Z)*

## For the itch.io release
- [x] **16. itch.io package and page.** *(done 2026-10-03: pack script with checks, embedded-mode handling, sample collection, About/credits/TMDB notice, PRIVACY.md, third-party notices, cover and screenshots, docs/ITCH.md)*
- [ ] **17. Pre-publish checks only a person can do:** USPTO trademark search and domain for "Stacks Video" (a first pass is recorded in docs/ITCH.md; MIT license is done), check or delete the old Supabase project, run the real-page checklist in docs/ITCH.md.
- [ ] **18. Barcode scanning on iPhone, Safari and Firefox.** They have no built-in `BarcodeDetector`, so the Scan button is hidden there. A small WASM scanner loaded only when Scan is tapped would fix it. *Most valuable remaining feature for the in-shop use case.*
- [x] **19. Desktop app (Electron).** *(done 2026-10-03: ported from HorrorHub; Windows installer built and the packaged app passes the 21-check audit. macOS and Linux installers are built by the GitHub workflow and are NOT yet verified. Unsigned, so first run needs the right-click → Open route; the unsigned macOS arm64 case is the main unknown)*
- [ ] **19b. Code signing** for Windows (SmartScreen) and macOS (Gatekeeper, notarization), and automatic updates.
- [ ] **20. Test against the live services and real devices:** TMDB, RAWG, UPCitemdb, the camera, the real folder picker and printer, iPhone Safari.
- [ ] **21. Importers for other apps** (Letterboxd, Delicious Library, CLZ, Goodreads) beyond the generic CSV mapping.
- [ ] **22. Accessibility audit** (dialog focus, screen-reader announcements, tap targets).

## Bigger decision
- [ ] **15. Sync between devices.** Needs accounts and a backend (Supabase fits), which cuts against local-first. Only if sharing one collection across phone and computer is really wanted. Cheaper alternative: folder backup (1) plus import.

- [x] **23. TMDB six-month rule.** *(done 2026-10-03: offline images and franchise results expire after ~5 months; items carry a "refreshed on" date; Settings can refresh poster links by id or remove them all; a reminder banner appears when details are getting old. Whether TMDB treats a user's saved collection entries as "cached content" is a legal question that has not been answered; this keeps the footprint minimal and the controls in the user's hands.)*

- [x] **24. Suggested tags from TMDB (movies and TV).** *(done 2026-10-03: 50-tag curated vocabulary, kept apart from your own tags, keep/dismiss on each item, Tag filter, Top tags in Stats, bulk suggest in Settings.)*
- [ ] **25. Suggested tags for games (RAWG tags), books (Open Library subjects) and music (MusicBrainz tags).** Same pattern; needs a vocabulary for each.

- [x] **26. Synopsis and cast page for movies and TV** *(done 2026-10-03: "Synopsis and cast" panel on an item, fetched from TMDB on demand and never stored.)* Possible follow-ups: trailer link, where-to-watch.

## Known gaps (from earlier work)
- Migrated items all show as added on the migration day, so "added per month" has one tall bar.
- Camera barcode scanning needs a Chromium browser.
- Cover matching is conservative; unmatched titles must be fixed by hand (Cover image URL field).

## Done
- [x] Local-first rewrite (React + TypeScript + Vite), multi-format items, search/filter/sort/group, stats, JSON/CSV backup and import, TMDB/Open Library/MusicBrainz/UPC lookups, barcode scan, cover matching, legacy migration, help tab and per-screen help.
