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
  /** The seat under the pointer, and the seat that was picked. */
  active: SV.gold,
} as const

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

/** The colour a seat is drawn in right now: gold when it is hovered or selected, otherwise its own. */
export function colorFor(i: number, v: VenueLayout, s: { hover: number; selected: number }, cfg: VenueConfig = VENUE): string {
  return i === s.hover || i === s.selected ? SEAT_COLORS.active : baseColor(i, v, cfg)
}
