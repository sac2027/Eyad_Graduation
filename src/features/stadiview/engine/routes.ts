import { VENUE } from '@/features/stadiview/config/venue'
import type { GateId, VenueConfig, Vec3 } from '@/features/stadiview/config/venue'
import { SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

/**
 * Walking routes from a gate to a seat, as a line of points on the surfaces people walk on.
 *
 * - **Guests** follow the concourse ring outside the stands from their gate to behind their stand,
 *   climb to its back row, walk along it to the nearer end, go down the stair there to their row
 *   and along the row to their seat. Guests with disabilities come from Gate 3 straight onto the
 *   step-free platform.
 * - **Graduates** come in by their gate (2 for men, 5 for women), round the concourse to the east
 *   tunnel, onto the track and to the Procession Start, then up the east leg of the carpet in the
 *   march direction to the aisle beside their block, along it to their row, and along the row.
 */

export type Walker = 'guest' | 'graduate'
export type Leg = 'concourse' | 'portal' | 'stand' | 'tunnel' | 'march' | 'blockAisle' | 'row'

export interface Route {
  points: Vec3[]
  /** The leg each point belongs to (the first point's leg is the first leg). */
  legs: Leg[]
  length: number
  gate: GateId
}

/** No step of a route is longer than this, so a drawn route bends with the ground. */
const STEP = 5
/** Walking pace, metres per second, for the minutes in words. */
export const WALK_SPEED = 1.3

/**
 * The concourse: a ring outside every stand and the bowl, through the five gates, in order round
 * the stadium (south, then east, north and west). Corners keep clear of the stands and terraces.
 */
export function concourse(cfg: VenueConfig = VENUE): { points: [number, number][]; gates: Record<GateId, number> } {
  const g = (id: GateId) => {
    const p = cfg.gates.find((x) => x.id === id)!.position
    return [p[0], p[2]] as [number, number]
  }
  const points: [number, number][] = [g(1), [40, 80], g(2), [95, 58], [112, 20], [112, 0], [112, -20], [95, -58], g(5), [40, -80], g(4), [-40, -80], [-90, -60], [-110, -20], [-110, 20], [-90, 60], g(3)]
  const gates = {} as Record<GateId, number>
  for (const id of [1, 2, 3, 4, 5] as GateId[]) gates[id] = points.findIndex((p) => p[0] === g(id)[0] && p[1] === g(id)[1])
  return { points, gates }
}

/** The way round the ring from one corner to another, the shorter way. */
function roundRing(ring: [number, number][], from: number, to: number): [number, number][] {
  const n = ring.length
  const forward: [number, number][] = []
  for (let k = from; k !== to; k = (k + 1) % n) forward.push(ring[k])
  forward.push(ring[to])
  const backward: [number, number][] = []
  for (let k = from; k !== to; k = (k - 1 + n) % n) backward.push(ring[k])
  backward.push(ring[to])
  const len = (ps: [number, number][]) => ps.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - ps[i - 1][0], p[1] - ps[i - 1][1]) : 0), 0)
  return len(forward) <= len(backward) ? forward : backward
}

function nearestCorner(ring: [number, number][], x: number, z: number): number {
  let best = 0
  for (let k = 1; k < ring.length; k++) if (Math.hypot(ring[k][0] - x, ring[k][1] - z) < Math.hypot(ring[best][0] - x, ring[best][1] - z)) best = k
  return best
}

class Builder {
  points: Vec3[] = []
  legs: Leg[] = []
  to(p: Vec3, leg: Leg) {
    const last = this.points[this.points.length - 1]
    if (last) {
      const d = Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2])
      if (d < 1e-6) return
      const n = Math.ceil(d / STEP)
      for (let k = 1; k < n; k++) {
        this.points.push([last[0] + ((p[0] - last[0]) * k) / n, last[1] + ((p[1] - last[1]) * k) / n, last[2] + ((p[2] - last[2]) * k) / n])
        this.legs.push(leg)
      }
    }
    this.points.push(p)
    this.legs.push(leg)
  }
  done(gate: GateId): Route {
    let length = 0
    for (let k = 1; k < this.points.length; k++) {
      const a = this.points[k - 1]
      const b = this.points[k]
      length += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    }
    return { points: this.points, legs: this.legs, length, gate }
  }
}

/** The route to a seat for the person sitting in it. Pitch seats and bays are walked by graduates; stand seats by guests. */
export function routeTo(seat: number, cfg: VenueConfig = VENUE): Route {
  const v = getVenue()
  const sx = v.position[seat * 3]
  const sy = v.position[seat * 3 + 1]
  const sz = v.position[seat * 3 + 2]
  const ring = concourse(cfg)
  const b = new Builder()
  const section = v.sections[v.section[seat]]

  if (v.kind[seat] !== SeatKind.Stand) {
    // A graduate: their gate, round to the tunnel, onto the track, to the Procession Start.
    const gate = cfg.blocks.gate[cfg.blocks.genders[v.section[seat]]] as GateId
    const tunnelCorner = ring.points.findIndex((p) => p[0] === 112 && p[1] === 0)
    for (const p of roundRing(ring.points, ring.gates[gate], tunnelCorner)) b.to([p[0], 0, p[1]], 'concourse')
    const [ex, , ez] = cfg.procession.entrance
    b.to([ex, 0, ez], 'tunnel')
    b.to([60, 0, 0], 'tunnel')
    // Onto the start from the east, across the grass beside the carpet's south-east corner.
    b.to([cfg.march.start[0] + 8, 0, cfg.march.start[2]], 'tunnel')
    b.to([...cfg.march.start], 'march')
    // Up the east leg (north, as the march goes) to the aisle beside the block, then west along it.
    const block = v.section[seat]
    const aisleZ = aisleBeside(block, v.number[seat], v.kind[seat] === SeatKind.AccessBay ? (v.number[seat] === 1 ? 'north' : 'south') : null)
    b.to([cfg.march.east, 0, aisleZ], 'march')
    const front = sx - 0.55
    b.to([front, 0, aisleZ], 'blockAisle')
    b.to([front, 0, sz], 'row')
    b.to([sx, sy, sz], 'row')
    return b.done(gate)
  }

  const gate = section.gate
  const stand = cfg.stands.find((s) => s.id === section.id)!
  if (stand.kind === 'line' && stand.riser === 0) {
    // The step-free platform: from Gate 3 straight onto its west end, then along the row.
    const g = ring.points[ring.gates[gate]]
    b.to([g[0], 0, g[1]], 'concourse')
    b.to([stand.xMin - 7, 0, stand.firstRowZ + 1], 'portal')
    b.to([stand.xMin - 0.6, 0, sz], 'portal')
    b.to([sx, sy, sz], 'row')
    return b.done(gate)
  }

  const rows = stand.rows
  const lastY = stand.firstRowY + (rows - 1) * stand.riser
  if (stand.kind === 'line') {
    const back = stand.side === 'south' ? 1 : -1
    const backZ = stand.firstRowZ + back * ((rows - 1) * stand.tread + stand.tread / 2)
    // The nearer end of the seat's row.
    const end = sx - stand.xMin <= stand.xMax - sx ? stand.xMin + 0.3 : stand.xMax - 0.3
    const behind: [number, number] = [end, backZ + back * 3]
    for (const p of roundRing(ring.points, ring.gates[gate], nearestCorner(ring.points, behind[0], behind[1]))) b.to([p[0], 0, p[1]], 'concourse')
    b.to([behind[0], 0, behind[1]], 'portal')
    b.to([end, lastY, backZ], 'stand')
    b.to([end, sy, sz - (back * stand.tread) / 2], 'stand')
    b.to([sx, sy, sz - (back * stand.tread) / 2], 'row')
    b.to([sx, sy, sz], 'row')
    return b.done(gate)
  }

  // The curved stand: the nearer end of the seat's span, then down the stair at that end.
  const angle = Math.atan2(sz - stand.cz, sx - stand.cx)
  const span = stand.spans.find((s) => angle >= ((s.fromDeg - 1) * Math.PI) / 180 && angle <= ((s.toDeg + 1) * Math.PI) / 180) ?? stand.spans[0]
  const a0 = (span.fromDeg * Math.PI) / 180
  const a1 = (span.toDeg * Math.PI) / 180
  const endAngle = Math.abs(angle - a0) <= Math.abs(a1 - angle) ? a0 : a1
  const r = Math.hypot(sx - stand.cx, sz - stand.cz)
  const backR = stand.firstRowRadius + (rows - 1) * stand.tread + stand.tread / 2
  const at = (radius: number, a: number, y: number): Vec3 => [stand.cx + radius * Math.cos(a), y, stand.cz + radius * Math.sin(a)]
  const behind = at(backR + 3, endAngle, 0)
  for (const p of roundRing(ring.points, ring.gates[gate], nearestCorner(ring.points, behind[0], behind[2]))) b.to([p[0], 0, p[1]], 'concourse')
  b.to(behind, 'portal')
  b.to(at(backR, endAngle, lastY), 'stand')
  b.to(at(r - stand.tread / 2, endAngle, sy), 'stand')
  const steps = Math.max(1, Math.ceil(Math.abs(angle - endAngle) * r / 2))
  for (let k = 1; k <= steps; k++) b.to(at(r - stand.tread / 2, endAngle + ((angle - endAngle) * k) / steps, sy), 'row')
  b.to([sx, sy, sz], 'row')
  return b.done(gate)
}

/** The z of the aisle a graduate walks along to reach their row: beside their block, on the side of their seat. */
function aisleBeside(block: number, seatNumber: number, bay: 'north' | 'south' | null): number {
  const v = getVenue()
  const bounds = (k: number) => {
    let a = Infinity
    let c = -Infinity
    for (let i = 0; i < v.ranges.pitch[1]; i++) {
      if (v.section[i] !== k) continue
      a = Math.min(a, v.position[i * 3 + 2])
      c = Math.max(c, v.position[i * 3 + 2])
    }
    return [a, c]
  }
  const [zMin, zMax] = bounds(block)
  const blocks = VENUE.blocks.genders.length
  const northSide = bay ? bay === 'north' : seatNumber <= VENUE.blocks.seatsPerRow / 2
  // The outermost blocks have the carpet on their outer side: they use the aisle on their inner side.
  if ((northSide && block > 0) || block === blocks - 1) {
    const [, prevMax] = bounds(block - 1)
    return (prevMax + zMin) / 2
  }
  const [nextMin] = bounds(block + 1)
  return (zMax + nextMin) / 2
}

/** The minutes it takes to walk a route at an easy pace, at least one. */
export function walkMinutes(route: Route): number {
  return Math.max(1, Math.round(route.length / WALK_SPEED / 60))
}
