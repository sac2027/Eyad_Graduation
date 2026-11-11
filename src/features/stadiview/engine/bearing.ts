import type { Vec3 } from '@/features/stadiview/config/venue'

/**
 * Directions in the stadium, for telling a family where to look.
 *
 * North is -Z and east is +X, as everywhere in the venue. Bearings are compass bearings: degrees
 * clockwise from north, seen from above.
 */

export type CompassPoint = 'N' | 'NNE' | 'NE' | 'ENE' | 'E' | 'ESE' | 'SE' | 'SSE' | 'S' | 'SSW' | 'SW' | 'WSW' | 'W' | 'WNW' | 'NW' | 'NNW'

const POINTS: CompassPoint[] = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

const degrees = (radians: number) => (radians * 180) / Math.PI

/** The compass bearing from one point to another, in degrees from 0 (north) up to, not including, 360. */
function bearing(from: Vec3, to: Vec3): number {
  const east = to[0] - from[0]
  const north = from[2] - to[2]
  return (degrees(Math.atan2(east, north)) + 360) % 360
}

/** How far it is from one point to another in a straight line, and in which compass direction. */
export function bearingBetween(from: Vec3, to: Vec3): { distance: number; degrees: number; point: CompassPoint } {
  const b = bearing(from, to)
  return { distance: Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]), degrees: b, point: POINTS[Math.round(b / 22.5) % 16] }
}

/** Within this many degrees of the stage's direction counts as straight ahead, and within this many of level as level. */
const AHEAD = 3
const LEVEL = 2

/**
 * Where a target is for someone at `eye` who is looking at the stage: how many degrees to the left
 * or right of the stage, and whether above or below eye level.
 */
export function relativeToStage(eye: Vec3, target: Vec3, stage: Vec3): { side: 'left' | 'right' | 'ahead'; degrees: number; tilt: 'up' | 'down' | 'level' } {
  // Clockwise from the stage's direction is to the right; fold the difference into -180 to 180.
  let turn = bearing(eye, target) - bearing(eye, stage)
  if (turn > 180) turn -= 360
  if (turn <= -180) turn += 360
  const level = Math.hypot(target[0] - eye[0], target[2] - eye[2])
  const rise = degrees(Math.atan2(target[1] - eye[1], level))
  return {
    side: Math.abs(turn) < AHEAD ? 'ahead' : turn > 0 ? 'right' : 'left',
    degrees: Math.abs(turn),
    tilt: rise > LEVEL ? 'up' : rise < -LEVEL ? 'down' : 'level',
  }
}
