import { describe, expect, it, vi } from 'vitest'
import { getTmdbInfo, MAX_CAST, parseInfo, parseTmdbLink } from './tmdb'

const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('TMDB title info (synopsis and cast)', () => {
  const movie = {
    overview: ' In space. ',
    tagline: 'No one can hear you scream.',
    runtime: 117,
    credits: {
      cast: [{ name: 'Sigourney Weaver', character: 'Ripley', profile_path: '/sw.jpg' }, { name: 'Extra', profile_path: null }, { character: 'No name' }],
      crew: [{ name: 'Ridley Scott', job: 'Director' }, { name: 'Someone', job: 'Editor' }, { name: 'Ridley Scott', job: 'Director' }],
    },
  }
  it('reads a film: synopsis, runtime, director, cast with photos', () => {
    expect(parseInfo({ ...movie, title: 'Alien 3', release_date: '1992-05-22' }, 'movie', 348)).toEqual({
      title: 'Alien 3',
      year: 1992,
      overview: 'In space.',
      tagline: 'No one can hear you scream.',
      runtime: 117,
      seasons: undefined,
      directors: ['Ridley Scott'],
      cast: [
        { name: 'Sigourney Weaver', character: 'Ripley', photoUrl: 'https://image.tmdb.org/t/p/w185/sw.jpg' },
        { name: 'Extra', character: undefined, photoUrl: undefined },
      ],
      pageUrl: 'https://www.themoviedb.org/movie/348',
    })
  })
  it('reads a series: creators, episode length, seasons', () => {
    const tv = parseInfo({ overview: 'x', episode_run_time: [45, 50], number_of_seasons: 3, created_by: [{ name: 'A' }, { name: 'B' }] }, 'tv', 9)
    expect(tv).toMatchObject({ directors: ['A', 'B'], runtime: 45, seasons: 3, pageUrl: 'https://www.themoviedb.org/tv/9' })
  })
  it('copes with nothing at all', () => {
    expect(parseInfo(null, 'movie', 1)).toMatchObject({ overview: undefined, runtime: undefined, directors: [], cast: [] })
    expect(parseInfo({ runtime: 0, overview: '  ' }, 'movie', 1)).toMatchObject({ overview: undefined, runtime: undefined })
  })
  it('reads a pasted TMDB address or a bare id', () => {
    expect(parseTmdbLink('https://www.themoviedb.org/movie/8077-alien-3', 'tv')).toEqual({ category: 'movie', id: 8077 })
    expect(parseTmdbLink(' themoviedb.org/tv/1396/seasons ', 'movie')).toEqual({ category: 'tv', id: 1396 })
    expect(parseTmdbLink('8077', 'movie')).toEqual({ category: 'movie', id: 8077 })
    expect(parseTmdbLink('https://example.com/movie/12', 'movie')).toBeNull()
    expect(parseTmdbLink('0', 'movie')).toBeNull()
    expect(parseTmdbLink('alien 3', 'movie')).toBeNull()
  })
  it('limits the cast', () => {
    const cast = Array.from({ length: 40 }, (_, i) => ({ name: `P${i}` }))
    expect(parseInfo({ credits: { cast } }, 'movie', 1).cast).toHaveLength(MAX_CAST)
  })
  it('asks for credits in the same request, and returns null for a title TMDB dropped', async () => {
    const f = reply(movie)
    await getTmdbInfo('tok', 'movie', 348, f)
    expect((f.mock.calls[0] as unknown as [string])[0]).toContain('/movie/348?language=en-US&append_to_response=credits')
    expect(await getTmdbInfo('tok', 'movie', 1, reply({}, 404))).toBeNull()
    await expect(getTmdbInfo('', 'movie', 1, f)).rejects.toMatchObject({ kind: 'needs-token' })
  })
})
