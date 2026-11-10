import { CatmullRomCurve3, Euler, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { VENUE } from '@/features/stadiview/config/venue'
import {
  EYE_HEIGHT,
  FLIGHT_CURVE_TYPE,
  ORBIT_HOME,
  POV_FOV,
  clampLook,
  clampOrbit,
  flightPath,
  lookAngles,
  orbitFromPosition,
  orbitPosition,
  overviewFov,
  returnPath,
  seatEye,
  seatLook,
} from '@/features/stadiview/engine/cameraMath'
import { getOccluders, occluderDistance } from '@/features/stadiview/engine/occluders'
import { pickHit } from '@/features/stadiview/engine/picking'
import { CHAIR_BOX, seatBack, seatFacing } from '@/features/stadiview/engine/seatFrame'
import type { Vec3 } from '@/features/stadiview/engine/seatFrame'
import { SeatKind } from '@/features/stadiview/layout/types'
import { buildVenue } from '@/features/stadiview/layout/venueLayout'

const v = buildVenue()
const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const at = (i: number): Vec3 => [v.position[i * 3], v.position[i * 3 + 1], v.position[i * 3 + 2]]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2])

/** The difference between two angles, folded into -pi to pi, so 179 and -179 degrees count as 2 apart. */
const angleBetween = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b))

/** The direction a camera looks along for a yaw and a pitch, written out from the documented convention. */
const direction = (yaw: number, pitch: number): Vec3 => [-Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.cos(yaw)]

/** A small seeded generator, so the "random" cases are the same on every run. */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------------------------
// The plan's tests, as written.
// ---------------------------------------------------------------------------------------------

describe('camera maths (the plan)', () => {
  it('puts the eye 1.15 above the seat floor', () => {
    const i = v.indexOf('S-20-060')
    const e = seatEye(i, v)
    expect(e[1]).toBeCloseTo(v.position[i * 3 + 1] + 1.15, 5)
    expect(e[0]).toBeCloseTo(v.position[i * 3], 5)
    expect(e[2]).toBeCloseTo(v.position[i * 3 + 2], 5)
  })

  it('looks at the podium from the pitch and toward the pitch from the stands', () => {
    expect(seatLook(v.indexOf('P1-01-01'), v)).toEqual([-42, 3.2, 0])
    expect(seatLook(v.indexOf('P4-A2'), v)).toEqual([-42, 3.2, 0])
    expect(seatLook(v.indexOf('E-01-050'), v)).toEqual([-20, 1.5, 0])
  })

  it('builds a flight that starts at the camera, crests, approaches from behind the seat, and ends at the eye', () => {
    const p = flightPath([72, 64, -88], [-10, 1.15, 5], [1, 0, 0])
    expect(p).toHaveLength(4)
    expect(p[0]).toEqual([72, 64, -88])
    expect(p[3]).toEqual([-10, 1.15, 5])
    expect(p[2][0]).toBeCloseTo(2, 6)
    expect(p[2][1]).toBeCloseTo(8.15, 6)
    expect(p[2][2]).toBeCloseTo(5, 6)
    expect(p[1][0]).toBeCloseTo(44, 6)
    expect(p[1][1]).toBeCloseTo(82, 6)
    expect(p[1][2]).toBeCloseTo(-50.8, 6)
    const r = returnPath([-10, 1.15, 5], [72, 64, -88])
    expect(r).toHaveLength(3)
    expect(r[1]).toEqual([31, 84, -41.5])
  })

  it('converts between orbit angles and positions', () => {
    const o = orbitFromPosition(ORBIT_HOME.position, ORBIT_HOME.target)
    expect(o.radius).toBeCloseTo(Math.hypot(80, 64, 88), 6)
    const p = orbitPosition(o, ORBIT_HOME.target)
    expect(p[0]).toBeCloseTo(72, 6)
    expect(p[1]).toBeCloseTo(64, 6)
    expect(p[2]).toBeCloseTo(-88, 6)
    expect(clampOrbit(o)).toEqual(o) // the opening pose is inside the limits
  })

  it('clamps the orbit and the look', () => {
    expect(clampOrbit({ theta: 1, phi: 0, radius: 500 })).toEqual({ theta: 1, phi: (18 * Math.PI) / 180, radius: 220 })
    expect(clampOrbit({ theta: 1, phi: 3, radius: 1 })).toEqual({ theta: 1, phi: (80 * Math.PI) / 180, radius: 60 })
    expect(clampLook(0, 2).pitch).toBeCloseTo((50 * Math.PI) / 180, 6)
    expect(clampLook(0, -2).pitch).toBeCloseTo((-35 * Math.PI) / 180, 6)
    expect(clampLook(4, 0).yaw).toBeCloseTo(4 - 2 * Math.PI, 6)
  })

  it('uses the seat-yaw convention for look angles', () => {
    const west = lookAngles([0, 1.15, 0], [-42, 1.15, 0])
    expect(west.yaw).toBeCloseTo(Math.PI / 2, 6)
    expect(west.pitch).toBeCloseTo(0, 6)
    const north = lookAngles([0, 0, 0], [0, 0, -10])
    expect(north.yaw).toBeCloseTo(0, 6)
    const up = lookAngles([0, 0, 0], [0, 10, -10])
    expect(up.pitch).toBeCloseTo(Math.PI / 4, 6)
  })

  it('widens the overview on portrait screens', () => {
    expect(overviewFov(1.6)).toBe(42)
    expect(overviewFov(3)).toBe(42)
    expect(overviewFov(1)).toBeCloseTo(53, 0)
    expect(overviewFov(0.46)).toBe(72)
  })
})

// ---------------------------------------------------------------------------------------------
// Behaviour the plan describes but does not test.
// ---------------------------------------------------------------------------------------------

describe('the fixed camera numbers', () => {
  it('opens north-east of the stadium, at the pose held in the venue config', () => {
    expect(ORBIT_HOME).toEqual({ position: [72, 64, -88], target: [-8, 0, 0], fov: 42 })
    expect(ORBIT_HOME).toEqual(VENUE.camera.home)
  })

  it('keeps its own copy of the opening pose, so the camera rig cannot disturb the config', () => {
    expect(ORBIT_HOME).not.toBe(VENUE.camera.home)
    expect(ORBIT_HOME.position).not.toBe(VENUE.camera.home.position)
    expect(ORBIT_HOME.target).not.toBe(VENUE.camera.home.target)
  })

  it('seats the viewer with their eyes above the chair backs, and gives first person a 62 degree view', () => {
    expect(EYE_HEIGHT).toBe(1.15)
    expect(EYE_HEIGHT).toBeGreaterThan(CHAIR_BOX.height)
    expect(POV_FOV).toBe(62)
  })
})

describe('seatEye', () => {
  it('is straight above the seat, by the eye height, for every seat in the venue', () => {
    for (let i = 0; i < v.count; i++) {
      const e = seatEye(i, v)
      expect(e[0]).toBe(v.position[i * 3])
      expect(e[1]).toBeCloseTo(v.position[i * 3 + 1] + EYE_HEIGHT, 5)
      expect(e[2]).toBe(v.position[i * 3 + 2])
    }
  })

  it('is 1.15 above the grass on the pitch and at the bays', () => {
    expect(seatEye(v.indexOf('P3-12-07'), v)[1]).toBeCloseTo(1.15, 6)
    expect(seatEye(v.indexOf('P1-A1'), v)[1]).toBeCloseTo(1.15, 6)
  })

  it('returns a new point each time', () => {
    const i = v.indexOf('NW-08-015')
    const a = seatEye(i, v)
    a[1] = 999
    expect(seatEye(i, v)[1]).toBeCloseTo(v.position[i * 3 + 1] + EYE_HEIGHT, 5)
  })
})

describe('seatLook', () => {
  it('aims every pitch seat and bay at the podium and every stand seat at the graduates', () => {
    let pitch = 0
    let stand = 0
    for (let i = 0; i < v.count; i++) {
      if (v.kind[i] === SeatKind.Stand) {
        expect(seatLook(i, v)).toEqual(VENUE.camera.standLook)
        stand++
      } else {
        expect(seatLook(i, v)).toEqual(VENUE.camera.pitchLook)
        pitch++
      }
    }
    expect(pitch).toBe(v.ranges.bays[1])
    expect(stand).toBe(v.ranges.stands[1] - v.ranges.stands[0])
  })

  it('covers one seat of each stand', () => {
    for (const id of ['VIP-01-001', 'NW-15-030', 'NE-01-001', 'S-20-120', 'E-12-100', 'ACC-04-050']) {
      expect(seatLook(v.indexOf(id), v)).toEqual([-20, 1.5, 0])
    }
  })

  it('hands out a copy, so turning the camera cannot move the landmark', () => {
    const a = seatLook(0, v)
    a[0] = 999
    expect(seatLook(0, v)).toEqual([-42, 3.2, 0])
    expect(VENUE.camera.pitchLook).toEqual([-42, 3.2, 0])
    const b = seatLook(v.ranges.stands[0], v)
    b[2] = 999
    expect(VENUE.camera.standLook).toEqual([-20, 1.5, 0])
  })

  it('reads the landmarks from the config it is given', () => {
    const cfg = structuredClone(VENUE)
    cfg.camera.pitchLook = [-40, 3, 1]
    cfg.camera.standLook = [0, 2, 0]
    expect(seatLook(0, v, cfg)).toEqual([-40, 3, 1])
    expect(seatLook(v.ranges.bays[0], v, cfg)).toEqual([-40, 3, 1])
    expect(seatLook(v.ranges.stands[0], v, cfg)).toEqual([0, 2, 0])
  })

  it('looks above the podium, at about head height of someone standing on the stage', () => {
    const look = seatLook(0, v)
    expect(look[0]).toBe(VENUE.stage.podium[0])
    expect(look[2]).toBe(VENUE.stage.podium[2])
    expect(look[1] - VENUE.stage.podium[1]).toBeGreaterThan(1.4)
    expect(look[1] - VENUE.stage.podium[1]).toBeLessThan(2)
  })
})

describe('the view a seat opens on', () => {
  it('is in front of the chair, never over the shoulder, for every seat', () => {
    let widestPitch = 0
    let widestStand = 0
    for (let i = 0; i < v.count; i++) {
      const d = sub(seatLook(i, v), seatEye(i, v))
      const f = seatFacing(i, v)
      const turn = deg(Math.acos((d[0] * f[0] + d[2] * f[2]) / Math.hypot(d[0], d[2])))
      if (v.kind[i] === SeatKind.Stand) widestStand = Math.max(widestStand, turn)
      else widestPitch = Math.max(widestPitch, turn)
    }
    // The stands all face the pitch, so nobody there turns far to find the graduates.
    expect(widestStand).toBeLessThan(50)
    // The podium is one point, and the front corners of the outer blocks sit well to its side: those
    // graduates open turned about 70 degrees toward it. That is the most anyone turns.
    expect(widestPitch).toBeGreaterThan(60)
    expect(widestPitch).toBeLessThan(75)
  })

  it('is inside the look limits for every seat, so first person never opens against a stop', () => {
    let lowest = Infinity
    let highest = -Infinity
    for (let i = 0; i < v.count; i++) {
      const a = lookAngles(seatEye(i, v), seatLook(i, v))
      const c = clampLook(a.yaw, a.pitch)
      expect(c.pitch).toBe(a.pitch)
      expect(c.yaw).toBe(a.yaw)
      lowest = Math.min(lowest, a.pitch)
      highest = Math.max(highest, a.pitch)
    }
    // Front-row graduates look up at the speaker; the top of the stands looks down at the pitch.
    expect(highest).toBeGreaterThan(0)
    expect(lowest).toBeLessThan(0)
  })

  it('faces a pitch seat west toward the stage', () => {
    const i = v.indexOf('P3-20-07')
    const a = lookAngles(seatEye(i, v), seatLook(i, v))
    expect(Math.abs(angleBetween(a.yaw, Math.PI / 2))).toBeLessThan(rad(15))
  })
})

describe('flightPath', () => {
  const HOME: Vec3 = [72, 64, -88]

  it('approaches a pitch seat from 12 m to the east and 7 m up', () => {
    const i = v.indexOf('P3-12-07')
    const eye = seatEye(i, v)
    const p = flightPath(HOME, eye, seatBack(i, v))
    expect(p[2][0]).toBeCloseTo(eye[0] + 12, 4)
    expect(p[2][1]).toBeCloseTo(eye[1] + 7, 6)
    expect(p[2][2]).toBeCloseTo(eye[2], 4)
  })

  it('approaches a south-stand seat from the south and a north-stand seat from the north', () => {
    const s = v.indexOf('S-10-060')
    const ps = flightPath(HOME, seatEye(s, v), seatBack(s, v))
    expect(ps[2][2]).toBeCloseTo(seatEye(s, v)[2] + 12, 4)
    expect(ps[2][0]).toBeCloseTo(seatEye(s, v)[0], 4)
    const n = v.indexOf('NW-08-015')
    const pn = flightPath(HOME, seatEye(n, v), seatBack(n, v))
    expect(pn[2][2]).toBeCloseTo(seatEye(n, v)[2] - 12, 4)
    expect(pn[2][0]).toBeCloseTo(seatEye(n, v)[0], 4)
  })

  it('approaches an east-curve seat from outside the curve', () => {
    const east = VENUE.stands.find((s) => s.kind === 'arc')!
    for (const id of ['E-01-001', 'E-06-050', 'E-12-100']) {
      const i = v.indexOf(id)
      const eye = seatEye(i, v)
      const p = flightPath(HOME, eye, seatBack(i, v))
      const seatRadius = Math.hypot(eye[0] - east.cx, eye[2] - east.cz)
      expect(Math.hypot(p[2][0] - east.cx, p[2][2] - east.cz)).toBeCloseTo(seatRadius + 12, 3)
    }
  })

  it('ends level with, and directly behind, the seat: the last leg comes down over the chair back', () => {
    for (let i = 0; i < v.count; i += 97) {
      const eye = seatEye(i, v)
      const p = flightPath(HOME, eye, seatBack(i, v))
      const leg = sub(p[3], p[2])
      const f = seatFacing(i, v)
      // The level part of the last leg points the way the seat faces.
      expect((leg[0] * f[0] + leg[2] * f[2]) / Math.hypot(leg[0], leg[2])).toBeCloseTo(1, 5)
      expect(Math.hypot(leg[0], leg[2])).toBeCloseTo(12, 4)
      expect(leg[1]).toBeCloseTo(-7, 5)
    }
  })

  it('crests 18 m above the camera when the camera is the higher end', () => {
    const p = flightPath([0, 100, 0], [10, 1.15, 0], [1, 0, 0])
    expect(p[1][1]).toBe(118)
  })

  it('crests 18 m above the approach point when the camera starts low, as when leaving another seat', () => {
    const i = v.indexOf('S-20-060')
    const eye = seatEye(i, v)
    const from = seatEye(v.indexOf('P1-01-01'), v)
    const p = flightPath(from, eye, seatBack(i, v))
    expect(p[1][1]).toBeCloseTo(eye[1] + 7 + 18, 6)
    expect(p[1][1]).toBeGreaterThan(from[1] + 18)
  })

  it('puts the crest 40% of the way along, over the straight line from the camera to the approach point', () => {
    const from: Vec3 = [-30, 5, 40]
    const p = flightPath(from, [20, 2, -10], [0, 0, -1])
    expect(p[1][0]).toBeCloseTo(from[0] + 0.4 * (p[2][0] - from[0]), 9)
    expect(p[1][2]).toBeCloseTo(from[2] + 0.4 * (p[2][2] - from[2]), 9)
  })

  it('has its highest point at the crest, wherever it starts', () => {
    const rnd = seeded(41)
    for (let n = 0; n < 300; n++) {
      const i = Math.floor(rnd() * v.count)
      const from: Vec3 = [(rnd() - 0.5) * 300, rnd() * 150, (rnd() - 0.5) * 300]
      const p = flightPath(from, seatEye(i, v), seatBack(i, v))
      expect(p[1][1]).toBeGreaterThanOrEqual(Math.max(p[0][1], p[2][1], p[3][1]) + 18 - 1e-9)
      for (const q of p) for (const c of q) expect(Number.isFinite(c)).toBe(true)
    }
  })

  it('does not touch the points it is given, and returns points of its own', () => {
    const from: Vec3 = [72, 64, -88]
    const eye: Vec3 = [-10, 1.15, 5]
    const back: Vec3 = [1, 0, 0]
    const p = flightPath(from, eye, back)
    expect(from).toEqual([72, 64, -88])
    expect(eye).toEqual([-10, 1.15, 5])
    expect(back).toEqual([1, 0, 0])
    expect(p[0]).not.toBe(from)
    expect(p[3]).not.toBe(eye)
    p[0][0] = 0
    p[3][0] = 0
    expect(from[0]).toBe(72)
    expect(eye[0]).toBe(-10)
  })

  it('copes with a camera that is already at the approach point', () => {
    const eye: Vec3 = [0, 1.15, 0]
    const p = flightPath([12, 8.15, 0], eye, [1, 0, 0])
    expect(p[1]).toEqual([12, 26.15, 0])
    expect(p[2]).toEqual([12, 8.15, 0])
  })
})

describe('returnPath', () => {
  it('starts and ends where asked, with one point between', () => {
    const from: Vec3 = [-10, 1.15, 5]
    const to: Vec3 = [72, 64, -88]
    const r = returnPath(from, to)
    expect(r[0]).toEqual(from)
    expect(r[2]).toEqual(to)
    expect(r[0]).not.toBe(from)
    expect(r[2]).not.toBe(to)
    expect(from).toEqual([-10, 1.15, 5])
    expect(to).toEqual([72, 64, -88])
  })

  it('rises 20 m above whichever end is higher', () => {
    expect(returnPath([0, 1, 0], [10, 50, 10])[1]).toEqual([5, 70, 5])
    expect(returnPath([0, 50, 0], [10, 1, 10])[1]).toEqual([5, 70, 5])
    expect(returnPath([0, 9, 0], [0, 9, 0])[1]).toEqual([0, 29, 0])
  })
})

describe('orbit angles', () => {
  it('measures theta round the target from the south toward the east, and phi down from straight above', () => {
    const t: Vec3 = [-8, 0, 0]
    const level = Math.PI / 2
    const south = orbitPosition({ theta: 0, phi: level, radius: 100 }, t)
    expect(south[0]).toBeCloseTo(-8, 9)
    expect(south[1]).toBeCloseTo(0, 9)
    expect(south[2]).toBeCloseTo(100, 9)
    const east = orbitPosition({ theta: Math.PI / 2, phi: level, radius: 100 }, t)
    expect(east[0]).toBeCloseTo(92, 9)
    expect(east[2]).toBeCloseTo(0, 9)
    const north = orbitPosition({ theta: Math.PI, phi: level, radius: 100 }, t)
    expect(north[2]).toBeCloseTo(-100, 9)
    const above = orbitPosition({ theta: 1.234, phi: 0, radius: 100 }, t)
    expect(above[0]).toBeCloseTo(-8, 9)
    expect(above[1]).toBeCloseTo(100, 9)
    expect(above[2]).toBeCloseTo(0, 9)
  })

  it('places the opening camera north-east of the target, about 62 degrees down from overhead', () => {
    const o = orbitFromPosition(ORBIT_HOME.position, ORBIT_HOME.target)
    // Between east (90) and north (180).
    expect(deg(o.theta)).toBeGreaterThan(90)
    expect(deg(o.theta)).toBeLessThan(180)
    expect(deg(o.phi)).toBeCloseTo(61.7, 1)
  })

  it('adds the target, so the same angles about another target give a shifted position', () => {
    const o = { theta: 0.7, phi: 1.1, radius: 90 }
    const a = orbitPosition(o, [0, 0, 0])
    const b = orbitPosition(o, [5, -2, 9])
    expect(b[0] - a[0]).toBeCloseTo(5, 9)
    expect(b[1] - a[1]).toBeCloseTo(-2, 9)
    expect(b[2] - a[2]).toBeCloseTo(9, 9)
  })

  it('round-trips angles to a position and back', () => {
    const rnd = seeded(7)
    for (let n = 0; n < 300; n++) {
      const o = { theta: (rnd() * 2 - 1) * Math.PI * 0.999, phi: rad(1 + rnd() * 178), radius: 1 + rnd() * 400 }
      const target: Vec3 = [(rnd() - 0.5) * 50, (rnd() - 0.5) * 10, (rnd() - 0.5) * 50]
      const back = orbitFromPosition(orbitPosition(o, target), target)
      expect(back.theta).toBeCloseTo(o.theta, 6)
      expect(back.phi).toBeCloseTo(o.phi, 6)
      expect(back.radius).toBeCloseTo(o.radius, 6)
    }
  })

  it('round-trips a position to angles and back', () => {
    const rnd = seeded(8)
    for (let n = 0; n < 300; n++) {
      const position: Vec3 = [(rnd() - 0.5) * 400, (rnd() - 0.5) * 400, (rnd() - 0.5) * 400]
      const target: Vec3 = [(rnd() - 0.5) * 50, (rnd() - 0.5) * 10, (rnd() - 0.5) * 50]
      const o = orbitFromPosition(position, target)
      expect(o.radius).toBeCloseTo(length(sub(position, target)), 9)
      const p = orbitPosition(o, target)
      expect(p[0]).toBeCloseTo(position[0], 6)
      expect(p[1]).toBeCloseTo(position[1], 6)
      expect(p[2]).toBeCloseTo(position[2], 6)
    }
  })

  it('gives plain zeros, not NaN, for a camera sitting on its target or straight above it', () => {
    expect(orbitFromPosition([3, 4, 5], [3, 4, 5])).toEqual({ theta: 0, phi: 0, radius: 0 })
    expect(orbitFromPosition([3, 14, 5], [3, 4, 5])).toEqual({ theta: 0, phi: 0, radius: 10 })
    const below = orbitFromPosition([3, -6, 5], [3, 4, 5])
    expect(below.phi).toBeCloseTo(Math.PI, 9)
    expect(below.radius).toBe(10)
  })
})

describe('clampOrbit', () => {
  it('takes its limits from the venue config: 18 to 80 degrees from overhead, 60 to 220 m out', () => {
    expect(VENUE.camera.orbit).toEqual({ polarMinDeg: 18, polarMaxDeg: 80, radiusMin: 60, radiusMax: 220 })
    const cfg = structuredClone(VENUE)
    cfg.camera.orbit = { polarMinDeg: 30, polarMaxDeg: 60, radiusMin: 10, radiusMax: 20 }
    expect(clampOrbit({ theta: 0, phi: 0, radius: 0 }, cfg)).toEqual({ theta: 0, phi: (30 * Math.PI) / 180, radius: 10 })
    expect(clampOrbit({ theta: 0, phi: 3, radius: 999 }, cfg)).toEqual({ theta: 0, phi: (60 * Math.PI) / 180, radius: 20 })
  })

  it('leaves a pose alone when it is inside the limits or exactly on one', () => {
    for (const o of [
      { theta: -2, phi: rad(45), radius: 100 },
      { theta: 0, phi: rad(18), radius: 60 },
      { theta: 0, phi: rad(80), radius: 220 },
    ]) {
      expect(clampOrbit(o)).toEqual(o)
    }
  })

  it('never limits theta: the camera can go round and round', () => {
    expect(clampOrbit({ theta: 100, phi: 1, radius: 100 }).theta).toBe(100)
    expect(clampOrbit({ theta: -100, phi: 1, radius: 100 }).theta).toBe(-100)
  })

  it('returns a new pose and leaves the one it was given unchanged', () => {
    const o = { theta: 1, phi: 0, radius: 500 }
    const c = clampOrbit(o)
    expect(c).not.toBe(o)
    expect(o).toEqual({ theta: 1, phi: 0, radius: 500 })
  })

  it('keeps the camera above the ground and outside the seats at every limit', () => {
    const rnd = seeded(12)
    for (let n = 0; n < 500; n++) {
      const o = clampOrbit({ theta: rnd() * 20 - 10, phi: rnd() * 4 - 0.5, radius: rnd() * 600 - 100 })
      const p = orbitPosition(o, ORBIT_HOME.target)
      // The lowest the camera can get is the closest radius at the flattest angle: about 10.4 m up,
      // which is still over the heads of everyone on the pitch.
      expect(p[1]).toBeGreaterThan(10)
      expect(length(sub(p, ORBIT_HOME.target))).toBeGreaterThanOrEqual(60 - 1e-9)
      expect(length(sub(p, ORBIT_HOME.target))).toBeLessThanOrEqual(220 + 1e-9)
    }
  })
})

describe('clampLook', () => {
  it('takes its pitch limits from the venue config: 35 degrees down to 50 up', () => {
    expect(VENUE.camera.look).toEqual({ pitchMinDeg: -35, pitchMaxDeg: 50 })
    const cfg = structuredClone(VENUE)
    cfg.camera.look = { pitchMinDeg: -10, pitchMaxDeg: 20 }
    expect(clampLook(0, -1, cfg).pitch).toBe((-10 * Math.PI) / 180)
    expect(clampLook(0, 1, cfg).pitch).toBe((20 * Math.PI) / 180)
  })

  it('leaves a look alone when it is inside the limits or exactly on one', () => {
    expect(clampLook(1, 0.3)).toEqual({ yaw: 1, pitch: 0.3 })
    expect(clampLook(-3, -0.3)).toEqual({ yaw: -3, pitch: -0.3 })
    expect(clampLook(0, rad(50))).toEqual({ yaw: 0, pitch: rad(50) })
    expect(clampLook(0, rad(-35))).toEqual({ yaw: 0, pitch: rad(-35) })
    // Plain zero in, plain zero out: a -0 would fail an exact comparison further on.
    expect(Object.is(clampLook(0, 0).yaw, 0)).toBe(true)
  })

  it('wraps the yaw into -pi (not included) to +pi (included)', () => {
    expect(clampLook(Math.PI, 0).yaw).toBe(Math.PI)
    expect(clampLook(-Math.PI, 0).yaw).toBeCloseTo(Math.PI, 12)
    expect(clampLook(3 * Math.PI, 0).yaw).toBeCloseTo(Math.PI, 12)
    expect(clampLook(2 * Math.PI, 0).yaw).toBeCloseTo(0, 12)
    expect(clampLook(-4, 0).yaw).toBeCloseTo(2 * Math.PI - 4, 12)
    expect(clampLook(7, 0).yaw).toBeCloseTo(7 - 2 * Math.PI, 12)
  })

  it('keeps the direction when it wraps: a full turn of dragging lands where it started', () => {
    const rnd = seeded(3)
    for (let n = 0; n < 300; n++) {
      const yaw = (rnd() - 0.5) * 200
      const w = clampLook(yaw, 0).yaw
      expect(w).toBeGreaterThan(-Math.PI)
      expect(w).toBeLessThanOrEqual(Math.PI)
      expect(Math.sin(w)).toBeCloseTo(Math.sin(yaw), 9)
      expect(Math.cos(w)).toBeCloseTo(Math.cos(yaw), 9)
    }
  })
})

describe('lookAngles', () => {
  it('names the four compass directions the way seat yaw does', () => {
    expect(lookAngles([0, 0, 0], [0, 0, -5]).yaw).toBeCloseTo(0, 9) // north
    expect(lookAngles([0, 0, 0], [-5, 0, 0]).yaw).toBeCloseTo(Math.PI / 2, 9) // west
    expect(lookAngles([0, 0, 0], [5, 0, 0]).yaw).toBeCloseTo(-Math.PI / 2, 9) // east
    expect(lookAngles([0, 0, 0], [0, 0, 5]).yaw).toBeCloseTo(Math.PI, 9) // south
    // Due north is a plain zero, not -0.
    expect(Object.is(lookAngles([0, 0, 0], [0, 0, -5]).yaw, 0)).toBe(true)
  })

  it('gives the yaw of a seat when looking the way the seat faces', () => {
    for (let i = 0; i < v.count; i += 13) {
      const p = at(i)
      const f = seatFacing(i, v)
      const a = lookAngles(p, [p[0] + f[0] * 10, p[1], p[2] + f[2] * 10])
      expect(Math.abs(angleBetween(a.yaw, v.yaw[i]))).toBeLessThan(1e-6)
      expect(a.pitch).toBeCloseTo(0, 9)
    }
  })

  it('has a positive pitch looking up and a negative one looking down', () => {
    expect(lookAngles([0, 5, 0], [10, 15, 0]).pitch).toBeCloseTo(Math.PI / 4, 9)
    expect(lookAngles([0, 5, 0], [10, -5, 0]).pitch).toBeCloseTo(-Math.PI / 4, 9)
    expect(lookAngles([0, 5, 0], [0, 9, 0]).pitch).toBeCloseTo(Math.PI / 2, 9)
  })

  it('answers with zeros, not NaN, when the two points are the same or one is straight above the other', () => {
    expect(lookAngles([1, 2, 3], [1, 2, 3])).toEqual({ yaw: 0, pitch: 0 })
    expect(lookAngles([1, 2, 3], [1, 9, 3]).yaw).toBe(0)
  })

  it('depends only on the direction, not on the distance or where the eye is', () => {
    const a = lookAngles([0, 0, 0], [3, 2, -7])
    const b = lookAngles([10, 20, 30], [10 + 30, 20 + 20, 30 - 70])
    expect(b.yaw).toBeCloseTo(a.yaw, 9)
    expect(b.pitch).toBeCloseTo(a.pitch, 9)
  })

  it('round-trips with the direction formula', () => {
    const rnd = seeded(5)
    for (let n = 0; n < 300; n++) {
      const yaw = (rnd() * 2 - 1) * 3.1
      const pitch = (rnd() * 2 - 1) * 1.5
      const a = lookAngles([4, 5, 6], [4 + direction(yaw, pitch)[0], 5 + direction(yaw, pitch)[1], 6 + direction(yaw, pitch)[2]])
      expect(a.yaw).toBeCloseTo(yaw, 9)
      expect(a.pitch).toBeCloseTo(pitch, 9)
    }
  })

  it('makes a three.js camera look at the target when set as rotation.y and rotation.x in YXZ order', () => {
    const rnd = seeded(9)
    for (let n = 0; n < 200; n++) {
      const eye: Vec3 = [(rnd() - 0.5) * 100, rnd() * 20, (rnd() - 0.5) * 100]
      const target: Vec3 = [(rnd() - 0.5) * 100, rnd() * 20, (rnd() - 0.5) * 100]
      const a = lookAngles(eye, target)
      // A camera looks down its own -Z axis.
      const forward = new Vector3(0, 0, -1).applyEuler(new Euler(a.pitch, a.yaw, 0, 'YXZ'))
      const want = new Vector3(...sub(target, eye)).normalize()
      expect(forward.distanceTo(want)).toBeLessThan(1e-9)
    }
  })
})

describe('overviewFov', () => {
  /** The horizontal field of view that goes with a vertical one on a screen of this shape. */
  const horizontal = (fov: number, aspect: number) => deg(2 * Math.atan(aspect * Math.tan(rad(fov / 2))))

  it('is the opening field of view on every landscape screen', () => {
    for (const aspect of [1.3, 4 / 3, 1.6, 16 / 9, 21 / 9, 3]) expect(overviewFov(aspect)).toBe(ORBIT_HOME.fov)
  })

  it('holds the view 53 degrees wide on squarer screens, until it reaches 72 degrees tall', () => {
    for (const aspect of [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.29]) {
      const fov = overviewFov(aspect)
      expect(fov).toBeGreaterThan(42)
      expect(fov).toBeLessThan(72)
      expect(horizontal(fov, aspect)).toBeCloseTo(53, 6)
    }
    for (const aspect of [0.68, 0.56, 390 / 844, 0.3]) expect(overviewFov(aspect)).toBe(72)
  })

  it('never narrows as the screen gets taller, and stays between 42 and 72', () => {
    let last = 0
    for (let aspect = 4; aspect >= 0.2; aspect -= 0.01) {
      const fov = overviewFov(aspect)
      expect(fov).toBeGreaterThanOrEqual(last)
      expect(fov).toBeGreaterThanOrEqual(42)
      expect(fov).toBeLessThanOrEqual(72)
      last = fov
    }
  })

  it('falls back to the opening field of view for a screen with no shape yet', () => {
    for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(overviewFov(aspect)).toBe(42)
  })
})

describe('the flight as the camera rig will fly it', () => {
  // The rig threads a Catmull-Rom curve through the control points. A curve like that does not
  // follow the straight legs between its points, so these check the path that is actually flown.
  const curve = (points: Vec3[], type: 'centripetal' | 'chordal' | 'catmullrom' = FLIGHT_CURVE_TYPE) =>
    new CatmullRomCurve3(points.map((p) => new Vector3(...p)), false, type)
  const occluders = getOccluders()

  /** Whether a flown path passes through a wall, or through the pick box of any chair but its own. */
  function passesThrough(path: Vector3[], own: number): { wall: boolean; chair: boolean } {
    const hit = { wall: false, chair: false }
    for (let k = 0; k + 1 < path.length; k++) {
      const a = path[k]
      const step = path[k + 1].clone().sub(a)
      const reach = step.length()
      if (reach < 1e-9) continue
      step.divideScalar(reach)
      const ray = { ox: a.x, oy: a.y, oz: a.z, dx: step.x, dy: step.y, dz: step.z }
      if (occluderDistance(ray, occluders) <= reach) hit.wall = true
      const chair = pickHit(ray, v, [])
      if (chair.index >= 0 && chair.index !== own && chair.t <= reach) hit.chair = true
    }
    return hit
  }

  /** The stand whose box is closed in by the canopy: its rear wall goes all the way up to the roof slab. */
  const roofed = v.sections.findIndex((s) => s.id === VENUE.canopy.over)

  it('names the curve type the rig must use', () => {
    expect(FLIGHT_CURVE_TYPE).toBe('chordal')
  })

  it('never dips below eye level on the way into a seat from the opening camera', () => {
    for (let i = 0; i < v.count; i += 53) {
      const eye = seatEye(i, v)
      const path = curve(flightPath(ORBIT_HOME.position, eye, seatBack(i, v))).getPoints(200)
      for (const q of path) expect(q.y).toBeGreaterThanOrEqual(eye[1] - 1e-6)
    }
  })

  it('never dips below the seat on the way back out', () => {
    for (let i = 0; i < v.count; i += 53) {
      const eye = seatEye(i, v)
      const path = curve(returnPath(eye, ORBIT_HOME.position)).getPoints(200)
      for (const q of path) expect(q.y).toBeGreaterThanOrEqual(eye[1] - 1e-6)
    }
  })

  it('comes straight down the last leg without touching a chair or a wall, for every open-air seat', () => {
    // The last leg is the line from the approach point to the eye. It has to clear the chair backs
    // of the rows behind, which rise almost as steeply as it comes down, and the stand's rear wall.
    for (let i = 0; i < v.count; i++) {
      if (v.section[i] === roofed) continue
      const p = flightPath(ORBIT_HOME.position, seatEye(i, v), seatBack(i, v))
      expect(passesThrough([new Vector3(...p[2]), new Vector3(...p[3])], i)).toEqual({ wall: false, chair: false })
    }
  })

  it('flies into every open-air seat from the opening camera without passing through a chair or a wall', () => {
    let flown = 0
    for (let i = 0; i < v.count; i += 11) {
      if (v.section[i] === roofed) continue
      const path = curve(flightPath(ORBIT_HOME.position, seatEye(i, v), seatBack(i, v))).getPoints(300)
      expect(passesThrough(path, i)).toEqual({ wall: false, chair: false })
      flown++
    }
    expect(flown).toBeGreaterThan(650)
  })

  it('flies from one seat to another without passing through a chair or a wall', () => {
    const from = seatEye(v.indexOf('P1-01-01'), v)
    for (const id of ['P6-33-14', 'P3-12-07', 'S-01-001', 'S-10-060', 'S-20-120', 'NW-08-015', 'NE-15-030', 'E-01-001', 'E-12-100', 'ACC-02-020']) {
      const i = v.indexOf(id)
      const path = curve(flightPath(from, seatEye(i, v), seatBack(i, v))).getPoints(300)
      expect(passesThrough(path, i)).toEqual({ wall: false, chair: false })
    }
  })

  it("would cut through the rows behind a stand seat with three.js's default curve type", () => {
    // Why FLIGHT_CURVE_TYPE exists: the default ('centripetal') sags below the last leg, into the
    // chairs behind the seat. If this ever stops being true the constant can go.
    const i = v.indexOf('S-10-060')
    const points = flightPath(ORBIT_HOME.position, seatEye(i, v), seatBack(i, v))
    expect(passesThrough(curve(points, 'centripetal').getPoints(300), i).chair).toBe(true)
    expect(passesThrough(curve(points).getPoints(300), i).chair).toBe(false)
  })

  it('cannot reach a seat under the canopy from behind without passing through the box', () => {
    // A known limit of approaching every seat from behind and above: the roofed box is closed on
    // exactly those two sides. Kept as a test so the day the flight is given a way in from the
    // front, this fails and the exception in the tests above can be removed.
    const i = v.indexOf('VIP-03-025')
    const p = flightPath(ORBIT_HOME.position, seatEye(i, v), seatBack(i, v))
    expect(passesThrough([new Vector3(...p[2]), new Vector3(...p[3])], i).wall).toBe(true)
  })
})
