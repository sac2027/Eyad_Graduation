import { VENUE } from '@/features/stadiview/config/venue'
import type { VenueConfig } from '@/features/stadiview/config/venue'
import { orbitFromPosition, orbitPosition, overviewFov } from '@/features/stadiview/engine/cameraMath'
import { CHAIR_BOX } from '@/features/stadiview/engine/seatFrame'
import type { Vec3 } from '@/features/stadiview/engine/seatFrame'
import type { VenueLayout } from '@/features/stadiview/layout/types'

/**
 * Framing the overview: does the camera, from where it is, see everything that matters?
 *
 * On a wide screen the opening pose shows the six blocks and the stage with room to spare. On a
 * phone held upright the same pose would cut them off at the sides, so the camera backs away along
 * its own line of sight until they fit. This file works out how far, as plain arithmetic.
 */

/**
 * Parts of the picture to keep clear, as shares of half the screen: 0.1 at the side means the
 * outer 5% of the width on each side. The top is deeper because the title sits there.
 */
export interface ViewInset {
  side: number
  top: number
  bottom: number
}

export const OVERVIEW_INSET: ViewInset = { side: 0.06, top: 0.2, bottom: 0.1 }

/**
 * Whether a camera at `position`, looking at `target` with a vertical field of view of `fovDeg`
 * on a screen of the given aspect (width / height), has every one of `points` in view and inside
 * the inset.
 */
export function viewContains(position: Vec3, target: Vec3, fovDeg: number, aspect: number, points: Vec3[], inset: ViewInset = { side: 0, top: 0, bottom: 0 }): boolean {
  // The camera's own axes: forward to the target, right, and up.
  let fx = target[0] - position[0]
  let fy = target[1] - position[1]
  let fz = target[2] - position[2]
  const fl = Math.hypot(fx, fy, fz)
  if (fl === 0 || !(aspect > 0)) return false
  fx /= fl
  fy /= fl
  fz /= fl
  // right = forward x world-up, up = right x forward.
  let rx = -fz
  let rz = fx
  const rl = Math.hypot(rx, rz)
  if (rl === 0) return false // looking straight up or down: no way to say which side is which
  rx /= rl
  rz /= rl
  const ux = -rz * fy
  const uy = rz * fx - rx * fz
  const uz = rx * fy

  const tan = Math.tan((fovDeg * Math.PI) / 360)
  for (const p of points) {
    const dx = p[0] - position[0]
    const dy = p[1] - position[1]
    const dz = p[2] - position[2]
    const depth = dx * fx + dy * fy + dz * fz
    if (depth <= 0) return false // behind the camera
    const x = (dx * rx + dz * rz) / (depth * tan * aspect)
    const y = (dx * ux + dy * uy + dz * uz) / (depth * tan)
    if (Math.abs(x) > 1 - inset.side || y > 1 - inset.top || y < -1 + inset.bottom) return false
  }
  return true
}

/**
 * The points the overview must show: the corners of the graduates' seating (floor and chair tops)
 * and the outline of the stage with its backdrop and screens.
 */
export function overviewPoints(v: VenueLayout, cfg: VenueConfig = VENUE): Vec3[] {
  let x0 = Infinity
  let x1 = -Infinity
  let z0 = Infinity
  let z1 = -Infinity
  for (let i = v.ranges.pitch[0]; i < v.ranges.bays[1]; i++) {
    x0 = Math.min(x0, v.position[i * 3])
    x1 = Math.max(x1, v.position[i * 3])
    z0 = Math.min(z0, v.position[i * 3 + 2])
    z1 = Math.max(z1, v.position[i * 3 + 2])
  }
  const points: Vec3[] = []
  if (x0 <= x1) {
    for (const x of [x0 - CHAIR_BOX.halfD, x1 + CHAIR_BOX.halfD]) {
      for (const z of [z0 - CHAIR_BOX.halfW, z1 + CHAIR_BOX.halfW]) points.push([x, 0, z], [x, CHAIR_BOX.height, z])
    }
  }
  const { deck, backdrop, screens } = cfg.stage
  for (const z of [backdrop.zMin, backdrop.zMax]) points.push([backdrop.x, backdrop.yTop, z], [backdrop.x, 0, z])
  for (const z of [deck.zMin, deck.zMax]) points.push([deck.xMax, 0, z])
  for (const c of screens.centres) {
    // A screen is turned, so take a box round it rather than its exact corners.
    for (const z of [c[2] - screens.width / 2, c[2] + screens.width / 2]) points.push([c[0], c[1] + screens.height / 2, z], [c[0], c[1] - screens.height / 2, z])
  }
  return points
}

/**
 * How far from its target the overview camera should sit on a screen of this aspect: the opening
 * distance when everything fits, otherwise the shortest distance (along the same line of sight)
 * at which it does, up to the orbit's limit.
 */
export function overviewRadius(aspect: number, points: Vec3[], cfg: VenueConfig = VENUE, inset: ViewInset = OVERVIEW_INSET): number {
  const home = cfg.camera.home
  const orbit = orbitFromPosition(home.position, home.target)
  const max = cfg.camera.orbit.radiusMax
  if (!(aspect > 0)) return orbit.radius
  const fov = overviewFov(aspect)
  const fits = (radius: number) => viewContains(orbitPosition({ ...orbit, radius }, home.target), home.target, fov, aspect, points, inset)
  if (orbit.radius >= max || fits(orbit.radius)) return Math.min(orbit.radius, max)
  if (!fits(max)) return max
  let near = orbit.radius
  let far = max
  // Halving the gap 16 times narrows 85 m to about a millimetre.
  for (let k = 0; k < 16; k++) {
    const mid = (near + far) / 2
    if (fits(mid)) far = mid
    else near = mid
  }
  return far
}
