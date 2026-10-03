import { CircleHelp } from 'lucide-react'
import { SCREEN_HELP, type HelpId } from '../lib/help'
import { usePref } from '../hooks/usePref'

/** A collapsible "How this screen works" panel. Open the first time, then remembers if you closed it. */
export function ScreenHelp({ id, defaultOpen = true }: { id: HelpId; defaultOpen?: boolean }) {
  const help = SCREEN_HELP[id]
  const [state, setState] = usePref<'open' | 'closed'>(`help.${id}`, defaultOpen ? 'open' : 'closed', ['open', 'closed'])
  return (
    <details
      open={state === 'open'}
      onToggle={(e) => {
        const next = e.currentTarget.open ? 'open' : 'closed'
        if (next !== state) setState(next)
      }}
      className="rounded-xl border border-line bg-surface/60 text-sm"
    >
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-mute hover:text-ink">
        <CircleHelp size={16} className="text-accent" />
        <span>How this screen works</span>
      </summary>
      <div className="border-t border-line px-3 py-3">
        <p className="mb-2 font-medium">{help.title}</p>
        <ul className="grid list-disc gap-1.5 pl-5 text-mute">
          {help.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </details>
  )
}
