// Starts the desktop app from source (after `npm run build`).
//
// Some editors and terminals set ELECTRON_RUN_AS_NODE, which makes Electron behave as plain Node and
// the window never appears. This starts it without that variable.

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import electronPath from 'electron'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env

const child = spawn(electronPath, ['.', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit', env })
child.on('exit', (code) => process.exit(code ?? 0))
