// All help text lives here. When you add a screen or change what one does, update its entry:
// a test fails if a screen has no help. Write for someone who has never seen the app, and use
// the names of buttons as they appear on screen.

export type HelpId = 'collection' | 'wishlist' | 'binder' | 'stats' | 'settings' | 'add' | 'check' | 'series' | 'print'

export interface ScreenHelp {
  title: string
  points: string[]
}

export const SCREEN_HELP: Record<HelpId, ScreenHelp> = {
  collection: {
    title: 'Your collection',
    points: [
      'Each card is one physical copy. Own the same film on DVD and Blu-ray, or two copies of the same disc? Add each one separately.',
      'Tap a card to edit it, record where it lives, lend it out, rate it, or add another copy.',
      'The search box looks at titles, series, people, locations, notes and tags (yours and suggested) all at once. The Tag filter narrows to one tag. "alien binder" finds Alien discs in a binder.',
      'Use Filters, sort and grouping to narrow things down. Group by Series to see a franchise in order, or by Location to see what is on each shelf or binder page.',
      'Press Select to pick many items at once (or Select group on a heading), then Edit to set location, genre, series, format, tags and more for all of them, or delete them. Tick only the fields you want to change.',
      'Icons on a card: a heart is a favorite, a tick means you have watched, played, listened to or read it, and the arrows mean it is lent out (they turn red once it has been out longer than your reminder limit).',
      'Enter what an item is Worth today on its card if you want to track value; Stats shows the total and how it compares with what you paid.',
    ],
  },
  wishlist: {
    title: 'Coming soon (your wishlist)',
    points: [
      'Things you want to buy. They are kept out of your collection counts, stats and total value.',
      'Use Add while this tab is open and the item goes on the wishlist.',
      'Give a wish a Priority and a Target price (the most you would pay) by tapping its card. Sort by Wishlist priority to see the high ones first; the total of your targets is shown above the list.',
      'Tap a card and use Find a copy to search Amazon, eBay and other shops for it. These are plain links; nothing is sent until you click one.',
      'Bought it? Tap the card and press Mark as bought, then fill in what you paid and where it lives, and Save.',
    ],
  },
  print: {
    title: 'Print or save a list',
    points: [
      'Makes a clean paper list of your collection or wishlist: handy for insurance, selling, or a paper backup that does not need any app.',
      'Choose which columns to include and how to lay it out. Grouping by location keeps binder pages in order, and adds subtotals for what you paid and what things are worth when those columns are shown.',
      'Press Print or save as PDF. In the print window, pick “Save as PDF” as the destination to make a file. The paper preview below always prints black on white, whatever theme you use.',
      'Only what you have typed is printed. The list is made on this device and nothing is sent anywhere.',
    ],
  },
  series: {
    title: 'Series gaps',
    points: [
      'Lists every series you have a film from, and can show which other films in that franchise you are missing. Press Check next to a series, or Check all.',
      'Franchises come from TMDB, so this needs your free TMDB token. Only films are checked; TV, games, music and books have no franchise data.',
      'Missing means released, not owned and not on your wishlist. Unreleased films are shown as Upcoming and never counted as missing.',
      'Add to wishlist puts the film on your wishlist in the format you mostly own for that series. Add all missing does the whole series at once.',
      'Wrong answer? Hide an entry you already own under another name (for example a boxed set) and it stops counting. A series is only trusted if the franchise contains a film you own; otherwise it says so rather than guessing.',
      'Results are remembered for 30 days, so you can look at them again without internet. Press Check again to refresh a series.',
    ],
  },
  check: {
    title: 'Is it in stock? (Do I own this?)',
    points: [
      'For when you are in a shop: type a title, or type or scan the barcode, and get a clear answer. It works offline for titles, so it is fine without signal.',
      'The answer is about the exact title. Owning "Aliens" does not count as owning "Alien"; similar titles are listed separately so you can see them.',
      'Each copy you own shows where it lives, such as "Main binder · Page 28 · B", plus its format, edition and whether it is lent out.',
      'Scanning a disc barcode can also tell you the format. If you own the film on DVD but the barcode is the 4K disc, it says so.',
      'A barcode that is not already saved on one of your items needs an internet connection to look up. Pick a type first if you are checking books or music.',
      'Not found? Add to wishlist or Add to collection starts the Add screen with the title already searched.',
    ],
  },
  binder: {
    title: 'Binder',
    points: [
      'Shows a location as the pages and pockets of a binder, with empty pockets visible. It appears for any location whose items have positions like "Page 12 · C" (page number, then pocket letter).',
      'Tap a filled pocket to open the item. Tap an empty pocket to add something there; after saving, Add moves on to the next free pocket so you can fill a page in one go.',
      'Pockets per page sets the grid (8 shows 2 by 4, 9 shows 3 by 3). Stacks Video widens it automatically if an item sits in a pocket past the end.',
      'Find in this binder highlights matches; press Enter to jump to the first one.',
      'A pocket with a "+1" badge holds more than one item, which is usually a typo in one of the positions. Items whose position is not a page and pocket are listed at the bottom.',
    ],
  },
  stats: {
    title: 'Stats',
    points: [
      'Counts only things you own. Wishlist items are left out.',
      'Value paid adds up the prices you entered, so it only covers items that have a price. Worth today adds up the values you entered by hand and compares them with the price paid on items that have both.',
      'Lent out lists who has what and for how long; entries turn red once they pass the reminder limit in Settings.',
      'Duplicate copies means the same title, format and edition owned more than once. A DVD plus a digital copy is not a duplicate.',
      '"Added in the last 12 months" uses the date each item was added to Stacks Video, not the date you bought it.',
    ],
  },
  settings: {
    title: 'Settings, backup and import',
    points: [
      'Everything is stored only in this browser. Nothing is uploaded, so export a backup regularly.',
      'Made a mistake? Press Rewind (undo) at the top, or Ctrl+Z / Cmd+Z when you are not typing. It steps back through your last 30 changes, including deletes, bulk edits, imports, tidy-ups and even deleting the whole collection. Undo is forgotten when you close or reload the page, so it is not a substitute for a backup.',
      'Automatic backup to a folder (Chrome or Edge) saves a copy a few seconds after every change. Pick a folder inside OneDrive, Dropbox or iCloud and your collection survives losing this computer. After restarting the browser you may need to press Reconnect once.',
      'About (at the bottom) has the privacy statement, credits and licenses. If Stacks Video is running inside another website such as itch.io, folder backup is unavailable and a Copy backup as text button appears for when downloads are blocked.',
      'Print or save a list (PDF) makes a paper list for insurance or selling; see its own help inside.',
      'Export backup (JSON) saves everything and is what you want for restoring or moving to another device. Export spreadsheet (CSV) is for editing in Excel or Sheets.',
      'Import shows a preview first. It adds new items and fills blanks, and never deletes or overwrites what you already have, so importing the same file twice is safe.',
      'A CSV needs at least a title column. Other columns it understands include type, format, year, genre, series, location, position, price and tags.',
      'Appearance switches between a dark and a light theme, or follows your device.',
      'Suggested tags: for movies and TV from TMDB, the app can suggest tags (like heist, time-travel or slasher) worked out from TMDB\'s genres and keywords. They show with a ✦ on an item, apart from your own tags. Keep the ones you like or dismiss the rest; dismissed ones never come back. Press Refresh details and suggest tags in Settings to fill them in for everything you have already matched.',
      'TMDB details and the six-month rule: TMDB does not allow its content to be kept for more than six months. Stacks Video keeps only an id, a poster link, a year, a genre label and the suggested tags (never descriptions or the keywords themselves), expires offline pictures and remembered franchise results after about five months, and lets you refresh or remove the poster links and suggested tags here. It never changes anything you typed.',
      'Tidy up (under Organize and reminders) renames or merges genres, locations, series and tags across everything at once. Renaming to a name that already exists merges the two.',
      'Remind me about lent items after sets when a banner appears for things you have lent out too long. Set it to 0 to turn it off.',
      'Movie and TV search needs a free TMDB token and game search a free RAWG key (steps below). Books and music need nothing.',
    ],
  },
  add: {
    title: 'Adding an item',
    points: [
      'Pick a type, then search by title, or type or scan the barcode from the back of the case. Choose a result and check the details.',
      'No match, or no internet? Choose Enter by hand. You can always edit it later.',
      'Save and add another keeps your last type, format and location, which makes cataloguing a whole shelf quick.',
      'A USB barcode scanner works too: click the search box and scan. It types the digits and presses Enter for you.',
      'Games are searched by title using a free RAWG key from Settings (no barcode lookup for games). Each game lists its platforms, and the first is preselected.',
    ],
  },
}

export const GETTING_STARTED: string[] = [
  'Press Add and search for something you own, or choose Enter by hand. Just looking around? On an empty shelf, press Try a sample collection to fill it with made-up titles; you can remove them again in Settings.',
  'Say where it lives, for example "Main binder" and "Page 12 · C" (the Binder tab turns those into a page-by-page view). Stacks Video remembers your last location while you add several in a row.',
  'Already have a list? Go to Settings and Import a CSV or a Stacks Video backup.',
  'For movie and TV search, paste a free TMDB token in Settings. Then use Find cover art to fill in posters for what you have already added.',
  'In a shop, press In stock? at the top, type a title or scan a barcode, and see at once whether you already have it and where it lives.',
  'Export a backup from Settings now and then. Your collection lives only in this browser.',
]

export const GLOSSARY: { term: string; meaning: string }[] = [
  { term: 'Copy', meaning: 'One physical thing on your shelf. Two copies of a film are two items.' },
  { term: 'Format', meaning: 'What it is stored on: DVD, Blu-ray, 4K UHD, vinyl, paperback, PS5, digital and so on. The list changes with the type.' },
  { term: 'Edition', meaning: "Which version: Director's cut, steelbook, first pressing, special features disc. Two editions of a film are not duplicates." },
  { term: 'Location and position', meaning: 'Where it lives. Location is the big place ("Living room shelf", "Main binder", "Prime Video") and position is the spot inside it ("Shelf 3", "Page 12 · C").' },
  { term: 'Series and entry number', meaning: 'A franchise and the item\'s place in it. Entry numbers can be 1, 4A, 3.5 or text like Prequel, and series are sorted in order.' },
  { term: 'Finished', meaning: 'Watched, played, listened to or read, depending on the type.' },
  { term: 'Condition', meaning: 'From New / sealed down to Poor. Handy for insurance and for selling.' },
  { term: 'Lent to', meaning: 'Who has borrowed it. Stats lists everything that is out, and for how long.' },
]

export const FAQ: { q: string; a: string }[] = [
  { q: 'Where is my data stored?', a: 'Only in this browser, on this device. There is no account and nothing is uploaded. That is private, but it also means it is not shared between your phone and computer.' },
  { q: 'How does the automatic folder backup work?', a: 'In Settings, press Choose backup folder (Chrome or Edge only). Stacks Video then writes stacks-video-backup.json there a few seconds after every change, plus a dated copy for each of the last 7 days. It never overwrites a backup with an empty collection. To restore, use Settings, Import and choose the file. Your browser may ask you to Reconnect after a restart; that is a browser rule.' },
  { q: 'How do I move my collection to another device?', a: 'On the old device, Settings, then Export backup (JSON). On the new one, open Stacks Video, then Settings, then Import and choose that file.' },
  { q: 'I cleared my browser data. Is my collection gone?', a: 'Yes, unless you exported a backup. Import your latest backup file to get it back. This is why Stacks Video reminds you to back up.' },
  { q: 'How do I get a TMDB token?', a: 'Create a free account at themoviedb.org, open your profile, then Settings, then API. Copy the "API Read Access Token" (the long one) and paste it into Stacks Video\'s Settings. It stays in this browser and is only sent to TMDB.' },
  { q: 'Can I see the synopsis and cast?', a: 'For movies and TV found through TMDB, open the item and press Synopsis and cast. It shows the synopsis, director or creator, runtime and the main cast, looked up from TMDB when you ask (so it needs your TMDB token and a connection). If it is the wrong title, press Wrong title? and paste the address of the right page from themoviedb.org. It is shown for that visit only and is never saved, to respect the six-month rule TMDB sets.' },
  { q: 'What are the ✦ suggested tags?', a: 'For movies and TV found through TMDB, Stacks Video works out tags such as heist, time-travel or slasher from TMDB\'s genres and keywords. They are kept separate from your own tags and marked with a ✦. Open an item to keep one (it becomes your own tag) or dismiss it (it will not come back). Settings can suggest tags for everything already matched, or remove all the suggestions.' },
  { q: 'How do I get a RAWG key?', a: 'Create a free account at rawg.io, open the API page (rawg.io/apidocs) and copy your key into Stacks Video\'s Settings, under Game lookup. It stays in this browser and is only sent to RAWG. RAWG asks apps to link back to rawg.io, which Stacks Video does on the Add screen.' },
  { q: 'The barcode was not found. What now?', a: 'Disc barcode databases are patchy, especially for older titles. Search by title instead, or choose Enter by hand. The barcode field still saves whatever you type.' },
  { q: 'The Scan button is missing.', a: 'Camera scanning needs a Chromium browser such as Chrome or Edge, and permission to use the camera. Elsewhere, type the number, or use a USB scanner.' },
  { q: 'Can I add the same film twice?', a: 'Yes. Stacks Video warns you when you already own it, and you can still save. Use Add a copy on an existing item to duplicate it quickly.' },
  { q: 'Find cover art matched the wrong poster, or none.', a: 'It only accepts confident matches, so unmatched titles are listed for you to fix. Tap the item and paste an image address into Cover image URL (or clear it to remove the poster).' },
  { q: 'Does it work offline?', a: 'Yes. Once loaded, you can browse and edit offline. Searching and cover art need internet.' },
  { q: 'Can I use it on my phone?', a: 'Yes. In Chrome use the menu and choose Install app. On iPhone use Share, then Add to Home Screen. Remember each device keeps its own collection.' },
]
