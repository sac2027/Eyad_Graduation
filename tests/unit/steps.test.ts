import { describe, expect, it } from 'vitest'
import { personalStatus, STEPS } from '@/features/steps/steps'
import { STAGE_ORDER } from '@/time/schedule'

const at = (iso: string) => Date.parse(`${iso}+03:00`)
const none = { confirmed: false, gownDone: false, hasSeat: false }

describe('steps', () => {
  it('has the nine steps in journey order, numbered 1 to 9', () => {
    expect(STEPS.map((s) => s.id)).toEqual(STAGE_ORDER)
    expect(STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
  it('links the steps that need action to their pages', () => {
    const to = Object.fromEntries(STEPS.map((s) => [s.id, s.to]))
    expect(to).toMatchObject({ candidacy: '/me', attire: '/me/attire', tickets: '/me/tickets' })
  })
})

describe('personalStatus', () => {
  it('is pending before the deadline and done once the task is complete', () => {
    expect(personalStatus('attire', none, at('2027-03-16T10:00:00'))).toBe('pending')
    expect(personalStatus('attire', { ...none, gownDone: true }, at('2027-03-16T10:00:00'))).toBe('done')
    expect(personalStatus('tickets', { ...none, hasSeat: true }, at('2027-03-16T10:00:00'))).toBe('done')
    expect(personalStatus('candidacy', { ...none, confirmed: true }, at('2027-02-01T10:00:00'))).toBe('done')
  })
  it('is late once the deadline has passed without the task', () => {
    expect(personalStatus('candidacy', none, at('2027-02-12T10:00:00'))).toBe('late')
  })
  it('has no status before a task opens', () => {
    expect(personalStatus('attire', none, at('2027-02-01T10:00:00'))).toBeNull()
  })
  it('marks information steps done once their time has passed, and nothing before', () => {
    expect(personalStatus('rehearsal', none, at('2027-04-06T10:00:00'))).toBe('done')
    expect(personalStatus('rehearsal', none, at('2027-03-16T10:00:00'))).toBeNull()
  })
})
