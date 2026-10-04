// Suggested tags: turn what TMDB knows about a film or show (its genres and its keywords) into a small,
// curated set of tags. Raw keywords are never stored, only the tags below, which are our own words.
// Everything here is pure (no network, no storage). The person's own tags are never touched; suggested
// ones are kept in `autoTags` beside them, and any the person dismisses are remembered in `removedTags`.

export interface TagRule {
  tag: string
  /**
   * Keyword phrases that signal this tag. A phrase matches when its words appear together, in order,
   * inside a keyword ("haunted house" matches "haunted house"). Plurals match ("alien" matches "aliens"),
   * and a trailing * makes the last word a prefix ("haunt*" matches "haunted" and "haunting").
   */
  keywords: string[]
}

// Most specific first: when there are more matches than the limit, the early ones win.
export const VOCABULARY: TagRule[] = [
  // sub-genres and creatures
  { tag: 'slasher', keywords: ['slasher', 'masked killer', 'final girl'] },
  { tag: 'zombie', keywords: ['zombie', 'undead'] },
  { tag: 'vampire', keywords: ['vampire', 'dracula'] },
  { tag: 'haunted', keywords: ['haunt*', 'ghost', 'poltergeist'] },
  { tag: 'witchcraft', keywords: ['witch', 'witchcraft', 'sorcery'] },
  { tag: 'kaiju', keywords: ['kaiju', 'giant monster', 'godzilla'] },
  { tag: 'monster', keywords: ['monster', 'creature'] },
  { tag: 'found-footage', keywords: ['found footage', 'handheld camera', 'camcorder'] },
  { tag: 'body-horror', keywords: ['body horror', 'body transformation', 'mutation'] },
  { tag: 'superhero', keywords: ['superhero', 'super hero'] },
  { tag: 'martial-arts', keywords: ['martial arts', 'kung fu', 'karate', 'samurai'] },
  { tag: 'buddy-cop', keywords: ['buddy cop', 'cop buddy'] },
  { tag: 'mockumentary', keywords: ['mockumentary'] },
  { tag: 'film-noir', keywords: ['film noir', 'neo noir', 'noir'] },
  { tag: 'spy', keywords: ['spy', 'espionage', 'secret agent'] },
  { tag: 'pirates', keywords: ['pirate'] },
  { tag: 'cyberpunk', keywords: ['cyberpunk', 'hacker'] },
  // plot and structure
  { tag: 'heist', keywords: ['heist', 'robbery', 'caper'] },
  { tag: 'time-travel', keywords: ['time travel', 'time loop', 'time machine'] },
  { tag: 'whodunit', keywords: ['whodunit', 'murder mystery', 'locked room mystery'] },
  { tag: 'road-trip', keywords: ['road trip', 'road movie'] },
  { tag: 'revenge', keywords: ['revenge', 'vengeance'] },
  { tag: 'survival', keywords: ['survival', 'stranded'] },
  { tag: 'conspiracy', keywords: ['conspiracy', 'cover up'] },
  { tag: 'courtroom', keywords: ['courtroom', 'trial'] },
  { tag: 'prison', keywords: ['prison', 'prisoner', 'prison escape'] },
  { tag: 'disaster', keywords: ['disaster', 'earthquake', 'tsunami', 'volcano'] },
  { tag: 'twist-ending', keywords: ['twist ending', 'surprise ending', 'plot twist'] },
  { tag: 'anthology', keywords: ['anthology', 'omnibus'] },
  { tag: 'coming-of-age', keywords: ['coming of age', 'adolescence'] },
  // worlds and settings
  { tag: 'space', keywords: ['space', 'outer space', 'spacecraft', 'astronaut', 'space station'] },
  { tag: 'alien', keywords: ['alien', 'extraterrestrial', 'first contact'] },
  { tag: 'ai-and-robots', keywords: ['artificial intelligence', 'robot', 'android', 'cyborg'] },
  { tag: 'post-apocalyptic', keywords: ['post apocalyptic', 'post apocalypse', 'apocalypse'] },
  { tag: 'dystopia', keywords: ['dystopia', 'dystopian'] },
  { tag: 'dragons', keywords: ['dragon'] },
  { tag: 'high-school', keywords: ['high school'] },
  { tag: 'small-town', keywords: ['small town'] },
  { tag: 'sports', keywords: ['sport', 'boxing', 'baseball', 'basketball', 'football'] },
  { tag: 'christmas', keywords: ['christmas', 'santa claus', 'xmas'] },
  { tag: 'halloween', keywords: ['halloween'] },
  // origin and look
  { tag: 'based-on-a-true-story', keywords: ['based on true story', 'based on true events', 'true story', 'biography'] },
  { tag: 'based-on-a-book', keywords: ['based on novel', 'based on book', 'based on young adult novel', 'based on children s book'] },
  { tag: 'based-on-a-comic', keywords: ['based on comic', 'based on graphic novel', 'based on manga'] },
  { tag: 'remake', keywords: ['remake', 'reboot'] },
  { tag: 'cult-classic', keywords: ['cult film', 'cult classic'] },
  { tag: 'silent-film', keywords: ['silent film'] },
  { tag: 'black-and-white', keywords: ['black and white'] },
  // mood
  { tag: 'dark-comedy', keywords: ['black comedy', 'dark comedy', 'dark humor'] },
  { tag: 'feel-good', keywords: ['feel good', 'heartwarming'] },
  { tag: 'slow-burn', keywords: ['slow burn'] },
]

export const SUGGESTED_TAGS: string[] = VOCABULARY.map((r) => r.tag)

/** How many suggested tags one title can get, so a busy keyword list doesn't bury the person's own. */
export const MAX_SUGGESTED = 8

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9*]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

function wordMatches(pattern: string, word: string): boolean {
  if (pattern.endsWith('*')) return word.startsWith(pattern.slice(0, -1))
  return word === pattern || word === `${pattern}s` || word === `${pattern}es`
}

/** Does `phrase` occur, word for word, inside `keyword`? */
export function phraseMatches(phrase: string, keyword: string): boolean {
  const p = words(phrase)
  const k = words(keyword)
  if (p.length === 0 || p.length > k.length) return false
  for (let start = 0; start + p.length <= k.length; start++) {
    if (p.every((w, n) => wordMatches(w, k[start + n]!))) return true
  }
  return false
}

export interface TagInput {
  /** TMDB genre labels in TMDB's order, e.g. ["Horror", "Sci-Fi"]. */
  genres: string[]
  /** TMDB keyword names, e.g. ["haunted house", "final girl"]. */
  keywords: string[]
}

const genreTag = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const SKIP_GENRES = new Set(['tv-movie'])

/**
 * The suggested tags for a title: vocabulary matches from its keywords first, then its other genres
 * (the first genre lives in the item's own Genre field). Tags the person has dismissed never come back,
 * and the ones they already have are not repeated.
 */
export function inferTags(input: TagInput, opts: { primaryGenre?: string; dismissed?: string[]; own?: string[]; max?: number } = {}): string[] {
  const blocked = new Set([...(opts.dismissed ?? []), ...(opts.own ?? [])])
  const out: string[] = []
  const add = (tag: string) => {
    if (tag && !blocked.has(tag) && !out.includes(tag)) out.push(tag)
  }

  for (const rule of VOCABULARY) {
    if (rule.keywords.some((phrase) => input.keywords.some((k) => phraseMatches(phrase, k)))) add(rule.tag)
  }
  const primary = genreTag(opts.primaryGenre ?? input.genres[0] ?? '')
  for (const g of input.genres) {
    const t = genreTag(g)
    if (t !== primary && !SKIP_GENRES.has(t)) add(t)
  }
  return out.slice(0, opts.max ?? MAX_SUGGESTED)
}
