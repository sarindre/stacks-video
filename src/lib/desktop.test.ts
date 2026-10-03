import { describe, expect, it } from 'vitest'
import { desktopPlatform, isDesktopApp, platformName } from './desktop'

const win = (v: unknown) => ({ stacksVideoDesktop: v }) as unknown as Window

describe('desktop detection', () => {
  it('is true only when the desktop shell says so', () => {
    expect(isDesktopApp(win({ isDesktop: true, platform: 'win32' }))).toBe(true)
    expect(isDesktopApp(win({ isDesktop: false }))).toBe(false)
    expect(isDesktopApp(win({ isDesktop: 'yes' }))).toBe(false)
    expect(isDesktopApp(win(undefined))).toBe(false)
    expect(isDesktopApp(undefined)).toBe(false)
  })
  it('names the platform for the About screen', () => {
    expect(desktopPlatform(win({ isDesktop: true, platform: 'darwin' }))).toBe('darwin')
    expect(['win32', 'darwin', 'linux', 'freebsd', undefined].map(platformName)).toEqual(['Windows', 'macOS', 'Linux', 'freebsd', undefined])
  })
})
