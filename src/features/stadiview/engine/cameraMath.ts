import { VENUE } from '@/features/stadiview/config/venue'
import type { VenueConfig } from '@/features/stadiview/config/venue'
import type { Vec3 } from '@/features/stadiview/engine/seatFrame'
import { SeatKind } from '@/features/stadiview/layout/types'
import type { VenueLayout } from '@/features/stadiview/layout/types'

/**
 * Where the camera goes and which way it looks, as plain arithmetic.
 *
 * Nothing here touches three.js or the clock, so the camera rig stays a thin layer that can be
 * trusted: every pose it uses is worked out by a function that is tested on its own.
 *
 * Two angle conventions are used, and they are kept apart on purpose:
 * - An orbit (the overview) is described from its target: `theta` goes round the target and `phi`
 *   comes down from straight overhead.
 * - A look (first person) is described from the eye: `yaw` and `pitch`, with yaw measured exactly
 *   like a seat's yaw, so a seat's facing direction can be used as a look without conversion.
 */

/** A camera position on a sphere round a target. Angles are radians. */
export interface Orbit {
  /** The angle round the target, seen from above: 0 is due south of it (+Z), growing toward the east (+X). */
  theta: number
  /** The angle down from straight overhead: 0 is directly above the target, 90 degrees is level with it. */
  phi: number
  /** Distance from the target. */
  radius: number
}

/** A viewing direction from an eye point. Angles are radians. */
export interface Look {
  /** 0 looks north (-Z) and it grows toward the west (-X), the same as a seat's yaw. */
  yaw: number
  /** 0 is level; positive looks up. */
  pitch: number
}

/** How high a seated viewer's eyes are above the floor their chair stands on. */
export const EYE_HEIGHT = 1.15

/** The first-person field of view, in degrees. A flight into a seat ends on it. */
export const POV_FOV = 62

/**
 * The overview the page opens on. It is a copy of the pose in the venue config, so the rig can
 * hold on to it, or even change it, without altering the config.
 */
export const ORBIT_HOME: { position: Vec3; target: Vec3; fov: number } = {
  position: [...VENUE.camera.home.position],
  target: [...VENUE.camera.home.target],
  fov: VENUE.camera.home.fov,
}

// A flight into a seat arrives from behind and above it, over the heads of the rows behind, so the
// last second reads as settling into the chair.
const APPROACH_BEHIND = 12
const APPROACH_ABOVE = 7
/** The top of the flight is this far above whichever of its two ends is higher: "up and over". */
const FLIGHT_CREST = 18
/** The top comes early (40% of the way), which leaves the longer part of the flight for the descent. */
const FLIGHT_CREST_AT = 0.4
/** The flight back out has no approach leg; one crest over its midpoint, this far above the higher end, shapes it. */
const RETURN_CREST = 20
/**
 * A seat under a roof is closed in behind and above, exactly where the usual approach comes from.
 * The camera reaches it from the open side instead: from this far in front and only this far up,
 * low enough to pass under the edge of the roof, and settles backward into the chair.
 */
const FRONT_AHEAD = 12
const FRONT_ABOVE = 2.5

/**
 * How the rig must thread its curve through the flight points: pass this as the curve type of
 * three.js's `CatmullRomCurve3`.
 *
 * It matters. The last leg of a flight comes down only a little more steeply than a stand rises,
 * so there is not much room over the chairs behind the seat. The default type ('centripetal') sags
 * a metre or more below that leg and takes the camera through those chairs and through the rear
 * wall of the back rows. The chordal type stays close to the straight legs and clears both.
 */
export const FLIGHT_CURVE_TYPE = 'chordal'

/**
 * The overview has to show the six blocks and the stage side by side. On a landscape screen the
 * opening field of view does that. On a squarer or portrait screen the same vertical angle would
 * cut the sides off, so the view is kept this many degrees wide instead, which makes it taller.
 */
const OVERVIEW_WIDTH_FOV = 53
/** Beyond this the picture distorts badly at the edges; the rig moves the camera back instead. */
const OVERVIEW_MAX_FOV = 72

const rad = (deg: number): number => (deg * Math.PI) / 180
const deg = (r: number): number => (r * 180) / Math.PI
const clamp = (x: number, low: number, high: number): number => Math.min(Math.max(x, low), high)

/** Where the eyes of someone sitting in seat `i` are: straight above the seat's position. */
export function seatEye(i: number, v: VenueLayout): Vec3 {
  return [v.position[i * 3], v.position[i * 3 + 1] + EYE_HEIGHT, v.position[i * 3 + 2]]
}

/**
 * What seat `i` looks at when first person opens: graduates on the pitch (and in the bays) watch
 * the speaker at the podium, families in the stands watch the graduates.
 *
 * The result is a copy, so the caller may change it. `cfg` is the config the layout was built from.
 */
export function seatLook(i: number, v: VenueLayout, cfg: VenueConfig = VENUE): Vec3 {
  const look = v.kind[i] === SeatKind.Stand ? cfg.camera.standLook : cfg.camera.pitchLook
  return [look[0], look[1], look[2]]
}

/**
 * The points a flight into a seat passes through: where the camera is now, a crest, an approach
 * point behind and above the seat, and the seat's eye point.
 *
 * `from` can be any pose, including one in the middle of another flight, which is what lets a new
 * pick take over without a jump. `back` is the level unit vector pointing behind the seat
 * (`seatBack`).
 */
export function flightPath(from: Vec3, eye: Vec3, back: Vec3): Vec3[] {
  return flightVia(from, [eye[0] + APPROACH_BEHIND * back[0], eye[1] + APPROACH_BEHIND * back[1] + APPROACH_ABOVE, eye[2] + APPROACH_BEHIND * back[2]], eye)
}

/**
 * The same flight for a seat under a roof: the last point before the seat is in front of it and
 * low, so the camera passes under the roof's edge and backs into the chair. `facing` is the level
 * unit vector the seat faces along (`seatFacing`).
 */
export function frontFlightPath(from: Vec3, eye: Vec3, facing: Vec3): Vec3[] {
  return flightVia(from, frontPoint(eye, facing), eye)
}

/**
 * The point in front of a roofed seat that flights in and out of it pass through: out from under
 * the roof, just above head height. A flight that leaves such a seat for another seat goes
 * through it first.
 */
export function frontPoint(eye: Vec3, facing: Vec3): Vec3 {
  return [eye[0] + FRONT_AHEAD * facing[0], eye[1] + FRONT_AHEAD * facing[1] + FRONT_ABOVE, eye[2] + FRONT_AHEAD * facing[2]]
}

/** A flight from the camera, over a crest, through an approach point, to the eye. */
function flightVia(from: Vec3, approach: Vec3, eye: Vec3): Vec3[] {
  const crest: Vec3 = [
    from[0] + FLIGHT_CREST_AT * (approach[0] - from[0]),
    // Measured from the higher end, so the path still rises when it starts low (leaving one seat for another).
    Math.max(from[1], approach[1]) + FLIGHT_CREST,
    from[2] + FLIGHT_CREST_AT * (approach[2] - from[2]),
  ]
  return [[from[0], from[1], from[2]], crest, approach, [eye[0], eye[1], eye[2]]]
}

/** The points a flight back to an overview pose passes through: start, a crest over the midpoint, end. */
export function returnPath(from: Vec3, to: Vec3): Vec3[] {
  const crest: Vec3 = [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + RETURN_CREST, (from[2] + to[2]) / 2]
  return [[from[0], from[1], from[2]], crest, [to[0], to[1], to[2]]]
}

/**
 * The flight back from a seat under a roof: out through the front first, under the roof's edge,
 * and only then up and over to the overview pose. `from` is the seat's eye point.
 */
export function frontReturnPath(from: Vec3, to: Vec3, facing: Vec3): Vec3[] {
  const exit = frontPoint(from, facing)
  const crest: Vec3 = [(exit[0] + to[0]) / 2, Math.max(exit[1], to[1]) + RETURN_CREST, (exit[2] + to[2]) / 2]
  return [[from[0], from[1], from[2]], exit, crest, [to[0], to[1], to[2]]]
}

/**
 * Brings an orbit inside the limits in the venue config: not too close to overhead or to the
 * ground, not too near or too far. `theta` is left alone, because the camera may circle the
 * stadium as many times as the user likes. Returns a new object.
 */
export function clampOrbit(o: Orbit, cfg: VenueConfig = VENUE): Orbit {
  const limit = cfg.camera.orbit
  return {
    theta: o.theta,
    phi: clamp(o.phi, rad(limit.polarMinDeg), rad(limit.polarMaxDeg)),
    radius: clamp(o.radius, limit.radiusMin, limit.radiusMax),
  }
}

/** The camera position for an orbit round `target`. */
export function orbitPosition(o: Orbit, target: Vec3): Vec3 {
  const level = o.radius * Math.sin(o.phi)
  return [target[0] + level * Math.sin(o.theta), target[1] + o.radius * Math.cos(o.phi), target[2] + level * Math.cos(o.theta)]
}

/**
 * The orbit that puts the camera at `position` round `target`: the inverse of `orbitPosition`.
 * `theta` comes back between -pi and pi. A camera exactly on its target, or straight above or
 * below it, has no meaningful `theta`; it is reported as 0 rather than left undefined.
 */
export function orbitFromPosition(position: Vec3, target: Vec3): Orbit {
  const dx = position[0] - target[0]
  const dy = position[1] - target[1]
  const dz = position[2] - target[2]
  const radius = Math.hypot(dx, dy, dz)
  if (radius === 0) return { theta: 0, phi: 0, radius: 0 }
  // Rounding can push the ratio a hair past 1, and acos of that is NaN.
  return { theta: Math.atan2(dx, dz), phi: Math.acos(clamp(dy / radius, -1, 1)), radius }
}

/**
 * Brings a first-person look inside its limits. The pitch stops at the limits in the venue config.
 * The yaw is free (a viewer can turn all the way round) but is folded back into the range from
 * -pi (not included) to pi, so it cannot grow without end as someone keeps dragging.
 */
export function clampLook(yaw: number, pitch: number, cfg: VenueConfig = VENUE): Look {
  const limit = cfg.camera.look
  const turn = 2 * Math.PI
  // The number of whole turns to take off; 0 for a yaw already in range, which is then returned untouched.
  const turns = Math.ceil((yaw - Math.PI) / turn)
  return { yaw: yaw - turns * turn, pitch: clamp(pitch, rad(limit.pitchMinDeg), rad(limit.pitchMaxDeg)) }
}

/**
 * The yaw and pitch that look from `eye` toward `target`.
 *
 * A three.js camera with rotation order 'YXZ', `rotation.y = yaw` and `rotation.x = pitch` looks
 * along this direction. When the two points coincide, or the target is straight above or below,
 * the yaw is 0.
 */
export function lookAngles(eye: Vec3, target: Vec3): Look {
  const dx = target[0] - eye[0]
  const dy = target[1] - eye[1]
  const dz = target[2] - eye[2]
  // Subtracting from 0 rather than negating keeps due north a plain 0 and not -0.
  return { yaw: Math.atan2(0 - dx, 0 - dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }
}

/**
 * The overview's vertical field of view, in degrees, for a screen `aspect` (width / height).
 *
 * Landscape screens get the opening field of view. As the screen gets squarer the view is held at
 * a fixed width instead, so it grows taller, up to a ceiling. A screen with no usable shape (not
 * measured yet, or zero-sized) gets the opening field of view.
 */
export function overviewFov(aspect: number): number {
  if (!(aspect > 0)) return ORBIT_HOME.fov
  const fixedWidth = deg(2 * Math.atan(Math.tan(rad(OVERVIEW_WIDTH_FOV / 2)) / aspect))
  return clamp(fixedWidth, ORBIT_HOME.fov, OVERVIEW_MAX_FOV)
}
