import { describe, expect, it } from 'vitest'
import { VENUE } from '@/features/stadiview/config/venue'
import type { LineStandConfig, VenueConfig } from '@/features/stadiview/config/venue'
import { buildOccluders, getOccluders, occluderDistance } from '@/features/stadiview/engine/occluders'
import type { Occluder } from '@/features/stadiview/engine/occluders'
import { pickBays, pickHit, pickPitch, pickSeat, pickStands } from '@/features/stadiview/engine/picking'
import type { Ray } from '@/features/stadiview/engine/picking'
import { CHAIR_BOX, seatAim, seatBack, seatFacing } from '@/features/stadiview/engine/seatFrame'
import type { Vec3 } from '@/features/stadiview/engine/seatFrame'
import { blockZ, rowX } from '@/features/stadiview/layout/pitchLayout'
import { SeatKind } from '@/features/stadiview/layout/types'
import type { VenueLayout } from '@/features/stadiview/layout/types'
import { buildVenue } from '@/features/stadiview/layout/venueLayout'

const v = buildVenue()
const rad = (deg: number) => (deg * Math.PI) / 180
const at = (w: VenueLayout, i: number): Vec3 => [w.position[i * 3], w.position[i * 3 + 1], w.position[i * 3 + 2]]

/** A ray from `o` in the direction `d`, which need not be a unit vector. */
const along = (o: Vec3, d: Vec3): Ray => {
  const l = Math.hypot(d[0], d[1], d[2])
  return { ox: o[0], oy: o[1], oz: o[2], dx: d[0] / l, dy: d[1] / l, dz: d[2] / l }
}
const toward = (o: Vec3, t: Vec3): Ray => along(o, [t[0] - o[0], t[1] - o[1], t[2] - o[2]])
const down = (x: number, z: number): Ray => ({ ox: x, oy: 50, oz: z, dx: 0, dy: -1, dz: 0 })
const HOME: Vec3 = [72, 64, -88]

/**
 * A venue unlike the default one, to prove picking reads the layout it is given:
 * - a pitch grid with other spacings, aisles and cross aisles, and five more graduates;
 * - in place of the east curve, a ring of seats all the way round the stadium. It is numbered
 *   against the angle, and its first and last seats meet due south, so its rows cross the jump
 *   from +180 to -180 degrees and have a seam.
 */
function reshaped(): { cfg: VenueConfig; layout: VenueLayout } {
  const cfg = structuredClone(VENUE)
  cfg.blocks.seatPitch = 0.7
  cfg.blocks.aisle = 3
  cfg.blocks.row1X = -28
  cfg.blocks.rowPitch = 1.2
  cfg.blocks.crossAisleEvery = 10
  cfg.blocks.crossAisle = 2.5
  cfg.zones[0].count += 5
  const ring = cfg.stands.find((s) => s.id === 'E')!
  if (ring.kind === 'arc') {
    ring.cx = 0
    ring.cz = 0
    ring.firstRowRadius = 90
    ring.rows = 3
    ring.spans = [{ fromDeg: 450, toDeg: 90, seats: 800 }]
  }
  return { cfg, layout: buildVenue(cfg) }
}

describe('the seat frame', () => {
  it('defines the pick box of one seat', () => {
    expect(CHAIR_BOX).toEqual({ halfW: 0.25, height: 0.95, halfD: 0.25 })
  })

  it('faces pitch seats and bays west, the south stand north and the north stands south', () => {
    const facing = (id: string) => seatFacing(v.indexOf(id), v)
    for (const id of ['P1-01-01', 'P6-33-14', 'P4-A2']) {
      expect(facing(id)[0]).toBeCloseTo(-1, 6)
      expect(facing(id)[1]).toBe(0)
      expect(facing(id)[2]).toBeCloseTo(0, 6)
    }
    expect(facing('S-10-060')[2]).toBeCloseTo(-1, 6)
    expect(facing('ACC-02-020')[2]).toBeCloseTo(-1, 6)
    for (const id of ['NW-08-015', 'NE-08-015', 'VIP-03-025']) expect(facing(id)[2]).toBeCloseTo(1, 6)
  })

  it('faces every east-curve seat at the centre of the curve', () => {
    const east = v.sections.find((s) => s.id === 'E')!
    for (let i = east.start; i < east.start + east.count; i += 13) {
      const [x, , z] = at(v, i)
      const dx = VENUE.track.straightHalf - x
      const l = Math.hypot(dx, z)
      const f = seatFacing(i, v)
      expect(f[0]).toBeCloseTo(dx / l, 4)
      expect(f[1]).toBe(0)
      expect(f[2]).toBeCloseTo(-z / l, 4)
    }
  })

  it('gives plain zeros, not negative zeros, for a seat that faces due north', () => {
    // -0 fails an exact comparison with 0, which would trip up tests that compare whole vectors.
    const s = v.indexOf('S-10-060')
    expect(seatFacing(s, v)).toEqual([0, 0, -1])
    expect(seatBack(s, v)).toEqual([0, 0, 1])
  })

  it('gives a level unit vector for the facing, and its opposite for the back', () => {
    for (let i = 0; i < v.count; i += 41) {
      const f = seatFacing(i, v)
      const b = seatBack(i, v)
      expect(Math.hypot(f[0], f[1], f[2])).toBeCloseTo(1, 9)
      expect(f[1]).toBe(0)
      expect(b[0]).toBeCloseTo(-f[0], 12)
      expect(b[1]).toBe(0)
      expect(b[2]).toBeCloseTo(-f[2], 12)
    }
  })

  it('aims at the upper seat back: 0.22 behind the seat centre and 0.8 above its floor', () => {
    const p = v.indexOf('P3-12-07')
    const [px, py, pz] = at(v, p)
    const a = seatAim(p, v)
    // A pitch seat faces west, so its back is to the east.
    expect(a[0]).toBeCloseTo(px + 0.22, 5)
    expect(a[1]).toBeCloseTo(py + 0.8, 5)
    expect(a[2]).toBeCloseTo(pz, 5)

    const s = v.indexOf('S-10-060')
    const sa = seatAim(s, v)
    expect(sa[0]).toBeCloseTo(at(v, s)[0], 5)
    expect(sa[1]).toBeCloseTo(at(v, s)[1] + 0.8, 5)
    expect(sa[2]).toBeCloseTo(at(v, s)[2] + 0.22, 5)
  })

  it('keeps the aim point inside the seat\'s own pick box, on every seat', () => {
    for (let i = 0; i < v.count; i++) {
      const p = at(v, i)
      const a = seatAim(i, v)
      const f = seatFacing(i, v)
      const rel = [a[0] - p[0], a[1] - p[1], a[2] - p[2]]
      const depth = rel[0] * f[0] + rel[2] * f[2]
      const width = rel[0] * f[2] - rel[2] * f[0]
      expect(Math.abs(depth)).toBeLessThan(CHAIR_BOX.halfD)
      expect(Math.abs(width)).toBeLessThan(CHAIR_BOX.halfW)
      expect(rel[1]).toBeGreaterThan(0)
      expect(rel[1]).toBeLessThan(CHAIR_BOX.height)
    }
  })
})

describe('occluders', () => {
  const occ = buildOccluders()
  const boxes = occ.filter((o) => o.kind === 'box')
  const sides = occ.filter((o) => o.kind === 'side')
  const arcs = occ.filter((o) => o.kind === 'arc')
  const boxWith = (pred: (b: Extract<Occluder, { kind: 'box' }>) => boolean) => boxes.find(pred)!
  const expectVec = (got: Vec3, want: Vec3) => got.forEach((n, k) => expect(n).toBeCloseTo(want[k], 9))

  it('lists the backdrop, the canopy, four rear walls, eight side walls and the east curve\'s two arcs', () => {
    expect(boxes).toHaveLength(6)
    expect(sides).toHaveLength(8)
    expect(arcs).toHaveLength(2)
    expect(VENUE.walls.stands).toEqual(['VIP', 'NW', 'NE', 'S', 'E'])
  })

  it('lists them in a fixed order: backdrop, canopy, then each walled stand\'s rear wall and its two ends', () => {
    const stand = ['box', 'side', 'side']
    expect(occ.map((o) => o.kind)).toEqual(['box', 'box', ...stand, ...stand, ...stand, ...stand, 'arc', 'arc'])
    // The walled stands come in the config's order, and each rear wall is followed by its west end, then its east end.
    const walled = VENUE.stands.filter((s) => s.kind === 'line' && VENUE.walls.stands.includes(s.id)) as LineStandConfig[]
    walled.forEach((s, k) => {
      const [rear, west, east] = occ.slice(2 + 3 * k, 5 + 3 * k)
      expect(rear).toMatchObject({ kind: 'box' })
      expect(west).toMatchObject({ kind: 'side', x: s.xMin })
      expect(east).toMatchObject({ kind: 'side', x: s.xMax })
      if (rear.kind === 'box') expect([rear.min[0], rear.max[0]]).toEqual([s.xMin, s.xMax])
    })
  })

  it('describes walls that can be built: each has a real size and stands on or above the ground', () => {
    for (const o of occ) {
      if (o.kind === 'box') {
        for (let axis = 0; axis < 3; axis++) expect(o.max[axis]).toBeGreaterThan(o.min[axis])
        expect(o.min[1]).toBeGreaterThanOrEqual(0)
      } else if (o.kind === 'side') {
        expect(Math.abs(o.z1 - o.z0)).toBeGreaterThan(1)
        expect(o.y0).toBeGreaterThan(0)
        expect(o.y1).toBeGreaterThan(o.y0)
      } else {
        expect(o.radius).toBeGreaterThan(0)
        expect(o.to).toBeGreaterThan(o.from)
        expect(o.y1).toBeGreaterThan(o.y0)
      }
    }
  })

  it('stands nothing over a seat except the canopy over the VIP box', () => {
    const vip = v.sections.find((s) => s.id === 'VIP')!
    const covered: number[] = []
    for (let i = 0; i < v.count; i++) {
      const toChair = 50 - v.position[i * 3 + 1] - CHAIR_BOX.height
      if (occluderDistance(down(v.position[i * 3], v.position[i * 3 + 2]), occ) < toChair) covered.push(i)
    }
    expect(covered).toEqual(Array.from({ length: vip.count }, (_, k) => vip.start + k))
  })

  it('keeps every chair clear of the walls: none is cut by one', () => {
    // Take the eight corners of each stand chair's box. No corner may be inside a solid block, and
    // no chair may straddle an end wall or the curved wall.
    const cut: string[] = []
    for (let i = v.ranges.stands[0]; i < v.ranges.stands[1]; i++) {
      const p = at(v, i)
      const f = seatFacing(i, v)
      const corners: Vec3[] = []
      for (const side of [-1, 1]) {
        for (const depth of [-1, 1]) {
          const x = p[0] + depth * CHAIR_BOX.halfD * f[0] + side * CHAIR_BOX.halfW * f[2]
          const z = p[2] + depth * CHAIR_BOX.halfD * f[2] - side * CHAIR_BOX.halfW * f[0]
          corners.push([x, p[1], z], [x, p[1] + CHAIR_BOX.height, z])
        }
      }
      const xs = corners.map((c) => c[0])
      for (const o of occ) {
        let touches: boolean
        if (o.kind === 'box') {
          touches = corners.some((c) => c[0] > o.min[0] && c[0] < o.max[0] && c[1] > o.min[1] && c[1] < o.max[1] && c[2] > o.min[2] && c[2] < o.max[2])
        } else if (o.kind === 'side') {
          const alongside = Math.min(o.z0, o.z1) < p[2] && p[2] < Math.max(o.z0, o.z1)
          touches = alongside && Math.min(...xs) < o.x && o.x < Math.max(...xs)
        } else {
          // Only the part of the circle the wall covers counts: the circle itself carries on across the pitch.
          const angle = Math.atan2(p[2] - o.cz, p[0] - o.cx)
          const reach = corners.map((c) => Math.hypot(c[0] - o.cx, c[2] - o.cz))
          touches = angle > o.from && angle < o.to && Math.min(...reach) < o.radius && o.radius < Math.max(...reach)
        }
        if (touches) cut.push(`${v.idOf(i)} by a ${o.kind}`)
      }
    }
    expect(cut).toEqual([])
  })

  it('makes the stage backdrop solid from the ground to its top', () => {
    const b = boxWith((o) => o.max[0] < -50)
    expectVec(b.min, [-52.4, 0, -22])
    expectVec(b.max, [-52, 12.6, 22])
  })

  it('lays the canopy slab over the VIP box', () => {
    const b = boxWith((o) => o.min[1] > 5)
    expectVec(b.min, [-17, 9.5, -60])
    expectVec(b.max, [17, 9.8, -50])
  })

  it('stands a rear wall 0.3 thick directly behind the last tread of S, NW and NE, 1.1 above the last row', () => {
    const south = boxWith((o) => o.min[2] > 60)
    expectVec(south.min, [-36, 0, 69.575])
    expectVec(south.max, [36, 10.28, 69.875])
    const nw = boxWith((o) => o.max[2] < -62 && o.max[0] < 0)
    expectVec(nw.min, [-35, 0, -64.625])
    expectVec(nw.max, [-17, 8.18, -64.325])
    const ne = boxWith((o) => o.max[2] < -62 && o.min[0] > 0)
    expectVec(ne.min, [17, 0, -64.625])
    expectVec(ne.max, [35, 8.18, -64.325])
  })

  it('raises the VIP rear wall to the underside of the canopy', () => {
    const vip = boxWith((o) => o.min[0] === -15)
    expectVec(vip.min, [-15, 0, -58.35])
    expectVec(vip.max, [15, 9.5, -58.05])
  })

  it('closes both ends of S, NW, NE and VIP with a wall that slopes up from the first row to the rear wall', () => {
    const side = (x: number) => sides.find((s) => s.x === x)!
    for (const x of [-36, 36]) {
      expect(side(x).z0).toBeCloseTo(52.575, 9)
      expect(side(x).z1).toBeCloseTo(69.575, 9)
      expect(side(x).y0).toBeCloseTo(1.2, 9)
      expect(side(x).y1).toBeCloseTo(10.28, 9)
    }
    for (const x of [-35, -17, 17, 35]) {
      expect(side(x).z0).toBeCloseTo(-51.575, 9)
      expect(side(x).z1).toBeCloseTo(-64.325, 9)
      expect(side(x).y0).toBeCloseTo(1.2, 9)
      expect(side(x).y1).toBeCloseTo(8.18, 9)
    }
    for (const x of [-15, 15]) {
      expect(side(x).z0).toBeCloseTo(-51.45, 9)
      expect(side(x).z1).toBeCloseTo(-58.05, 9)
      expect(side(x).y0).toBeCloseTo(3.0, 9)
      expect(side(x).y1).toBeCloseTo(9.5, 9)
    }
  })

  it('curves the east rear wall in two arcs that leave the procession entrance open', () => {
    const [north, south] = arcs
    for (const a of arcs) {
      expect(a.cx).toBe(42.195)
      expect(a.cz).toBe(0)
      expect(a.radius).toBeCloseTo(61.775, 9)
      expect(a.y0).toBe(0)
      expect(a.y1).toBeCloseTo(6.92, 9)
    }
    expect(north.from).toBeCloseTo(rad(-34), 12)
    expect(north.to).toBeCloseTo(rad(-4), 12)
    expect(south.from).toBeCloseTo(rad(4), 12)
    expect(south.to).toBeCloseTo(rad(34), 12)
  })

  it('builds the default list once and shares it', () => {
    expect(getOccluders()).toBe(getOccluders())
    expect(getOccluders()).toEqual(occ)
    expect(buildOccluders()).not.toBe(buildOccluders())
  })

  it('follows the config', () => {
    const cfg = structuredClone(VENUE)
    cfg.walls.rise = 2
    cfg.walls.thickness = 0.5
    cfg.canopy.yBottom = 11
    cfg.canopy.yTop = 11.4
    cfg.stage.backdrop.yTop = 15
    cfg.stage.backdrop.thickness = 1
    const south = cfg.stands.find((s) => s.id === 'S') as LineStandConfig
    south.rows = 10
    const east = cfg.stands.find((s) => s.id === 'E')!
    if (east.kind === 'arc') east.spans = [{ fromDeg: -30, toDeg: 30, seats: 100 }]
    const list = buildOccluders(cfg)
    const b = list.filter((o) => o.kind === 'box')

    expectVec(b.find((o) => o.max[0] < -50)!.min, [-53, 0, -22])
    expect(b.find((o) => o.max[0] < -50)!.max[1]).toBe(15)
    expectVec(b.find((o) => o.min[1] > 5)!.min, [-17, 11, -60])
    // Ten rows: the last tread ends at 53 + 9 x 0.85 + 0.425, and its floor is at 1.2 + 9 x 0.42.
    const rear = b.find((o) => o.min[2] > 55)!
    expectVec(rear.min, [-36, 0, 61.075])
    expectVec(rear.max, [36, 6.98, 61.575])
    // The VIP wall still stops under the canopy, wherever that is.
    expect(b.find((o) => o.min[0] === -15)!.max[1]).toBe(11)
    const a = list.filter((o) => o.kind === 'arc')
    expect(a).toHaveLength(1)
    expect(a[0].from).toBeCloseTo(rad(-30), 12)
    expect(a[0].to).toBeCloseTo(rad(30), 12)
    expect(a[0].y1).toBeCloseTo(1.2 + 11 * 0.42 + 2, 9)
  })

  it('builds walls only for the stands the config names', () => {
    const cfg = structuredClone(VENUE)
    cfg.walls.stands = ['S']
    const list = buildOccluders(cfg)
    // The backdrop, the canopy, and the south stand's rear wall and two ends.
    expect(list.map((o) => o.kind).sort()).toEqual(['box', 'box', 'box', 'side', 'side'])
    cfg.walls.stands = []
    expect(buildOccluders(cfg)).toHaveLength(2)
  })

  describe('distance along a ray', () => {
    const box: Occluder = { kind: 'box', min: [-1, 0, -2], max: [1, 3, 2] }
    // A wall in the plane x = 5 whose top climbs from 1 at z = 0 to 4 at z = -6 (a north stand's end).
    const side: Occluder = { kind: 'side', x: 5, z0: 0, z1: -6, y0: 1, y1: 4 }
    const arc: Occluder = { kind: 'arc', cx: 10, cz: 0, radius: 20, from: rad(10), to: rad(40), y0: 0, y1: 5 }

    it('is infinite when the list is empty or the ray hits nothing', () => {
      expect(occluderDistance(down(0, 0), [])).toBe(Infinity)
      expect(occluderDistance(down(5, 5), [box])).toBe(Infinity)
      expect(occluderDistance({ ox: 0, oy: 10, oz: 0, dx: 0, dy: 1, dz: 0 }, [box, side, arc])).toBe(Infinity)
    })

    it('measures to the face of a box the ray enters', () => {
      expect(occluderDistance(down(0, 0), [box])).toBeCloseTo(47, 9)
      expect(occluderDistance(along([-11, 1, 0], [1, 0, 0]), [box])).toBeCloseTo(10, 9)
      // Exactly along an edge plane still counts: the box is closed.
      expect(occluderDistance(along([-11, 3, 0], [1, 0, 0]), [box])).toBeCloseTo(10, 9)
      expect(occluderDistance(along([-11, 3.01, 0], [1, 0, 0]), [box])).toBe(Infinity)
    })

    it('ignores a box behind the ray and reports zero from inside one', () => {
      expect(occluderDistance(along([11, 1, 0], [1, 0, 0]), [box])).toBe(Infinity)
      expect(occluderDistance(along([0, 1, 0], [1, 0, 0]), [box])).toBe(0)
    })

    it('blocks under the sloping edge of a side wall and lets a ray pass over it', () => {
      // Half way along, the edge is at 2.5.
      expect(occluderDistance(along([0, 2.4, -3], [1, 0, 0]), [side])).toBeCloseTo(5, 9)
      expect(occluderDistance(along([0, 2.6, -3], [1, 0, 0]), [side])).toBe(Infinity)
      // From the other face too.
      expect(occluderDistance(along([9, 2.4, -3], [-1, 0, 0]), [side])).toBeCloseTo(4, 9)
      // Solid down to the ground, and no further along than its two ends.
      expect(occluderDistance(along([0, 0.05, -5.9], [1, 0, 0]), [side])).toBeCloseTo(5, 9)
      expect(occluderDistance(along([0, 0.5, 0.1], [1, 0, 0]), [side])).toBe(Infinity)
      expect(occluderDistance(along([0, 0.5, -6.1], [1, 0, 0]), [side])).toBe(Infinity)
      // A ray running alongside the wall never meets it.
      expect(occluderDistance(along([4, 0.5, 5], [0, 0, -1]), [side])).toBe(Infinity)
      expect(occluderDistance(along([9, 0.5, -3], [1, 0, 0]), [side])).toBe(Infinity)
    })

    it('blocks inside the angles and the height of a curved wall, from either face', () => {
      const out = (deg: number, y: number) => along([10, y, 0], [Math.cos(rad(deg)), 0, Math.sin(rad(deg))])
      expect(occluderDistance(out(25, 2), [arc])).toBeCloseTo(20, 9)
      expect(occluderDistance(out(5, 2), [arc])).toBe(Infinity)
      expect(occluderDistance(out(45, 2), [arc])).toBe(Infinity)
      expect(occluderDistance(out(25, 5.5), [arc])).toBe(Infinity)
      // From outside, coming in along the same line.
      const p: Vec3 = [10 + 30 * Math.cos(rad(25)), 2, 30 * Math.sin(rad(25))]
      expect(occluderDistance(toward(p, [10, 2, 0]), [arc])).toBeCloseTo(10, 9)
      // A ray that crosses the circle outside the wall's angles first and inside them second hits it from within.
      const q: Vec3 = [10 + 40 * Math.cos(rad(205)), 2, 40 * Math.sin(rad(205))]
      expect(occluderDistance(toward(q, [10, 2, 0]), [arc])).toBeCloseTo(60, 9)
      // Straight down never meets an upright wall.
      expect(occluderDistance(down(10 + 20 * Math.cos(rad(25)), 20 * Math.sin(rad(25)) + 1), [arc])).toBe(Infinity)
    })

    it('handles a curved wall that spans the direction opposite to east', () => {
      const west: Occluder = { kind: 'arc', cx: 0, cz: 0, radius: 10, from: rad(170), to: rad(190), y0: 0, y1: 5 }
      expect(occluderDistance(along([0, 1, 0], [-1, 0, 0]), [west])).toBeCloseTo(10, 9)
      expect(occluderDistance(along([0, 1, 0], [Math.cos(rad(-175)), 0, Math.sin(rad(-175))]), [west])).toBeCloseTo(10, 9)
      expect(occluderDistance(along([0, 1, 0], [1, 0, 0]), [west])).toBe(Infinity)
      expect(occluderDistance(along([0, 1, 0], [Math.cos(rad(160)), 0, Math.sin(rad(160))]), [west])).toBe(Infinity)
    })

    it('returns the nearest of several', () => {
      expect(occluderDistance(along([-11, 1, 0], [1, 0, 0]), [side, box])).toBeCloseTo(10, 9)
      expect(occluderDistance(along([3, 0.5, -3], [1, 0, 0]), [box, arc, side])).toBeCloseTo(2, 9)
    })

    it('measures the real walls: the canopy from above, and a ray over one stand end that meets the next', () => {
      expect(occluderDistance(down(0, -55), occ)).toBeCloseTo(50 - 9.8, 9)
      // West of the north-west flank, heading east at z = -58. At 3 m up it meets that flank's end wall.
      expect(occluderDistance(along([-40, 3, -58], [1, 0, 0]), occ)).toBeCloseTo(5, 9)
      // At 6 m it clears both of the flank's ends (their edge is at about 4.7 there) and stops at the taller end of the VIP box.
      expect(occluderDistance(along([-40, 6, -58], [1, 0, 0]), occ)).toBeCloseTo(25, 9)
    })

    it('lets a ray through the procession entrance but not through the curve beside it', () => {
      const arcsOnly = arcs
      expect(occluderDistance(along([120, 3, 0], [-1, 0, 0]), arcsOnly)).toBe(Infinity)
      const hit = 120 - (42.195 + Math.sqrt(61.775 ** 2 - 20 ** 2))
      expect(occluderDistance(along([120, 3, 20], [-1, 0, 0]), arcsOnly)).toBeCloseTo(hit, 6)
      expect(occluderDistance(along([120, 7, 20], [-1, 0, 0]), arcsOnly)).toBe(Infinity)
    })
  })
})

describe('picking', () => {
  it('picks every 37th seat when the ray comes straight down on it', () => {
    for (let i = 0; i < v.count; i += 37) expect(pickHit(down(v.position[i * 3], v.position[i * 3 + 2]), v, []).index).toBe(i)
  })

  it('picks the seat whose back the opening camera is aimed at', () => {
    expect(VENUE.camera.home.position).toEqual(HOME)
    for (const id of ['P3-12-07', 'P1-01-01', 'P1-45-13', 'P6-33-14', 'P2-A1', 'S-10-060', 'S-01-001', 'S-20-120', 'NW-08-015', 'NE-08-015', 'E-06-025', 'E-06-075', 'ACC-02-020']) {
      expect(v.idOf(pickSeat(toward(HOME, seatAim(v.indexOf(id), v)), v))).toBe(id)
    }
  })

  it('returns nothing in an aisle, a cross aisle, on the track, into the sky, or past the last partial row', () => {
    expect(pickSeat(down(-20, -21.6), v)).toBe(-1) // aisle between blocks 1 and 2
    expect(pickSeat(down(-14.5, -27), v)).toBe(-1) // cross aisle after row 15
    expect(pickSeat(down(0, 40), v)).toBe(-1) // track
    expect(pickSeat(down(97, 0), v)).toBe(-1) // the procession entrance gap
    expect(pickSeat({ ox: 0, oy: 5, oz: 0, dx: 0, dy: 1, dz: 0 }, v)).toBe(-1)
    expect(pickSeat(down(rowX(34), blockZ(6, 7)), v)).toBe(-1)
  })

  it('does not pick through the VIP canopy, a stand rear wall or the stage backdrop', () => {
    const vip = v.indexOf('VIP-03-025')
    expect(pickHit(down(v.position[vip * 3], v.position[vip * 3 + 2]), v, []).index).toBe(vip) // geometry alone
    expect(pickSeat(down(v.position[vip * 3], v.position[vip * 3 + 2]), v)).toBe(-1) // the canopy is in the way

    const behindSouth = toward([0, 3, 110], seatAim(v.indexOf('S-10-060'), v)) // from behind and below the south stand
    expect(pickSeat(behindSouth, v)).toBe(-1)
    expect(pickSeat(behindSouth, v, [])).toBeGreaterThanOrEqual(0) // it is the wall that stops it, not a miss

    const behindStage = toward([-90, 4, -5], seatAim(v.indexOf('P3-01-07'), v)) // from behind the stage backdrop
    expect(pickSeat(behindStage, v)).toBe(-1)
    expect(v.idOf(pickSeat(behindStage, v, []))).toBe('P3-01-07')
  })

  it('reports no hit as index -1 at an infinite distance', () => {
    expect(pickHit(down(0, 40), v)).toEqual({ index: -1, t: Infinity })
    expect(pickHit(down(0, 40), v, [])).toEqual({ index: -1, t: Infinity })
    // Blocked by the canopy: the seat is there, but the answer is still "nothing".
    const vip = v.indexOf('VIP-03-025')
    expect(pickHit(down(v.position[vip * 3], v.position[vip * 3 + 2]), v)).toEqual({ index: -1, t: Infinity })
  })

  it('reports the distance to where the ray enters the chair box', () => {
    for (const id of ['P3-12-07', 'P5-A2', 'S-20-120', 'E-06-075', 'ACC-01-001']) {
      const i = v.indexOf(id)
      const hit = pickHit(down(v.position[i * 3], v.position[i * 3 + 2]), v, [])
      expect(hit.index).toBe(i)
      expect(hit.t).toBeCloseTo(50 - (v.position[i * 3 + 1] + CHAIR_BOX.height), 5)
    }
    // Level with the seat, from 10 m in front of it: the front face is half a depth nearer.
    const p = v.indexOf('P3-01-07')
    const [x, , z] = at(v, p)
    const level = pickHit(along([x - 10, 0.5, z], [1, 0, 0]), v, [])
    expect(level.index).toBe(p)
    expect(level.t).toBeCloseTo(10 - CHAIR_BOX.halfD, 5)
  })

  it('picks every seat in the venue from in front and above', () => {
    // 60 degrees up clears the chair in front, so each seat must be the first box its own aim ray enters.
    const up = Math.sin(rad(60))
    const out = Math.cos(rad(60))
    for (let i = 0; i < v.count; i++) {
      const a = seatAim(i, v)
      const f = seatFacing(i, v)
      const eye: Vec3 = [a[0] + 30 * out * f[0], a[1] + 30 * up, a[2] + 30 * out * f[2]]
      expect(pickHit(toward(eye, a), v, []).index).toBe(i)
    }
  })

  it('picks the chair the ray passes through, not the cell where it would land on the grass', () => {
    // 10 degrees above level, from the stage side. The ray clears row 11, enters the front of the
    // row-12 chair, and would only reach the grass 4.5 m further on, in the cross aisle.
    const i = v.indexOf('P3-12-07')
    const a = seatAim(i, v)
    const eye: Vec3 = [a[0] - 15 * Math.cos(rad(10)), a[1] + 15 * Math.sin(rad(10)), a[2]]
    const landsAt = a[0] + a[1] / Math.tan(rad(10))
    expect(landsAt).toBeGreaterThan(rowX(15) + CHAIR_BOX.halfD)
    expect(landsAt).toBeLessThan(rowX(16) - CHAIR_BOX.halfD)
    expect(pickSeat(down(landsAt, a[2]), v)).toBe(-1)
    expect(pickSeat(toward(eye, a), v)).toBe(i)
  })

  it('picks the nearer of two chairs in the ray\'s path, whichever way it travels', () => {
    const z = blockZ(1, 5)
    const first = v.indexOf('P1-01-05')
    const last = v.indexOf('P1-45-05')
    // Skimming a whole column of block 1 at knee height.
    expect(pickSeat(along([-31, 0.4, z], [1, 0, 0]), v, [])).toBe(first)
    expect(pickSeat(along([rowX(45) + 2, 0.4, z], [-1, 0, 0]), v, [])).toBe(last)
    expect(pickHit(along([rowX(45) + 2, 0.4, z], [-1, 0, 0]), v, []).t).toBeCloseTo(2 - CHAIR_BOX.halfD, 5)
    // Across the rows: from the north touchline the first chair met is seat 1 of block 1.
    expect(v.idOf(pickSeat(along([rowX(20), 0.4, -34], [0, 0, 1]), v, []))).toBe('P1-20-01')
    expect(v.idOf(pickSeat(along([rowX(20), 0.4, 34], [0, 0, -1]), v, []))).toBe('P6-20-14')
  })

  it('follows a level ray down a cross aisle, however far, to the one chair it clips', () => {
    // From the middle of the cross aisle after row 15, at chair height, aimed at the middle of the
    // aisle-side face of one chair. All the way there the ray is over the aisle, so that chair is
    // the first it enters, after up to 64 m of nothing. Every seat of rows 15 and 16 is tried from
    // both ends of the aisle.
    const aisleX = (rowX(15) + rowX(16)) / 2
    const blocks = VENUE.blocks.genders.length
    let longest = 0
    for (const startZ of [-33, 33]) {
      for (const row of [15, 16]) {
        const faceX = row === 15 ? rowX(15) + CHAIR_BOX.halfD : rowX(16) - CHAIR_BOX.halfD
        for (let b = 1; b <= blocks; b++) {
          for (let seat = 1; seat <= VENUE.blocks.seatsPerRow; seat++) {
            const id = `P${b}-${row}-${String(seat).padStart(2, '0')}`
            const from: Vec3 = [aisleX, 0.5, startZ]
            const to: Vec3 = [faceX, 0.5, blockZ(b, seat)]
            const hit = pickHit(toward(from, to), v)
            expect(v.idOf(hit.index), `toward ${id} from z = ${startZ}`).toBe(id)
            expect(hit.t).toBeCloseTo(Math.hypot(to[0] - from[0], to[2] - from[2]), 4)
            longest = Math.max(longest, hit.t)
          }
        }
      }
    }
    expect(longest).toBeGreaterThan(60)
  })

  it('misses chairs that a level ray passes over or under', () => {
    const z = blockZ(2, 1)
    // Through the chairs it meets the bay; a hair above their tops, or below the grass, nothing.
    expect(v.idOf(pickBays(along([-40, 0.94, z], [1, 0, 0]), v).index)).toBe('P2-A1')
    expect(pickBays(along([-40, 0.96, z], [1, 0, 0]), v).index).toBe(-1)
    expect(pickBays(along([-40, -0.01, z], [1, 0, 0]), v).index).toBe(-1)
    expect(v.idOf(pickPitch(along([-31, 0.94, z], [1, 0, 0]), v).index)).toBe('P2-01-01')
    expect(pickPitch(along([-31, 0.96, z], [1, 0, 0]), v).index).toBe(-1)
    expect(pickPitch(along([-31, -0.01, z], [1, 0, 0]), v).index).toBe(-1)
    // Along row 10 of the south stand, from beyond its east end.
    const s = v.indexOf('S-10-001')
    const [, sy, sz] = at(v, s)
    expect(pickStands(along([40, sy + 0.94, sz], [-1, 0, 0]), v).index).toBe(s)
    expect(pickStands(along([40, sy + 0.96, sz], [-1, 0, 0]), v).index).toBe(-1)
    expect(pickStands(along([40, sy - 0.01, sz], [-1, 0, 0]), v).index).toBe(-1)
  })

  it('ignores chairs behind the ray', () => {
    const z = blockZ(1, 5)
    // East of block 1's last row and heading further east: every chair is behind.
    expect(pickPitch(along([rowX(45) + 2, 0.4, z], [1, 0, 0]), v).index).toBe(-1)
    // Above the south stand, looking up.
    const s = v.indexOf('S-10-060')
    expect(pickSeat({ ox: at(v, s)[0], oy: at(v, s)[1] + 3, oz: at(v, s)[2], dx: 0, dy: 1, dz: 0 }, v, [])).toBe(-1)
    // Under the pitch, looking down.
    expect(pickSeat({ ox: -20, oy: -1, oz: -5.7, dx: 0, dy: -1, dz: 0 }, v, [])).toBe(-1)
  })

  it('finds a bay before the row behind it, and the row once past the bay', () => {
    const z = blockZ(2, 1)
    expect(v.idOf(pickSeat(along([-40, 0.5, z], [1, 0, 0]), v))).toBe('P2-A1')
    expect(v.idOf(pickSeat(along([-31, 0.5, z], [1, 0, 0]), v))).toBe('P2-01-01')
    // Between a block's two bays there is only the front row.
    expect(v.idOf(pickSeat(along([-40, 0.5, blockZ(2, 7)], [1, 0, 0]), v))).toBe('P2-01-07')
  })

  it('still picks a seat when the wall is behind it', () => {
    // From over the pitch, the south stand's rear wall is beyond the seat.
    expect(v.idOf(pickSeat(toward([0, 30, 20], seatAim(v.indexOf('S-10-060'), v)), v))).toBe('S-10-060')
    // A custom occluder: in front of the seat it blocks, behind the seat it does not.
    const i = v.indexOf('P3-12-07')
    const ray = down(v.position[i * 3], v.position[i * 3 + 2])
    const roof: Occluder = { kind: 'box', min: [-25, 5, -10], max: [-15, 5.2, 0] }
    const cellar: Occluder = { kind: 'box', min: [-25, -2, -10], max: [-15, -1, 0] }
    expect(pickSeat(ray, v, [roof])).toBe(-1)
    expect(pickSeat(ray, v, [cellar])).toBe(i)
  })

  it('leaves the accessibility platform open at the back but not the south stand', () => {
    const acc = v.indexOf('ACC-04-025')
    const [ax, ay] = at(v, acc)
    expect(pickSeat(along([ax, ay + 0.6, 52], [0, 0, -1]), v)).toBe(acc)
    const s = v.indexOf('S-20-060')
    const [sx, sy] = at(v, s)
    const fromBehind = along([sx, sy + 0.6, 75], [0, 0, -1])
    expect(pickSeat(fromBehind, v, [])).toBe(s)
    expect(pickSeat(fromBehind, v)).toBe(-1)
  })

  it('hides the lower part of an end seat behind the stand\'s sloping end wall', () => {
    const s = v.indexOf('S-20-001')
    const [, sy, sz] = at(v, s)
    // From the east, level with the seat: low down the wall is in the way, the top of the chair shows over it.
    expect(pickSeat(along([45, sy + 0.4, sz], [-1, 0, 0]), v, [])).toBe(s)
    expect(pickSeat(along([45, sy + 0.4, sz], [-1, 0, 0]), v)).toBe(-1)
    expect(pickSeat(along([45, sy + 0.92, sz], [-1, 0, 0]), v)).toBe(s)
  })

  it('does not pick east-curve seats through the curved rear wall', () => {
    const e = v.indexOf('E-12-025')
    const a = seatAim(e, v)
    const b = seatBack(e, v)
    // From outside the stadium, level with the seat back.
    const outside: Vec3 = [a[0] + 20 * b[0], a[1], a[2] + 20 * b[2]]
    expect(pickSeat(toward(outside, a), v, [])).toBe(e)
    expect(pickSeat(toward(outside, a), v)).toBe(-1)
    // From high enough to see over the wall, which stands 0.2 m behind the seat back and 0.3 m above the aim point.
    const above: Vec3 = [a[0] + 20 * b[0], a[1] + 60, a[2] + 20 * b[2]]
    expect(pickSeat(toward(above, a), v)).toBe(e)
  })

  describe('the three partial pickers', () => {
    const over = (id: string) => down(v.position[v.indexOf(id) * 3], v.position[v.indexOf(id) * 3 + 2])

    it('each answer only for their own seats', () => {
      expect(pickPitch(over('P3-12-07'), v).index).toBe(v.indexOf('P3-12-07'))
      expect(pickStands(over('P3-12-07'), v).index).toBe(-1)
      expect(pickBays(over('P3-12-07'), v).index).toBe(-1)

      expect(pickBays(over('P2-A1'), v).index).toBe(v.indexOf('P2-A1'))
      expect(pickPitch(over('P2-A1'), v).index).toBe(-1)
      expect(pickStands(over('P2-A1'), v).index).toBe(-1)

      for (const id of ['S-10-060', 'E-06-075', 'NW-08-015', 'ACC-02-020']) {
        expect(pickStands(over(id), v).index).toBe(v.indexOf(id))
        expect(pickPitch(over(id), v).index).toBe(-1)
        expect(pickBays(over(id), v).index).toBe(-1)
      }
    })

    it('report a miss as index -1 at an infinite distance', () => {
      for (const pick of [pickPitch, pickStands, pickBays]) expect(pick(down(0, 40), v)).toEqual({ index: -1, t: Infinity })
    })

    it('take no notice of occluders', () => {
      const vip = v.indexOf('VIP-03-025')
      expect(pickStands(over('VIP-03-025'), v)).toEqual(pickHit(over('VIP-03-025'), v, []))
      expect(pickStands(over('VIP-03-025'), v).index).toBe(vip)
    })

    it('agree with the whole pick on the nearest of the three', () => {
      const z = blockZ(2, 1)
      const ray = along([-40, 0.5, z], [1, 0, 0])
      const bay = pickBays(ray, v)
      const pitch = pickPitch(ray, v)
      expect(v.idOf(bay.index)).toBe('P2-A1')
      expect(v.idOf(pitch.index)).toBe('P2-01-01')
      expect(bay.t).toBeLessThan(pitch.t)
      expect(pickHit(ray, v, [])).toEqual(bay)
    })
  })

  describe('on a venue built from another config', () => {
    const { cfg, layout: w } = reshaped()

    it('picks by that layout\'s own grid, not the default one', () => {
      expect(w.pitchRows).toBe(46)
      expect(w.idOf(pickSeat(down(rowX(3, cfg), blockZ(4, 9, cfg)), w, []))).toBe('P4-03-09')
      expect(w.idOf(pickSeat(down(rowX(46, cfg), blockZ(1, 2, cfg)), w, []))).toBe('P1-46-02')
      // Half a row further on there is only the gap between two rows.
      expect(pickSeat(down(rowX(1, cfg) + cfg.blocks.rowPitch / 2, blockZ(4, 9, cfg)), w, [])).toBe(-1)
      // Its cross aisle comes after row 10, and its aisles are wider.
      expect(pickSeat(down((rowX(10, cfg) + rowX(11, cfg)) / 2, blockZ(4, 9, cfg)), w, [])).toBe(-1)
      expect(pickSeat(down(rowX(3, cfg), (blockZ(1, 14, cfg) + blockZ(2, 1, cfg)) / 2), w, [])).toBe(-1)
    })

    it('picks every seat straight down', () => {
      expect(w.count).toBe(7998 + 5 + 3 * 800 - 1200)
      for (let i = 0; i < w.count; i++) expect(pickHit(down(w.position[i * 3], w.position[i * 3 + 2]), w, []).index).toBe(i)
    })

    it('picks the seats either side of the seam where a ring of seats closes on itself', () => {
      // Seat 1 and seat 800 of the ring are neighbours, due south of the centre.
      const first = w.indexOf('E-02-001')
      const last = w.indexOf('E-02-800')
      expect(Math.hypot(at(w, first)[0] - at(w, last)[0], at(w, first)[2] - at(w, last)[2])).toBeLessThan(0.75)
      expect(at(w, first)[2]).toBeGreaterThan(90)
      // The ring is numbered against the angle, so seat 1 is just east of due south and seat 800 just west.
      expect(at(w, first)[0]).toBeGreaterThan(at(w, last)[0])
      // From the gap between the two, level with the chairs: one way meets seat 1, the other seat 800.
      const seam: Vec3 = [(at(w, first)[0] + at(w, last)[0]) / 2, at(w, first)[1] + 0.5, at(w, first)[2]]
      expect(w.idOf(pickSeat(along(seam, [1, 0, 0]), w, []))).toBe('E-02-001')
      expect(w.idOf(pickSeat(along(seam, [-1, 0, 0]), w, []))).toBe('E-02-800')
      // From three seats away the ray meets the chairs in order, on both sides of the seam.
      expect(w.idOf(pickSeat(along([at(w, w.indexOf('E-02-798'))[0] - 0.36, seam[1], seam[2]], [1, 0, 0]), w, []))).toBe('E-02-798')
      expect(w.idOf(pickSeat(along([at(w, w.indexOf('E-02-003'))[0] + 0.36, seam[1], seam[2]], [-1, 0, 0]), w, []))).toBe('E-02-003')
    })

    it('uses that venue\'s own occluders when they are passed', () => {
      const own = buildOccluders(cfg)
      const seat = w.indexOf('E-03-200')
      const a = seatAim(seat, w)
      const b = seatBack(seat, w)
      const outside: Vec3 = [a[0] + 20 * b[0], a[1], a[2] + 20 * b[2]]
      expect(pickSeat(toward(outside, a), w, [])).toBe(seat)
      // The ring's rear wall goes all the way round, so it is in the way; the default venue's east wall is not.
      expect(pickSeat(toward(outside, a), w, own)).toBe(-1)
      expect(pickSeat(toward(outside, a), w)).toBe(seat)
    })

    it('still picks stand seats and bays when the pitch has no graduates at all', () => {
      const empty = structuredClone(VENUE)
      for (const z of empty.zones) z.count = 0
      const e = buildVenue(empty)
      expect(e.ranges.pitch).toEqual([0, 0])
      expect(pickPitch(down(rowX(1), blockZ(3, 7)), e)).toEqual({ index: -1, t: Infinity })
      expect(e.idOf(pickSeat(down(rowX(1) - VENUE.bays.setback, blockZ(3, 1)), e, []))).toBe('P3-A1')
      const s = e.indexOf('S-10-060')
      expect(pickSeat(down(e.position[s * 3], e.position[s * 3 + 2]), e, [])).toBe(s)
    })
  })
})

/**
 * The oracle: test the ray against all the chair boxes, one by one, straight from the definition.
 * A seat's pick box is CHAIR_BOX standing on the seat's position and turned to face the way its
 * yaw says. This shares nothing with the picking code.
 */
function bruteForce(ray: Ray, w: VenueLayout): { index: number; t: number } {
  let index = -1
  let best = Infinity
  for (let i = 0; i < w.count; i++) {
    // The seat's own axes in the world: the way it faces, and its side-to-side direction.
    const faceX = -Math.sin(w.yaw[i])
    const faceZ = -Math.cos(w.yaw[i])
    const sideX = -faceZ
    const sideZ = faceX
    const relX = ray.ox - w.position[i * 3]
    const relY = ray.oy - w.position[i * 3 + 1]
    const relZ = ray.oz - w.position[i * 3 + 2]

    // The ray is inside the box while it is inside all three pairs of faces at once.
    let enter = 0
    let leave = Infinity
    let inside = true
    const between = (o: number, d: number, lo: number, hi: number) => {
      if (d === 0) {
        if (o < lo || o > hi) inside = false
        return
      }
      const a = (lo - o) / d
      const b = (hi - o) / d
      enter = Math.max(enter, Math.min(a, b))
      leave = Math.min(leave, Math.max(a, b))
    }
    between(relX * sideX + relZ * sideZ, ray.dx * sideX + ray.dz * sideZ, -CHAIR_BOX.halfW, CHAIR_BOX.halfW)
    between(relY, ray.dy, 0, CHAIR_BOX.height)
    between(relX * faceX + relZ * faceZ, ray.dx * faceX + ray.dz * faceZ, -CHAIR_BOX.halfD, CHAIR_BOX.halfD)
    if (inside && enter <= leave && enter < best) {
      best = enter
      index = i
    }
  }
  return { index, t: best }
}

/** A small repeatable random number generator, so a failure can be reproduced exactly. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('picking against a brute-force test of every chair box', () => {
  /**
   * Compares the two on each ray and returns how many rays hit a seat. Each test also checks that
   * number, so that it cannot pass on rays that mostly miss.
   */
  function agree(rays: Ray[], w: VenueLayout): number {
    let hits = 0
    rays.forEach((ray, k) => {
      const want = bruteForce(ray, w)
      const got = pickHit(ray, w, [])
      const label = `ray ${k} ${JSON.stringify(ray)}: brute force ${w.idOf(want.index) || 'nothing'} at ${want.t}, picked ${w.idOf(got.index) || 'nothing'} at ${got.t}`
      if (want.index < 0 && got.index < 0) {
        expect(got.t, label).toBe(Infinity)
      } else {
        // The same seat at the same distance. A different seat is only acceptable when the two boxes
        // are entered at the same instant, to within a micrometre.
        expect(Math.abs(got.t - want.t), label).toBeLessThanOrEqual(1e-6)
      }
      if (want.index >= 0) hits++
    })
    return hits
  }

  /** From anywhere the overview camera can be, toward a seat's surroundings or any point of the bowl. */
  function orbitRays(w: VenueLayout, n: number, rnd: () => number): Ray[] {
    const span = (a: number, b: number) => a + (b - a) * rnd()
    const target = VENUE.camera.home.target
    const rays: Ray[] = []
    for (let k = 0; k < n; k++) {
      const radius = span(60, 220)
      const polar = rad(span(18, 80))
      const theta = span(0, 2 * Math.PI)
      const eye: Vec3 = [target[0] + radius * Math.sin(polar) * Math.sin(theta), target[1] + radius * Math.cos(polar), target[2] + radius * Math.sin(polar) * Math.cos(theta)]
      let aim: Vec3
      if (k % 2 === 0) {
        const p = at(w, Math.floor(rnd() * w.count))
        aim = [p[0] + span(-1.2, 1.2), p[1] + span(0, 1), p[2] + span(-1.2, 1.2)]
      } else {
        aim = [span(-60, 105), span(0, 9), span(-72, 72)]
      }
      rays.push(toward(eye, aim))
    }
    return rays
  }

  /** From a seated graduate's or guest's eyes, anywhere the first-person view can turn. */
  function firstPersonRays(w: VenueLayout, n: number, rnd: () => number): Ray[] {
    const span = (a: number, b: number) => a + (b - a) * rnd()
    const rays: Ray[] = []
    for (let k = 0; k < n; k++) {
      const p = at(w, Math.floor(rnd() * w.count))
      const yaw = span(0, 2 * Math.PI)
      const pitch = rad(span(-35, 50))
      rays.push(along([p[0], p[1] + 1.15, p[2]], [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]))
    }
    return rays
  }

  /** Level or nearly level rays through the pitch chairs: the longest walks through the grid. */
  function skimmingRays(n: number, rnd: () => number): Ray[] {
    const span = (a: number, b: number) => a + (b - a) * rnd()
    const rays: Ray[] = []
    for (let k = 0; k < n; k++) {
      const height = [0.2, 0.5, 0.94][k % 3]
      // Half start outside the blocks, half among the chairs.
      const bearing = span(0, 2 * Math.PI)
      const from: Vec3 = k % 2 === 0 ? [-6 + 60 * Math.cos(bearing), height, 60 * Math.sin(bearing)] : [span(-32, 19), height, span(-32, 32)]
      const to: Vec3 = [span(-32, 19), k % 4 < 2 ? height : height + span(-0.3, 0.3), span(-32, 32)]
      rays.push(toward(from, to))
    }
    return rays
  }

  /** Rays running along a stand row inside the height of its chairs, where one ray passes many seats. */
  function rowRays(w: VenueLayout, n: number, rnd: () => number): Ray[] {
    const span = (a: number, b: number) => a + (b - a) * rnd()
    const rays: Ray[] = []
    for (let k = 0; k < n; k++) {
      const row = w.standRows[Math.floor(rnd() * w.standRows.length)]
      const y = row.y + [0.2, 0.5, 0.94][k % 3]
      if (row.kind === 'line') {
        const a: Vec3 = [row.x0 - Math.sign(row.dx) * span(0.5, 6), y, row.z + span(-0.35, 0.35)]
        const b: Vec3 = [row.x0 + row.dx * row.count + Math.sign(row.dx) * span(0, 6), y + span(-0.25, 0.25), row.z + span(-0.35, 0.35)]
        rays.push(rnd() < 0.5 ? toward(a, b) : toward(b, a))
      } else {
        const s = row.spans[Math.floor(rnd() * row.spans.length)]
        const angle = s.from + s.step * s.count * span(-0.05, 1.05)
        const radius = row.radius + span(-0.3, 0.3)
        const p: Vec3 = [row.cx + radius * Math.cos(angle), y, row.cz + radius * Math.sin(angle)]
        // Along the tangent, give or take a few degrees, starting 8 m before the point.
        const heading = angle + (rnd() < 0.5 ? 1 : -1) * Math.PI / 2 + span(-0.1, 0.1)
        const d: Vec3 = [Math.cos(heading), span(-0.03, 0.03), Math.sin(heading)]
        rays.push(along([p[0] - 8 * d[0], p[1] - 8 * d[1], p[2] - 8 * d[2]], d))
      }
    }
    return rays
  }

  /** Exactly vertical rays, down from above and up from under the ground. */
  function plumbRays(w: VenueLayout, n: number, rnd: () => number): Ray[] {
    const span = (a: number, b: number) => a + (b - a) * rnd()
    const rays: Ray[] = []
    for (let k = 0; k < n; k++) {
      const p = at(w, Math.floor(rnd() * w.count))
      const x = k % 3 === 0 ? span(-60, 105) : p[0] + span(-0.4, 0.4)
      const z = k % 3 === 0 ? span(-72, 72) : p[2] + span(-0.4, 0.4)
      rays.push(k % 2 === 0 ? { ox: x, oy: 60, oz: z, dx: 0, dy: -1, dz: 0 } : { ox: x, oy: -5, oz: z, dx: 0, dy: 1, dz: 0 })
    }
    return rays
  }

  it('agrees on 250 rays from overview camera positions', () => {
    expect(agree(orbitRays(v, 250, seeded(56)), v)).toBeGreaterThan(100)
  })

  it('agrees on 100 first-person rays from seat eye points', () => {
    expect(agree(firstPersonRays(v, 100, seeded(57)), v)).toBeGreaterThan(30)
  })

  it('agrees on 50 near-level rays at heights 0.2, 0.5 and 0.94', () => {
    expect(agree(skimmingRays(50, seeded(58)), v)).toBeGreaterThan(40)
  })

  it('agrees on 150 rays running along stand rows', () => {
    expect(agree(rowRays(v, 150, seeded(59)), v)).toBeGreaterThan(110)
  })

  it('agrees on 150 exactly vertical rays', () => {
    expect(agree(plumbRays(v, 150, seeded(60)), v)).toBeGreaterThan(40)
  })

  it('agrees on a venue built from another config', () => {
    const w = reshaped().layout
    const rnd = seeded(61)
    const rays = [...orbitRays(w, 120, rnd), ...firstPersonRays(w, 40, rnd), ...skimmingRays(40, rnd), ...rowRays(w, 30, rnd), ...plumbRays(w, 30, rnd)]
    expect(agree(rays, w)).toBeGreaterThan(120)
  })

  it('agrees on rays along a ring of seats, across the seam where it closes', () => {
    const w = reshaped().layout
    const rnd = seeded(62)
    const span = (a: number, b: number) => a + (b - a) * rnd()
    const ring = w.standRows.filter((r) => r.kind === 'arc')
    expect(ring).toHaveLength(3)
    const rays: Ray[] = []
    for (let k = 0; k < 120; k++) {
      const row = ring[k % ring.length]
      // The seam is due south, at 90 degrees. Each ray touches the ring within a few degrees of it
      // and runs nearly along the row, so many of them pass from the last seats to the first.
      const angle = rad(90 + span(-5, 5))
      const radius = row.radius + span(-0.3, 0.3)
      const heading = angle + (k % 2 === 0 ? 1 : -1) * (Math.PI / 2) + span(-0.06, 0.06)
      const d: Vec3 = [Math.cos(heading), span(-0.02, 0.02), Math.sin(heading)]
      const p: Vec3 = [row.cx + radius * Math.cos(angle), row.y + [0.2, 0.5, 0.94][k % 3], row.cz + radius * Math.sin(angle)]
      rays.push(along([p[0] - 6 * d[0], p[1] - 6 * d[1], p[2] - 6 * d[2]], d))
    }
    expect(agree(rays, w)).toBeGreaterThan(95)
  })

  it('keeps the oracle honest: it finds the seat under a ray straight down, and nothing in an aisle', () => {
    for (let i = 0; i < v.count; i += 97) expect(bruteForce(down(v.position[i * 3], v.position[i * 3 + 2]), v).index).toBe(i)
    expect(bruteForce(down(-20, -21.6), v)).toEqual({ index: -1, t: Infinity })
    // A seat that is turned: the corner of an east-curve chair's box is inside it, the same point of an unturned box is not.
    const e = v.indexOf('E-01-001')
    expect(v.kind[e]).toBe(SeatKind.Stand)
    const f = seatFacing(e, v)
    const corner: Vec3 = [at(v, e)[0] + 0.24 * f[0] - 0.24 * f[2], 50, at(v, e)[2] + 0.24 * f[2] + 0.24 * f[0]]
    expect(Math.max(Math.abs(corner[0] - at(v, e)[0]), Math.abs(corner[2] - at(v, e)[2]))).toBeGreaterThan(0.25)
    expect(bruteForce(down(corner[0], corner[2]), v).index).toBe(e)
  })
})
