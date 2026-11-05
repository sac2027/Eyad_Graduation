import { describe, expect, it } from 'vitest'
import { createGownService } from '@/data/services/gownService'

const at = (iso: string) => Date.parse(`${iso}+03:00`)
const open = at('2027-03-20T10:00:00')

describe('gownService', () => {
  it('moves forward only', () => {
    const g = createGownService()
    expect(g.markPickedUp('u')).toEqual({ ok: false, error: 'out-of-order' })
    expect(g.requestSize('u', '56', 'm', open).ok).toBe(true)
    expect(g.markPickedUp('u')).toEqual({ ok: false, error: 'out-of-order' })
    const slot = g.slots[0]
    expect(g.bookPickup('u', slot.id, at('2027-03-28T08:00:00')).ok).toBe(true)
    expect(g.markReturned('u')).toEqual({ ok: false, error: 'out-of-order' })
    expect(g.markPickedUp('u').ok).toBe(true)
    expect(g.markReturned('u').ok).toBe(true)
    expect(g.get('u').status).toBe('returned')
  })
  it('refuses sizes after the deadline and invalid sizes', () => {
    const g = createGownService()
    expect(g.requestSize('u', '56', 'm', at('2027-03-26T00:00:01')).ok).toBe(false)
    expect(g.requestSize('u', '99', 'm', open)).toEqual({ ok: false, error: 'invalid-size' })
    expect(g.requestSize('u', '62', 'f', open)).toEqual({ ok: false, error: 'invalid-size' })
  })
  it('lets a graduate change size before booking, not after', () => {
    const g = createGownService()
    g.requestSize('u', '56', 'm', open)
    expect(g.requestSize('u', '58', 'm', open).ok).toBe(true)
    g.bookPickup('u', g.slots[0].id, at('2027-03-28T08:00:00'))
    expect(g.requestSize('u', '60', 'm', open)).toEqual({ ok: false, error: 'out-of-order' })
  })
  it('respects slot capacity', () => {
    // Mock demand already holds one of the two places in the first slot.
    const g = createGownService({ slotCapacity: 2 })
    g.requestSize('a', '56', 'm', open)
    g.requestSize('b', '56', 'm', open)
    const id = g.slots[0].id
    expect(g.bookPickup('a', id, at('2027-03-28T08:00:00')).ok).toBe(true)
    expect(g.bookPickup('b', id, at('2027-03-28T08:00:00'))).toEqual({ ok: false, error: 'full' })
  })
  it('refuses a pickup slot that has already started', () => {
    const g = createGownService()
    g.requestSize('u', '56', 'm', open)
    const slot = g.slots[3]
    expect(g.bookPickup('u', slot.id, slot.start)).toEqual({ ok: false, error: 'past' })
    expect(g.bookPickup('u', slot.id, slot.start - 1).ok).toBe(true)
  })
  it('reset clears every record', () => {
    const g = createGownService()
    g.requestSize('u', '56', 'm', open)
    g.reset()
    expect(g.get('u').status).toBe('none')
  })
})
