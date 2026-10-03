import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isThemePref, resolveTheme, THEME_COLOR } from './theme'

describe('resolveTheme', () => {
  it('follows the device only when asked to', () => {
    expect(resolveTheme('system', true)).toBe('light')
    expect(resolveTheme('system', false)).toBe('dark')
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
  })
  it('validates stored values', () => {
    expect(['system', 'dark', 'light'].every(isThemePref)).toBe(true)
    expect(isThemePref('sepia')).toBe(false)
    expect(isThemePref(undefined)).toBe(false)
  })
})

// ---- Readability, checked against the real stylesheet --------------------------------------
// Parses the colour tokens out of index.css so a future tweak that makes text hard to read in
// either theme fails here instead of being noticed on a phone in daylight.

const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8')

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]!] = m[2]!
  return out
}

const dark = tokens(/@theme\s*\{([\s\S]*?)\}/.exec(css)![1]!)
const light = { ...dark, ...tokens(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\}/.exec(css)![1]!) }

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe.each([
  ['dark', dark],
  ['light', light],
] as const)('%s theme contrast', (name, t) => {
  const surfaces = ['bg', 'surface', 'raised'] as const

  it('has every colour token', () => {
    for (const k of ['bg', 'surface', 'raised', 'line', 'ink', 'mute', 'accent', 'accent-ink', 'good', 'bad', 'sticker', 'sticker-ink']) expect(t[k], k).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it.each(surfaces)('main text is easy to read on %s', (s) => {
    expect(contrast(t.ink!, t[s]!)).toBeGreaterThanOrEqual(7)
  })
  it.each(surfaces)('secondary text meets AA on %s', (s) => {
    expect(contrast(t.mute!, t[s]!), `${name} mute on ${s}`).toBeGreaterThanOrEqual(4.5)
  })
  it.each(surfaces)('accent, good and bad text meet AA on %s', (s) => {
    for (const k of ['accent', 'good', 'bad']) expect(contrast(t[k]!, t[s]!), `${name} ${k} on ${s}`).toBeGreaterThanOrEqual(4.5)
  })
  it('text on an accent button meets AA', () => {
    expect(contrast(t['accent-ink']!, t.accent!)).toBeGreaterThanOrEqual(4.5)
  })
  it('the yellow rental sticker is readable and reads as a sticker against the page', () => {
    expect(contrast(t['sticker-ink']!, t.sticker!)).toBeGreaterThanOrEqual(7)
    expect(contrast(t.sticker!, t.bg!)).toBeGreaterThanOrEqual(1.5)
  })
  it('borders are distinguishable from the surfaces they sit on', () => {
    expect(contrast(t.line!, t.bg!)).toBeGreaterThanOrEqual(1.15)
  })
})

describe('browser chrome colour', () => {
  it('matches the page background in each theme', () => {
    expect(THEME_COLOR.dark.toLowerCase()).toBe(dark.bg!.toLowerCase())
    expect(THEME_COLOR.light.toLowerCase()).toBe(light.bg!.toLowerCase())
  })
})
