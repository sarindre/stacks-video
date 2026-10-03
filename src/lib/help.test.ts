import { describe, expect, it } from 'vitest'
import { FAQ, GETTING_STARTED, GLOSSARY, SCREEN_HELP, type HelpId } from './help'

// If you add a screen, add its id here and write its help in help.ts.
const SCREENS: HelpId[] = ['collection', 'wishlist', 'binder', 'stats', 'settings', 'add', 'check', 'series', 'print']

describe('help content', () => {
  it('has real help for every screen', () => {
    for (const id of SCREENS) {
      const h = SCREEN_HELP[id]
      expect(h.title.length, id).toBeGreaterThan(3)
      expect(h.points.length, id).toBeGreaterThanOrEqual(3)
      expect(new Set(h.points).size, `${id} has duplicate points`).toBe(h.points.length)
    }
    expect(Object.keys(SCREEN_HELP).sort()).toEqual([...SCREENS].sort())
  })

  it('has unique, non-empty questions and terms', () => {
    expect(GETTING_STARTED.length).toBeGreaterThan(2)
    expect(new Set(FAQ.map((f) => f.q)).size).toBe(FAQ.length)
    expect(new Set(GLOSSARY.map((g) => g.term)).size).toBe(GLOSSARY.length)
    for (const f of FAQ) expect(f.a.length).toBeGreaterThan(20)
  })

  it('refers to buttons that exist on screen', () => {
    const text = JSON.stringify([SCREEN_HELP, GETTING_STARTED, FAQ])
    for (const label of ['Enter by hand', 'Export backup (JSON)', 'Find cover art', 'Save and add another', 'Add a copy', 'Cover image URL', 'Choose backup folder', 'Select', 'Add to wishlist', 'In stock?', 'Series gaps', 'Add all missing', 'Mark as bought', 'Tidy up', 'Wishlist priority', 'Rewind', 'Print or save a list']) {
      expect(text, label).toContain(label)
    }
  })
})
