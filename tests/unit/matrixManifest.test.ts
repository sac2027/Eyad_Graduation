import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MATRIX_LOOPS } from '@/brand/matrix/manifest'
import { isAllowedPair } from '@/brand/matrix/pairs'

describe('Matrix loop manifest', () => {
  it('only lists colour pairs the brand guideline allows', () => {
    for (const l of MATRIX_LOOPS) expect(isAllowedPair(l.background, l.stripes), l.id).toBe(true)
  })
  it('points at files that exist and are web-sized (under 2 MB)', () => {
    for (const l of MATRIX_LOOPS) {
      const path = join(process.cwd(), 'public', l.src)
      expect(existsSync(path), l.src).toBe(true)
      expect(statSync(path).size, l.src).toBeLessThan(2_000_000)
    }
  })
  it('has the ids the app uses', () => {
    const ids = MATRIX_LOOPS.map((l) => l.id)
    for (const id of ['hero', 'ascent', 'completion', 'afterglow', 'honors']) expect(ids).toContain(id)
  })
})
