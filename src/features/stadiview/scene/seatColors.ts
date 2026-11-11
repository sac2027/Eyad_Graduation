import { VENUE } from '@/features/stadiview/config/venue'
import type { VenueConfig } from '@/features/stadiview/config/venue'
import { southLetterMask } from '@/features/stadiview/layout/standsLayout'
import { SeatKind } from '@/features/stadiview/layout/types'
import type { VenueLayout } from '@/features/stadiview/layout/types'
import { SV } from '@/features/stadiview/scene/palette'

/** The four colours a seat can be, straight from the palette. */
export const SEAT_COLORS = {
  /** Graduate seats and wheelchair bays on the pitch. */
  pitch: SV.green,
  /** Family seats in the stands. */
  stand: SV.deep,
  /** The seats that spell the university's name across the lettered stand. */
  letter: SV.sand,
  /** The seat under the pointer, and the seat that was picked or is being inspected. */
  active: SV.gold,
  /** A graduate seat someone else has booked: dark, so the free seats stand out. */
  taken: '#1F3F38',
  /** The viewer's own seat. */
  mine: SV.gold,
} as const

/** How strongly a seat outside the graduate's own zone is drawn, and one the filters leave out. */
export const ZONE_DIM = 0.6
export const FILTER_DIM = 0.25

export interface SeatLook {
  hover: number
  selected: number
  /** The seat the inspector shows; -1 or left out for none. */
  inspected?: number
  /** Whether the seat is free, someone else's, or the viewer's. Left out, a seat is free. */
  status?: 'available' | 'taken' | 'mine'
}

/**
 * A seat's own colour, before any highlight. `cfg` is the config the layout was built from; it
 * says which stand carries the lettering.
 */
export function baseColor(i: number, v: VenueLayout, cfg: VenueConfig = VENUE): string {
  if (v.kind[i] !== SeatKind.Stand) return SEAT_COLORS.pitch
  // The letter mask only knows rows and seat numbers, so the stand has to be checked here.
  const lettered = v.sections[v.section[i]].id === cfg.lettering.stand
  return lettered && southLetterMask(v.row[i], v.number[i], cfg) ? SEAT_COLORS.letter : SEAT_COLORS.stand
}

/**
 * The colour a seat is drawn in right now. Gold for the seat that is hovered, picked or inspected
 * and for the viewer's own; dark for a graduate seat someone else holds; otherwise its own colour.
 */
export function colorFor(i: number, v: VenueLayout, s: SeatLook, cfg: VenueConfig = VENUE): string {
  if (i === s.hover || i === s.selected || i === s.inspected) return SEAT_COLORS.active
  if (s.status === 'mine') return SEAT_COLORS.mine
  if (s.status === 'taken' && v.kind[i] !== SeatKind.Stand) return SEAT_COLORS.taken
  return baseColor(i, v, cfg)
}
