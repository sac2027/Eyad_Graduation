import { describe, expect, it } from 'vitest'
import { ALLOWED_MATRIX_PAIRS, assertAllowedPair, isAllowedPair, type MatrixColor } from '@/brand/matrix/pairs'

describe('approved Matrix pairings', () => {
  it('accepts approved pairs', () => {
    expect(() => assertAllowedPair('turquoise', 'green')).not.toThrow()
    expect(() => assertAllowedPair('beige', 'turquoise')).not.toThrow()
    expect(() => assertAllowedPair('yellow', 'white')).not.toThrow()
  })
  it('rejects pairs the guideline does not allow', () => {
    expect(() => assertAllowedPair('sand', 'green')).toThrow(/not approved/)
    expect(() => assertAllowedPair('green', 'sand')).toThrow()
    expect(() => assertAllowedPair('yellow', 'blue')).toThrow()
  })
  it('never pairs a colour with itself and keeps both lists consistent', () => {
    for (const [bg, list] of Object.entries(ALLOWED_MATRIX_PAIRS) as [MatrixColor, MatrixColor[]][]) {
      expect(list).not.toContain(bg)
    }
    expect(isAllowedPair('turquoise', 'blue')).toBe(true)
  })
})
