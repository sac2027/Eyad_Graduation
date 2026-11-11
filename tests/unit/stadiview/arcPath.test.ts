import { describe, expect, it } from 'vitest'
import type { Vec3 } from '@/features/stadiview/config/venue'
import { ARC_START, arcPoints } from '@/features/stadiview/engine/arcPath'
import { seatEye } from '@/features/stadiview/engine/cameraMath'
import { seatAim } from '@/features/stadiview/engine/seatFrame'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { getOccluders, occluderDistance } from '@/features/stadiview/engine/occluders'

const v = getVenue()
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

describe('the sightline arc', () => {
  const cases: [string, string][] = [
    ['S-02-084', 'P3-12-07'],
    ['S-10-060', 'P1-01-01'],
    ['VIP-03-025', 'P6-20-07'],
    ['E-05-020', 'P4-30-14'],
    ['ACC-02-010', 'P5-01-01'],
  ]
  for (const [from, to] of cases) {
    it(`from ${from} to ${to}`, () => {
      const eye = seatEye(v.indexOf(from), v)
      const aim = seatAim(v.indexOf(to), v)
      const pts = arcPoints(eye, aim)
      // It leaves the eyes 1.5 m along the line and ends on the graduate's seat.
      expect(dist(pts[0], eye)).toBeCloseTo(ARC_START)
      expect(dist(pts[pts.length - 1], aim)).toBeLessThan(1e-9)
      // It rises above both ends, at least 8 m above the higher, and never below the lower.
      const top = Math.max(...pts.map((p) => p[1]))
      expect(top).toBeGreaterThanOrEqual(Math.max(pts[0][1], aim[1]) + 7.9)
      const low = Math.min(pts[0][1], aim[1])
      for (const p of pts) expect(p[1]).toBeGreaterThanOrEqual(low - 1e-9)
      // It passes through no stand, wall, backdrop or canopy on the way.
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1]
        const b = pts[k]
        const len = dist(a, b)
        const ray = { ox: a[0], oy: a[1], oz: a[2], dx: (b[0] - a[0]) / len, dy: (b[1] - a[1]) / len, dz: (b[2] - a[2]) / len }
        expect(occluderDistance(ray, getOccluders())).toBeGreaterThan(len)
      }
    })
  }
})
