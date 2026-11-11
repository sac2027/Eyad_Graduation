import type { Result } from '@/domain/types'
import type { GateId } from '@/features/stadiview/config/venue'
import { getDirectory } from '@/features/stadiview/data/graduateDirectory'
import type { Graduate } from '@/features/stadiview/data/graduateDirectory'
import { parseTicket, seatsOfGate, ticketFor } from '@/features/stadiview/data/ticketCodec'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { SCHEDULE } from '@/time/schedule'

export type Parking = 'P1' | 'P2' | 'P3' | 'P4'

/** What a guest's ticket says. */
export interface GuestTicket {
  ticket: string
  seat: number
  gate: GateId
  parking: Parking
  /** When the gates close to arriving guests. */
  arriveBy: number
  /** The graduate whose family holds this ticket; null for VIP and accessibility seats, which are given out separately. */
  graduate: Graduate | null
}

/** The gates whose stands hold the families' seats. Gate 3 (accessibility) and gate 4 (VIP) are allocated by the organisers. */
const FAMILY_GATES: GateId[] = [1, 2]
const PARKING: Record<GateId, Parking> = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4', 5: 'P2' }

interface Dealing {
  /** The family seats in the order they are dealt. */
  seats: number[]
  /** Per seat of the venue: the directory index of the graduate whose family sits there, or -1. */
  graduateOf: Int32Array
  /** How many graduates receive two seats side by side; the rest receive one. */
  pairs: number
}

let dealing: Dealing | undefined

/**
 * Deals the family seats. There are fewer seats than two per graduate, as on the real night: the
 * first graduates in the directory receive two neighbouring seats and the rest one each, so that
 * every graduate has at least one and every family seat is used.
 */
function deal(): Dealing {
  const v = getVenue()
  const graduates = getDirectory().count
  const seats = FAMILY_GATES.flatMap((g) => [...seatsOfGate(g)])
  const pairs = Math.max(0, Math.min(graduates, seats.length - graduates))
  const graduateOf = new Int32Array(v.count).fill(-1)
  seats.forEach((seat, n) => {
    const g = n < pairs * 2 ? Math.floor(n / 2) : pairs + (n - pairs * 2)
    if (g < graduates) graduateOf[seat] = g
  })
  return { seats, graduateOf, pairs }
}

function forSeat(seat: number): GuestTicket | null {
  const ticket = ticketFor(seat)
  if (!ticket) return null
  dealing ??= deal()
  const gate = getVenue().sections[getVenue().section[seat]].gate
  const g = dealing.graduateOf[seat]
  return { ticket, seat, gate, parking: PARKING[gate], arriveBy: SCHEDULE.stages.arrival.closes ?? SCHEDULE.stages.arrival.opens, graduate: g === -1 ? null : getDirectory().all[g] }
}

export const guestTicketService = {
  /** The ticket of a stand seat; null for any other seat. */
  forSeat,
  /** Finds a ticket from what was typed; see `parseTicket` for what can be wrong with it. */
  lookup(text: string): Result<GuestTicket, 'format' | 'gate' | 'range'> {
    const parsed = parseTicket(text)
    return parsed.ok ? { ok: true, value: forSeat(parsed.value)! } : parsed
  },
  /** The tickets a graduate's family holds: two, or one. */
  ticketsOf(graduate: Graduate): GuestTicket[] {
    dealing ??= deal()
    const { seats, pairs } = dealing
    const at = graduate.index < pairs ? [graduate.index * 2, graduate.index * 2 + 1] : [pairs * 2 + (graduate.index - pairs)]
    return at.filter((n) => n < seats.length).map((n) => forSeat(seats[n])!)
  },
  /** One ticket in the middle of each stand, for the demo's quick-fill chips. */
  demoTickets(): string[] {
    const v = getVenue()
    return v.sections.filter((s) => s.kind === 'stand').map((s) => ticketFor(s.start + Math.floor(s.count / 2))!)
  },
}
