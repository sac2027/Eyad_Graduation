import { afterEach, describe, expect, it } from 'vitest'
import { bookingWindow } from '@/features/stadiview/data/bookingWindow'
import { getDirectory } from '@/features/stadiview/data/graduateDirectory'
import { familyGraduateOf } from '@/features/stadiview/data/guestTicketService'
import { avatarKindOf, ceremonyNight, headwearOf, OCCUPANT, occupancy } from '@/features/stadiview/data/occupancy'
import { pitchSeats } from '@/features/stadiview/data/pitchSeatService'
import { SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

const v = getVenue()
const at = (iso: string) => Date.parse(`${iso}+03:00`)
const BEFORE = at('2027-03-01T10:00:00')
const MID = at('2027-03-20T10:00:00')
const LATER = at('2027-03-28T10:00:00')
const AFTER = at('2027-04-03T10:00:00')
const khaled = getDirectory().byPersona('grad-m-gold')!
const none = { full: false, ticketSeat: -1 }

afterEach(() => pitchSeats().reset())

describe('who sits where', () => {
  it('nobody before the booking window opens', () => {
    expect(occupancy(null, BEFORE, none).reserved).toBe(0)
    expect(occupancy(khaled, BEFORE, none).reserved).toBe(0)
  })

  it('on the pitch, exactly the seats that are taken or the viewer\'s own', () => {
    const o = occupancy(khaled, MID, none)
    for (let i = 0; i < v.ranges.bays[1]; i++) {
      const status = pitchSeats().statusOf(i, khaled, MID)
      const expected = status === 'available' ? OCCUPANT.none : status === 'mine' ? OCCUPANT.viewer : OCCUPANT.graduate
      if (o.occupant[i] !== expected) expect.fail(`${v.idOf(i)}: ${o.occupant[i]} for ${status}`)
    }
  })

  it('in the family stands, a family arrives with its graduate', () => {
    const o = occupancy(null, MID, none)
    let linked = 0
    for (let i = v.ranges.stands[0]; i < v.ranges.stands[1]; i++) {
      const g = familyGraduateOf(i)
      if (g === -1) continue
      linked++
      const seated = pitchSeats().seatOf(getDirectory().all[g], MID) !== -1
      expect(o.occupant[i] === OCCUPANT.family).toBe(seated)
    }
    expect(linked).toBe(4500)
  })

  it('fills VIP and accessibility seats more and more over the window, and never empties them early', () => {
    const unlinked: number[] = []
    for (let i = v.ranges.stands[0]; i < v.ranges.stands[1]; i++) if (familyGraduateOf(i) === -1) unlinked.push(i)
    expect(unlinked).toHaveLength(500)
    const count = (t: number) => {
      const o = occupancy(null, t, none)
      return unlinked.filter((i) => o.occupant[i] !== 0)
    }
    const mid = count(MID)
    const later = count(LATER)
    const after = count(AFTER)
    expect(mid.length).toBeGreaterThan(0)
    expect(later.length).toBeGreaterThan(mid.length)
    expect(after.length).toBeGreaterThan(450)
    // Whoever was seated earlier is still seated later.
    const laterSet = new Set(later)
    for (const i of mid) expect(laterSet.has(i)).toBe(true)
    expect(count(bookingWindow().opens - 1)).toHaveLength(0)
  })

  it('follows a booking, a move and a release', () => {
    const zone = v.zones[khaled.zone]
    let seat = -1
    for (let i = zone.start; i < zone.start + zone.count; i++) {
      if (pitchSeats().statusOf(i, khaled, MID) === 'available') {
        seat = i
        break
      }
    }
    const before = occupancy(khaled, MID, none).reserved
    expect(pitchSeats().book(seat, khaled, MID).ok).toBe(true)
    // Booking seats Khaled's family too.
    const after = occupancy(khaled, MID, none)
    expect(after.occupant[seat]).toBe(OCCUPANT.viewer)
    expect(after.reserved).toBeGreaterThan(before)
    expect(pitchSeats().release(khaled, MID).ok).toBe(true)
    expect(occupancy(khaled, MID, none).occupant[seat]).toBe(OCCUPANT.none)
    expect(occupancy(khaled, MID, none).reserved).toBe(before)
  })

  it('seats the demo rival', () => {
    const zone = v.zones[0]
    let seat = zone.start
    while (pitchSeats().statusOf(seat, null, MID) !== 'available') seat++
    expect(pitchSeats().rivalTakes(seat, MID)).toBe(true)
    expect(occupancy(null, MID, none).occupant[seat]).toBe(OCCUPANT.graduate)
  })

  it('keeps the viewer\'s own booking when the clock goes back before the window', () => {
    const zone = v.zones[khaled.zone]
    let seat = zone.start
    while (pitchSeats().statusOf(seat, khaled, MID) !== 'available') seat++
    pitchSeats().book(seat, khaled, MID)
    const o = occupancy(khaled, BEFORE, none)
    expect(o.occupant[seat]).toBe(OCCUPANT.viewer)
  })

  it('fills every seat for the full house, keeping the viewer marked', () => {
    const o = occupancy(null, MID, { full: true, ticketSeat: v.indexOf('S-02-084') })
    expect(o.reserved).toBe(7998)
    expect(o.occupant[v.indexOf('S-02-084')]).toBe(OCCUPANT.viewer)
    expect(o.occupant[v.indexOf('P3-12-07')]).toBe(OCCUPANT.graduate)
  })

  it('keeps a guest\'s own ticket seat filled', () => {
    const seat = v.indexOf('S-02-084')
    expect(occupancy(null, BEFORE, { full: false, ticketSeat: seat }).occupant[seat]).toBe(OCCUPANT.viewer)
  })

  it('knows ceremony night', () => {
    expect(ceremonyNight(at('2027-04-07T19:30:00'))).toBe(true)
    expect(ceremonyNight(at('2027-04-07T18:44:00'))).toBe(false)
    expect(ceremonyNight(at('2027-04-07T21:31:00'))).toBe(false)
    expect(ceremonyNight(at('2027-04-06T19:30:00'))).toBe(false)
  })
})

describe('which figure', () => {
  it('puts women in Block 1 and men in Blocks 2 to 6, bays by their block', () => {
    for (let i = 0; i < v.ranges.bays[1]; i++) {
      const block = v.sections[v.section[i]].id
      const kind = avatarKindOf(i)
      if (v.kind[i] === SeatKind.AccessBay) expect(kind).toBe(block === 'P1' ? 'bay-f' : 'bay-m')
      else expect(kind).toBe(block === 'P1' ? 'grad-f' : 'grad-m')
    }
  })

  it('seats about as many men as women in the stands, the same on every call', () => {
    let men = 0
    for (let i = v.ranges.stands[0]; i < v.ranges.stands[1]; i++) {
      const kind = avatarKindOf(i)
      expect(kind === 'family-m' || kind === 'family-f').toBe(true)
      expect(avatarKindOf(i)).toBe(kind)
      if (kind === 'family-m') men++
    }
    expect(Math.abs(men / 5000 - 0.5)).toBeLessThan(0.03)
  })

  it('gives about four in ten men in the stands a red shemagh, and every graduate a white ghutra', () => {
    let men = 0
    let shemagh = 0
    for (let i = v.ranges.stands[0]; i < v.ranges.stands[1]; i++) {
      if (avatarKindOf(i) !== 'family-m') continue
      men++
      if (headwearOf(i) === 'shemagh') shemagh++
    }
    expect(Math.abs(shemagh / men - 0.4)).toBeLessThan(0.04)
    expect(headwearOf(v.indexOf('P3-12-07'))).toBe('ghutra')
  })
})
