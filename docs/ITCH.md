# itch.io page

The itch.io listing. The page can offer **both**: downloadable installers for Windows, macOS and Linux (the full experience), and an in-browser version for people who just want to look. Decided so far: the classification is **Tools** and pricing is **No payments**, because TMDB's terms treat an app that earns money as commercial (see "Pricing" below).

What to upload (itch.io calls each upload a *channel*):

| Channel | File | How it is made |
| --- | --- | --- |
| `windows` | `StacksVideo-<version>-win-x64.exe` | GitHub workflow (or `npm run desktop:dist` on Windows) |
| `mac` | `StacksVideo-<version>-mac-x64.dmg` and `-arm64.dmg` | GitHub workflow (macOS only) |
| `linux` | `StacksVideo-<version>-linux-x86_64.AppImage` | GitHub workflow (or `npm run desktop:dist` on Linux) |
| `html5` | `stacks-video-html5-v<version>.zip` | `npm run pack:itch` (also done by the workflow) |

Pushing a version tag (`git tag v0.1.0 && git push origin v0.1.0`) builds all of them; see "Setting up automatic uploads" below. By hand: `npm run pack:itch` for the zip, `npm run desktop:dist` for an installer for your own system, and the Actions page for the others.

```bash
npm run store-assets   # (optional) redraws the cover and screenshots in docs/itch/
```

## Page settings
| Field | Value |
| --- | --- |
| Title | Stacks Video |
| Project URL | `stacks-video` (or what's free) |
| Short description / tagline | Catalog your DVDs, games, records and books. Private, offline, and entirely yours. Be kind, rewind. |
| Kind of project | **Downloadable** if the installers are the main thing (as with HorrorHub); **HTML** if the browser version should be what visitors see first. Either way both can be uploaded. |
| Classification | Tools |
| Pricing | No payments |
| Genre | Leave empty, or "Other" |
| Platforms | Windows, macOS, Linux (set automatically from the channel names above), plus "Web" when the zip is flagged as playable in the browser |
| Tags | tool, collection, organizer, movies, dvd, vhs, retro, offline, local-first, privacy |
| Community | Comments on, no ads |
| Mature content | None |

### Uploads and embed
1. Upload the installers (they are recognised by channel name), and upload `release/stacks-video-html5-v<version>.zip` and tick **This file will be played in the browser** (itch.io needs this ticked by hand once; it can't be set from the command line).
2. Embed options:
   - **Viewport:** manually set, `1100 × 760` (the app is responsive and scrolls inside the frame).
   - **Fullscreen button:** on.
   - **Mobile friendly:** on, and **Orientation:** default.
   - **Enable scrollbars:** on.
   - **Automatically start on page load:** off (or on, your taste; there is nothing to wait for).
   - **Click to launch in fullscreen:** off.
3. Don't tick **SharedArrayBuffer support**; the app doesn't use it.

## Description (paste in)

**Stacks Video is a private catalog for the things on your shelves.** DVDs, Blu-rays, VHS, games, records, cassettes and books, with exactly where each one lives. Be kind, rewind.

Everything stays in your browser. No account, no ads, no tracking, nothing uploaded.

- **In stock?** Standing in a shop wondering if you already own it? Type a title or scan the barcode and get "In stock" or "Not in stock", where it lives, and whether you have it in that format (you own it on DVD, but not on 4K).
- **Binder view:** see your disc binder as real pages and pockets, with the empty ones visible and a "where is it?" finder.
- **Every format:** movies, TV, games, music and books, with editions, condition, price paid and what it's worth today.
- **Coming soon:** a wishlist with priorities, target prices and shop links.
- **Synopsis and cast:** open any movie or show matched through TMDB to read the synopsis and see who is in it.
- **Suggested tags:** with a free TMDB key, movies and TV get tags like heist, time-travel or slasher, kept separate from your own so you stay in control.
- **Series gaps:** which films in a franchise you're missing.
- **Lending:** who has what, and a reminder when something is overdue.
- **Rewind:** undo anything, including a delete.
- **Yours to keep:** export backups, import from a spreadsheet, and print a clean shelf list for insurance or selling.
- Light and dark themes, works offline, and installs on your phone from your browser.

**Download it or play it in your browser.** The downloadable version for Windows, macOS and Linux keeps your collection on your computer, can back itself up to a folder you choose, and saves files normally. The browser version needs nothing installed.

**Want to look around first?** On the empty shelf press **Try a sample collection**.

**About the install warning:** the installers aren't code-signed yet, so Windows SmartScreen or macOS Gatekeeper may warn the first time.
- Windows: choose "More info", then "Run anyway".
- macOS: right-click the app, choose Open, then confirm. (Or System Settings → Privacy & Security → "Open Anyway".)
- Linux: make the AppImage executable (`chmod +x StacksVideo-*.AppImage`) and run it.

**Looking things up (optional):** movie and TV details come from TMDB and games from RAWG. Both give out free keys; the app shows you how to get them in about three minutes (Settings). Books, music and barcodes need no key. Without any key you can still add everything by hand.

**About saving your data:** your collection is saved in your browser for this page. That's private, but it also means it can be lost if you clear your browser's site data, and on iPhone or iPad Safari may clear it after about a week away unless you add the page to your Home Screen. Use **Settings → Export backup** now and then. Inside itch.io's player, the automatic backup folder isn't available (the browser blocks it there); if downloads are blocked too, use **Copy backup as text**.

![TMDB](https://raw.githubusercontent.com/sarindre/stacks-video/main/docs/itch/tmdb-logo.png)

*This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.*
Privacy: https://github.com/sarindre/stacks-video/blob/main/PRIVACY.md

**Free and open source (MIT):** https://github.com/sarindre/stacks-video

## Images
All made from the real app with the built-in sample collection (no personal data) by `npm run store-assets`.

| File | Use |
| --- | --- |
| `docs/itch/cover-630x500.png` | **Cover image** (itch.io recommends about 630×500; minimum 315×250) |
| `docs/itch/01-collection.png` | Screenshot 1: the collection with covers. "Every format on one shelf." |
| `docs/itch/02-in-stock.png` | Screenshot 2: "In stock?" with two copies and where they live |
| `docs/itch/03-binder.png` | Screenshot 3: the binder view, empty pockets visible |
| `docs/itch/04-coming-soon.png` | Screenshot 4: the wishlist with priorities |
| `docs/itch/05-stats.png` | Screenshot 5: stats, value and breakdowns |
| `docs/itch/06-collection-light.png` | Screenshot 6: the light theme |
| `docs/itch/07-phone.png` | Screenshot 7: on a phone |

The posters in the screenshots are simple typographic art drawn by the script for the made-up sample titles; nothing is copied from TMDB or from film posters.

## Pricing: why "No payments"
TMDB's terms say an app that is sold or that earns revenue needs a written commercial agreement, and it isn't clear whether an optional tip counts. HorrorHub (the sibling project) reached the same conclusion; see its `docs/TIP-JAR.md`. So the listing is free with no payment or "name your price" option. RAWG's free tier asks for a visible link back to rawg.io, which the app shows. UPCitemdb's free tier is rate-limited (about 100 lookups a day per network address) and may not cover older discs.

## What behaves differently inside itch.io's player
Tested by embedding the packaged app in a page on a different site (like itch does). Things I could not test directly (itch's exact iframe settings, Safari) are marked.

| Feature | Inside the player |
| --- | --- |
| Saving the collection | Works in Chrome. Stored per page. *Safari/Firefox: storage may be partitioned or cleared sooner; unverified.* |
| Automatic backup folder | **Unavailable** (the browser blocks folder access in embedded frames). The app says so and hides the button. |
| Export backup (download) | Works, **unless** itch sandboxes the frame without `allow-downloads` (unverified). If so, use **Copy backup as text** (shown automatically when embedded) and **Paste backup text** to restore. |
| Camera barcode scanning | Works if itch grants camera access to the frame (unverified); otherwise the app falls back to typing the number. Not available in Safari or Firefox at all (no built-in scanner). |
| Offline use | The app caches itself, but itch pages are online by nature. |
| Print / Save as PDF | Works. |

The app shows a one-time notice when it detects it is embedded, and a one-time notice on iPhone/iPad about Safari clearing data.

## Before going public
- [~] **Check the name.** A first pass was done on 2026-10-03 (web searches, itch.io search, DNS). This is **not a legal clearance**; the USPTO trademark database can't be searched this way, so do that yourself at https://tmsearch.uspto.gov before relying on the name.
  - No app, itch.io project or trademark called exactly "Stacks Video" turned up.
  - Close neighbours to be aware of: **Stacks** (the plain name) is used by a personal media/experience tracker on GitHub (`benjamintian2005/stacks`, MIT-0, a live Vercel site), a bookmark app on Google Play, a card-game series on itch.io (*Stacks:Space!* by Stacks:Engine), and the Stacks blockchain. That is why the name carries "Video" and the tagline; don't shorten it to just "Stacks" in the title (the install name is already "Stacks Video"; the short name for home screens is "Stacks").
  - **Domains:** `stacksvideo.com` is already registered (it serves a blank page, so its owner is unknown). `.app`, `.net`, `.io`, `.org` and `stacks-video.com` had no DNS record (probably free, but check at a registrar).
  - Still to do: the USPTO search, and the itch.io project URL `<you>.itch.io/stacks-video` is only claimable from your account.
- [x] **License:** MIT (added 2026-10-03: `LICENSE`, `package.json`, README, About screen, notices). The page description says so.
- [~] The repository **is public** (checked 2026-10-03), so link it on the page ("Source: https://github.com/sarindre/stacks-video") (it is MIT-licensed now). `legacy/` holds the original **721-title movie list** and the old **Supabase publishable key** (`sb_publishable_…` for `prgivcziksnywptcuzoh.supabase.co`, in `legacy/index.html` and `legacy/manage.html`). Both are **already public** in `main`'s history, so removing the folder later hides nothing that's already out. What matters is the key: it is publishable (meant for browsers), but the old app added, edited and deleted rows with it, which implies the `movies` table allows public writes (the project's actual settings can't be seen from here). If you don't want strangers editing it, **check its row-level security, or delete that Supabase project** now that the app no longer uses it.
- [ ] Push a version tag (or run the workflow by hand) and **try each installer from a fresh download**: Windows, macOS (Intel and Apple silicon if you can) and Linux.
- [ ] Upload to a **Draft** page and run the checklist below on the real page.
- [ ] Set the page to Public.

### Checklist on the real itch.io page (needs a person with a browser)
1. The app loads and shows the shelf-is-empty screen with the "embedded" notice.
2. **Try a sample collection** fills it; the Binder, In stock?, Coming soon and Stats screens work.
3. Add an item by hand, reload the page, and check it is still there.
4. **Settings → Export backup** downloads a file. If not, **Copy backup as text** appears; copy, delete the collection, **Paste backup text** restores it.
5. Settings shows "Automatic folder backup is not available…" and no folder button.
6. Chrome: the Scan button offers the camera (or falls back cleanly if blocked).
7. Fullscreen button works and the layout is usable on a phone.
8. About shows the TMDB logo and notice; the privacy link opens.
9. (If you have keys) a TMDB movie search and a RAWG game search return results.

## Uploading with butler (optional)
Manual upload works. To push from the command line later:
```bash
butler push release/stacks-video-html5-v0.1.0.zip <username>/stacks-video:html5 --userversion 0.1.0
```
The first push to a channel creates it. Get an API key at https://itch.io/user/settings/api-keys.

## Setting up automatic uploads
Uploading by hand works too: itch.io's Edit game page lets you upload the files directly. To have a version tag push them for you:

1. Create the project on itch.io (draft is fine) and note its address: `username/project-slug`.
2. Make an API key at https://itch.io/user/settings/api-keys (needed by `butler`, itch.io's upload tool).
3. In the GitHub repo, go to Settings → Secrets and variables → Actions:
   - **Secrets:** add `BUTLER_API_KEY` with the key.
   - **Variables:** add `ITCH_TARGET` with `username/project-slug`.
4. Push a version tag (`git tag v0.1.0 && git push origin v0.1.0`). The workflow (`.github/workflows/desktop.yml`) builds the three installers and the browser zip, publishes a GitHub Release, and pushes each to the channels `windows`, `mac`, `linux` and `html5`.

The first push to a channel creates it. Until the secret and variable exist the step just skips, so tagging never fails because of itch.io. After the first push, open the page's Edit game screen and tick **This file will be played in the browser** on the `html5` file.

## The desktop app
Described in the README. What matters for the page: it removes the limits of the in-browser frame (it can use an automatic backup folder, downloads work normally, the camera is allowed), and its data is stored separately from the browser version, so people moving between them use Export and Import. There are no automatic updates; players download the new version from the page.

**Not verified on this machine:** the macOS and Linux installers (they can only be built on those systems, so the workflow builds them) and whether the unsigned macOS app opens cleanly on Apple-silicon Macs (macOS can be strict about unsigned arm64 apps; the right-click → Open route normally works). Try each installer from a fresh download before making the page public.
