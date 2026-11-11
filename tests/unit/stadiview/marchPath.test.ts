import { describe, expect, it } from 'vitest'
import { VENUE } from '@/features/stadiview/config/venue'
import { archPosts, buildMarchPath, carpetEdges, distanceToPath, edgeLights } from '@/features/stadiview/engine/marchPath'
import { SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

const m = VENUE.march
const path = buildMarchPath()
const v = getVenue()
const HALF = m.width / 2
/** Half a chair's footprint. */
const CHAIR = 0.25

describe('the march path', () => {
  it('runs east, north, west, south, then out, from the start to the exit', () => {
    expect(path.legs.map((l) => l.name)).toEqual(['east', 'north', 'west', 'south', 'exit'])
    const first = path.points[0]
    expect(first[0]).toBeCloseTo(m.east)
    // The Procession Start stands on the east leg, a few metres from where it begins.
    expect(distanceToPath(path, m.start[0], m.start[2])).toBeLessThan(0.01)
    expect(Math.hypot(m.start[0] - first[0], m.start[2] - first[2])).toBeLessThan(2.5)
    const last = path.points[path.points.length - 1]
    expect(last[0]).toBeCloseTo(m.exit[0])
    expect(last[2]).toBeCloseTo(m.exit[2])
  })

  it('goes counter-clockwise seen from above, north up', () => {
    const loop = path.points.filter((_, k) => path.along[k] <= path.legs[3].to)
    let area = 0
    for (let k = 0; k < loop.length; k++) {
      const a = loop[k]
      const b = loop[(k + 1) % loop.length]
      // Plan coordinates: X east, Y north (north is -z).
      area += a[0] * -b[2] - b[0] * -a[2]
    }
    expect(area).toBeGreaterThan(0)
  })

  it('heads due west through the Procession Gate on the north leg', () => {
    const north = path.legs[1]
    let s = north.from
    while (s < north.to && path.at(s).point[0] > VENUE.arch.x) s += 0.25
    const { point, dir } = path.at(s)
    expect(point[2]).toBeCloseTo(m.north)
    expect(dir[0]).toBeCloseTo(-1)
    expect(Math.abs(dir[2])).toBeLessThan(1e-6)
  })

  it('has smooth corners', () => {
    for (let k = 2; k < path.points.length; k++) {
      const a = path.points[k - 2]
      const b = path.points[k - 1]
      const c = path.points[k]
      const t1 = Math.atan2(b[2] - a[2], b[0] - a[0])
      const t2 = Math.atan2(c[2] - b[2], c[0] - b[0])
      let d = Math.abs(t2 - t1)
      if (d > Math.PI) d = 2 * Math.PI - d
      expect(d, `turn at point ${k}`).toBeLessThan((15 * Math.PI) / 180)
    }
  })

  it('keeps 0.6 m clear of every graduate chair and wheelchair bay', () => {
    let tightest = Infinity
    for (let i = 0; i < v.count; i++) {
      if (v.kind[i] === SeatKind.Stand) continue
      const clear = distanceToPath(path, v.position[i * 3], v.position[i * 3 + 2]) - HALF - CHAIR
      if (clear < tightest) tightest = clear
    }
    expect(tightest).toBeGreaterThanOrEqual(0.6)
  })

  it('keeps 0.5 m clear of the stage steps', () => {
    const st = VENUE.stage
    const xFront = st.deck.xMax + st.steps.count * st.steps.run
    for (const p of carpetEdges(path, m.width).right.concat(carpetEdges(path, m.width).left)) {
      const dx = Math.max(st.deck.xMax - p[0], 0, p[0] - xFront)
      const dz = Math.max(-st.steps.width / 2 - p[2], 0, p[2] - st.steps.width / 2)
      expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(0.5)
    }
  })

  it('stays inside the track on the loop', () => {
    const { left, right } = carpetEdges(path, m.width)
    const end = path.legs[3].to
    for (let k = 0; k < path.points.length; k++) {
      if (path.along[k] > end) break
      for (const p of [left[k], right[k]]) {
        expect(Math.abs(p[2])).toBeLessThan(VENUE.track.innerRadius - 0.3)
        expect(Math.abs(p[0])).toBeLessThan(VENUE.track.straightHalf)
      }
    }
  })

  it('leaves by the south-east without crossing a stand', () => {
    const exit = path.legs[4]
    const e = VENUE.stands.find((s) => s.id === 'E')!
    if (e.kind !== 'arc') throw new Error('east curve')
    for (let s = exit.from; s <= exit.to; s += 0.5) {
      const p = path.at(s).point
      // The south stand and the accessibility platform.
      expect(p[2] < 52 - HALF || Math.abs(p[0]) > 36 + HALF).toBe(true)
      expect(p[2] < 46.5 - HALF || p[0] > 0.5 + HALF).toBe(true)
      // The east curve.
      const r = Math.hypot(p[0] - e.cx, p[2] - e.cz)
      const a = (Math.atan2(p[2] - e.cz, p[0] - e.cx) * 180) / Math.PI
      expect(r < e.firstRowRadius - 1 || Math.abs(a) > 34 + 2).toBe(true)
    }
  })
})

describe('the Procession Gate', () => {
  const posts = archPosts()

  it('stands with a post either side of the carpet', () => {
    const inner = m.north + HALF
    const outer = m.north - HALF
    const zs = posts.map(([, , z0, z1]) => [z0, z1]).sort((a, b) => a[0] - b[0])
    expect(zs[0][1]).toBeLessThan(outer)
    expect(zs[1][0]).toBeGreaterThan(inner)
    expect(zs[0][0]).toBeGreaterThan(-VENUE.track.innerRadius)
  })

  it('keeps 0.6 m clear of Block 1', () => {
    for (const [x0, x1, z0, z1] of posts) {
      for (let i = 0; i < v.ranges.pitch[1]; i++) {
        const x = v.position[i * 3]
        const z = v.position[i * 3 + 2]
        const dx = Math.max(x0 - (x + CHAIR), 0, x - CHAIR - x1)
        const dz = Math.max(z0 - (z + CHAIR), 0, z - CHAIR - z1)
        expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(0.6)
      }
    }
  })
})

describe('the edge lights', () => {
  const lights = edgeLights(path)

  it('line both edges of the whole carpet', () => {
    expect(lights.length).toBeGreaterThan(180)
    expect(lights.length).toBeLessThan(300)
  })

  it('stand 2.5 m apart along a straight', () => {
    const outerNorth = lights.filter((p) => Math.abs(p[2] - (m.north - m.lightOffset)) < 0.05 && p[0] > m.west + m.corner + 1 && p[0] < m.east - m.corner - 1).sort((a, b) => a[0] - b[0])
    expect(outerNorth.length).toBeGreaterThan(15)
    for (let k = 1; k < outerNorth.length; k++) {
      const gap = outerNorth[k][0] - outerNorth[k - 1][0]
      // Either the next light, or the one after when the gap is the arch.
      const nearest = Math.round(gap / m.lightSpacing) * m.lightSpacing
      expect(Math.abs(gap - nearest)).toBeLessThan(0.1)
      if (gap > m.lightSpacing + 0.1) expect(Math.abs((outerNorth[k][0] + outerNorth[k - 1][0]) / 2 - VENUE.arch.x)).toBeLessThan(2)
    }
  })

  it('never stand on the carpet, in a block, or against an arch post', () => {
    for (const p of lights) {
      expect(distanceToPath(path, p[0], p[2])).toBeGreaterThanOrEqual(HALF - 0.05)
      for (const [x0, x1, z0, z1] of archPosts()) expect(p[0] > x0 - 0.3 && p[0] < x1 + 0.3 && p[2] > z0 - 0.3 && p[2] < z1 + 0.3).toBe(false)
    }
    for (let i = 0; i < v.ranges.bays[1]; i++) {
      for (const p of lights) expect(Math.hypot(p[0] - v.position[i * 3], p[2] - v.position[i * 3 + 2])).toBeGreaterThan(0.6)
    }
  })
})
