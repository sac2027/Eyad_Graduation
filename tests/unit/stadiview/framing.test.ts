import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { VENUE } from '@/features/stadiview/config/venue'
import { ORBIT_HOME, orbitFromPosition, orbitPosition, overviewFov } from '@/features/stadiview/engine/cameraMath'
import { OVERVIEW_INSET, overviewPoints, overviewRadius, viewContains } from '@/features/stadiview/engine/framing'
import type { Vec3 } from '@/features/stadiview/engine/seatFrame'
import { buildVenue, getVenue } from '@/features/stadiview/layout/venueLayout'

const v = getVenue()
const points = overviewPoints(v)
const home = orbitFromPosition(ORBIT_HOME.position, ORBIT_HOME.target)

/** The same question answered by three.js itself: project the point with a real camera. */
function threeSees(position: Vec3, target: Vec3, fov: number, aspect: number, p: Vec3): { x: number; y: number; ahead: boolean } {
  const camera = new PerspectiveCamera(fov, aspect, 0.1, 5000)
  camera.position.set(...position)
  camera.lookAt(...target)
  camera.updateMatrixWorld()
  const q = new Vector3(...p).applyMatrix4(camera.matrixWorldInverse)
  const ahead = q.z < 0
  q.applyMatrix4(camera.projectionMatrix)
  return { x: q.x, y: q.y, ahead }
}

describe('viewContains', () => {
  it('agrees with a three.js camera about which points are on screen', () => {
    let seed = 7
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    let inside = 0
    let outside = 0
    for (let k = 0; k < 400; k++) {
      const position: Vec3 = [-150 + 300 * random(), 5 + 120 * random(), -150 + 300 * random()]
      const target: Vec3 = [-30 + 60 * random(), 10 * random(), -30 + 60 * random()]
      const fov = 30 + 50 * random()
      const aspect = 0.4 + 2 * random()
      const p: Vec3 = [-120 + 240 * random(), 30 * random(), -120 + 240 * random()]
      const seen = threeSees(position, target, fov, aspect, p)
      const expected = seen.ahead && Math.abs(seen.x) <= 1 && Math.abs(seen.y) <= 1
      // Skip points within a hair of an edge, where rounding may fall either way.
      if (seen.ahead && (Math.abs(Math.abs(seen.x) - 1) < 1e-6 || Math.abs(Math.abs(seen.y) - 1) < 1e-6)) continue
      expect(viewContains(position, target, fov, aspect, [p]), `case ${k}`).toBe(expected)
      if (expected) inside++
      else outside++
    }
    // The cases must exercise both answers.
    expect(inside).toBeGreaterThan(40)
    expect(outside).toBeGreaterThan(40)
  })

  it('needs every point to be in view, and none behind the camera', () => {
    const position: Vec3 = [0, 10, 50]
    const target: Vec3 = [0, 0, 0]
    expect(viewContains(position, target, 50, 1.5, [[0, 0, 0], [5, 0, 0]])).toBe(true)
    expect(viewContains(position, target, 50, 1.5, [[0, 0, 0], [500, 0, 0]])).toBe(false)
    expect(viewContains(position, target, 50, 1.5, [[0, 10, 80]])).toBe(false)
    expect(viewContains(position, target, 50, 1.5, [])).toBe(true)
  })

  it('keeps points out of the inset', () => {
    const position: Vec3 = [0, 0, 100]
    const target: Vec3 = [0, 0, 0]
    // At 100 m with a 53.13 degree view, half the picture is 50 m tall; on a square screen 50 m wide too.
    const fov = 2 * Math.atan(0.5) * (180 / Math.PI)
    expect(viewContains(position, target, fov, 1, [[45, 0, 0]])).toBe(true)
    expect(viewContains(position, target, fov, 1, [[45, 0, 0]], { side: 0.2, top: 0, bottom: 0 })).toBe(false)
    expect(viewContains(position, target, fov, 1, [[0, 45, 0]], { side: 0, top: 0.2, bottom: 0 })).toBe(false)
    expect(viewContains(position, target, fov, 1, [[0, -45, 0]], { side: 0, top: 0.2, bottom: 0 })).toBe(true)
    expect(viewContains(position, target, fov, 1, [[0, -45, 0]], { side: 0, top: 0, bottom: 0.2 })).toBe(false)
  })

  it('answers no, not NaN, for a camera on its target, one looking straight down, or a screen with no shape', () => {
    expect(viewContains([1, 2, 3], [1, 2, 3], 50, 1, [[0, 0, 0]])).toBe(false)
    expect(viewContains([0, 50, 0], [0, 0, 0], 50, 1, [[0, 0, 0]])).toBe(false)
    expect(viewContains([0, 10, 50], [0, 0, 0], 50, 0, [[0, 0, 0]])).toBe(false)
  })
})

describe('overviewPoints', () => {
  it('spans the graduates\' seating and the stage', () => {
    const xs = points.map((p) => p[0])
    const zs = points.map((p) => p[2])
    const ys = points.map((p) => p[1])
    // West to the backdrop, east to the back row of block 1.
    expect(Math.min(...xs)).toBeCloseTo(VENUE.stage.backdrop.x, 5)
    expect(Math.max(...xs)).toBeCloseTo(18.25, 4)
    // The LED screens stand wider than the blocks.
    expect(Math.max(...zs)).toBeCloseTo(35, 5)
    expect(Math.min(...zs)).toBeCloseTo(-35, 5)
    expect(Math.max(...ys)).toBeCloseTo(VENUE.stage.backdrop.yTop, 5)
    expect(Math.min(...ys)).toBe(0)
  })

  it('follows a changed config', () => {
    const cfg = structuredClone(VENUE)
    cfg.zones[0].count += 14 * 20
    const longer = overviewPoints(buildVenue(cfg), cfg)
    expect(Math.max(...longer.map((p) => p[0]))).toBeGreaterThan(30)
  })
})

describe('overviewRadius', () => {
  it('keeps the opening distance on landscape screens, where everything already fits', () => {
    for (const aspect of [16 / 9, 16 / 10, 1440 / 900, 21 / 9]) {
      expect(overviewRadius(aspect, points), `aspect ${aspect}`).toBeCloseTo(home.radius, 6)
      expect(viewContains(ORBIT_HOME.position, ORBIT_HOME.target, overviewFov(aspect), aspect, points, OVERVIEW_INSET)).toBe(true)
    }
  })

  it('backs away on a phone held upright, just far enough for the blocks and the stage to fit', () => {
    const aspect = 390 / 844
    const radius = overviewRadius(aspect, points)
    expect(radius).toBeGreaterThan(home.radius + 5)
    expect(radius).toBeLessThanOrEqual(VENUE.camera.orbit.radiusMax)
    const fov = overviewFov(aspect)
    const at = (r: number) => orbitPosition({ ...home, radius: r }, ORBIT_HOME.target)
    expect(viewContains(at(radius), ORBIT_HOME.target, fov, aspect, points, OVERVIEW_INSET)).toBe(true)
    if (radius < VENUE.camera.orbit.radiusMax) expect(viewContains(at(radius - 0.5), ORBIT_HOME.target, fov, aspect, points, OVERVIEW_INSET)).toBe(false)
  })

  it('never comes closer than the opening distance and never passes the orbit limit', () => {
    for (let aspect = 0.3; aspect <= 3; aspect += 0.1) {
      const radius = overviewRadius(aspect, points)
      expect(radius).toBeGreaterThanOrEqual(home.radius - 1e-9)
      expect(radius).toBeLessThanOrEqual(VENUE.camera.orbit.radiusMax)
    }
  })

  it('grows as the screen narrows', () => {
    let last = 0
    for (const aspect of [2, 1.5, 1.2, 1, 0.8, 0.6, 0.46]) {
      const radius = overviewRadius(aspect, points)
      expect(radius).toBeGreaterThanOrEqual(last - 1e-6)
      last = radius
    }
  })

  it('gives the opening distance for a screen with no shape yet', () => {
    expect(overviewRadius(0, points)).toBeCloseTo(home.radius, 6)
    expect(overviewRadius(Number.NaN, points)).toBeCloseTo(home.radius, 6)
  })

  it('stops at the limit when even that is not far enough', () => {
    const cfg = structuredClone(VENUE)
    cfg.camera.orbit.radiusMax = 140
    expect(overviewRadius(390 / 844, points, cfg)).toBe(140)
  })
})
