import type { Vec3 } from '@/features/stadiview/config/venue'
import type { VenueLayout } from '@/features/stadiview/layout/types'

export type { Vec3 }

/**
 * The pick box of one seat: what the pointer has to be over for the seat to count as "under" it.
 *
 * It stands on the seat's position (the centre of its footprint, on its floor) and is turned by the
 * seat's yaw: `halfW` to each side, `halfD` to the front and to the back, `height` tall. The drawn
 * chair fits inside it, and no two boxes overlap: the closest two seats in the venue are further
 * apart than a box is wide.
 */
export const CHAIR_BOX: Readonly<{ halfW: number; height: number; halfD: number }> = { halfW: 0.25, height: 0.95, halfD: 0.25 }

/** Where `seatAim` points: this far behind the seat's centre and this far above its floor, on the upper seat back. */
const AIM_BACK = 0.22
const AIM_HEIGHT = 0.8

/**
 * The level unit vector a seat faces along. A yaw of 0 faces north (-Z) and it grows toward the
 * west, so a pitch seat at +90 degrees faces the stage at (-1, 0, 0).
 */
export function seatFacing(i: number, v: VenueLayout): Vec3 {
  const yaw = v.yaw[i]
  // Subtracting from 0 rather than negating keeps a zero component a plain 0 and not -0, which
  // would fail an exact comparison in a test.
  return [0 - Math.sin(yaw), 0, 0 - Math.cos(yaw)]
}

/** The opposite of the facing: the level unit vector from the seat toward whoever sits behind it. */
export function seatBack(i: number, v: VenueLayout): Vec3 {
  const yaw = v.yaw[i]
  return [Math.sin(yaw), 0, Math.cos(yaw)]
}

/**
 * A point on the upper seat back. Tests and the debug hook aim at it because it is the part of a
 * chair that shows from most camera positions: the chair in front hides the seat pan long before
 * it hides the top of the back.
 */
export function seatAim(i: number, v: VenueLayout): Vec3 {
  const back = seatBack(i, v)
  return [v.position[i * 3] + AIM_BACK * back[0], v.position[i * 3 + 1] + AIM_HEIGHT, v.position[i * 3 + 2] + AIM_BACK * back[2]]
}
