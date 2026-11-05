import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { err, ok, type Result } from '@/domain/types'
import type { Seat, SectionDef, SectionSummary } from '@/domain/seats'
import { SECTION_DEFS } from '../fixtures/seats'

export const HOLD_TTL_MS = 10 * 60_000
export const MAX_SEATS_PER_USER = 2

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createSeatService(defs: SectionDef[] = SECTION_DEFS, rivalSeed = 57) {
  const seats = new Map<string, Seat>()
  const bySection = new Map<string, string[]>()
  const held = new Set<string>()
  const byUser = new Map<string, Set<string>>()
  const needsEasyAccess = new Set<string>()
  const rand = mulberry32(rivalSeed)

  for (const d of defs) {
    const ids: string[] = []
    for (let r = 1; r <= d.rows; r++) {
      for (let n = 1; n <= d.perRow; n++) {
        const id = `${d.id}-${r}-${n}`
        seats.set(id, { id, section: d.id, row: r, number: n, zone: d.zone, status: 'available' })
        ids.push(id)
      }
    }
    bySection.set(d.id, ids)
  }

  const store: StoreApi<{ version: number }> = createStore(() => ({ version: 0 }))
  const bump = () => store.setState((s) => ({ version: s.version + 1 }))

  const userSet = (u: string) => {
    let s = byUser.get(u)
    if (!s) byUser.set(u, (s = new Set()))
    return s
  }
  const put = (s: Seat) => seats.set(s.id, s)
  const free = (s: Seat) => {
    held.delete(s.id)
    byUser.get(s.heldBy ?? '')?.delete(s.id)
    put({ ...s, status: 'available', heldBy: undefined, heldUntil: undefined })
  }

  function expireHolds(now: number) {
    let changed = false
    for (const id of [...held]) {
      const s = seats.get(id)!
      if (s.heldUntil !== undefined && s.heldUntil <= now) {
        free(s)
        changed = true
      }
    }
    if (changed) bump()
  }

  function activeCount(userId: string, now: number) {
    let n = 0
    for (const id of byUser.get(userId) ?? []) {
      const s = seats.get(id)!
      if (s.status === 'confirmed' || (s.status === 'held' && (s.heldUntil ?? 0) > now)) n++
    }
    return n
  }

  return {
    store,
    needsEasyAccess: (userId: string) => needsEasyAccess.has(userId),
    setNeedsEasyAccess(userId: string, value: boolean) {
      if (value) needsEasyAccess.add(userId)
      else needsEasyAccess.delete(userId)
      bump()
    },
    getSeat: (id: string): Seat | undefined => seats.get(id),
    totalSeats: () => seats.size,
    listSections(): SectionSummary[] {
      return defs.map((d) => {
        const ids = bySection.get(d.id)!
        let available = 0
        for (const id of ids) if (seats.get(id)!.status === 'available') available++
        return { id: d.id, zone: d.zone, total: ids.length, available }
      })
    },
    listSeats(sectionId: string): Seat[] {
      return (bySection.get(sectionId) ?? []).map((id) => seats.get(id)!)
    },
    listUserSeats(userId: string): Seat[] {
      return [...(byUser.get(userId) ?? [])].map((id) => seats.get(id)!)
    },
    hold(seatId: string, userId: string, now: number): Result<Seat, 'taken' | 'limit' | 'not-found' | 'blocked'> {
      const seat = seats.get(seatId)
      if (!seat) return err('not-found')
      if (seat.zone === 'vip' || seat.zone === 'ops') return err('blocked')
      if (seat.zone === 'easy-access' && !needsEasyAccess.has(userId)) return err('blocked')
      if (seat.status === 'held' && (seat.heldUntil ?? 0) <= now) {
        free(seat)
      }
      const cur = seats.get(seatId)!
      if (cur.status === 'confirmed') return err('taken')
      if (cur.status === 'held') {
        if (cur.heldBy === userId) return ok(cur)
        return err('taken')
      }
      if (activeCount(userId, now) >= MAX_SEATS_PER_USER) return err('limit')
      const next: Seat = { ...cur, status: 'held', heldBy: userId, heldUntil: now + HOLD_TTL_MS }
      put(next)
      held.add(seatId)
      userSet(userId).add(seatId)
      bump()
      return ok(next)
    },
    release(seatId: string, userId: string) {
      const s = seats.get(seatId)
      if (s && s.status === 'held' && s.heldBy === userId) {
        free(s)
        bump()
      }
    },
    confirm(userId: string, now: number): Result<Seat[], 'no-hold' | 'expired'> {
      const mine = [...(byUser.get(userId) ?? [])].map((id) => seats.get(id)!).filter((s) => s.status === 'held')
      if (mine.length === 0) return err('no-hold')
      const expired = mine.filter((s) => (s.heldUntil ?? 0) <= now)
      if (expired.length > 0) {
        for (const s of expired) free(s)
        bump()
        return err('expired')
      }
      const out: Seat[] = []
      for (const s of mine) {
        held.delete(s.id)
        const next: Seat = { ...s, status: 'confirmed', confirmedBy: userId, heldBy: undefined, heldUntil: undefined }
        put(next)
        out.push(next)
      }
      bump()
      return ok(out)
    },
    expireHolds,
    /** Another guest takes this exact seat, if it is still free. Used to demonstrate the duplicate-seat conflict. */
    rivalTake(seatId: string): boolean {
      const seat = seats.get(seatId)
      if (!seat || seat.zone !== 'general' || seat.status !== 'available') return false
      put({ ...seat, status: 'confirmed', confirmedBy: 'rival' })
      bump()
      return true
    },
    /** The nearest free seat in the same section that this user is allowed to hold. */
    suggest(seatId: string, userId: string): Seat | null {
      const from = seats.get(seatId)
      if (!from) return null
      let best: Seat | null = null
      let bestD = Infinity
      for (const id of bySection.get(from.section) ?? []) {
        const s2 = seats.get(id)!
        if (s2.status !== 'available') continue
        if (s2.zone === 'vip' || s2.zone === 'ops') continue
        if (s2.zone === 'easy-access' && !needsEasyAccess.has(userId)) continue
        const d = Math.abs(s2.row - from.row) * 3 + Math.abs(s2.number - from.number)
        if (d < bestD) {
          bestD = d
          best = s2
        }
      }
      return best
    },
    /** Another guest takes a free general seat. Never touches held or confirmed seats. */
    simulateRival(now: number, sectionId?: string): { seatId: string } | null {
      expireHolds(now)
      const pool = (sectionId ? (bySection.get(sectionId) ?? []) : [...seats.keys()])
        .map((id) => seats.get(id)!)
        .filter((s) => s.zone === 'general' && s.status === 'available')
      if (pool.length === 0) return null
      const pick = pool[Math.floor(rand() * pool.length)]
      put({ ...pick, status: 'confirmed', confirmedBy: 'rival' })
      bump()
      return { seatId: pick.id }
    },
  }
}

export type SeatService = ReturnType<typeof createSeatService>
export const seatService = createSeatService()
export function useSeatVersion(service: SeatService = seatService): number {
  return useStore(service.store, (s) => s.version)
}
