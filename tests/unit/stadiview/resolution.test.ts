import { describe, expect, it } from 'vitest'
import { RESOLUTION, nextResolution, startResolution } from '@/features/stadiview/engine/resolution'

describe('adaptive resolution', () => {
  it('softens the picture when frames are slow, and never below the floor', () => {
    let s = startResolution(2)
    s = nextResolution(s, 30, 2)
    expect(s.ratio).toBe(1.75)
    for (let i = 0; i < 20; i++) s = nextResolution(s, 90, 2)
    expect(s.ratio).toBe(RESOLUTION.floor)
  })

  it('drops two steps at once when frames are very slow', () => {
    expect(nextResolution(startResolution(2), 60, 2).ratio).toBe(1.5)
  })

  it('sharpens only after several fast windows in a row, and never above the cap', () => {
    let s = startResolution(1)
    for (let i = 0; i < RESOLUTION.patience - 1; i++) s = nextResolution(s, 8, 1.5)
    expect(s.ratio).toBe(1)
    s = nextResolution(s, 8, 1.5)
    expect(s.ratio).toBe(1.25)
    for (let i = 0; i < 40; i++) s = nextResolution(s, 8, 1.5)
    expect(s.ratio).toBe(1.5)
  })

  it('holds still between the two thresholds, and a middling window resets the count', () => {
    let s = startResolution(1)
    s = nextResolution(s, 8, 2)
    s = nextResolution(s, 18, 2)
    expect(s).toEqual({ ratio: 1, calm: 0, relapses: 0 })
  })

  it('grows more patient each time sharpening had to be undone', () => {
    let s = startResolution(1)
    for (let i = 0; i < RESOLUTION.patience; i++) s = nextResolution(s, 8, 2)
    expect(s.ratio).toBe(1.25)
    s = nextResolution(nextResolution(s, 8, 2), 40, 2)
    expect(s.ratio).toBe(1)
    expect(s.relapses).toBe(1)
    for (let i = 0; i < RESOLUTION.patience; i++) s = nextResolution(s, 8, 2)
    expect(s.ratio).toBe(1)
    for (let i = 0; i < RESOLUTION.patience; i++) s = nextResolution(s, 8, 2)
    expect(s.ratio).toBe(1.25)
  })
})
