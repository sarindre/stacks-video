# Privacy

*Draft. Not legal advice. Review and update it before any store release, and whenever the app changes what it sends.*

Stacks Video is built to keep your information on your own device.

## What stays on your device
Your collection, wishlist, notes, tags, loans, values, settings and API keys are stored **only on the device you use**: in the browser's storage, or in the desktop app's own data folder. There are no accounts and no Stacks Video servers, so nothing about you or your collection is sent to the developer.

If you choose an automatic backup folder or press Export, the files are written where you choose. They are never uploaded anywhere by Stacks Video. Exports and backups contain your collection and wishlist but **never your API keys**.

## What Stacks Video sends over the internet
Stacks Video contacts these services only when a feature needs them, using your own key where one is needed:

| Service | What is sent | Why |
| --- | --- | --- |
| **TMDB** (api.themoviedb.org, image.tmdb.org) | Titles you search for, TMDB ids of items in your collection (to refresh them and suggest tags), and your TMDB token. Poster images are requested from their image servers | Movie and TV details, posters, franchises (Series gaps), suggested tags, and the synopsis and cast shown on request (not saved) |
| **RAWG** (api.rawg.io) | Titles you search for and your RAWG key | Game details |
| **Open Library** (openlibrary.org, covers.openlibrary.org) | Titles, authors or ISBNs you search for | Book details and covers |
| **MusicBrainz** (musicbrainz.org) and **Cover Art Archive** (coverartarchive.org) | Titles, artists or barcodes you search for | Music details and covers |
| **UPCitemdb** (api.upcitemdb.com) | A barcode you scan or type | Looking up what a disc barcode is |
| **The site hosting the app** (for example itch.io or GitHub Pages) | Your browser asks it to send the app's files. (The desktop app contains its files and does not need this) | They may keep ordinary server logs (such as your IP address). See their own privacy statements |

Those services have their own privacy policies and can see your network address when your device contacts them. Stacks Video adds no analytics, advertising or tracking of its own, and loads no third-party fonts or scripts. Fonts are bundled with the app.

The desktop app grants its pages only three permissions: copying to the clipboard, choosing a backup folder, and the camera. It refuses the microphone, location and everything else.

Camera access, if you use barcode scanning, is used only to read the barcode on your device. Nothing from the camera is recorded or sent anywhere.

## Things kept to make the app work offline
To work without internet, the app keeps its own files and some cover images you have viewed on your device. Cover images and remembered franchise results are deleted automatically after about five months (TMDB does not allow its content to be kept longer than six), and Settings can refresh or remove the poster links stored with your items. Clearing the site's data in your browser erases all of it, together with your collection. In the desktop app, deleting its data folder does the same.

## Your control
- **Export** gives you your data in a file (or as text) at any time. **Import** brings it back.
- **Delete my whole collection** (Settings) erases the collection from this device; **Rewind** can bring it back until you close the page.
- Removing your API keys (or never adding them) stops all requests that use them.
- Nothing is ever shared with other people unless you export a file and send it yourself.

## Where your data lives, and losing it
Because the data lives in your browser, it can be lost if you clear site data, if the browser decides to free space, or (on iPhone and iPad) if Safari clears a site you have not visited for about a week and you have not added it to your Home Screen. Export a backup now and then. Stacks Video reminds you.

## Children
Stacks Video has no accounts and collects no personal information. Lookups can return titles that are not suitable for children.

## Changes
If this changes, the new version will be in this file in the repository, with the date.

## Contact
Questions: open an issue at https://github.com/sarindre/Blockbuster-App/issues
