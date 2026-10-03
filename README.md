# Stacks Video

*Be kind, rewind.*

A private, local-first tracker for physical media: DVDs, Blu-rays, 4K discs, VHS, games, vinyl, CDs, cassettes and books. Your collection lives in your browser, with no account and no server, and you can back it up to a file whenever you like.

Built with React 19, TypeScript, Vite and Tailwind CSS. It is an installable PWA and works offline.

It wears a corner-video-store look (charcoal and cream, signage red, yellow rental stickers) and a light retro voice: **Rewind** is undo, **In stock?** is "do I own this?", **Coming soon** is the wishlist, and loans are **Rented out** / **Overdue**. The icon is a VHS tape with a rental sticker.

## Getting started

```bash
npm install
npm run dev
```

Open the app, then **Settings** to paste a free TMDB token if you want movie/TV search (see below).

## What it does

- **Collection and wishlist:** every physical copy is its own item, so two copies of a film are two items. Search across titles, series, people, places and notes; filter by type, format, genre, location and status; sort; group by series, genre, location or format; grid or list.
- **Multi-format:** movies, TV, games, music and books, each with its own formats (Blu-ray, 4K UHD, vinyl, paperback, PS5…), plus condition, edition, price, purchase date, tags, rating, notes and a favorite flag.
- **Where it lives:** a free-text *location* ("Main binder", "Living room shelf") and *position* ("Page 12 · C"), with natural sorting so page 2 sorts before page 10.
- **Series:** name and entry number (`4A`, `3.5` and `Prequel` all work), grouped in order.
- **Lending:** record who has something and since when; Stats lists what is out and for how long.
- **Add by search or barcode:** type a title, type or scan a barcode (camera scanning on Chromium browsers, or a USB scanner that types digits). Adding several in a row remembers the last location and format.
- **Duplicate warning:** adding something you already own in any format tells you before you save.
- **Stats:** totals, percent finished, money spent, breakdown by type, format, genre and location, additions per month, recently added, lent out, duplicate copies.
- **Automatic folder backup (Chrome/Edge):** pick a folder, ideally inside OneDrive or Dropbox, and a backup is written a few seconds after every change (latest plus 7 daily copies). It never overwrites a backup with an empty collection.
- **Rewind (undo):** every change (edits, deletes, bulk edits, imports, tidy-ups, even deleting everything) can be undone with the Rewind button, the toast that follows big changes, or Ctrl/Cmd+Z. It remembers the last 30 changes until the page is closed, so it does not replace a backup.
- **Print or save a list:** a clean paper list of your collection or wishlist, grouped by location/genre/series/format, with the columns you pick and subtotals of what you paid and what things are worth. Uses the browser's print, so "Save as PDF" makes a file.
- **Light and dark themes:** follows your device by default, or choose in Settings.
- **Coming soon (wishlist):** priority and target price, sort by priority, a running total of your targets, shop-search links (Amazon, eBay, Discogs, PriceCharting and so on, plain links that send nothing until clicked), and "Mark as bought" to move a wish into your collection.
- **Lending:** record who has something; a banner and red markers appear once it has been out longer than your limit (default 30 days, set in Settings). "Mark returned" clears it.
- **Value:** enter what an item is worth today; Stats shows the total, the change against what you paid, and your most valuable items. Amounts are in USD.
- **Tidy up:** rename or merge genres, locations, series and tags across everything at once (Settings).
- **Series gaps:** for any series you have a film from, shows which other films in the franchise you are missing (from TMDB collections), flags unreleased ones separately, and adds missing ones to your wishlist in the format you usually own. Results are cached for 30 days.
- **In stock?** A shop-friendly check in the header ("do I own this?"). Type a title or scan a barcode and get In stock / Not in stock, exactly where each copy lives, and format-aware answers ("you own it on DVD, not 4K"). Titles work offline.
- **Binder view:** any location with positions like "Page 12 · C" shows as pages of pockets with the empty ones visible, a "where is…?" finder, and "add to next free pocket" that walks along the binder as you add several items.
- **Bulk edit:** Select many items (or a whole series/location group), then set location, genre, series, format, condition, status, flags and tags in one step, or delete them.
- **Backup:** export JSON (full) or CSV (spreadsheet). Import merges after a preview and never deletes or overwrites what you have.
- **Cover art:** *Settings → Find cover art* fills posters, years and genres for movies and TV that have none.

## Lookups

| What | Service | Key needed |
| --- | --- | --- |
| Movies, TV | [TMDB](https://www.themoviedb.org/) | Yes, free. Create an account → Settings → API → copy the **API Read Access Token** into Stacks Video's Settings |
| Books | [Open Library](https://openlibrary.org/) | No |
| Music | [MusicBrainz](https://musicbrainz.org/) + Cover Art Archive | No |
| Disc barcodes | [UPCitemdb](https://www.upcitemdb.com/) free tier (~100 lookups/day) | No |
| Games | [RAWG](https://rawg.io/apidocs) (title search only, no barcodes) | Yes, free. Create an account → API → copy the key into Settings |
| Series / franchises | TMDB collections (same token) | See movies |

This product uses the TMDB API but is not endorsed or certified by TMDB. The token is stored in this browser and only ever sent to TMDB. Disc barcodes are patchy for older titles; when one isn't found, search by title.

## Your data

There is no backend. The collection is in `localStorage` under `shelfkeeper.library.v1`, settings under `shelfkeeper.settings.v1`.

- It is **not synced** between devices. Export on one device, import on the other.
- It is **lost if you clear site data**. The app asks the browser for persistent storage and nags for a backup after 30 days, but exporting is the real protection. If the browser refuses to save, a banner says so.
- Browser storage belongs to the web address. Keep using the same address; if you move hosts, export and import.

## Moving your old Family Movie Vault data

The previous single-page app is kept in `legacy/`. To convert its 49-page binder and Prime list into a Stacks Video backup:

```bash
npm run migrate:legacy                  # binder + Prime list
npm run migrate:legacy -- --supabase    # also pulls movies added through the old Cloud Manager
```

That writes `migration/blockbuster-collection.json` (git-ignored, since it is a personal list). In the app: **Settings → Import** and choose that file. Ids are stable, so importing again changes nothing.

What the converter does: binder page and slot become *location* "Main binder" and *position* "Page 12 · C"; Prime titles become *Digital* items at "Prime Video"; `SF` becomes a "Special features disc" edition; `BR`/`DVD` suffixes set the format; abbreviations (`HP:`, `LoR:`, `PotC:`) are spelled out; the old franchise "genres" are split into a real genre plus a series.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Typecheck and production build (also writes the offline file list into `dist/sw.js`) |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript only |
| `npm run migrate:legacy` | Convert the old app's data (see above) |

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml` (tests, build, publish to GitHub Pages). One-time setup: repo **Settings → Pages → Source: GitHub Actions**. The app uses relative paths, so it works under `/<repo>/`.
