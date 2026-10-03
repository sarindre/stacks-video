import { describe, expect, it } from 'vitest'
import { emptyHistory, MAX_HISTORY, peekHistory, popHistory, pushHistory } from './history'

describe('history', () => {
  it('starts empty', () => {
    expect(peekHistory(emptyHistory<number[]>())).toBeNull()
    expect(popHistory(emptyHistory<number[]>()).entry).toBeNull()
  })

  it('undoes in reverse order', () => {
    let h = emptyHistory<string>()
    h = pushHistory(h, 'one', 'A')
    h = pushHistory(h, 'two', 'B')
    expect(peekHistory(h)).toMatchObject({ label: 'two', before: 'B' })
    const first = popHistory(h)
    expect(first.entry?.before).toBe('B')
    const second = popHistory(first.history)
    expect(second.entry?.before).toBe('A')
    expect(popHistory(second.history).entry).toBeNull()
  })

  it('gives every entry a fresh id, even after undoing', () => {
    let h = pushHistory(emptyHistory<string>(), 'one', 'A')
    const firstId = peekHistory(h)!.id
    h = popHistory(h).history
    h = pushHistory(h, 'again', 'A')
    expect(peekHistory(h)!.id).toBeGreaterThan(firstId)
  })

  it('keeps only the most recent entries', () => {
    let h = emptyHistory<number>()
    for (let n = 0; n < MAX_HISTORY + 5; n++) h = pushHistory(h, `c${n}`, n)
    expect(h.entries).toHaveLength(MAX_HISTORY)
    expect(h.entries[0]!.before).toBe(5)
    expect(peekHistory(h)!.before).toBe(MAX_HISTORY + 4)
  })

  it('does not change the original when pushing or popping', () => {
    const h = pushHistory(emptyHistory<string>(), 'one', 'A')
    pushHistory(h, 'two', 'B')
    popHistory(h)
    expect(h.entries).toHaveLength(1)
  })
})
