import { describe, expect, it } from 'vitest'
import { beamColour, cueAt, LIGHT_CUES } from '@/features/honors/lightCues'

describe('honor light cues', () => {
  it('starts in blackout and runs in time order', () => {
    expect(LIGHT_CUES[0]).toMatchObject({ id: 'blackout', at: 0 })
    LIGHT_CUES.slice(1).forEach((c, i) => expect(c.at).toBeGreaterThanOrEqual(LIGHT_CUES[i].at))
  })
  it('has exactly three camera flashes, while the name is engraved', () => {
    const flashes = LIGHT_CUES.filter((c) => c.id === 'flash')
    expect(flashes).toHaveLength(3)
    flashes.forEach((f) => expect(f.at).toBeGreaterThanOrEqual(8.6))
  })
  it('ends on the settle cue', () => {
    expect(LIGHT_CUES[LIGHT_CUES.length - 1].id).toBe('settle')
    expect(cueAt(0.1)).toBe('blackout')
    expect(cueAt(2.0)).toBe('beams')
    expect(cueAt(99)).toBe('settle')
  })
  it('colours the beams in brand colours by tier', () => {
    expect(beamColour('gold')).toBe('#F0BA4F')
    expect(beamColour('silver')).toBe('#71B8D4')
    expect(beamColour('bronze')).toBe('#AA8C6D')
  })
})
