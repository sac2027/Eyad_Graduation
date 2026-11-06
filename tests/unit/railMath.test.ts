import { describe, expect, it } from 'vitest'
import { railProgress, scrollForProgress } from '@/features/rail/railMath'

const tops = [1000, 1600, 2200, 2800, 3400, 4000, 4600, 5200, 5800]
const vh = 800

describe('railMath', () => {
  it('is 0 before the first section reaches the middle of the screen and 1 at the last', () => {
    expect(railProgress(0, tops, vh)).toBe(0)
    expect(railProgress(1000 - vh / 2, tops, vh)).toBe(0)
    expect(railProgress(5800 - vh / 2, tops, vh)).toBe(1)
    expect(railProgress(99999, tops, vh)).toBe(1)
  })
  it('reaches i/8 when section i is in the middle of the screen, linear between', () => {
    expect(railProgress(2200 - vh / 2, tops, vh)).toBeCloseTo(2 / 8, 6)
    expect(railProgress(2500 - vh / 2, tops, vh)).toBeCloseTo(2.5 / 8, 6)
  })
  it('scrollForProgress is its inverse', () => {
    for (const p of [0, 0.125, 0.25, 0.4, 0.5, 0.9, 1]) expect(railProgress(scrollForProgress(p, tops, vh), tops, vh)).toBeCloseTo(p, 6)
  })
  it('clamps out-of-range progress', () => {
    expect(scrollForProgress(-1, tops, vh)).toBe(scrollForProgress(0, tops, vh))
    expect(scrollForProgress(2, tops, vh)).toBe(scrollForProgress(1, tops, vh))
  })
})
