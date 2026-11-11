import { describe, expect, it, vi } from 'vitest'
import { resetDemoData } from '@/features/demo-console/resetData'
import { bookingPhase, bookingWindow } from '@/features/stadiview/data/bookingWindow'
import { getDirectory } from '@/features/stadiview/data/graduateDirectory'
import { createPitchSeatService, pitchSeats } from '@/features/stadiview/data/pitchSeatService'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

const v = getVenue()
const dir = getDirectory()
const { opens, closes } = bookingWindow()
const at = (share: number) => opens + (closes - opens) * share
const MID = at(0.3)
const khaled = dir.byPersona('grad-m-gold')! // engineering, male
const reem = dir.byPersona('grad-f-gold')! // computing, female
const longName = dir.byPersona('grad-long-name')! // engineering, male: the same zone as Khaled

/** A free seat of a graduate's own zone at a moment. */
function freeSeat(s: ReturnType<typeof createPitchSeatService>, zone: number, now: number, skip = 0): number {
  const z = v.zones[zone]
  let seen = 0
  for (let k = z.start; k < z.start + z.count; k++) if (s.statusOf(k, null, now) === 'available' && seen++ === skip) return k
  throw new Error('no free seat')
}

describe('the booking window', () => {
  it('is the ticket stage of the schedule: 14 March to the end of 1 April 2027, Riyadh time', () => {
    expect(new Date(opens).toISOString()).toBe('2027-03-13T21:00:00.000Z')
    expect(new Date(closes).toISOString()).toBe('2027-04-01T20:59:59.000Z')
    expect(bookingPhase(opens - 1)).toBe('before')
    expect(bookingPhase(opens)).toBe('open')
    expect(bookingPhase(closes)).toBe('open')
    expect(bookingPhase(closes + 1)).toBe('closed')
  })
})

describe('the simulated graduates', () => {
  const s = createPitchSeatService()

  it('have booked nothing before the window, about 96% by its close, and never fewer as time goes on', () => {
    expect(s.counts(opens - 1).booked).toBe(0)
    const end = s.counts(closes).booked / 2986
    expect(end).toBeGreaterThan(0.94)
    expect(end).toBeLessThan(0.98)
    let last = 0
    for (let k = 0; k <= 20; k++) {
      const n = s.counts(at(k / 20)).booked
      expect(n).toBeGreaterThanOrEqual(last)
      last = n
    }
    // Most book early.
    expect(s.counts(at(0.3)).booked / 2986).toBeGreaterThan(0.45)
    expect(s.counts(closes + 86_400_000).booked).toBe(s.counts(closes).booked)
  })

  it('sit one to a seat, one seat each, always in their own zone', () => {
    for (let k = 1; k <= 20; k++) {
      const now = at(k / 20)
      const seen = new Set<number>()
      let seated = 0
      for (let seat = 0; seat < v.ranges.pitch[1]; seat++) {
        const g = s.occupantOf(seat, now)
        if (!g) continue
        seated++
        expect(seen.has(g.index)).toBe(false)
        seen.add(g.index)
        expect(g.zone).toBe(v.zone[seat])
        expect(s.seatOf(g, now)).toBe(seat)
      }
      expect(seated).toBe(s.counts(now).booked)
      expect(s.counts(now).byZone.reduce((a, b) => a + b, 0)).toBe(seated)
    }
  })

  it('are the same on every visit, and never include a demo persona', () => {
    const again = createPitchSeatService()
    for (let seat = 0; seat < v.ranges.pitch[1]; seat += 7) expect(again.occupantOf(seat, MID)?.index).toBe(s.occupantOf(seat, MID)?.index)
    for (const g of dir.all.filter((x) => x.personaId)) expect(s.seatOf(g, closes)).toBe(-1)
    expect(s.counts(MID).total).toBe(2986)
  })
})

describe('booking', () => {
  it('gives a graduate a free seat of their own zone', () => {
    const s = createPitchSeatService()
    const seat = freeSeat(s, khaled.zone, MID)
    expect(s.canBook(seat, khaled, MID)).toEqual({ ok: true, value: true })
    expect(s.book(seat, khaled, MID)).toEqual({ ok: true, value: { seat, released: -1 } })
    expect(s.statusOf(seat, khaled, MID)).toBe('mine')
    expect(s.statusOf(seat, reem, MID)).toBe('taken')
    expect(s.statusOf(seat, null, MID)).toBe('taken')
    expect(s.seatOf(khaled, MID)).toBe(seat)
    expect(s.occupantOf(seat, MID)).toBe(khaled)
  })

  it('refuses, with the reason, everything it should', () => {
    const s = createPitchSeatService()
    const seat = freeSeat(s, khaled.zone, MID)
    expect(s.book(seat, khaled, opens - 1)).toEqual({ ok: false, error: 'before' })
    expect(s.book(seat, khaled, closes + 1)).toEqual({ ok: false, error: 'closed' })
    expect(s.book(freeSeat(s, reem.zone, MID), khaled, MID)).toEqual({ ok: false, error: 'wrong-zone' })
    expect(s.book(v.indexOf('S-10-060'), khaled, MID)).toEqual({ ok: false, error: 'not-a-pitch-seat' })
    expect(s.book(-1, khaled, MID)).toEqual({ ok: false, error: 'not-a-pitch-seat' })
    expect(s.book(99999, khaled, MID)).toEqual({ ok: false, error: 'not-a-pitch-seat' })
    const taken = Array.from({ length: v.zones[khaled.zone].count }, (_, k) => v.zones[khaled.zone].start + k).find((k) => s.statusOf(k, null, MID) === 'taken')!
    expect(s.book(taken, khaled, MID)).toEqual({ ok: false, error: 'taken' })
    s.book(seat, khaled, MID)
    expect(s.book(seat, khaled, MID)).toEqual({ ok: false, error: 'same-seat' })
    expect(s.seatOf(khaled, MID)).toBe(seat)
  })

  it('opens the wheelchair bays only to those who need one, in a block of their own gender', () => {
    const s = createPitchSeatService()
    const menBay = v.indexOf('P3-A1')
    const womenBay = v.indexOf('P1-A1')
    expect(s.book(menBay, khaled, MID)).toEqual({ ok: false, error: 'bay-not-needed' })
    s.setNeedsBay(khaled, true)
    expect(s.needsBay(khaled)).toBe(true)
    expect(s.book(womenBay, khaled, MID)).toEqual({ ok: false, error: 'wrong-block' })
    expect(s.book(menBay, khaled, MID).ok).toBe(true)
    expect(s.statusOf(menBay, khaled, MID)).toBe('mine')
    s.setNeedsBay(reem, true)
    expect(s.book(menBay, reem, MID)).toEqual({ ok: false, error: 'wrong-block' })
    expect(s.book(womenBay, reem, MID).ok).toBe(true)
  })

  it('moves a graduate when they book again: the first seat is given up in the same step', () => {
    const s = createPitchSeatService()
    const first = freeSeat(s, khaled.zone, MID)
    const second = freeSeat(s, khaled.zone, MID, 1)
    s.book(first, khaled, MID)
    expect(s.book(second, khaled, MID)).toEqual({ ok: true, value: { seat: second, released: first } })
    expect(s.seatOf(khaled, MID)).toBe(second)
    expect(s.occupantOf(first, MID)).not.toBe(khaled)
  })

  it('keeps two users of one zone out of the same seat', () => {
    const s = createPitchSeatService()
    const seat = freeSeat(s, khaled.zone, MID)
    expect(longName.zone).toBe(khaled.zone)
    s.book(seat, khaled, MID)
    expect(s.book(seat, longName, MID)).toEqual({ ok: false, error: 'taken' })
  })

  it('releases a seat, but not after the window has closed', () => {
    const s = createPitchSeatService()
    expect(s.release(khaled, MID)).toEqual({ ok: false, error: 'none' })
    const seat = freeSeat(s, khaled.zone, MID)
    s.book(seat, khaled, MID)
    expect(s.release(khaled, closes + 1)).toEqual({ ok: false, error: 'closed' })
    expect(s.release(khaled, MID)).toEqual({ ok: true, value: seat })
    expect(s.seatOf(khaled, MID)).toBe(-1)
  })
})

describe('two things at once (Review Focus 1)', () => {
  it('refuses a seat another student took a moment ago, and leaves the earlier seat alone', () => {
    const s = createPitchSeatService()
    const mine = freeSeat(s, khaled.zone, MID)
    s.book(mine, khaled, MID)
    const target = freeSeat(s, khaled.zone, MID)
    const before = s.counts(MID).booked
    expect(s.rivalTakes(target, MID)).toBe(true)
    expect(s.statusOf(target, khaled, MID)).toBe('taken')
    expect(s.occupantOf(target, MID)!.zone).toBe(khaled.zone)
    expect(s.counts(MID).booked).toBe(before + 1)
    expect(s.book(target, khaled, MID)).toEqual({ ok: false, error: 'taken' })
    expect(s.seatOf(khaled, MID)).toBe(mine)
    // The rival cannot take a seat that is taken, a stand seat or a bay.
    expect(s.rivalTakes(target, MID)).toBe(false)
    expect(s.rivalTakes(mine, MID)).toBe(false)
    expect(s.rivalTakes(v.indexOf('S-10-060'), MID)).toBe(false)
    expect(s.rivalTakes(v.indexOf('P3-A1'), MID)).toBe(false)
  })
})

describe('scrubbing time after booking (Review Focus 2)', () => {
  it("keeps the user's seat theirs at every time, and seats whoever wanted it elsewhere in the zone", () => {
    const s = createPitchSeatService()
    const early = at(0.02)
    // A seat that is free now but that a simulated graduate will come for later.
    const z = v.zones[khaled.zone]
    const fresh = createPitchSeatService()
    let seat = -1
    for (let k = z.start; k < z.start + z.count; k++) {
      if (fresh.statusOf(k, null, early) === 'available' && fresh.statusOf(k, null, closes) === 'taken') {
        seat = k
        break
      }
    }
    expect(seat).toBeGreaterThanOrEqual(0)
    const wantedIt = fresh.occupantOf(seat, closes)!
    s.book(seat, khaled, early)
    for (const now of [opens - 86_400_000, early, at(0.2), at(0.6), closes, closes + 86_400_000]) {
      expect(s.seatOf(khaled, now)).toBe(seat)
      expect(s.statusOf(seat, khaled, now)).toBe('mine')
    }
    const elsewhere = s.seatOf(wantedIt, closes)
    expect(elsewhere).not.toBe(seat)
    expect(elsewhere).toBeGreaterThanOrEqual(0)
    expect(v.zone[elsewhere]).toBe(khaled.zone)
    // Still one to a seat, and one more person seated than without the user.
    expect(s.counts(closes).booked).toBe(fresh.counts(closes).booked + 1)
    // Booking a free seat never moves anyone who was already seated.
    for (let k = z.start; k < z.start + z.count; k += 3) {
      const before = fresh.occupantOf(k, early)
      if (before) expect(s.occupantOf(k, early)).toBe(before)
    }
  })
})

describe('change notices and reset', () => {
  it('tells subscribers once per change and not at all for a refusal', () => {
    const s = createPitchSeatService()
    const heard = vi.fn()
    const stop = s.subscribe(heard)
    const v0 = s.version()
    const seat = freeSeat(s, khaled.zone, MID)
    s.book(seat, khaled, MID)
    expect(heard).toHaveBeenCalledTimes(1)
    s.book(seat, khaled, MID) // same seat: refused
    s.book(seat, khaled, opens - 1) // refused
    s.setNeedsBay(khaled, false) // already off
    expect(heard).toHaveBeenCalledTimes(1)
    expect(s.version()).toBe(v0 + 1)
    stop()
    s.release(khaled, MID)
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('forgets bookings, rival moves and bay needs on reset, including through the demo console', () => {
    const s = createPitchSeatService()
    const seat = freeSeat(s, khaled.zone, MID)
    s.book(seat, khaled, MID)
    s.setNeedsBay(khaled, true)
    s.rivalTakes(freeSeat(s, khaled.zone, MID), MID)
    const fresh = createPitchSeatService().counts(MID).booked
    s.reset()
    expect(s.seatOf(khaled, MID)).toBe(-1)
    expect(s.needsBay(khaled)).toBe(false)
    expect(s.counts(MID).booked).toBe(fresh)

    const shared = pitchSeats()
    shared.book(freeSeat(shared, khaled.zone, MID), khaled, MID)
    expect(shared.seatOf(khaled, MID)).toBeGreaterThanOrEqual(0)
    resetDemoData()
    expect(shared.seatOf(khaled, MID)).toBe(-1)
  })

  it('answers for every seat of the venue in a few milliseconds at a moment it has not seen', () => {
    const s = createPitchSeatService()
    const now = at(0.4321)
    const t0 = performance.now()
    let taken = 0
    for (let seat = 0; seat < v.count; seat++) if (s.statusOf(seat, khaled, now) === 'taken') taken++
    expect(performance.now() - t0).toBeLessThan(25)
    expect(taken).toBeGreaterThan(1000)
  })
})
