import { VENUE } from '@/features/stadiview/config/venue'
import { bookingWindow } from '@/features/stadiview/data/bookingWindow'
import { getDirectory } from '@/features/stadiview/data/graduateDirectory'
import type { Graduate } from '@/features/stadiview/data/graduateDirectory'
import { familyGraduateOf } from '@/features/stadiview/data/guestTicketService'
import { pitchSeats } from '@/features/stadiview/data/pitchSeatService'
import { SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { SCHEDULE } from '@/time/schedule'

/**
 * Who is sitting in each seat at a moment of the simulated clock: the one question the figures in
 * the 3D scene ask. Nothing here knows about three.js.
 *
 * - **Pitch seats and bays** follow the pitch-seat service exactly: a seat holds someone when its
 *   status is `taken` or `mine`.
 * - **Family seats** follow their graduate: they are filled when the graduate the tickets were
 *   issued for has a pitch seat at that moment, so a family arrives with its graduate.
 * - **VIP and accessibility seats** have no graduate. They fill over the booking window on the
 *   same curve as the pitch: each seat has a fixed moment, most of them early.
 * - A guest's own looked-up ticket seat always holds them.
 * - On ceremony night, or with the demo's "Fill the stadium" switch, every seat is filled. That
 *   changes only the picture: bookings, the seat map and the tooltips keep the real data.
 */

/** Who sits in a seat: nobody, a graduate, a family member or guest, or the viewer themselves. */
export const OCCUPANT = { none: 0, graduate: 1, family: 2, viewer: 3 } as const
export type Occupant = (typeof OCCUPANT)[keyof typeof OCCUPANT]

/** The share of VIP and accessibility seats given out by the time booking closes. */
export const STAND_FILLED_BY_CLOSE = 0.96
/** How strongly those seats bunch up early in the window (as for the pitch). */
const STAND_EARLY_RUSH = 2
/** The share of family figures who are men, and of the men who wear a red shemagh rather than a white ghutra. */
export const FAMILY_MEN = 0.5
export const SHEMAGH = 0.4

/** A stable number from 0 to 1 for a seat and a purpose: the same on every load. */
export function seatHash(seat: number, salt: number): number {
  let h = Math.imul(seat ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35)
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d)
  h ^= h >>> 15
  h = Math.imul(h, 0x846ca68b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Ceremony night: from when everyone is seated (18:45) to the end of the photos (21:30) on 7 April 2027. */
export function ceremonyNight(now: number): boolean {
  return now >= SCHEDULE.ceremonyDay.seated.start && now < SCHEDULE.ceremonyDay.photos.end
}

/** When a VIP or accessibility seat is given out; Infinity for the few that never are. */
function standMoment(seat: number): number {
  if (seatHash(seat, 1) >= STAND_FILLED_BY_CLOSE) return Infinity
  const w = bookingWindow()
  return w.opens + (w.closes - w.opens) * Math.pow(seatHash(seat, 2), STAND_EARLY_RUSH)
}

export interface Occupancy {
  /** Per seat, an `Occupant`. */
  occupant: Uint8Array
  /** How many seats hold someone. */
  reserved: number
  /** Changes whenever `occupant` does, so a drawing can tell whether to update. */
  key: string
}

let last: Occupancy | null = null

export function occupancy(viewer: Graduate | null, now: number, opts: { full: boolean; ticketSeat: number }): Occupancy {
  const service = pitchSeats()
  const minute = Math.floor(now / 60_000)
  const key = `${service.version()}|${minute}|${viewer?.index ?? -1}|${opts.full ? 1 : 0}|${opts.ticketSeat}`
  if (last && last.key === key) return last

  const v = getVenue()
  const occupant = new Uint8Array(v.count)
  let reserved = 0
  const put = (seat: number, who: Occupant) => {
    occupant[seat] = who
    reserved++
  }
  const mine = viewer ? service.seatOf(viewer, now) : -1
  const everyone = getDirectory().all

  for (let seat = 0; seat < v.count; seat++) {
    const stand = v.kind[seat] === SeatKind.Stand
    if (seat === mine || seat === opts.ticketSeat) put(seat, OCCUPANT.viewer)
    else if (opts.full) put(seat, stand ? OCCUPANT.family : OCCUPANT.graduate)
    else if (!stand) {
      if (service.statusOf(seat, viewer, now) !== 'available') put(seat, OCCUPANT.graduate)
    } else {
      const g = familyGraduateOf(seat)
      const there = g === -1 ? standMoment(seat) <= now : service.seatOf(everyone[g], now) !== -1
      if (there) put(seat, OCCUPANT.family)
    }
  }
  last = { occupant, reserved, key }
  return last
}

export type AvatarKind = 'grad-m' | 'grad-f' | 'bay-m' | 'bay-f' | 'family-m' | 'family-f'
export const AVATAR_KINDS: AvatarKind[] = ['grad-m', 'grad-f', 'bay-m', 'bay-f', 'family-m', 'family-f']

/** Which figure sits in a seat: by block on the pitch (Block 1 is the women's), by a stable draw in the stands. */
export function avatarKindOf(seat: number): AvatarKind {
  const v = getVenue()
  const kind = v.kind[seat]
  if (kind === SeatKind.Stand) return seatHash(seat, 3) < FAMILY_MEN ? 'family-m' : 'family-f'
  const gender = VENUE.blocks.genders[v.section[seat]]
  if (kind === SeatKind.AccessBay) return gender === 'f' ? 'bay-f' : 'bay-m'
  return gender === 'f' ? 'grad-f' : 'grad-m'
}

/** What a man in the stands wears on his head. Graduates all wear the white ghutra. */
export function headwearOf(seat: number): 'ghutra' | 'shemagh' {
  return avatarKindOf(seat) === 'family-m' && seatHash(seat, 4) < SHEMAGH ? 'shemagh' : 'ghutra'
}
