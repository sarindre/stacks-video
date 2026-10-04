import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

// The service worker keeps cover images for a limited time (TMDB's terms: nothing cached longer than
// six months). Load its real expiry rule, with just enough of a browser around it to evaluate the file.
const source = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8')
const sandbox = {
  self: { addEventListener() {}, registration: { scope: 'https://x.test/' }, location: { origin: 'https://x.test' } },
  caches: {},
  module: { exports: {} as Record<string, unknown> },
  URL,
  Headers,
  Response,
}
vm.runInNewContext(source, sandbox)
const { isStale, MAX_COVER_AGE_MS, STAMP } = sandbox.module.exports as { isStale: (r: Response, now?: number) => boolean; MAX_COVER_AGE_MS: number; STAMP: string }

const DAY = 86_400_000
const NOW = Date.parse('2026-06-01T12:00:00Z')
const response = (headers: Record<string, string>) => new Response('x', { headers })

describe('cover image expiry', () => {
  it('keeps the limit comfortably under six months', () => {
    expect(MAX_COVER_AGE_MS).toBeLessThan(180 * DAY)
    expect(MAX_COVER_AGE_MS).toBeGreaterThan(90 * DAY)
  })

  it('keeps a recently stored image and drops one past the limit', () => {
    expect(isStale(response({ [STAMP]: String(NOW - 10 * DAY) }), NOW)).toBe(false)
    expect(isStale(response({ [STAMP]: String(NOW - 149 * DAY) }), NOW)).toBe(false)
    expect(isStale(response({ [STAMP]: String(NOW - 151 * DAY) }), NOW)).toBe(true)
    expect(isStale(response({ [STAMP]: String(NOW - 400 * DAY) }), NOW)).toBe(true)
  })

  it("uses the server's Date header for images stored before stamping existed", () => {
    expect(isStale(response({ date: new Date(NOW - 20 * DAY).toUTCString() }), NOW)).toBe(false)
    expect(isStale(response({ date: new Date(NOW - 200 * DAY).toUTCString() }), NOW)).toBe(true)
  })

  it('treats an image of unknown age as expired rather than keeping it', () => {
    expect(isStale(response({}), NOW)).toBe(true)
    expect(isStale(response({ [STAMP]: 'garbage' }), NOW)).toBe(true)
  })

  it('prefers our own stamp over the server date', () => {
    expect(isStale(response({ [STAMP]: String(NOW - DAY), date: new Date(NOW - 300 * DAY).toUTCString() }), NOW)).toBe(false)
  })
})
