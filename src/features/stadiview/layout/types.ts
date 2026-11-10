import type { CollegeCode, Degree, GateId, Gender, StandId } from '@/features/stadiview/config/venue'

/** What a seat is. Stored one byte per seat. */
export const SeatKind = { Pitch: 0, AccessBay: 1, Stand: 2 } as const
export type SeatKind = (typeof SeatKind)[keyof typeof SeatKind]

/**
 * Whether a seat can be taken. This is not part of the layout: the services keep one byte per seat,
 * so the layout itself never changes and can be shared.
 */
export const SeatState = { Available: 0, Held: 1, Booked: 2, Blocked: 3 } as const
export type SeatState = (typeof SeatState)[keyof typeof SeatState]

/** Value of the `zone` array for a seat that belongs to no zone (bays and stand seats). */
export const NO_ZONE = 255

export type SectionId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | StandId

/** A pitch block or a grandstand. */
export interface SectionInfo {
  id: SectionId
  kind: 'pitch' | 'stand'
  rows: number
  /**
   * Index of the section's first seat. For stands, the seats are `start` to `start + count - 1`.
   * The male pitch blocks are interleaved in line-up order, so list a pitch block's seats through
   * the layout's `section` array instead. -1 for a pitch block that has no seats.
   */
  start: number
  /** Seats in the section. A pitch block's accessible bays point at it through `section` but are not counted here. */
  count: number
  gate: GateId
}

/** One college-and-degree group and the run of seats it fills. */
export interface ZoneInfo {
  /** For example 'M-CEP-B' or 'F-CCM-G'. */
  id: string
  gender: Gender
  college: CollegeCode
  degree: Degree
  /** Index of the zone's first seat; its seats are `start` to `start + count - 1`, in line-up order. */
  start: number
  count: number
  gate: 2 | 5
}

/**
 * One row of a stand, with enough to place, draw and pick its seats without looking at each one.
 * `start` is the index of the row's seat 1 and `y` its floor height.
 */
export type StandRow =
  /** A straight row: seat n (1-based) is at x = x0 + (n - 1) x dx, on the line z. */
  | { kind: 'line'; section: number; row: number; y: number; start: number; count: number; z: number; x0: number; dx: number; yaw: number }
  /**
   * A curved row about (cx, cz). Seat k (0-based) of a span is at angle from + (k + 0.5) x step,
   * in radians measured from +X toward +Z. Seat numbers run on from one span to the next.
   */
  | { kind: 'arc'; section: number; row: number; y: number; start: number; count: number; cx: number; cz: number; radius: number; spans: { from: number; step: number; count: number }[] }

/**
 * The whole venue, built once from the config. One entry per seat in each array.
 * Seats are ordered: pitch seats in line-up order, then the accessible bays, then the stands.
 */
export interface VenueLayout {
  /** 7,998 at the baseline numbers. */
  count: number
  /** count x 3: the centre of the seat's footprint on its floor. */
  position: Float32Array
  /** Facing direction in radians about +Y. 0 faces north (-Z); pitch seats face west at +90 degrees. */
  yaw: Float32Array
  /** A SeatKind. */
  kind: Uint8Array
  /** Index into `sections`. */
  section: Uint8Array
  /** Index into `zones`; NO_ZONE (255) for none. */
  zone: Uint8Array
  /** 1-based within the section; 0 for a bay. */
  row: Uint16Array
  /** 1-based within the row. For a bay, its number among its block's bays: 1 is the north bay, 2 the south one. */
  number: Uint16Array
  /** 1-based position in the zone's procession order; 0 off the pitch. */
  lineup: Uint16Array
  sections: SectionInfo[]
  zones: ZoneInfo[]
  /** Half-open index ranges: [0, 2986], [2986, 2998] and [2998, 7998] at the baseline numbers. */
  ranges: { pitch: [number, number]; bays: [number, number]; stands: [number, number] }
  /** Pitch grid lookup for picking: block x row x column to seat index, -1 where there is no seat. Length is blocks x pitchRows x seats per block row. */
  pitchCell: Int32Array
  /** The largest row number in any pitch block (45 at the baseline numbers). */
  pitchRows: number
  /** One entry per stand row (72 at the baseline), for picking and for drawing the tiers. */
  standRows: StandRow[]
  /** The seat's id, for example 'P3-12-07', 'P3-A1' or 'S-07-112'. */
  idOf(index: number): string
  /** The seat's index, or -1 when the id is unknown. */
  indexOf(id: string): number
}
