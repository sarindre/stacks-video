import { describe, expect, it } from 'vitest'
import { isIOS, noticesFor, readEnv, type Env } from './environment'

const base: Env = { embedded: false, crossOrigin: false, userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120', standalone: false, maxTouchPoints: 0 }
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'

describe('isIOS', () => {
  it('recognises iPhones, and iPads that pretend to be Macs', () => {
    expect(isIOS({ userAgent: IPHONE, maxTouchPoints: 5 })).toBe(true)
    expect(isIOS({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })).toBe(true)
  })
  it('does not mistake a real Mac or Windows PC', () => {
    expect(isIOS({ userAgent: IPAD_AS_MAC, maxTouchPoints: 0 })).toBe(false)
    expect(isIOS({ userAgent: base.userAgent, maxTouchPoints: 0 })).toBe(false)
  })
})

describe('noticesFor', () => {
  it('says nothing in an ordinary browser tab', () => {
    expect(noticesFor(base)).toEqual([])
  })
  it('explains the limits of running inside another site', () => {
    const n = noticesFor({ ...base, embedded: true, crossOrigin: true })
    expect(n.map((x) => x.id)).toEqual(['embedded'])
    expect(n[0]!.text).toMatch(/Export backup/)
  })
  it('stays quiet in a frame on the same site', () => {
    expect(noticesFor({ ...base, embedded: true, crossOrigin: false })).toEqual([])
  })
  it('warns iPhone and iPad users who have not added it to the Home Screen', () => {
    expect(noticesFor({ ...base, userAgent: IPHONE, maxTouchPoints: 5 }).map((x) => x.id)).toEqual(['ios-storage'])
    expect(noticesFor({ ...base, userAgent: IPHONE, maxTouchPoints: 5, standalone: true })).toEqual([])
  })
  it('can show both', () => {
    expect(noticesFor({ ...base, userAgent: IPHONE, maxTouchPoints: 5, embedded: true, crossOrigin: true }).map((x) => x.id)).toEqual(['embedded', 'ios-storage'])
  })
})

describe('readEnv', () => {
  const win = (over: Record<string, unknown>) => ({ navigator: { userAgent: 'x', maxTouchPoints: 0 }, matchMedia: () => ({ matches: false }), ...over }) as unknown as Window

  it('is not embedded when the window is its own top', () => {
    const w = win({})
    ;(w as unknown as { self: unknown; top: unknown }).self = w
    ;(w as unknown as { top: unknown }).top = w
    expect(readEnv(w)).toMatchObject({ embedded: false, crossOrigin: false })
  })
  it('detects a frame whose parent it cannot read (another site)', () => {
    const parent = {}
    Object.defineProperty(parent, 'location', { get: () => { throw new DOMException('blocked', 'SecurityError') } })
    const w = win({ self: {}, top: parent })
    expect(readEnv(w)).toMatchObject({ embedded: true, crossOrigin: true })
  })
  it('detects a frame on the same site', () => {
    const w = win({ self: {}, top: { location: { href: 'https://example.test/' } } })
    expect(readEnv(w)).toMatchObject({ embedded: true, crossOrigin: false })
  })
  it('treats installed-app mode as standalone', () => {
    const w = win({ matchMedia: () => ({ matches: true }) })
    ;(w as unknown as { self: unknown; top: unknown }).self = w
    ;(w as unknown as { top: unknown }).top = w
    expect(readEnv(w).standalone).toBe(true)
  })
})
