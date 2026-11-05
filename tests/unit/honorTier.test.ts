import { describe, expect, it } from 'vitest'
import { honorTier } from '@/domain/honorTier'

describe('honorTier', () => {
  it.each([
    [4.0, 'gold'],
    [3.75, 'gold'],
    [3.749, 'silver'],
    [3.25, 'silver'],
    [3.249, 'bronze'],
    [3.0, 'bronze'],
    [2.99, null],
    [0, null],
  ])('GPA %s -> %s', (gpa, tier) => {
    expect(honorTier(gpa)).toBe(tier)
  })
  it.each([Number.NaN, -1, 4.01, Infinity])('rejects %s', (gpa) => {
    expect(() => honorTier(gpa)).toThrow(RangeError)
  })
})
