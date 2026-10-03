import { useState } from 'react'
import { FAQ, GETTING_STARTED, GLOSSARY } from '../../lib/help'

export function HelpView() {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const match = (...parts: string[]) => !needle || parts.join(' ').toLowerCase().includes(needle)
  const faq = FAQ.filter((f) => match(f.q, f.a))
  const glossary = GLOSSARY.filter((g) => match(g.term, g.meaning))

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help…" aria-label="Search help" />

      {!needle && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-3 font-display text-lg">Getting started</h2>
          <ol className="grid list-decimal gap-2 pl-5 text-sm text-mute">
            {GETTING_STARTED.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      )}

      {faq.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-display text-lg">Questions</h2>
          {faq.map((f) => (
            <details key={f.q} open={!!needle} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium">{f.q}</summary>
              <p className="mt-2 text-mute">{f.a}</p>
            </details>
          ))}
        </section>
      )}

      {glossary.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-3 font-display text-lg">Words used in the app</h2>
          <dl className="grid gap-3 text-sm">
            {glossary.map((g) => (
              <div key={g.term}>
                <dt className="font-medium">{g.term}</dt>
                <dd className="text-mute">{g.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {faq.length === 0 && glossary.length === 0 && <p className="py-8 text-center text-mute">Nothing in help matches “{q}”.</p>}
    </div>
  )
}
