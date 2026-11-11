import { VENUE } from '@/features/stadiview/config/venue'
import type { VenueConfig } from '@/features/stadiview/config/venue'
import type { Ray } from '@/features/stadiview/engine/picking'
import type { Vec3 } from '@/features/stadiview/engine/seatFrame'

/**
 * A solid part of the stadium that hides seats: a seat behind one cannot be picked.
 *
 * The scene draws its walls from the same list, so what stops the pointer is what stops the eye.
 *
 * - `box`: a block square to the axes, from corner `min` to corner `max`.
 * - `side`: an upright wall in the plane x = `x`, running from z0 to z1. Its top edge climbs in a
 *   straight line from height y0 at z0 to y1 at z1, and it is solid from that edge down to the
 *   ground (y = 0). This is the end wall of a raked stand: z0 is the front of the stand, z1 the back.
 * - `arc`: an upright curved wall, part of a circle of `radius` about (cx, cz), between the angles
 *   `from` and `to` and the heights y0 and y1. Angles are radians from east (+X) toward south (+Z),
 *   as for a curved stand row.
 *
 * Side and arc walls are surfaces with no thickness of their own; the scene gives them the
 * config's wall thickness on the side away from the seats.
 */
export type Occluder =
  | { kind: 'box'; min: Vec3; max: Vec3 }
  | { kind: 'side'; x: number; z0: number; z1: number; y0: number; y1: number }
  | { kind: 'arc'; cx: number; cz: number; radius: number; from: number; to: number; y0: number; y1: number }

const radians = (degrees: number) => (degrees * Math.PI) / 180
const FULL_TURN = 2 * Math.PI

/**
 * Lists the solid structures of a venue, all worked out from its config.
 *
 * The order is: the stage backdrop, the canopy, then for each walled stand in the config's order
 * its rear wall followed by its two end walls, the west end (xMin) before the east end (xMax).
 * A curved stand has one curved rear wall per span and no end walls. The scene relies on this
 * order to tell which way is outward from an end wall.
 */
export function buildOccluders(cfg: VenueConfig = VENUE): Occluder[] {
  const list: Occluder[] = []

  // The backdrop carries its picture from the deck upward, but it is one wall from the ground.
  const b = cfg.stage.backdrop
  list.push({ kind: 'box', min: [b.x - b.thickness, 0, b.zMin], max: [b.x, b.yTop, b.zMax] })

  const c = cfg.canopy
  list.push({ kind: 'box', min: [c.xMin, c.yBottom, c.zMin], max: [c.xMax, c.yTop, c.zMax] })

  for (const s of cfg.stands) {
    if (!cfg.walls.stands.includes(s.id)) continue
    const lastRowFloor = s.firstRowY + (s.rows - 1) * s.riser
    // Under the canopy the rear wall carries on up to the slab, closing the back of the box.
    const top = s.id === c.over ? c.yBottom : lastRowFloor + cfg.walls.rise

    if (s.kind === 'line') {
      // +1 when the rows step back toward the south, -1 toward the north.
      const back = s.side === 'south' ? 1 : -1
      // A row's seats are in the middle of its tread, so the stand starts half a tread in front of
      // the first row and ends half a tread behind the last.
      const front = s.firstRowZ - back * (s.tread / 2)
      const rear = s.firstRowZ + back * ((s.rows - 1) * s.tread + s.tread / 2)
      const behind = rear + back * cfg.walls.thickness
      list.push({ kind: 'box', min: [s.xMin, 0, Math.min(rear, behind)], max: [s.xMax, top, Math.max(rear, behind)] })
      for (const x of [s.xMin, s.xMax]) list.push({ kind: 'side', x, z0: front, z1: rear, y0: s.firstRowY, y1: top })
    } else {
      const radius = s.firstRowRadius + (s.rows - 1) * s.tread + s.tread / 2
      for (const span of s.spans) {
        list.push({ kind: 'arc', cx: s.cx, cz: s.cz, radius, from: radians(span.fromDeg), to: radians(span.toDeg), y0: 0, y1: top })
      }
    }
  }
  return list
}

let defaultList: Occluder[] | undefined

/** The default venue's occluders, built once and shared by picking and the scene. */
export function getOccluders(): Occluder[] {
  defaultList ??= buildOccluders(VENUE)
  return defaultList
}

/** Distance along the ray to where it enters the box; 0 when it starts inside; Infinity when it misses. */
function boxDistance(ray: Ray, min: Vec3, max: Vec3): number {
  // The ray is inside the box while it is between all three pairs of faces at once: from the
  // latest entry to the earliest exit.
  let enter = 0
  let leave = Infinity
  for (let axis = 0; axis < 3; axis++) {
    const o = axis === 0 ? ray.ox : axis === 1 ? ray.oy : ray.oz
    const d = axis === 0 ? ray.dx : axis === 1 ? ray.dy : ray.dz
    if (d === 0) {
      // Running parallel to this pair of faces: either between them all the way or never.
      if (o < min[axis] || o > max[axis]) return Infinity
      continue
    }
    const a = (min[axis] - o) / d
    const b = (max[axis] - o) / d
    if (a < b) {
      if (a > enter) enter = a
      if (b < leave) leave = b
    } else {
      if (b > enter) enter = b
      if (a < leave) leave = a
    }
    if (enter > leave) return Infinity
  }
  return enter
}

function sideDistance(ray: Ray, s: Extract<Occluder, { kind: 'side' }>): number {
  // A ray running alongside the wall never crosses its plane.
  if (ray.dx === 0) return Infinity
  const t = (s.x - ray.ox) / ray.dx
  if (t < 0) return Infinity
  // How far along the wall the crossing is: 0 at the front of the stand, 1 at the back.
  const along = (ray.oz + ray.dz * t - s.z0) / (s.z1 - s.z0)
  if (!(along >= 0 && along <= 1)) return Infinity
  const y = ray.oy + ray.dy * t
  return y >= 0 && y <= s.y0 + (s.y1 - s.y0) * along ? t : Infinity
}

function arcDistance(ray: Ray, a: Extract<Occluder, { kind: 'arc' }>): number {
  // Seen from above, the wall is part of a circle and the ray a straight line. Where the two
  // meet is a quadratic in the distance along the ray.
  const px = ray.ox - a.cx
  const pz = ray.oz - a.cz
  const level = ray.dx * ray.dx + ray.dz * ray.dz
  // Straight up or down: the ray stays over one point and never crosses an upright wall.
  if (level === 0) return Infinity
  const half = px * ray.dx + pz * ray.dz
  const disc = half * half - level * (px * px + pz * pz - a.radius * a.radius)
  if (disc < 0) return Infinity
  const root = Math.sqrt(disc)
  // The nearer crossing first. From inside the circle it is behind the ray and only the far one counts.
  const first = (-half - root) / level
  if (first >= 0 && onArc(ray, a, first)) return first
  const second = (-half + root) / level
  if (second >= 0 && onArc(ray, a, second)) return second
  return Infinity
}

/** Whether the point of the ray at distance t, already known to be on the wall's circle, is on the wall itself. */
function onArc(ray: Ray, a: Extract<Occluder, { kind: 'arc' }>, t: number): boolean {
  const y = ray.oy + ray.dy * t
  if (y < a.y0 || y > a.y1) return false
  const angle = Math.atan2(ray.oz + ray.dz * t - a.cz, ray.ox + ray.dx * t - a.cx)
  // Measure the angle onward from the wall's lower end, as a part of one full turn, so a wall that
  // spans the jump from +180 to -180 degrees needs no special case.
  let turn = angle - Math.min(a.from, a.to)
  turn -= FULL_TURN * Math.floor(turn / FULL_TURN)
  return turn <= Math.abs(a.to - a.from)
}

/** The distance along the ray to the nearest occluder it hits; Infinity when it hits none. */
export function occluderDistance(ray: Ray, occ: Occluder[]): number {
  let nearest = Infinity
  for (let k = 0; k < occ.length; k++) {
    const o = occ[k]
    const t = o.kind === 'box' ? boxDistance(ray, o.min, o.max) : o.kind === 'side' ? sideDistance(ray, o) : arcDistance(ray, o)
    if (t < nearest) nearest = t
  }
  return nearest
}
