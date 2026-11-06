import { describe, expect, it } from 'vitest'
import { HOLD_FRAMES, STRIDE_MS, WALK_FRAMES } from '@/features/stadium/figure/frames'

describe('graduate walk frames', () => {
  it('has twelve frames per outfit and a 1.6 s stride', () => {
    expect(WALK_FRAMES.bisht).toHaveLength(12)
    expect(WALK_FRAMES.abaya).toHaveLength(12)
    expect(STRIDE_MS).toBe(1600)
  })
  it('every frame is a closed path inside the 100x240 box', () => {
    for (const d of [...WALK_FRAMES.bisht, ...WALK_FRAMES.abaya, HOLD_FRAMES.bisht, HOLD_FRAMES.abaya]) {
      expect(d).toMatch(/^M/)
      expect(d.trim().endsWith('Z')).toBe(true)
      const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
      const xs = nums.filter((_, i) => i % 2 === 0)
      const ys = nums.filter((_, i) => i % 2 === 1)
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...xs)).toBeLessThanOrEqual(100)
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...ys)).toBeLessThanOrEqual(240)
    }
  })
  it('the frames differ, so the figure really moves', () => {
    expect(new Set(WALK_FRAMES.bisht).size).toBe(12)
    expect(new Set(WALK_FRAMES.abaya).size).toBe(12)
  })
})
