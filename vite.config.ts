/// <reference types="vitest/config" />
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// After a build, list every file in dist and write the list (plus a fingerprint of the
// build) into dist/sw.js so the service worker can store the whole app and work offline.
function offlineManifest(): Plugin {
  let outDir = 'dist'
  const walk = (dir: string, base = ''): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name), `${base}${e.name}/`) : [`${base}${e.name}`],
    )
  return {
    name: 'stacks-video-offline-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js')
      if (!fs.existsSync(swPath)) return
      const files = walk(outDir).filter((f) => f !== 'sw.js' && !f.endsWith('.map')).sort()
      const hash = crypto.createHash('sha1')
      for (const f of files) hash.update(f).update(fs.readFileSync(path.join(outDir, f)))
      const build = hash.digest('hex').slice(0, 12)
      const sw = fs
        .readFileSync(swPath, 'utf8')
        .replace('"__BUILD__"', JSON.stringify(build))
        .replace('/*__PRECACHE__*/[]', JSON.stringify(['./', ...files]))
      fs.writeFileSync(swPath, sw)
    },
  }
}

export default defineConfig({
  // GitHub Pages serves the app under /<repo>/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH || './',
  plugins: [react(), tailwindcss(), offlineManifest()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // West of UTC on purpose: that is where "YYYY-MM-DD parsed as UTC" bugs show up.
    env: { TZ: process.env.TZ || 'America/Los_Angeles' },
  },
})
