import { describe, expect, it } from 'vitest'
import { figureAt, geometryFor } from '@/features/stadium/geometry'

describe('stadium geometry', () => {
  for (const o of ['wide', 'tall'] as const) {
    it(`${o}: nine checkpoints that recede toward the stage`, () => {
      const g = geometryFor(o)
      expect(g.aisle).toHaveLength(9)
      g.aisle.slice(1).forEach((p, i) => {
        expect(p.scale).toBeLessThan(g.aisle[i].scale)
        expect(p.y).toBeLessThan(g.aisle[i].y)
      })
      expect(g.aisle[8].y).toBeLessThanOrEqual(g.podium.y + 1)
      for (const p of g.aisle) {
        expect(p.x).toBeGreaterThan(0)
        expect(p.x).toBeLessThan(g.w)
      }
    })
    it(`${o}: the graduate starts at the first checkpoint and ends at the podium`, () => {
      const g = geometryFor(o)
      expect(figureAt(0, g)).toMatchObject({ x: g.aisle[0].x, y: g.aisle[0].y, scale: g.aisle[0].scale })
      expect(figureAt(1, g)).toMatchObject({ x: g.aisle[8].x, y: g.aisle[8].y })
      const mid = figureAt(2.5 / 8, g)
      expect(mid.y).toBeCloseTo((g.aisle[2].y + g.aisle[3].y) / 2, 6)
    })
  }
})
