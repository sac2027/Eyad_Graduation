import { describe, expect, it } from 'vitest'
import { PRESETS } from '@/time/presets'
import { getPhase } from '@/time/phaseEngine'

describe('presets', () => {
  it('has the expected ids', () => {
    const ids = PRESETS.map((p) => p.id)
    for (const id of ['today', 'launch', 'sizes-due', 'honors-day', 'ceremony-live', 'after']) expect(ids).toContain(id)
  })
  it.each(PRESETS.map((p) => [p.id, p] as const))('%s lands in its expected phase', (_id, p) => {
    expect(getPhase(p.at).phase).toBe(p.expectedPhase)
  })
  it('has Arabic and English labels', () => {
    for (const p of PRESETS) {
      expect(p.label.ar.length).toBeGreaterThan(0)
      expect(p.label.en.length).toBeGreaterThan(0)
    }
  })
})
