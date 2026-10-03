// True when Stacks Video is running inside its desktop app (electron/preload.cjs sets this) rather
// than in a browser. The desktop app already works offline and is already installed, so the web-only
// pieces (the service worker) stand down.
export const isDesktopApp = (w: Window | undefined = typeof window === 'undefined' ? undefined : window): boolean =>
  (w as (Window & { stacksVideoDesktop?: { isDesktop?: boolean } }) | undefined)?.stacksVideoDesktop?.isDesktop === true

export const desktopPlatform = (w: Window | undefined = typeof window === 'undefined' ? undefined : window): string | undefined =>
  (w as (Window & { stacksVideoDesktop?: { platform?: string } }) | undefined)?.stacksVideoDesktop?.platform

const NAMES: Record<string, string> = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }
export const platformName = (platform: string | undefined): string | undefined => (platform ? (NAMES[platform] ?? platform) : undefined)
