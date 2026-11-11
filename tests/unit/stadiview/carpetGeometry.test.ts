import { describe, expect, it } from 'vitest'
import { VENUE } from '@/features/stadiview/config/venue'
import { distanceToPath, getMarchPath } from '@/features/stadiview/engine/marchPath'
import { buildArrowRibbon, buildCarpetGeometry, CARPET_Y } from '@/features/stadiview/scene/carpetGeometry'

const path = getMarchPath()

describe('the carpet', () => {
  const g = buildCarpetGeometry(path)
  const p = g.getAttribute('position')

  it('lies on the path, no wider than the carpet, at one height', () => {
    for (let k = 0; k < p.count; k++) {
      expect(distanceToPath(path, p.getX(k), p.getZ(k))).toBeLessThanOrEqual(VENUE.march.width / 2 + 0.01)
      expect(p.getY(k)).toBe(CARPET_Y)
    }
  })

  it('faces up, and is drawn in crimson with gold edges', () => {
    const n = g.getAttribute('normal')
    for (let k = 0; k < n.count; k++) expect(n.getY(k)).toBeCloseTo(1)
    const c = g.getAttribute('color')
    const tones = new Set<string>()
    for (let k = 0; k < c.count; k++) tones.add(`${c.getX(k).toFixed(3)},${c.getY(k).toFixed(3)}`)
    expect(tones.size).toBe(2)
  })

  it('stays under 5,000 triangles', () => {
    expect(p.count / 3).toBeLessThan(5000)
  })
})

describe('the arrows', () => {
  const g = buildArrowRibbon(path, 1.7)
  const uv = g.getAttribute('uv')
  const pos = g.getAttribute('position')

  it('measure their way along the path in metres, increasing the way the graduates walk', () => {
    for (let k = 2; k < uv.count; k += 2) expect(uv.getX(k)).toBeGreaterThan(uv.getX(k - 2))
    expect(uv.getX(uv.count - 1)).toBeCloseTo(path.length)
  })

  it('run across the ribbon from 0 to 1, inside the carpet', () => {
    for (let k = 0; k < uv.count; k++) {
      expect([0, 1]).toContain(uv.getY(k))
      expect(distanceToPath(path, pos.getX(k), pos.getZ(k))).toBeLessThanOrEqual(1.7 / 2 + 0.01)
    }
  })
})
