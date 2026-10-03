import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/bungee/latin-400.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import './index.css'
import App from './App'
import { AutoBackupProvider } from './hooks/useAutoBackup'
import { LibraryProvider } from './hooks/useLibrary'
import { isDesktopApp } from './lib/desktop'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LibraryProvider>
      <AutoBackupProvider>
        <App />
      </AutoBackupProvider>
    </LibraryProvider>
  </StrictMode>,
)

// The desktop app is already installed and works offline, and its custom address can't host a worker.
if ('serviceWorker' in navigator && import.meta.env.PROD && !isDesktopApp()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined)
  })
}
