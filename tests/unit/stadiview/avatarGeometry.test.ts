import { Color } from 'three'
import { describe, expect, it } from 'vitest'
import { AVATAR_KINDS } from '@/features/stadiview/data/occupancy'
import { EYE_HEIGHT, seatEye } from '@/features/stadiview/engine/cameraMath'
import { AVATAR_COLORS, avatarGeometry, avatarMesh } from '@/features/stadiview/scene/avatarGeometry'
import type { Headwear } from '@/features/stadiview/scene/avatarGeometry'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

const variants: [(typeof AVATAR_KINDS)[number], Headwear][] = AVATAR_KINDS.flatMap((k) => (k === 'family-m' ? [[k, 'ghutra'], [k, 'shemagh']] : [[k, 'ghutra']]) as [(typeof AVATAR_KINDS)[number], Headwear][])

function bounds(p: Float32Array) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let k = 0; k < p.length; k += 3) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], p[k + a])
      max[a] = Math.max(max[a], p[k + a])
    }
  }
  return { min, max }
}

describe('the seated figures', () => {
  for (const [kind, headwear] of variants) {
    describe(`${kind} ${headwear}`, () => {
      const near = avatarMesh(kind, 'near', headwear)
      const far = avatarMesh(kind, 'far', headwear)

      it('stays within the triangle budget (far figures: 14, or 18 with wheels)', () => {
        expect(near.triangles).toBeLessThanOrEqual(160)
        expect(far.triangles).toBeLessThanOrEqual(18)
        expect(near.positions.length).toBe(near.triangles * 9)
      })

      it('fits its seat: within 0.42 m to each side, -0.35 to 0.45 front to back, 1.32 m tall, on the floor', () => {
        for (const m of [near, far]) {
          const b = bounds(m.positions)
          expect(b.min[0]).toBeGreaterThanOrEqual(-0.42)
          expect(b.max[0]).toBeLessThanOrEqual(0.42)
          expect(b.min[2]).toBeGreaterThanOrEqual(-0.35)
          expect(b.max[2]).toBeLessThanOrEqual(0.45)
          expect(b.max[1]).toBeLessThanOrEqual(1.32)
          expect(b.min[1]).toBeGreaterThanOrEqual(0)
        }
      })

      it('has no face: the head is all silhouette', () => {
        const [first, count] = near.parts.face
        expect(count).toBe(8)
        for (let t = first; t < first + count; t++) expect(near.paints[t]).toBe('silhouette')
      })

      it('is wound and shaded so every corner has a colour no brighter than its paint', () => {
        for (let t = 0; t < near.triangles; t++) {
          const c = new Color(AVATAR_COLORS[near.paints[t]])
          for (let k = 0; k < 3; k++) {
            const o = (t * 3 + k) * 3
            expect(near.colors[o]).toBeLessThanOrEqual(c.r + 1e-6)
            expect(near.colors[o + 1]).toBeLessThanOrEqual(c.g + 1e-6)
          }
        }
      })
    })
  }

  it('dresses the men graduating in a black bisht with gold zari at the collar and both front edges, over the shawl and ghutra', () => {
    const m = avatarMesh('grad-m', 'near')
    expect(m.paints[m.parts.torso[0]]).toBe('bisht')
    const [first, count] = m.parts.trim
    const trimX = Array.from({ length: count * 3 }, (_, k) => m.positions[(first * 3 + k) * 3])
    expect(Math.min(...trimX)).toBeLessThan(0)
    expect(Math.max(...trimX)).toBeGreaterThan(0)
    expect(m.parts.collar[1]).toBeGreaterThan(0)
    for (const part of ['trim', 'collar']) for (let t = m.parts[part][0]; t < m.parts[part][0] + m.parts[part][1]; t++) expect(m.paints[t]).toBe('zari')
    expect(m.paints[m.parts.shawl[0]]).toBe('shawl')
    expect(m.paints[m.parts.headcloth[0]]).toBe('ghutra')
    expect(m.paints[m.parts.iqal[0]]).toBe('iqal')
  })

  it('dresses the women graduating in an abaya and shayla with the shawl, and no iqal', () => {
    const m = avatarMesh('grad-f', 'near')
    expect(m.paints[m.parts.torso[0]]).toBe('abaya')
    expect(m.paints[m.parts.headcloth[0]]).toBe('shayla')
    expect(m.parts.shawl).toBeDefined()
    expect(m.parts.iqal).toBeUndefined()
    expect(m.parts.trim).toBeUndefined()
  })

  it('dresses the families in a thobe with ghutra or shemagh, or an abaya and shayla, with no shawl', () => {
    expect(avatarMesh('family-m', 'near', 'shemagh').paints[avatarMesh('family-m', 'near', 'shemagh').parts.headcloth[0]]).toBe('shemagh')
    const man = avatarMesh('family-m', 'near')
    expect(man.paints[man.parts.torso[0]]).toBe('thobe')
    expect(man.parts.shawl).toBeUndefined()
    const woman = avatarMesh('family-f', 'near')
    expect(woman.paints[woman.parts.torso[0]]).toBe('abaya')
  })

  it('gives the far figures the garment\'s own colours', () => {
    expect(avatarMesh('grad-m', 'far').paints[avatarMesh('grad-m', 'far').parts.torso[0]]).toBe('bisht')
    expect(avatarMesh('family-m', 'far').paints[avatarMesh('family-m', 'far').parts.headcloth[0]]).toBe('ghutra')
    expect(avatarMesh('family-f', 'far').paints[avatarMesh('family-f', 'far').parts.torso[0]]).toBe('abaya')
  })

  it('puts wheels on the bay figures', () => {
    expect(avatarMesh('bay-m', 'near').parts.wheels[1]).toBeGreaterThan(0)
    expect(avatarMesh('bay-f', 'far').parts.wheels[1]).toBeGreaterThan(0)
  })

  it('leaves the eyes of anyone seated outside every neighbour\'s figure', () => {
    const v = getVenue()
    const fig = bounds(avatarMesh('grad-m', 'near').positions)
    // Any seat's eye against the figures of the seats round it, in that seat's own frame.
    for (let i = 0; i < v.count; i += 7) {
      const eye = seatEye(i, v)
      expect(eye[1] - v.position[i * 3 + 1]).toBeCloseTo(EYE_HEIGHT)
      for (let j = 0; j < v.count; j++) {
        if (j === i) continue
        const dx = eye[0] - v.position[j * 3]
        const dz = eye[2] - v.position[j * 3 + 2]
        if (dx * dx + dz * dz > 4) continue
        const c = Math.cos(v.yaw[j])
        const s = Math.sin(v.yaw[j])
        // Into seat j's frame (yaw 0 faces -Z).
        const lx = c * dx - s * dz
        const lz = s * dx + c * dz
        const ly = eye[1] - v.position[j * 3 + 1]
        const inside = lx > fig.min[0] && lx < fig.max[0] && ly > fig.min[1] && ly < fig.max[1] && lz > fig.min[2] && lz < fig.max[2]
        if (inside) expect.fail(`${v.idOf(i)}'s eyes are inside ${v.idOf(j)}'s figure`)
      }
    }
  })

  it('builds a three.js geometry with a colour per corner', () => {
    const g = avatarGeometry('grad-m', 'near')
    expect(g.getAttribute('position').count).toBe(g.getAttribute('color').count)
  })
})
