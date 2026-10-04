import { describe, expect, it } from 'vitest'
import { inferTags, MAX_SUGGESTED, phraseMatches, SUGGESTED_TAGS, VOCABULARY } from './autotags'
import { allTags, dismissSuggestion, keepSuggestion } from './tags'

describe('the vocabulary', () => {
  it('is a sensible size with unique, tidy tag names', () => {
    expect(SUGGESTED_TAGS.length).toBeGreaterThan(30)
    expect(new Set(SUGGESTED_TAGS).size).toBe(SUGGESTED_TAGS.length)
    for (const t of SUGGESTED_TAGS) expect(t, t).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })
  it('gives every tag at least one phrase', () => {
    for (const r of VOCABULARY) expect(r.keywords.length, r.tag).toBeGreaterThan(0)
  })
})

describe('phraseMatches', () => {
  it('matches words together, in order, inside a keyword', () => {
    expect(phraseMatches('time travel', 'time travel')).toBe(true)
    expect(phraseMatches('time travel', 'back in time travel adventure')).toBe(true)
    expect(phraseMatches('travel time', 'time travel')).toBe(false)
    expect(phraseMatches('time travel', 'time')).toBe(false)
  })
  it('allows plurals but not look-alikes', () => {
    expect(phraseMatches('alien', 'aliens')).toBe(true)
    expect(phraseMatches('witch', 'witches')).toBe(true)
    expect(phraseMatches('pirate', 'pirates')).toBe(true)
    expect(phraseMatches('alien', 'alienation')).toBe(false)
    expect(phraseMatches('cult', 'cultural')).toBe(false)
  })
  it('treats a trailing * as a prefix', () => {
    for (const k of ['haunted', 'haunting', 'haunt']) expect(phraseMatches('haunt*', k), k).toBe(true)
    expect(phraseMatches('haunt*', 'shaunt')).toBe(false)
  })
  it('ignores case and punctuation, and understands &', () => {
    expect(phraseMatches('black and white', 'Black & White')).toBe(true)
    expect(phraseMatches('cover up', 'cover-up')).toBe(true)
    expect(phraseMatches('based on children s book', "Based on Children's Book")).toBe(true)
  })
})

describe('inferTags', () => {
  it('turns TMDB keywords into our own tags', () => {
    const tags = inferTags({ genres: ['Horror'], keywords: ['haunted house', 'final girl', 'masked killer', 'sequel', 'blood'] })
    expect(tags).toEqual(['slasher', 'haunted'])
  })

  it('never stores raw keywords, only vocabulary words', () => {
    const tags = inferTags({ genres: ['Comedy'], keywords: ['heist', 'based on novel or book', 'some very specific keyword nobody curated'] })
    expect(tags).toEqual(['heist', 'based-on-a-book'])
    expect(tags.every((t) => SUGGESTED_TAGS.includes(t) || t === 'comedy')).toBe(true)
  })

  it('adds the other genres, but not the primary one (that is the item\'s Genre field)', () => {
    expect(inferTags({ genres: ['Horror', 'Sci-Fi', 'Thriller'], keywords: [] })).toEqual(['sci-fi', 'thriller'])
    expect(inferTags({ genres: ['Horror', 'Sci-Fi'], keywords: [] }, { primaryGenre: 'Sci-Fi' })).toEqual(['horror'])
    expect(inferTags({ genres: ['TV Movie', 'Drama'], keywords: [] })).toEqual(['drama']) // "TV Movie" is not a useful tag
  })

  it('puts specific keyword matches before the broad genre tags', () => {
    expect(inferTags({ genres: ['Action', 'Crime'], keywords: ['heist'] })).toEqual(['heist', 'crime'])
  })

  it('does not suggest what the person has already, or what they dismissed', () => {
    const input = { genres: ['Action'], keywords: ['heist', 'revenge', 'spy'] }
    expect(inferTags(input, { own: ['heist'] })).toEqual(['spy', 'revenge'])
    expect(inferTags(input, { dismissed: ['revenge'] })).toEqual(['spy', 'heist'])
  })

  it('caps how many it suggests', () => {
    const keywords = ['slasher', 'zombie', 'vampire', 'ghost', 'witch', 'kaiju', 'monster', 'found footage', 'body horror', 'superhero', 'heist', 'spy']
    expect(inferTags({ genres: ['Horror'], keywords })).toHaveLength(MAX_SUGGESTED)
    expect(inferTags({ genres: ['Horror'], keywords }, { max: 3 })).toEqual(['slasher', 'zombie', 'vampire'])
  })

  it('suggests nothing from nothing', () => {
    expect(inferTags({ genres: [], keywords: [] })).toEqual([])
  })

  it('matches sensible real-world TMDB keyword lists', () => {
    expect(inferTags({ genres: ['Sci-Fi', 'Horror'], keywords: ['space', 'spacecraft', 'alien', 'android', 'monster', 'cult film'] }, { primaryGenre: 'Horror' })).toEqual(['monster', 'space', 'alien', 'ai-and-robots', 'cult-classic', 'sci-fi'])
    expect(inferTags({ genres: ['Comedy', 'Family'], keywords: ['christmas', 'santa claus', 'dark comedy'] })).toEqual(['christmas', 'dark-comedy', 'family'])
  })
})

describe('your tags and the suggested ones', () => {
  const item = { tags: ['mine', 'heist'], autoTags: ['heist', 'spy'], removedTags: ['x'] }

  it('are combined without repeats wherever tags are searched or counted', () => {
    expect(allTags(item)).toEqual(['mine', 'heist', 'spy'])
    expect(allTags({ tags: ['a'] })).toEqual(['a'])
  })
  it('dismissing removes the suggestion and remembers it', () => {
    expect(dismissSuggestion(item, 'spy')).toEqual({ autoTags: ['heist'], removedTags: ['x', 'spy'] })
    expect(dismissSuggestion({ autoTags: undefined, removedTags: undefined }, 'spy')).toEqual({ autoTags: [], removedTags: ['spy'] })
  })
  it('keeping moves the suggestion into your own tags', () => {
    expect(keepSuggestion(item, 'spy')).toEqual({ tags: ['mine', 'heist', 'spy'], autoTags: ['heist'] })
  })
})
