// Where is the app running? A page embedded in another site (itch.io's player, a blog) and Safari
// on an iPhone each behave differently from a normal browser tab in ways that matter to an app
// that keeps its data locally. This works out what to tell the person, and is pure so it can be tested.

export interface Env {
  /** The page is inside an <iframe>. */
  embedded: boolean
  /** ...and the page above it is on a different site, so the browser blocks several features. */
  crossOrigin: boolean
  userAgent: string
  /** Installed to the home screen / launched as an app. */
  standalone: boolean
  maxTouchPoints: number
}

export function readEnv(w: Window = window): Env {
  let embedded = false
  let crossOrigin = false
  try {
    embedded = w.self !== w.top
    if (embedded) {
      try {
        void w.top!.location.href // throws when the parent is on another site
      } catch {
        crossOrigin = true
      }
    }
  } catch {
    embedded = true
    crossOrigin = true
  }
  const nav = w.navigator as Navigator & { standalone?: boolean }
  return {
    embedded,
    crossOrigin,
    userAgent: nav.userAgent ?? '',
    standalone: !!nav.standalone || !!w.matchMedia?.('(display-mode: standalone)').matches,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
  }
}

/** iPhone, iPad (which now says "Macintosh" but has a touch screen) or iPod. */
export function isIOS(env: Pick<Env, 'userAgent' | 'maxTouchPoints'>): boolean {
  return /iPhone|iPad|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1)
}

export type NoticeId = 'embedded' | 'ios-storage'

export interface Notice {
  id: NoticeId
  text: string
}

/**
 * Things worth saying once. Each has a stable id so dismissing it sticks.
 * - Inside someone else's page the browser blocks folder access, and a collection is saved per page.
 * - Safari clears a website's saved data after about a week without a visit, unless the site is
 *   added to the Home Screen: a real risk for an app whose data lives in the browser.
 */
export function noticesFor(env: Env): Notice[] {
  const out: Notice[] = []
  if (env.crossOrigin) {
    out.push({
      id: 'embedded',
      text: "You're running Stacks Video inside another website. Your collection is saved in this browser for this page, and automatic folder backup is unavailable here, so use Export backup (Settings) now and then.",
    })
  }
  if (isIOS(env) && !env.standalone) {
    out.push({
      id: 'ios-storage',
      text: 'On iPhone and iPad, Safari can clear a website\'s saved data after about a week without a visit. Tap Share, then "Add to Home Screen" to keep it safe, and export a backup now and then.',
    })
  }
  return out
}
