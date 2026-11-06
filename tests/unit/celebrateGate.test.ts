import { describe, expect, it } from 'vitest'
import { shouldCelebrate } from '@/features/celebrate/gate'

function memory() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('shouldCelebrate', () => {
  it('celebrates a trigger once per session', () => {
    const s = memory()
    expect(shouldCelebrate('welcome', 'landing', s)).toBe(true)
    expect(shouldCelebrate('welcome', 'landing', s)).toBe(false)
    expect(shouldCelebrate('task', 'attire:grad-m-gold', s)).toBe(true)
    expect(shouldCelebrate('task', 'attire:grad-f-gold', s)).toBe(true)
  })
  it('still works when storage throws (private mode), once per page load', () => {
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(shouldCelebrate('welcome', 'x-broken', broken)).toBe(true)
    expect(shouldCelebrate('welcome', 'x-broken', broken)).toBe(false)
  })
  it('works without storage at all', () => {
    expect(shouldCelebrate('task', 'no-storage', null)).toBe(true)
    expect(shouldCelebrate('task', 'no-storage', null)).toBe(false)
  })
})
