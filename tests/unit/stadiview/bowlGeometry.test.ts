import { describe, expect, it } from 'vitest'
import { bowlPieces, bowlRadii } from '@/features/stadiview/engine/decor'
import { buildBowlGeometry } from '@/features/stadiview/scene/bowlGeometry'

describe('the bowl\'s terraces', () => {
  const g = buildBowlGeometry()
  const p = g.getAttribute('position')
  const pieces = bowlPieces()
  const r = bowlRadii()

  it('stays under 20,000 triangles', () => {
    expect(p.count / 3).toBeLessThan(20000)
    expect(p.count / 3).toBeGreaterThan(1000)
  })

  it('stays inside the sections its tests clear: every corner within a piece\'s ring and angles', () => {
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k)
      const z = p.getZ(k)
      const inside = pieces.some((piece) => {
        const radius = Math.hypot(x - piece.cx, z - piece.cz)
        if (radius < r.inner - 0.01 || radius > r.outer + 0.01) return false
        let a = (Math.atan2(z - piece.cz, x - piece.cx) * 180) / Math.PI
        while (a < piece.fromDeg - 180) a += 360
        while (a > piece.fromDeg + 180) a -= 360
        return a >= piece.fromDeg - 0.01 && a <= piece.toDeg + 0.01
      })
      if (!inside) expect.fail(`corner ${k} at (${x.toFixed(2)}, ${z.toFixed(2)}) is outside the bowl`)
    }
  })

  it('stands on the ground and rises no higher than its rear wall', () => {
    for (let k = 0; k < p.count; k++) {
      expect(p.getY(k)).toBeGreaterThanOrEqual(0)
      expect(p.getY(k)).toBeLessThanOrEqual(r.top + 1e-6)
    }
  })
})
