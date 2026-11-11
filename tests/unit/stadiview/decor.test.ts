import { describe, expect, it } from 'vitest'
import { VENUE } from '@/features/stadiview/config/venue'
import type { Vec3 } from '@/features/stadiview/config/venue'
import { orbitFromPosition, orbitPosition, ORBIT_HOME } from '@/features/stadiview/engine/cameraMath'
import { archSolids, bowlPieces, bowlRadii, bowlSolids } from '@/features/stadiview/engine/decor'
import { buildMarchPath } from '@/features/stadiview/engine/marchPath'
import { getOccluders, occluderDistance } from '@/features/stadiview/engine/occluders'
import type { Occluder } from '@/features/stadiview/engine/occluders'
import { seatAim } from '@/features/stadiview/engine/seatFrame'
import { SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

const v = getVenue()
const pieces = bowlPieces()
const R = bowlRadii()
const deg = (r: number) => (r * 180) / Math.PI

/** Whether a ground point is inside a piece of the bowl, with a margin. */
function inBowl(x: number, z: number, margin = 0): boolean {
  return pieces.some((p) => {
    const r = Math.hypot(x - p.cx, z - p.cz)
    if (r < R.inner - margin || r > R.outer + margin) return false
    let a = deg(Math.atan2(z - p.cz, x - p.cx))
    // Bring the angle into the piece's own turn.
    while (a < p.fromDeg - 180) a += 360
    while (a > p.fromDeg + 180) a -= 360
    const slack = deg(margin / r)
    return a >= p.fromDeg - slack && a <= p.toDeg + slack
  })
}

describe('the bowl', () => {
  it('has the sections asked for, with gaps cut out', () => {
    expect(new Set(pieces.map((p) => p.id))).toEqual(new Set(['W', 'NW', 'SW', 'NE', 'SE']))
    // Gate 5's gap splits the north-east corner; Gate 2's and the exit's split the south-east.
    expect(pieces.filter((p) => p.id === 'NE')).toHaveLength(2)
    expect(pieces.filter((p) => p.id === 'SE')).toHaveLength(2)
  })

  it('touches no seat of any stand', () => {
    for (let i = v.ranges.stands[0]; i < v.ranges.stands[1]; i++) expect(inBowl(v.position[i * 3], v.position[i * 3 + 2], 1), v.idOf(i)).toBe(false)
  })

  it('stays clear of the stands, the masts and the gates', () => {
    for (const m of VENUE.floodlights.masts) expect(inBowl(m[0], m[2], 2)).toBe(false)
    for (const g of VENUE.gates) expect(inBowl(g.position[0], g.position[2], 5), `gate ${g.id}`).toBe(false)
    // The straight stands' footprints, rear walls included.
    for (const s of VENUE.stands) {
      if (s.kind !== 'line') continue
      const back = s.side === 'south' ? 1 : -1
      const z0 = s.firstRowZ - back
      const z1 = s.firstRowZ + back * (s.rows * s.tread + 1)
      for (let x = s.xMin; x <= s.xMax; x += 1) for (const z of [z0, z1]) expect(inBowl(x, z, 1), s.id).toBe(false)
    }
    // The east curve: the corners begin a degree past its ends.
    for (const p of pieces) if (p.cx > 0) expect(Math.min(Math.abs(p.fromDeg), Math.abs(p.toDeg))).toBeGreaterThanOrEqual(35)
  })

  it('leaves the procession exit and the east tunnel open', () => {
    const path = buildMarchPath()
    const exit = path.legs[4]
    for (let s = exit.from; s <= exit.to; s += 0.5) {
      const p = path.at(s).point
      expect(inBowl(p[0], p[2], VENUE.march.width / 2)).toBe(false)
    }
    for (let x = VENUE.track.straightHalf + 46; x <= VENUE.procession.entrance[0]; x += 1) expect(inBowl(x, 0, 3)).toBe(false)
  })

  it('leaves openings at least 6 m wide', () => {
    for (const s of VENUE.bowl.sections) {
      for (const g of s.gaps) expect(((2 * g.halfWidthDeg * Math.PI) / 180) * R.inner).toBeGreaterThanOrEqual(6)
    }
  })
})

describe('nothing new hides a seat', () => {
  const occ = getOccluders()
  const home = orbitFromPosition(ORBIT_HOME.position, ORBIT_HOME.target)
  // The opening camera, and every 15 degrees of the idle turn.
  const cameras: Vec3[] = []
  for (let k = 0; k < 24; k++) cameras.push(orbitPosition({ ...home, theta: home.theta + (k * Math.PI) / 12 }, ORBIT_HOME.target))

  const ray = (eye: Vec3, to: Vec3) => {
    const dx = to[0] - eye[0]
    const dy = to[1] - eye[1]
    const dz = to[2] - eye[2]
    const reach = Math.hypot(dx, dy, dz)
    return { reach, ray: { ox: eye[0], oy: eye[1], oz: eye[2], dx: dx / reach, dy: dy / reach, dz: dz / reach } }
  }

  /**
   * How much of a seat's chair back the solids cover from an eye, from 0 to 1: the share of a
   * grid of points spread over the back (0.4 m across, 0.54 m down) that they hide. Seats the
   * stadium itself already hides count as 0: they are not the new pieces' business.
   */
  function covered(solids: Occluder[], eye: Vec3, i: number, n: number): number {
    const aim = seatAim(i, v)
    const centre = ray(eye, aim)
    if (occluderDistance(centre.ray, occ) < centre.reach - 0.05) return 0
    const sx = Math.cos(v.yaw[i])
    const sz = -Math.sin(v.yaw[i])
    let hit = 0
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        const across = -0.2 + (0.4 * a) / (n - 1)
        const r = ray(eye, [aim[0] + sx * across, aim[1] + 0.12 - (0.54 * b) / (n - 1), aim[2] + sz * across])
        if (occluderDistance(r.ray, solids) < r.reach - 0.05) hit++
      }
    }
    return hit / (n * n)
  }

  it('the bowl covers no part of any seat, from the opening view and all round the idle turn', () => {
    const solids = bowlSolids()
    const touched: string[] = []
    for (const eye of cameras) for (let i = 0; i < v.count; i++) if (covered(solids, eye, i, 2) > 0) touched.push(v.idOf(i))
    expect(touched.slice(0, 20)).toEqual([])
  })

  it('the arch, if it were solid, would cover most of only a few chairs (it is drawn see-through outside first person)', () => {
    const solids = archSolids()
    let mostly = 0
    let worst = 0
    for (const eye of cameras) {
      // Only Block 1 lies near enough behind the arch to be covered.
      for (let i = 0; i < v.ranges.pitch[1]; i++) {
        if (covered(solids, eye, i, 3) <= 0.5) continue
        const share = covered(solids, eye, i, 7)
        worst = Math.max(worst, share)
        if (share > 0.75) mostly++
      }
    }
    console.info(`arch: ${mostly} seat views more than 75% covered over 24 camera angles; worst ${Math.round(worst * 100)}%`)
    expect(mostly).toBeLessThan(24)
  })

  it('measures cover truthfully: a wall in front of the camera covers a seat entirely', () => {
    const eye = ORBIT_HOME.position
    const wall: Occluder[] = [{ kind: 'box', min: [eye[0] - 5, eye[1] - 5, eye[2] + 2], max: [eye[0] + 5, eye[1] + 5, eye[2] + 3] }]
    expect(covered(wall, eye, v.indexOf('P3-12-07'), 3)).toBe(1)
    expect(v.kind[0]).toBe(SeatKind.Pitch)
  })
})
