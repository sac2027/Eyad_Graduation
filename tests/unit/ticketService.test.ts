import { describe, expect, it } from 'vitest'
import { createTicketService } from '@/data/services/ticketService'
import { SCHEDULE } from '@/time/schedule'

const at = (iso: string) => Date.parse(`${iso}+03:00`)

describe('ticketService', () => {
  it('gives one guaranteed seat and an unclaimed second ticket', () => {
    expect(createTicketService().getEntitlement('u')).toEqual({ guaranteed: 1, second: 'unclaimed' })
  })
  it('claims the second ticket once only', () => {
    const t = createTicketService()
    const now = at('2027-03-15T10:00:00')
    expect(t.claimSecond('u', now)).toEqual({ ok: true, value: 'claimed' })
    expect(t.claimSecond('u', now)).toEqual({ ok: false, error: 'already-claimed' })
  })
  it('puts claims beyond the pool on the waitlist', () => {
    const t = createTicketService({ poolSize: 1 })
    const now = SCHEDULE.stages.tickets.due! - 1000 // simulated demand has filled the pool
    expect(t.remaining(now)).toBe(0)
    expect(t.claimSecond('u', now)).toEqual({ ok: true, value: 'waitlist' })
    expect(t.getEntitlement('u').second).toBe('waitlist')
  })
  it('is closed before opening, between the deadline and the release date, and after the final lock', () => {
    const t = createTicketService()
    expect(t.claimSecond('u', at('2027-03-13T10:00:00'))).toEqual({ ok: false, error: 'closed' })
    expect(t.claimSecond('u', at('2027-03-27T10:00:00'))).toEqual({ ok: false, error: 'closed' })
    expect(t.claimSecond('u', at('2027-04-02T10:00:00'))).toEqual({ ok: false, error: 'closed' })
  })
  it('re-opens claims at the 28 March release with seats returned to the pool', () => {
    const t = createTicketService()
    expect(t.remaining(at('2027-03-27T10:00:00'))).toBeGreaterThan(0)
    expect(t.claimsOpen(at('2027-03-28T10:00:00'))).toBe(true)
    expect(t.claimSecond('u', at('2027-03-28T10:00:00'))).toEqual({ ok: true, value: 'claimed' })
  })
  it('never reports a negative remaining count', () => {
    const t = createTicketService({ poolSize: 5 })
    expect(t.remaining(at('2027-04-10T00:00:00'))).toBeGreaterThanOrEqual(0)
  })
})
