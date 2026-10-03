import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { APP_HOST, appUrl, isAppUrl, isSafeExternal, mediaAllowed, permissionAllowed, resolveAppFile } = require('../../electron/policy.cjs')

describe('which addresses the window may show', () => {
  it("only the app's own pages", () => {
    expect(isAppUrl(appUrl())).toBe(true)
    expect(isAppUrl(appUrl('assets/index.js'))).toBe(true)
    expect(isAppUrl(`app://${APP_HOST}/#stats`)).toBe(true)
    for (const url of ['https://example.com/', 'app://evil/', 'file:///C:/Windows/win.ini', 'http://stacksvideo/', 'javascript:alert(1)', '', 'not a url']) expect(isAppUrl(url)).toBe(false)
  })
})

describe("which links may open in the user's browser", () => {
  it('web addresses only', () => {
    expect(isSafeExternal('https://www.themoviedb.org/')).toBe(true)
    expect(isSafeExternal('http://example.com/x')).toBe(true)
    for (const url of ['file:///C:/Windows/System32/calc.exe', 'app://stacksvideo/', 'javascript:alert(1)', 'ms-msdt:/id', 'vscode://x', '', 'nope']) expect(isSafeExternal(url)).toBe(false)
  })
})

describe('resolveAppFile', () => {
  const root = path.resolve('/srv/app/dist')
  it("serves the page for the root and files inside the app folder", () => {
    expect(resolveAppFile(root, '/')).toBe(path.join(root, 'index.html'))
    expect(resolveAppFile(root, '')).toBe(path.join(root, 'index.html'))
    expect(resolveAppFile(root, '/assets/index-abc.js')).toBe(path.join(root, 'assets', 'index-abc.js'))
    expect(resolveAppFile(root, '/icons/icon-192.png')).toBe(path.join(root, 'icons', 'icon-192.png'))
  })
  it('never leaves the app folder, however the path is written', () => {
    for (const bad of ['/../secret.txt', '/../../etc/passwd', '/assets/../../x', '/%2e%2e/%2e%2e/x', '/..%2f..%2fx', '/assets/..%5c..%5cx']) {
      const r = resolveAppFile(root, bad)
      expect(r === null || r.startsWith(root + path.sep) || r === root, bad).toBe(true)
    }
    expect(resolveAppFile(root, '/../secret.txt')).toBeNull()
    expect(resolveAppFile(root, '/%2e%2e/%2e%2e/x')).toBeNull()
  })
  it('refuses NUL bytes and broken escapes', () => {
    expect(resolveAppFile(root, '/a%00b')).toBeNull()
    expect(resolveAppFile(root, '/%E0%A4%A')).toBeNull()
  })
})

describe('camera and other permissions', () => {
  const app = appUrl()

  it('lets the app use the camera but never the microphone', () => {
    expect(permissionAllowed('media', app, { mediaTypes: ['video'] })).toBe(true) // asynchronous request
    expect(permissionAllowed('media', app, { mediaType: 'video' })).toBe(true) // synchronous check
    expect(permissionAllowed('media', app, { mediaTypes: ['audio'] })).toBe(false)
    expect(permissionAllowed('media', app, { mediaTypes: ['video', 'audio'] })).toBe(false) // one request for both is refused
    expect(permissionAllowed('media', app, { mediaType: 'audio' })).toBe(false)
    expect(permissionAllowed('media', app, { mediaType: 'unknown' })).toBe(false)
    expect(permissionAllowed('media', app, {})).toBe(false)
    expect(permissionAllowed('media', app)).toBe(false)
    expect(mediaAllowed({ mediaTypes: [] })).toBe(false)
  })

  it('allows the few things the app needs, from its own pages only', () => {
    for (const p of ['clipboard-sanitized-write', 'notifications', 'fileSystem']) expect(permissionAllowed(p, app), p).toBe(true)
    for (const p of ['clipboard-sanitized-write', 'fileSystem']) expect(permissionAllowed(p, 'https://example.com/'), p).toBe(false)
    expect(permissionAllowed('media', 'https://example.com/', { mediaTypes: ['video'] })).toBe(false)
  })

  it('refuses everything else', () => {
    for (const p of ['geolocation', 'midi', 'openExternal', 'clipboard-read', 'hid', 'serial', 'usb', 'display-capture', 'pointerLock', 'idle-detection']) expect(permissionAllowed(p, app), p).toBe(false)
  })
})
