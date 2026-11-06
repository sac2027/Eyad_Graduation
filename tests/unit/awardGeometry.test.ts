import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { AWARD_PROFILE, AWARD_SEGMENTS, buildAwardGeometry, windowPlacements } from '@/features/honors/awardGeometry'

function vertexSet(g: THREE.BufferGeometry, rot = 0) {
  const p = g.getAttribute('position')
  const out = new Set<string>()
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const q = (v: number) => (Math.round(v * 1000) / 1000 + 0).toFixed(3)
    out.add([q(x * c + z * s), q(p.getY(i)), q(-x * s + z * c)].join(','))
  }
  return out
}

describe('award geometry', () => {
  const g = buildAwardGeometry()
  it('is eight-fold symmetric around the vertical axis', () => {
    const base = vertexSet(g)
    const rotated = vertexSet(g, (2 * Math.PI) / AWARD_SEGMENTS)
    expect(rotated.size).toBe(base.size)
    for (const v of rotated) expect(base.has(v)).toBe(true)
  })
  it('is a slender tower: taller than three times its width', () => {
    g.computeBoundingBox()
    const size = new THREE.Vector3()
    g.boundingBox!.getSize(size)
    expect(size.y).toBeGreaterThan(3 * Math.max(size.x, size.z))
  })
  it('is identical on every call', () => {
    const a = buildAwardGeometry().getAttribute('position').count
    const b = buildAwardGeometry().getAttribute('position').count
    expect(a).toBe(b)
  })
  it('narrows then flares: the crown is wider than the shaft', () => {
    const shaft = Math.min(...AWARD_PROFILE.filter(([, y]) => y > 1 && y < 3.4).map(([r]) => r))
    const crown = Math.max(...AWARD_PROFILE.map(([r]) => r))
    expect(crown).toBeGreaterThan(2 * shaft)
  })
  it('places eight crown windows evenly', () => {
    const w = windowPlacements()
    expect(w).toHaveLength(8)
    expect(w[1].angle - w[0].angle).toBeCloseTo(Math.PI / 4, 6)
  })
})
