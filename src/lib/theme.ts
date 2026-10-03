import type { ThemePref } from './types'

export type { ThemePref }
export type Theme = 'dark' | 'light'

export const THEME_PREFS: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'Match my device' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
]

export const isThemePref = (v: unknown): v is ThemePref => v === 'system' || v === 'dark' || v === 'light'

export const resolveTheme = (pref: ThemePref, prefersLight: boolean): Theme => (pref === 'system' ? (prefersLight ? 'light' : 'dark') : pref)

/** Browser chrome color (address bar on phones) for each theme; matches --color-bg in index.css. */
export const THEME_COLOR: Record<Theme, string> = { dark: '#151311', light: '#f6efe0' }

const query = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null)

export function applyTheme(pref: ThemePref): Theme {
  const theme = resolveTheme(pref, query()?.matches ?? false)
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  return theme
}

/** Re-applies the theme when the device switches between light and dark (only matters for "system"). */
export function watchSystemTheme(onChange: () => void): () => void {
  const mq = query()
  mq?.addEventListener('change', onChange)
  return () => mq?.removeEventListener('change', onChange)
}
