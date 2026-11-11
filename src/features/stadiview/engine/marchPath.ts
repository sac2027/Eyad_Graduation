import { VENUE } from '@/features/stadiview/config/venue'
import type { VenueConfig } from '@/features/stadiview/config/venue'
import type { Vec3 } from '@/features/stadiview/engine/seatFrame'

/**
 * The march carpet (مسار المسيرة) as numbers: its centre line, its edges and its lights.
 *
 * Everything is on the ground (y = 0) and ordered in the direction the graduates walk, so a
 * distance along the path is also how far into the march a point is.
 */

export type LegName = 'east' | 'north' | 'west' | 'south' | 'exit'

export interface MarchPath {
  /** The centre line, a point every half metre or less, in march order. */
  points: Vec3[]
  /** Distance along the path to each point. */
  along: number[]
  length: number
  /** Where each leg starts and ends, as distances along the path. A corner belongs to the leg it turns into. */
  legs: { name: LegName; from: number; to: number }[]
  /** The point at a distance along the path, and the unit direction of travel there. */
  at(s: number): { point: Vec3; dir: Vec3 }
}

const STEP = 0.5

type P2 = [number, number]

/** Points from a to b, at most STEP apart, without a. */
function straight(a: P2, b: P2): P2[] {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / STEP))
  const out: P2[] = []
  for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  return out
}

/** A quarter turn round `centre` from angle a0 to a1 (radians, in the x-z plane), without its first point. */
function turn(centre: P2, r: number, a0: number, a1: number): P2[] {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / STEP))
  const out: P2[] = []
  for (let k = 1; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n
    out.push([centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a)])
  }
  return out
}

/** A quadratic curve from a through control c to b, without a. */
function curve(a: P2, c: P2, b: P2): P2[] {
  const rough = Math.hypot(c[0] - a[0], c[1] - a[1]) + Math.hypot(b[0] - c[0], b[1] - c[1])
  const n = Math.max(2, Math.ceil(rough / STEP))
  const out: P2[] = []
  for (let k = 1; k <= n; k++) {
    const t = k / n
    const u = 1 - t
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]])
  }
  return out
}

export function buildMarchPath(cfg: VenueConfig = VENUE): MarchPath {
  const m = cfg.march
  const r = m.corner
  const { north: N, south: S, west: W, east: E } = m
  const half = Math.PI / 2
  // The east leg begins where it meets the south leg's inner edge, so the two carpets join without overlapping.
  const first: P2 = [E, S - m.width / 2]
  const parts: { name: LegName; points: P2[] }[] = []
  // x-z angles: 0 is +x (east), pi/2 is +z (south).
  parts.push({ name: 'east', points: straight(first, [E, N + r]) })
  parts.push({ name: 'north', points: [...turn([E - r, N + r], r, 0, -half), ...straight([E - r, N], [W + r, N])] })
  parts.push({ name: 'west', points: [...turn([W + r, N + r], r, -half, -Math.PI), ...straight([W, N + r], [W, S - r])] })
  const southEnd: P2 = [m.exitVia[0] - 14, S]
  parts.push({ name: 'south', points: [...turn([W + r, S - r], r, Math.PI, half), ...straight([W + r, S], southEnd)] })
  parts.push({ name: 'exit', points: curve(southEnd, [m.exitVia[0], m.exitVia[2]], [m.exit[0], m.exit[2]]) })

  const points: Vec3[] = [[first[0], 0, first[1]]]
  const along = [0]
  const legs: MarchPath['legs'] = []
  for (const part of parts) {
    const from = along[along.length - 1]
    for (const p of part.points) {
      const last = points[points.length - 1]
      along.push(along[along.length - 1] + Math.hypot(p[0] - last[0], p[1] - last[2]))
      points.push([p[0], 0, p[1]])
    }
    legs.push({ name: part.name, from, to: along[along.length - 1] })
  }
  const length = along[along.length - 1]

  const at = (s: number) => {
    const d = Math.min(Math.max(s, 0), length)
    let lo = 0
    let hi = along.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (along[mid] <= d) lo = mid
      else hi = mid
    }
    const a = points[lo]
    const b = points[hi]
    const seg = along[hi] - along[lo] || 1
    const t = (d - along[lo]) / seg
    const dx = (b[0] - a[0]) / seg
    const dz = (b[2] - a[2]) / seg
    const n = Math.hypot(dx, dz) || 1
    return { point: [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t] as Vec3, dir: [dx / n, 0, dz / n] as Vec3 }
  }
  return { points, along, length, legs, at }
}

let shared: MarchPath | undefined

/** The default venue's march path, built once. */
export function getMarchPath(): MarchPath {
  shared ??= buildMarchPath(VENUE)
  return shared
}

/**
 * The left of the direction of travel, on the ground. The loop turns left at every corner
 * (counter-clockwise seen from above), so on the loop the left side is the inside.
 */
export function leftOf(dir: Vec3): Vec3 {
  return [dir[2], 0, -dir[0]]
}

/** The two edges of a ribbon of `width` along the path: `left` (the inside of the loop) and `right`. */
export function carpetEdges(path: MarchPath, width: number): { left: Vec3[]; right: Vec3[] } {
  const left: Vec3[] = []
  const right: Vec3[] = []
  for (let k = 0; k < path.points.length; k++) {
    const { dir } = path.at(path.along[k])
    const l = leftOf(dir)
    const p = path.points[k]
    left.push([p[0] + (l[0] * width) / 2, 0, p[2] + (l[2] * width) / 2])
    right.push([p[0] - (l[0] * width) / 2, 0, p[2] - (l[2] * width) / 2])
  }
  return { left, right }
}

/** The shortest distance on the ground from a point to the path's centre line. */
export function distanceToPath(path: MarchPath, x: number, z: number): number {
  let best = Infinity
  const pts = path.points
  for (let k = 1; k < pts.length; k++) {
    const ax = pts[k - 1][0]
    const az = pts[k - 1][2]
    const bx = pts[k][0] - ax
    const bz = pts[k][2] - az
    const len2 = bx * bx + bz * bz || 1
    const t = Math.min(1, Math.max(0, ((x - ax) * bx + (z - az) * bz) / len2))
    const d = Math.hypot(x - (ax + bx * t), z - (az + bz * t))
    if (d < best) best = d
  }
  return best
}

/** The arch's two posts, as ground rectangles [xMin, xMax, zMin, zMax]. */
export function archPosts(cfg: VenueConfig = VENUE): [number, number, number, number][] {
  const a = cfg.arch
  const z0 = cfg.march.north
  return [-1, 1].map((side) => {
    const zc = z0 + (side * a.span) / 2
    return [a.x - a.depth / 2, a.x + a.depth / 2, zc - a.postWidth / 2, zc + a.postWidth / 2] as [number, number, number, number]
  })
}

/**
 * The centre line of the arch's pointed band, across the carpet, as (z, y) points from one post's
 * top to the other's. Each half is a circle centred on the spring line beyond the middle, so the
 * two halves meet in a point at `height` (a drop arch).
 */
export function archCurve(cfg: VenueConfig = VENUE, steps = 10): [number, number][] {
  const a = cfg.arch
  const half = a.span / 2
  const rise = a.height - a.springY
  // half^2 + 2 * half * c = rise^2, where c is how far past the middle each centre lies.
  const c = (rise * rise - half * half) / (2 * half)
  const radius = half + c
  const z0 = cfg.march.north
  const out: [number, number][] = []
  for (let k = 0; k <= steps; k++) {
    // From the north post up to the apex, then the mirror image down to the south post.
    const t = k / steps
    const zLocal = -half + half * t
    const y = a.springY + Math.sqrt(Math.max(0, radius * radius - (zLocal - c) * (zLocal - c)))
    out.push([z0 + zLocal, y])
  }
  for (let k = steps - 1; k >= 0; k--) {
    const [z, y] = out[k]
    out.push([2 * z0 - z, y])
  }
  return out
}

/**
 * The marker lights along both edges of the carpet, `lightSpacing` apart along each edge. A light
 * that would stand on another part of the carpet (where the east leg meets the south leg, or the
 * exit leaves it) or against an arch post is left out.
 */
export function edgeLights(path: MarchPath, cfg: VenueConfig = VENUE): Vec3[] {
  const m = cfg.march
  const posts = archPosts(cfg)
  const out: Vec3[] = []
  for (const side of [1, -1]) {
    // The edge line, and how far along it each of its points is.
    const edge: Vec3[] = path.points.map((p, k) => {
      const l = leftOf(path.at(path.along[k]).dir)
      return [p[0] + side * l[0] * m.lightOffset, 0, p[2] + side * l[2] * m.lightOffset]
    })
    const along = [0]
    for (let k = 1; k < edge.length; k++) along.push(along[k - 1] + Math.hypot(edge[k][0] - edge[k - 1][0], edge[k][2] - edge[k - 1][2]))
    let k = 1
    for (let d = 0; d <= along[along.length - 1]; d += m.lightSpacing) {
      while (k < along.length - 1 && along[k] < d) k++
      const t = (d - along[k - 1]) / (along[k] - along[k - 1] || 1)
      const p: Vec3 = [edge[k - 1][0] + (edge[k][0] - edge[k - 1][0]) * t, 0, edge[k - 1][2] + (edge[k][2] - edge[k - 1][2]) * t]
      if (distanceToPath(path, p[0], p[2]) < m.width / 2 - 0.05) continue
      if (posts.some(([x0, x1, z0, z1]) => p[0] > x0 - 0.35 && p[0] < x1 + 0.35 && p[2] > z0 - 0.35 && p[2] < z1 + 0.35)) continue
      out.push(p)
    }
  }
  return out
}
