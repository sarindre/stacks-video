import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/bungee/latin-400.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import './index.css'
import App from './App'
import { AutoBackupProvider } from './hooks/useAutoBackup'
import { LibraryProvider } from './hooks/useLibrary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LibraryProvider>
      <AutoBackupProvider>
        <App />
      </AutoBackupProvider>
    </LibraryProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined)
  })
}
