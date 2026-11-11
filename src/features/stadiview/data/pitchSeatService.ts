import { useSyncExternalStore } from 'react'
import { err, ok } from '@/domain/types'
import type { Result } from '@/domain/types'
import { registerReset } from '@/features/demo-console/resetData'
import { VENUE } from '@/features/stadiview/config/venue'
import { bookingPhase, bookingWindow } from '@/features/stadiview/data/bookingWindow'
import { getDirectory } from '@/features/stadiview/data/graduateDirectory'
import type { Graduate } from '@/features/stadiview/data/graduateDirectory'
import { SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

/**
 * Who sits where on the pitch.
 *
 * This is a mock: there is no server, and "other students" are simulated. To keep the demo honest
 * and repeatable, what the other 2,976 graduates do is a pure function of the simulated clock:
 *
 * - Each has a fixed moment in the booking window at which they book (most of them early), and a
 *   fixed seat in their zone that they want. A few never book.
 * - At any time, the people whose moment has passed are seated. Scrub the clock back and they
 *   stand up again.
 *
 * What a real user of the demo does is the only stored state: their own booking stays whatever
 * the clock says, and a simulated graduate who wanted that seat takes another in the same zone.
 */

export type SeatStatus = 'available' | 'taken' | 'mine'

export type BookError = 'before' | 'closed' | 'taken' | 'wrong-zone' | 'not-a-pitch-seat' | 'bay-not-needed' | 'wrong-block' | 'same-seat'

/** The share of simulated graduates who have booked by the time the window closes. */
export const BOOKED_BY_CLOSE = 0.96
/** How strongly bookings bunch up at the start of the window: 1 is even, 2 means half are in within the first 30%. */
const EARLY_RUSH = 2

function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Occupancy {
  /** Per seat: the directory index of whoever sits there, or -1. */
  occupant: Int32Array
  /** Per graduate: their seat, or -1. */
  seat: Int32Array
}

export function createPitchSeatService(opts: { seed?: number } = {}) {
  const v = getVenue()
  const dir = getDirectory()
  const window = bookingWindow()
  const random = seeded(opts.seed ?? 2027)

  // What every simulated graduate will do, decided once.
  /** The seat each graduate wants: a shuffle of their zone's seats, one each. */
  const wanted = new Int32Array(dir.count)
  /** When each books; Infinity for the few who never do, and for the demo personas, who book by hand. */
  const moment = new Float64Array(dir.count)
  /** Per zone, the seats nobody will come for: they take in whoever finds their own seat gone. */
  const spare: number[][] = []
  v.zones.forEach((zone, z) => {
    const seats = Array.from({ length: zone.count }, (_, k) => zone.start + k)
    for (let k = seats.length - 1; k > 0; k--) {
      const j = Math.floor(random() * (k + 1))
      ;[seats[k], seats[j]] = [seats[j], seats[k]]
    }
    spare.push([])
    dir.inZone(z).forEach((g, k) => {
      wanted[g.index] = seats[k]
      const books = g.personaId === null && random() < BOOKED_BY_CLOSE
      moment[g.index] = books ? window.opens + (window.closes - window.opens) * Math.pow(random(), EARLY_RUSH) : Infinity
      if (!books) spare[z].push(seats[k])
    })
  })
  /** Everyone who books by themselves, in the order they do. */
  const arrivals = dir.all.filter((g) => moment[g.index] !== Infinity).sort((a, b) => moment[a.index] - moment[b.index] || a.index - b.index)

  // What the demo's users did. This is the only state.
  const userSeat = new Map<number, number>()
  /** Demo: "another student takes this seat now". The seat is theirs from that moment on. */
  const rivals: { graduate: number; seat: number; at: number }[] = []
  const wantsBay = new Set<number>()

  let version = 0
  const listeners = new Set<() => void>()
  const cache = new Map<string, Occupancy>()
  const changed = () => {
    version++
    cache.clear()
    for (const fn of listeners) fn()
  }

  function occupancy(now: number): Occupancy {
    // Nothing changes within a minute, and the scene asks many times a second.
    const key = `${Math.floor(now / 60_000)}`
    const hit = cache.get(key)
    if (hit) return hit

    const occupant = new Int32Array(v.count).fill(-1)
    const seat = new Int32Array(dir.count).fill(-1)
    const sit = (g: number, s: number) => {
      occupant[s] = g
      seat[g] = s
    }
    for (const [g, s] of userSeat) sit(g, s)
    for (const r of rivals) if (r.at <= now && occupant[r.seat] === -1 && seat[r.graduate] === -1) sit(r.graduate, r.seat)

    const nextSpare = spare.map(() => 0)
    for (const g of arrivals) {
      if (moment[g.index] > now) break
      if (seat[g.index] !== -1) continue
      let s = wanted[g.index]
      if (occupant[s] !== -1) {
        // Their seat is gone: the first seat of the zone that nobody is coming for, then any free one.
        const list = spare[g.zone]
        while (nextSpare[g.zone] < list.length && occupant[list[nextSpare[g.zone]]] !== -1) nextSpare[g.zone]++
        s = nextSpare[g.zone] < list.length ? list[nextSpare[g.zone]] : -1
        if (s === -1) {
          const zone = v.zones[g.zone]
          for (let k = zone.start; k < zone.start + zone.count; k++) {
            if (occupant[k] === -1) {
              s = k
              break
            }
          }
        }
        if (s === -1) continue // a full zone: nowhere left to sit
      }
      sit(g.index, s)
    }

    const result = { occupant, seat }
    if (cache.size > 8) cache.clear()
    cache.set(key, result)
    return result
  }

  const isSeat = (s: number) => Number.isInteger(s) && s >= 0 && s < v.count
  /** The gender a pitch block is for, from the block a seat or bay belongs to. */
  const blockGender = (s: number) => VENUE.blocks.genders[v.section[s]]

  function canBook(seat: number, graduate: Graduate, now: number): Result<true, BookError> {
    const phase = bookingPhase(now)
    if (phase !== 'open') return err(phase)
    if (!isSeat(seat) || v.kind[seat] === SeatKind.Stand) return err('not-a-pitch-seat')
    if (v.kind[seat] === SeatKind.AccessBay) {
      if (!wantsBay.has(graduate.index)) return err('bay-not-needed')
      if (blockGender(seat) !== graduate.gender) return err('wrong-block')
    } else if (v.zone[seat] !== graduate.zone) return err('wrong-zone')
    const there = occupancy(now).occupant[seat]
    if (there === graduate.index) return err('same-seat')
    if (there !== -1) return err('taken')
    return ok(true)
  }

  return {
    /** Whether a seat is free, taken by someone else, or the viewer's own. Stand seats are never booked here and read as free. */
    statusOf(seat: number, viewer: Graduate | null, now: number): SeatStatus {
      if (!isSeat(seat)) return 'available'
      const there = occupancy(now).occupant[seat]
      return there === -1 ? 'available' : viewer && there === viewer.index ? 'mine' : 'taken'
    },
    occupantOf(seat: number, now: number): Graduate | null {
      const there = isSeat(seat) ? occupancy(now).occupant[seat] : -1
      return there === -1 ? null : dir.all[there]
    },
    /** The graduate's seat at this moment, or -1. */
    seatOf(graduate: Graduate, now: number): number {
      return occupancy(now).seat[graduate.index]
    },
    canBook,
    /**
     * Books a seat for a graduate. A graduate has one seat: booking another gives up the first in
     * the same step, and `released` says which it was (-1 for none).
     */
    book(seat: number, graduate: Graduate, now: number): Result<{ seat: number; released: number }, BookError> {
      const allowed = canBook(seat, graduate, now)
      if (!allowed.ok) return allowed
      const released = userSeat.get(graduate.index) ?? -1
      userSeat.set(graduate.index, seat)
      changed()
      return ok({ seat, released })
    },
    /** Gives up the graduate's seat. Returns the seat that was released. */
    release(graduate: Graduate, now: number): Result<number, 'none' | 'closed'> {
      const seat = userSeat.get(graduate.index)
      if (seat === undefined) return err('none')
      if (bookingPhase(now) === 'closed') return err('closed')
      userSeat.delete(graduate.index)
      changed()
      return ok(seat)
    },
    /** A wheelchair user may book a bay in a block of their own gender. */
    setNeedsBay(graduate: Graduate, value: boolean): void {
      if (wantsBay.has(graduate.index) === value) return
      if (value) wantsBay.add(graduate.index)
      else wantsBay.delete(graduate.index)
      changed()
    },
    needsBay: (graduate: Graduate): boolean => wantsBay.has(graduate.index),
    /**
     * Demo only: another student of the seat's zone, who has no seat yet, takes this free seat now.
     * False when the seat is not free, is not a zone seat, or everyone in the zone is seated.
     */
    rivalTakes(seat: number, now: number): boolean {
      if (!isSeat(seat) || v.kind[seat] !== SeatKind.Pitch) return false
      const o = occupancy(now)
      if (o.occupant[seat] !== -1) return false
      // The one who would have come for it, if they have not sat down yet; otherwise whoever of the zone is still standing.
      const zone = dir.inZone(v.zone[seat])
      const waiting = (g: Graduate) => g.personaId === null && o.seat[g.index] === -1
      const who = zone.find((g) => wanted[g.index] === seat && waiting(g)) ?? zone.find(waiting)
      if (!who) return false
      rivals.push({ graduate: who.index, seat, at: now })
      changed()
      return true
    },
    /** How many pitch seats and bays are taken, in all and per zone. `total` is the number of zone seats. */
    counts(now: number): { booked: number; total: number; byZone: number[] } {
      const o = occupancy(now)
      const byZone = v.zones.map(() => 0)
      let booked = 0
      for (let s = 0; s < v.ranges.bays[1]; s++) {
        if (o.occupant[s] === -1) continue
        booked++
        if (s < v.ranges.pitch[1]) byZone[v.zone[s]]++
      }
      return { booked, total: v.ranges.pitch[1] - v.ranges.pitch[0], byZone }
    },
    /** Demo only: forget everything the demo's users did. */
    reset(): void {
      userSeat.clear()
      rivals.length = 0
      wantsBay.clear()
      changed()
    },
    version: () => version,
    subscribe(fn: () => void): () => void {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
}

export type PitchSeatService = ReturnType<typeof createPitchSeatService>

let shared: PitchSeatService | undefined

/** The one service the page uses, made on first use and cleared by the demo console's reset. */
export function pitchSeats(): PitchSeatService {
  if (!shared) {
    shared = createPitchSeatService()
    const service = shared
    registerReset(() => service.reset())
  }
  return shared
}

/** Re-renders the calling component whenever a booking changes, and returns the service's version. */
export function usePitchSeats(): number {
  const service = pitchSeats()
  return useSyncExternalStore(service.subscribe, service.version)
}
