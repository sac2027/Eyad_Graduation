import { describe, expect, it } from 'vitest'
import { createSeatService, HOLD_TTL_MS } from '@/data/services/seatService'
import { computeCapacity } from '@/domain/capacity'
import { GRADUATES, RESERVED, TOTAL_SEATS } from '@/data/fixtures/seats'

const T = Date.parse('2027-03-20T10:00:00+03:00')

describe('seatService', () => {
  it('has 5,000 seats in the planned zones', () => {
    const s = createSeatService()
    expect(s.totalSeats()).toBe(5000)
    const byZone: Record<string, number> = {}
    for (const sec of s.listSections()) byZone[sec.zone] = (byZone[sec.zone] ?? 0) + sec.total
    expect(byZone).toEqual({ vip: 300, 'easy-access': 300, ops: 100, general: 4300 })
  })
  it('matches the capacity maths', () => {
    const c = computeCapacity({ totalSeats: TOTAL_SEATS, graduates: GRADUATES, reserved: RESERVED })
    expect(c.pool).toBe(createSeatService().listSections().filter((x) => x.zone === 'general').reduce((a, x) => a + x.total, 0))
  })
  it('holds an available seat and refuses a seat held by someone else', () => {
    const s = createSeatService()
    expect(s.hold('G01-1-1', 'a', T).ok).toBe(true)
    const r = s.hold('G01-1-1', 'b', T)
    expect(r).toEqual({ ok: false, error: 'taken' })
  })
  it('limits a user to two seats', () => {
    const s = createSeatService()
    s.hold('G01-1-1', 'a', T)
    s.hold('G01-1-2', 'a', T)
    expect(s.hold('G01-1-3', 'a', T)).toEqual({ ok: false, error: 'limit' })
  })
  it('blocks vip, ops and (without need) easy-access seats', () => {
    const s = createSeatService()
    expect(s.hold('V1-1-1', 'a', T)).toEqual({ ok: false, error: 'blocked' })
    expect(s.hold('O1-1-1', 'a', T)).toEqual({ ok: false, error: 'blocked' })
    expect(s.hold('E1-1-1', 'a', T)).toEqual({ ok: false, error: 'blocked' })
    s.setNeedsEasyAccess('a', true)
    expect(s.hold('E1-1-1', 'a', T).ok).toBe(true)
  })
  it('returns not-found for unknown seats', () => {
    expect(createSeatService().hold('nope', 'a', T)).toEqual({ ok: false, error: 'not-found' })
  })
  it('expires a hold only when simulated time moves past it', () => {
    const s = createSeatService()
    s.hold('G01-1-1', 'a', T)
    s.expireHolds(T + HOLD_TTL_MS - 1)
    expect(s.getSeat('G01-1-1')?.status).toBe('held')
    s.expireHolds(T + HOLD_TTL_MS + 1)
    expect(s.getSeat('G01-1-1')?.status).toBe('available')
    expect(s.listUserSeats('a')).toHaveLength(0)
  })
  it('releases a hold that would not exist yet when time is scrubbed back before it', () => {
    const s = createSeatService()
    s.hold('G01-1-1', 'a', T)
    s.expireHolds(T - 60 * 60_000)
    expect(s.getSeat('G01-1-1')?.status).toBe('available')
    expect(s.listUserSeats('a')).toHaveLength(0)
    expect(s.hold('G01-1-1', 'b', T - 60 * 60_000).ok).toBe(true)
  })
  it('does not resurrect an expired hold when time goes back', () => {
    const s = createSeatService()
    s.hold('G01-1-1', 'a', T)
    s.expireHolds(T + HOLD_TTL_MS + 1)
    s.expireHolds(T)
    expect(s.getSeat('G01-1-1')?.status).toBe('available')
  })
  it('confirm after expiry fails with expired, and without a hold fails with no-hold', () => {
    const s = createSeatService()
    expect(s.confirm('a', T)).toEqual({ ok: false, error: 'no-hold' })
    s.hold('G01-1-1', 'a', T)
    expect(s.confirm('a', T + HOLD_TTL_MS + 1)).toEqual({ ok: false, error: 'expired' })
  })
  it('never confirms a seat twice and a confirmed seat cannot be held', () => {
    const s = createSeatService()
    s.hold('G01-1-1', 'a', T)
    const c = s.confirm('a', T + 1000)
    expect(c.ok).toBe(true)
    expect(s.hold('G01-1-1', 'b', T + 2000)).toEqual({ ok: false, error: 'taken' })
    expect(s.confirm('b', T + 3000)).toEqual({ ok: false, error: 'no-hold' })
    expect(s.getSeat('G01-1-1')?.confirmedBy).toBe('a')
  })
  it('a rival never takes a held or confirmed seat', () => {
    const s = createSeatService([{ id: 'G01', zone: 'general', rows: 1, perRow: 3 }])
    s.hold('G01-1-1', 'a', T)
    s.hold('G01-1-2', 'a', T)
    const r = s.simulateRival(T)
    expect(r?.seatId).toBe('G01-1-3')
    expect(s.simulateRival(T)).toBeNull()
    expect(s.getSeat('G01-1-1')?.heldBy).toBe('a')
  })
})

describe('seatService: rival and suggestions', () => {
  it('a targeted rival takes only a free general seat', () => {
    const s = createSeatService()
    expect(s.rivalTake('G01-1-1')).toBe(true)
    expect(s.rivalTake('G01-1-1')).toBe(false)
    expect(s.rivalTake('V1-1-1')).toBe(false)
    s.hold('G01-1-2', 'a', T)
    expect(s.rivalTake('G01-1-2')).toBe(false)
    expect(s.hold('G01-1-1', 'a', T)).toEqual({ ok: false, error: 'taken' })
  })
  it('suggests the nearest free seat the user may hold', () => {
    const s = createSeatService()
    s.rivalTake('G01-2-10')
    const g = s.suggest('G01-2-10', 'a')!
    expect(g.section).toBe('G01')
    expect(g.status).toBe('available')
    expect(Math.abs(g.number - 10) + Math.abs(g.row - 2) * 3).toBeLessThanOrEqual(1)
  })
  it('never suggests an easy-access seat unless the user needs one', () => {
    const s = createSeatService([{ id: 'E1', zone: 'easy-access', rows: 1, perRow: 3 }])
    expect(s.suggest('E1-1-1', 'a')).toBeNull()
    s.setNeedsEasyAccess('a', true)
    expect(s.suggest('E1-1-1', 'a')).not.toBeNull()
  })
})
