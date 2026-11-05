export type SeatStatus = 'available' | 'held' | 'confirmed' | 'blocked'
export type SeatZone = 'general' | 'easy-access' | 'vip' | 'ops'

export interface Seat {
  id: string
  section: string
  row: number
  number: number
  zone: SeatZone
  status: SeatStatus
  heldBy?: string
  heldAt?: number
  heldUntil?: number
  confirmedBy?: string
}

export interface SectionSummary {
  id: string
  zone: SeatZone
  total: number
  available: number
}

export interface SectionDef {
  id: string
  zone: SeatZone
  rows: number
  perRow: number
}

/**
 * A hold is active only between when it was made and when it runs out. Time can be scrubbed backwards in the demo,
 * so a hold made "later" than the current simulated time is not active either.
 */
export function isHoldActive(seat: Seat, now: number): boolean {
  return seat.status === 'held' && (seat.heldAt ?? -Infinity) <= now && (seat.heldUntil ?? 0) > now
}
