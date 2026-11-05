import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { err, ok, type Result } from '@/domain/types'
import { SCHEDULE, type Schedule } from '@/time/schedule'

export type GownStatus = 'none' | 'requested' | 'slot-booked' | 'picked-up' | 'returned'
export const BISHT_SIZES = ['52', '54', '56', '58', '60', '62']
export const ABAYA_SIZES = ['52', '54', '56', '58', '60']
const ORDER: GownStatus[] = ['none', 'requested', 'slot-booked', 'picked-up', 'returned']

export interface PickupSlot {
  id: string
  start: number
  capacity: number
}

export interface GownRecord {
  status: GownStatus
  size?: string
  slotId?: string
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

export function createGownService(opts: { schedule?: Schedule; slotCapacity?: number } = {}) {
  const s = opts.schedule ?? SCHEDULE
  const capacity = opts.slotCapacity ?? 150
  const store = createStore<{ records: Record<string, GownRecord>; booked: Record<string, number> }>(() => ({ records: {}, booked: {} }))

  const slots: PickupSlot[] = []
  for (let day = 0; day < 5; day++) {
    const base = s.pickupOpens + day * DAY
    for (const h of [9, 11, 14, 16]) slots.push({ id: `slot-${day}-${h}`, start: base + h * HOUR, capacity })
  }

  const get = (u: string): GownRecord => store.getState().records[u] ?? { status: 'none' }
  const set = (u: string, rec: GownRecord) => store.setState((st) => ({ records: { ...st.records, [u]: rec } }))
  const forward = (from: GownStatus, to: GownStatus) => ORDER.indexOf(to) === ORDER.indexOf(from) + 1

  return {
    store,
    slots,
    get,
    /** Seats already taken in a slot by other graduates (deterministic mock demand). */
    slotLoad(slotId: string): number {
      const i = slots.findIndex((x) => x.id === slotId)
      const base = Math.round(capacity * (0.35 + 0.1 * (i % 5)))
      return base + (store.getState().booked[slotId] ?? 0)
    },
    requestSize(userId: string, size: string, gender: 'm' | 'f', now: number): Result<GownRecord, 'closed' | 'invalid-size' | 'out-of-order'> {
      const w = s.stages.attire
      if (now < w.opens || now > w.due!) return err('closed')
      if (!(gender === 'm' ? BISHT_SIZES : ABAYA_SIZES).includes(size)) return err('invalid-size')
      const cur = get(userId)
      if (cur.status !== 'none' && cur.status !== 'requested') return err('out-of-order')
      const rec: GownRecord = { ...cur, status: 'requested', size }
      set(userId, rec)
      return ok(rec)
    },
    bookPickup(userId: string, slotId: string, now: number): Result<GownRecord, 'closed' | 'full' | 'out-of-order' | 'no-slot'> {
      if (now < s.pickupOpens - 14 * DAY || now > s.pickupCloses) return err('closed')
      const slot = slots.find((x) => x.id === slotId)
      if (!slot) return err('no-slot')
      const cur = get(userId)
      if (cur.status !== 'requested') return err('out-of-order')
      if (this.slotLoad(slotId) >= slot.capacity) return err('full')
      store.setState((st) => ({ booked: { ...st.booked, [slotId]: (st.booked[slotId] ?? 0) + 1 } }))
      const rec: GownRecord = { ...cur, status: 'slot-booked', slotId }
      set(userId, rec)
      return ok(rec)
    },
    markPickedUp(userId: string): Result<GownRecord, 'out-of-order'> {
      const cur = get(userId)
      if (!forward(cur.status, 'picked-up')) return err('out-of-order')
      const rec = { ...cur, status: 'picked-up' as const }
      set(userId, rec)
      return ok(rec)
    },
    markReturned(userId: string): Result<GownRecord, 'out-of-order'> {
      const cur = get(userId)
      if (!forward(cur.status, 'returned')) return err('out-of-order')
      const rec = { ...cur, status: 'returned' as const }
      set(userId, rec)
      return ok(rec)
    },
  }
}

export type GownService = ReturnType<typeof createGownService>
export const gownService = createGownService()
export function useGownRecord(userId: string, service: GownService = gownService): GownRecord {
  return useStore(service.store, (st) => st.records[userId]) ?? { status: 'none' }
}
