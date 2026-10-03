import { useRef, useState } from 'react'
import { ClipboardCopy } from 'lucide-react'
import { copyText } from '../../lib/clipboard'
import { btnPrimary, btnSecondary, Dialog } from '../../components/ui'

// For pages where the browser blocks file downloads (some embedded players): the backup as plain
// text to copy, and a box to paste one back in. A file is still better when downloads work.

export function ExportTextDialog({ open, onClose, getText, onCopied }: { open: boolean; onClose: () => void; getText: () => string; onCopied: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Copy your backup as text" wide>
      {open && <ExportText getText={getText} onCopied={onCopied} />}
    </Dialog>
  )
}

// `getText` must be free of side effects: it runs while rendering. It is read once, when the dialog opens.
function ExportText({ getText, onCopied }: { getText: () => string; onCopied: () => void }) {
  const [text] = useState(getText)
  const field = useRef<HTMLTextAreaElement>(null)
  const [done, setDone] = useState<null | boolean>(null)
  return (
    <div className="grid gap-3">
      <p className="text-sm text-mute">
        Copy this text and keep it somewhere safe, for example in a note or a file named <b>stacks-video-backup.json</b>. To restore, use <b>Paste backup text</b> in Settings.
      </p>
      <textarea ref={field} readOnly value={text} rows={10} className="font-mono text-xs" aria-label="Backup text" onFocus={(e) => e.currentTarget.select()} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={btnPrimary}
          onClick={async () => {
            const ok = await copyText(text, field.current)
            setDone(ok)
            if (ok) onCopied()
          }}
        >
          <ClipboardCopy size={16} /> Copy to clipboard
        </button>
        {done === true && (
          <span role="status" className="text-sm text-good">
            Copied.
          </span>
        )}
        {done === false && (
          <span role="status" className="text-sm text-accent">
            The browser would not copy automatically. The text is selected, so press Ctrl+C (Cmd+C on a Mac).
          </span>
        )}
      </div>
    </div>
  )
}

export function PasteImportDialog({ open, onClose, onText }: { open: boolean; onClose: () => void; onText: (text: string) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Paste backup text">
      {open && <PasteBox onClose={onClose} onText={onText} />}
    </Dialog>
  )
}

function PasteBox({ onClose, onText }: { onClose: () => void; onText: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        onText(text)
        onClose()
      }}
    >
      <p className="text-sm text-mute">Paste the text of a Stacks Video backup (JSON) or a spreadsheet (CSV). You will see a preview before anything is changed.</p>
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={10} className="font-mono text-xs" aria-label="Pasted backup text" />
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={!text.trim()}>
          Preview import
        </button>
        <button type="button" className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  )
}
