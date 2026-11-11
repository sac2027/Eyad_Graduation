import { beforeEach, describe, expect, it } from 'vitest'
import { VENUE } from '@/features/stadiview/config/venue'
import { bookingWindow } from '@/features/stadiview/data/bookingWindow'
import { getDirectory } from '@/features/stadiview/data/graduateDirectory'
import { guestTicketService } from '@/features/stadiview/data/guestTicketService'
import { locatorService } from '@/features/stadiview/data/locatorService'
import { pitchSeats } from '@/features/stadiview/data/pitchSeatService'
import { parseTicket, ticketFor, ticketGate } from '@/features/stadiview/data/ticketCodec'
import { bearingBetween, relativeToStage } from '@/features/stadiview/engine/bearing'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

const v = getVenue()
const dir = getDirectory()
const { opens, closes } = bookingWindow()

describe('ticket numbers', () => {
  it('give every stand seat one ticket, and read it back', () => {
    const seen = new Set<string>()
    for (let seat = v.ranges.stands[0]; seat < v.ranges.stands[1]; seat++) {
      const ticket = ticketFor(seat)!
      expect(ticket).toMatch(/^TICKET-G[1-4]-\d+$/)
      expect(seen.has(ticket)).toBe(false)
      seen.add(ticket)
      expect(parseTicket(ticket)).toEqual({ ok: true, value: seat })
    }
    expect(seen.size).toBe(5000)
  })

  it('have none for pitch seats, bays, or a seat that does not exist', () => {
    expect(ticketFor(0)).toBeNull()
    expect(ticketFor(v.indexOf('P3-A1'))).toBeNull()
    expect(ticketFor(-1)).toBeNull()
    expect(ticketFor(99999)).toBeNull()
  })

  it("puts the brief's example in the south stand: TICKET-G1-204 is row 2, seat 84", () => {
    expect(parseTicket('TICKET-G1-204')).toEqual({ ok: true, value: v.indexOf('S-02-084') })
    expect(ticketFor(v.indexOf('S-01-001'))).toBe('TICKET-G1-1')
    // The VIP box is the only stand of gate 4, so its first seat is that gate's first ticket.
    expect(ticketFor(v.indexOf('VIP-01-001'))).toBe('TICKET-G4-1')
  })

  it('names the gate of the seat\'s own stand', () => {
    for (const stand of VENUE.stands) {
      const section = v.sections.find((s) => s.id === stand.id)!
      expect(ticketFor(section.start)).toContain(`-G${stand.gate}-`)
    }
  })

  it('reads a ticket however it is typed (Review Focus 4)', () => {
    const seat = v.indexOf('S-02-084')
    for (const typed of ['ticket-g1-204', ' TICKET G1 204 ', 'TICKET–G1–204', 'TICKET-G١-٢٠٤', 'Ticket_G1_204', 'TICKETG1204']) {
      expect(parseTicket(typed), typed).toEqual({ ok: true, value: seat })
    }
  })

  it('says what is wrong with one that cannot be a ticket (Review Focus 4)', () => {
    expect(parseTicket('TICKET-G1-99999')).toEqual({ ok: false, error: 'range' })
    expect(parseTicket('TICKET-G1-3601')).toEqual({ ok: false, error: 'range' })
    expect(parseTicket('TICKET-G1-3600').ok).toBe(true)
    expect(parseTicket('TICKET-G9-1')).toEqual({ ok: false, error: 'gate' })
    expect(parseTicket('TICKET-G5-1')).toEqual({ ok: false, error: 'gate' })
    for (const bad of ['G1-204', 'TICKET-G1-', 'TICKET-G1-0', '', 'hello', 'TICKET-1-204', 'TICKET-G1-20A4']) {
      expect(parseTicket(bad), bad).toEqual({ ok: false, error: 'format' })
    }
  })
})

describe('guest tickets', () => {
  it('carry the gate, parking and arrival time of their stand', () => {
    const t = guestTicketService.lookup('TICKET-G1-204')
    expect(t.ok).toBe(true)
    if (!t.ok) return
    expect(t.value).toMatchObject({ ticket: 'TICKET-G1-204', seat: v.indexOf('S-02-084'), gate: 1, parking: 'P1' })
    expect(new Date(t.value.arriveBy).toISOString()).toBe('2027-04-07T15:45:00.000Z')
    expect(guestTicketService.lookup('nope')).toEqual({ ok: false, error: 'format' })
    expect(guestTicketService.forSeat(0)).toBeNull()
  })

  it('give every graduate at least one family seat, two side by side for the first 1,514, and use every family seat once', () => {
    const owners = new Map<number, number>()
    let pairs = 0
    for (const g of dir.all) {
      const tickets = guestTicketService.ticketsOf(g)
      expect(tickets.length === 1 || tickets.length === 2).toBe(true)
      if (tickets.length === 2) {
        pairs++
        // Neighbours in the same row.
        expect(v.row[tickets[0].seat]).toBe(v.row[tickets[1].seat])
        expect(Math.abs(v.number[tickets[0].seat] - v.number[tickets[1].seat])).toBe(1)
      }
      for (const t of tickets) {
        expect(t.graduate).toBe(g)
        expect([1, 2]).toContain(t.gate)
        expect(owners.has(t.seat)).toBe(false)
        owners.set(t.seat, g.index)
        expect(guestTicketService.forSeat(t.seat)!.graduate).toBe(g)
      }
    }
    expect(pairs).toBe(1514)
    expect(owners.size).toBe(4500)
  })

  it('link no graduate to a VIP or an accessibility seat', () => {
    expect(guestTicketService.forSeat(v.indexOf('VIP-03-025'))!.graduate).toBeNull()
    expect(guestTicketService.forSeat(v.indexOf('ACC-02-020'))!.graduate).toBeNull()
    expect(guestTicketService.forSeat(v.indexOf('ACC-02-020'))!).toMatchObject({ gate: 3, parking: 'P3' })
  })

  it('offer one demo ticket per stand, each of them valid', () => {
    const demo = guestTicketService.demoTickets()
    expect(demo).toHaveLength(6)
    for (const t of demo) expect(guestTicketService.lookup(t).ok).toBe(true)
  })
})

describe('the family locator (Review Focus 3)', () => {
  const late = closes
  // A simulated graduate who has booked by the close, and one who never books.
  const seated = dir.all.find((g) => g.personaId === null && pitchSeats().seatOf(g, late) !== -1)!
  const standing = dir.all.find((g) => g.personaId === null && pitchSeats().seatOf(g, late) === -1)!
  beforeEach(() => locatorService.reset())

  it('finds a seated graduate by name or ID while their locator is on, and always by share code', () => {
    const seat = pitchSeats().seatOf(seated, late)
    expect(locatorService.isAllowed(seated)).toBe(true)
    expect(locatorService.locate({ graduate: seated }, late)).toEqual({ ok: true, value: { graduate: seated, seat } })
    expect(locatorService.locate({ shareCode: seated.shareCode }, late)).toEqual({ ok: true, value: { graduate: seated, seat } })
    locatorService.setAllowed(seated, false)
    expect(locatorService.locate({ graduate: seated }, late)).toEqual({ ok: false, error: 'locator-off' })
    expect(locatorService.locate({ shareCode: seated.shareCode.toLowerCase() }, late)).toEqual({ ok: true, value: { graduate: seated, seat } })
  })

  it('says so when the graduate has not booked, or the code is not known', () => {
    expect(locatorService.locate({ graduate: standing }, late)).toEqual({ ok: false, error: 'no-seat-yet' })
    expect(locatorService.locate({ shareCode: standing.shareCode }, late)).toEqual({ ok: false, error: 'no-seat-yet' })
    expect(locatorService.locate({ graduate: seated }, opens - 1)).toEqual({ ok: false, error: 'no-seat-yet' })
    expect(locatorService.locate({ shareCode: 'KF-ZZZZ-ZZ' }, late)).toEqual({ ok: false, error: 'unknown-code' })
  })

  it('gives nothing away about a graduate whose locator is off, booked or not', () => {
    locatorService.setAllowed(standing, false)
    expect(locatorService.locate({ graduate: standing }, late)).toEqual({ ok: false, error: 'locator-off' })
  })

  it('tells subscribers of a real change only', () => {
    let heard = 0
    const stop = locatorService.subscribe(() => heard++)
    locatorService.setAllowed(seated, true)
    expect(heard).toBe(0)
    locatorService.setAllowed(seated, false)
    expect(heard).toBe(1)
    stop()
  })
})

describe('bearings', () => {
  it('names the four compass directions, with north at -Z and east at +X', () => {
    expect(bearingBetween([0, 0, 0], [0, 0, -10])).toMatchObject({ degrees: 0, point: 'N', distance: 10 })
    expect(bearingBetween([0, 0, 0], [10, 0, 0])).toMatchObject({ degrees: 90, point: 'E' })
    expect(bearingBetween([0, 0, 0], [0, 0, 10])).toMatchObject({ degrees: 180, point: 'S' })
    expect(bearingBetween([0, 0, 0], [-10, 0, 0])).toMatchObject({ degrees: 270, point: 'W' })
    expect(bearingBetween([0, 0, 0], [-10, 0, 10]).point).toBe('SW')
    expect(bearingBetween([0, 0, 0], [-1, 0, -10]).point).toBe('N')
  })

  it('measures the straight line, height included', () => {
    expect(bearingBetween([0, 6, 0], [3, 2, 0]).distance).toBeCloseTo(5, 9)
  })

  it('says how far left or right of the stage to look, and whether up or down', () => {
    // Looking north at the stage; a seat to the north-west is 45 degrees to the left.
    expect(relativeToStage([0, 0, 10], [-10, 0, 0], [0, 0, 0])).toMatchObject({ side: 'left', tilt: 'level' })
    expect(relativeToStage([0, 0, 10], [-10, 0, 0], [0, 0, 0]).degrees).toBeCloseTo(45, 6)
    expect(relativeToStage([0, 0, 10], [10, 0, 0], [0, 0, 0]).side).toBe('right')
    expect(relativeToStage([0, 0, 10], [0.2, 0, 0], [0, 0, 0]).side).toBe('ahead')
    expect(relativeToStage([0, 6, 10], [0, 0, 0], [0, 6, 0]).tilt).toBe('down')
    expect(relativeToStage([0, 0, 10], [0, 6, 0], [0, 0, 0]).tilt).toBe('up')
    // Across north: the stage a little west of north, the target a little east of it.
    const r = relativeToStage([0, 0, 0], [1, 0, -10], [-1, 0, -10])
    expect(r.side).toBe('right')
    expect(r.degrees).toBeCloseTo(11.42, 1)
  })

  it('reads sensibly from a real stand seat', () => {
    const eye: [number, number, number] = [0.3, 6.13, 60.65] // S-10-060
    const podium = VENUE.camera.pitchLook
    const r = relativeToStage(eye, [10, 1, 0], podium)
    // The podium is to the north-west of the south stand; a seat east of centre is to its right, and below.
    expect(r.side).toBe('right')
    expect(r.tilt).toBe('down')
  })
})

describe('the gate written in a ticket', () => {
  it('is read from anything shaped like a ticket, even for a gate that does not exist', () => {
    expect(ticketGate('TICKET-G1-204')).toBe(1)
    expect(ticketGate('ticket g9 1')).toBe(9)
    expect(ticketGate('TICKET-G1-99999')).toBe(1)
  })

  it('is null for anything else', () => {
    for (const text of ['', 'hello', 'TICKET', 'G1-204', 'TICKET-GX-1']) expect(ticketGate(text), text).toBeNull()
  })
})
