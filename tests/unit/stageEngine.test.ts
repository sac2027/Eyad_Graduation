import { describe, expect, it } from 'vitest'
import { SCHEDULE } from '@/time/schedule'
import { getDayProgress, getJourneyProgress, getNextDeadline, getSlotProgress, getStageStatus } from '@/time/stageEngine'

const at = (iso: string) => Date.parse(iso)
const HOUR = 3_600_000

describe('getStageStatus', () => {
  it('is upcoming before a stage opens', () => {
    expect(getStageStatus('attire', at('2027-03-13T23:59:59+03:00'))).toBe('upcoming')
  })
  it('is open early in the window and due-soon within 72 hours of the deadline', () => {
    expect(getStageStatus('attire', at('2027-03-15T12:00:00+03:00'))).toBe('open')
    const due = SCHEDULE.stages.attire.due!
    expect(getStageStatus('attire', due - 1000)).toBe('due-soon')
    expect(getStageStatus('attire', due - 72 * HOUR - 1000)).toBe('open')
  })
  it('is closed after the deadline', () => {
    const due = SCHEDULE.stages.attire.due!
    expect(getStageStatus('attire', due + 1000)).toBe('closed')
  })
  it('uses closes when a stage has no due date', () => {
    expect(getStageStatus('rehearsal', at('2027-04-04T10:00:00+03:00'))).toBe('open')
    expect(getStageStatus('rehearsal', at('2027-04-06T00:00:01+03:00'))).toBe('closed')
  })
})

describe('getJourneyProgress', () => {
  it('is 0 before the first milestone and 1 at the last', () => {
    expect(getJourneyProgress(at('2026-11-05T09:00:00+03:00'))).toBe(0)
    expect(getJourneyProgress(SCHEDULE.milestones[8].at)).toBe(1)
    expect(getJourneyProgress(at('2027-05-01T00:00:00+03:00'))).toBe(1)
  })
  it('is i/8 at milestone i', () => {
    const m = SCHEDULE.milestones
    expect(getJourneyProgress(m[2].at)).toBeCloseTo(2 / 8, 6)
    expect(getJourneyProgress(m[5].at)).toBeCloseTo(5 / 8, 6)
  })
  it('never decreases as time moves forward (hourly samples)', () => {
    let prev = -1
    for (let t = at('2026-11-05T00:00:00+03:00'); t <= at('2027-04-30T00:00:00+03:00'); t += HOUR) {
      const p = getJourneyProgress(t)
      expect(p).toBeGreaterThanOrEqual(prev)
      prev = p
    }
  })
  it('is a pure function of time, so scrubbing backwards gives the same values', () => {
    const a = at('2027-03-20T10:00:00+03:00')
    const b = at('2027-04-02T10:00:00+03:00')
    const forward = [getJourneyProgress(a), getJourneyProgress(b)]
    const backward = [getJourneyProgress(b), getJourneyProgress(a)].reverse()
    expect(forward).toEqual(backward)
    expect(forward[0]).toBeLessThan(forward[1])
  })
  it('rests at the start when the ceremony date is TBC', () => {
    const tbc = { ...SCHEDULE, ceremonyDateStatus: 'tbc' as const }
    expect(getJourneyProgress(at('2027-03-20T10:00:00+03:00'), tbc)).toBe(0)
  })
})

describe('getDayProgress', () => {
  it('runs from 0 at 00:00 to 1 at 21:30 on ceremony day', () => {
    expect(getDayProgress(at('2027-04-07T00:00:00+03:00'))).toBe(0)
    expect(getDayProgress(at('2027-04-07T21:30:00+03:00'))).toBe(1)
    expect(getDayProgress(at('2027-04-08T10:00:00+03:00'))).toBe(1)
    expect(getDayProgress(at('2027-04-06T10:00:00+03:00'))).toBe(0)
  })
})

describe('getNextDeadline', () => {
  it('returns the earliest deadline still ahead', () => {
    const n = getNextDeadline(at('2027-03-20T10:00:00+03:00'))
    expect(n?.due).toBe(SCHEDULE.stages.attire.due)
  })
  it('returns null when none remain', () => {
    expect(getNextDeadline(at('2027-06-01T00:00:00+03:00'))).toBeNull()
  })
})

describe('getSlotProgress', () => {
  it('is null outside ceremony day', () => {
    expect(getSlotProgress(at('2027-04-06T12:00:00+03:00'))).toBeNull()
    expect(getSlotProgress(at('2027-04-07T21:30:00+03:00'))).toBeNull()
  })
  it('reports slot, index and fraction', () => {
    const r = getSlotProgress(at('2027-04-07T20:30:00+03:00'))!
    expect(r.slot).toBe('ceremony')
    expect(r.index).toBe(3)
    expect(r.p).toBeCloseTo(0.5, 6)
    expect(getSlotProgress(at('2027-04-07T15:00:00+03:00'))).toMatchObject({ slot: 'arrival', index: 1, p: 0 })
  })
})
