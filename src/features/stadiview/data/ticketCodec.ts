import { err, ok } from '@/domain/types'
import type { Result } from '@/domain/types'
import type { GateId } from '@/features/stadiview/config/venue'
import { normalise } from '@/features/stadiview/data/textSearch'
import { SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

/**
 * Ticket numbers for the stand seats: TICKET-G{gate}-{serial}.
 *
 * The serial counts the stand seats a gate serves, in the layout's order, starting at 1. So a
 * ticket says which gate to use and names exactly one seat, and no table of tickets is needed:
 * TICKET-G1-204 is the 204th seat of gate 1, which is south stand, row 2, seat 84.
 */

interface Tables {
  /** Per gate: its stand seats, in serial order. */
  seatsOfGate: Map<GateId, number[]>
  /** Per seat: its serial at its gate, 0 for a seat without a ticket. */
  serial: Int32Array
}

let tables: Tables | undefined

function build(): Tables {
  const v = getVenue()
  const seatsOfGate = new Map<GateId, number[]>()
  const serial = new Int32Array(v.count)
  for (let seat = v.ranges.stands[0]; seat < v.ranges.stands[1]; seat++) {
    const gate = v.sections[v.section[seat]].gate
    let list = seatsOfGate.get(gate)
    if (!list) seatsOfGate.set(gate, (list = []))
    list.push(seat)
    serial[seat] = list.length
  }
  return { seatsOfGate, serial }
}

/** The stand seats a gate serves, in ticket order. Empty for a gate with no stand. */
export function seatsOfGate(gate: GateId): readonly number[] {
  tables ??= build()
  return tables.seatsOfGate.get(gate) ?? []
}

/** The ticket number of a stand seat; null for a pitch seat, a bay, or no seat at all. */
export function ticketFor(seat: number): string | null {
  const v = getVenue()
  if (!Number.isInteger(seat) || seat < 0 || seat >= v.count || v.kind[seat] !== SeatKind.Stand) return null
  tables ??= build()
  return `TICKET-G${v.sections[v.section[seat]].gate}-${tables.serial[seat]}`
}

/** The gate and serial digits of text shaped like a ticket number, or null. */
function shapeOf(text: string): RegExpExecArray | null {
  const plain = normalise(text)
    .toUpperCase()
    .replace(/[\s‐-―−_-]+/g, '')
  return /^TICKETG(\d)(\d{1,6})$/.exec(plain)
}

/** The gate number written in a ticket, whether or not such a gate exists; null when the text is not shaped like a ticket. */
export function ticketGate(text: string): number | null {
  const m = shapeOf(text)
  return m ? Number(m[1]) : null
}

/**
 * Reads a ticket number as someone might type it: any letter case, spaces or any kind of dash
 * between its parts, Latin or Arabic digits. Says what is wrong when it cannot be a ticket:
 * - 'format': not of the shape TICKET-G1-204
 * - 'gate': no stand is served by that gate
 * - 'range': that gate has fewer seats than the number given
 */
export function parseTicket(text: string): Result<number, 'format' | 'gate' | 'range'> {
  const m = shapeOf(text)
  if (!m) return err('format')
  const serial = Number(m[2])
  if (serial < 1) return err('format')
  const seats = seatsOfGate(Number(m[1]) as GateId)
  if (seats.length === 0) return err('gate')
  if (serial > seats.length) return err('range')
  return ok(seats[serial - 1])
}
