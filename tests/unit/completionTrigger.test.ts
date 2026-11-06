import { describe, expect, it } from 'vitest'
import { daysSinceCeremony, shouldPlayCompletion } from '@/features/journey/completion'
import { SCHEDULE } from '@/time/schedule'

const at = (iso: string) => Date.parse(`${iso}+03:00`)

describe('shouldPlayCompletion', () => {
  it('is true when time moves forward across the end of the ceremony', () => {
    expect(shouldPlayCompletion(at('2027-04-07T21:00:00'), at('2027-04-07T21:31:00'))).toBe(true)
    expect(shouldPlayCompletion(at('2027-03-01T10:00:00'), at('2027-04-09T10:00:00'))).toBe(true)
    expect(shouldPlayCompletion(at('2027-04-07T21:29:59'), SCHEDULE.afterglowStart)).toBe(true)
  })
  it('is false when both times are on the same side', () => {
    expect(shouldPlayCompletion(at('2027-04-07T21:31:00'), at('2027-04-09T10:00:00'))).toBe(false)
    expect(shouldPlayCompletion(at('2027-04-07T10:00:00'), at('2027-04-07T11:00:00'))).toBe(false)
    expect(shouldPlayCompletion(at('2027-04-09T10:00:00'), at('2027-04-09T10:00:00'))).toBe(false)
  })
  it('is false when scrubbing backwards', () => {
    expect(shouldPlayCompletion(at('2027-04-09T10:00:00'), at('2027-04-07T21:00:00'))).toBe(false)
  })
  it('plays exactly once when a time-lapse steps across the boundary in several ticks', () => {
    let plays = 0
    let prev = at('2027-04-07T19:00:00')
    for (let t = prev; t <= at('2027-04-07T23:00:00'); t += 3_600_000 / 4) {
      if (shouldPlayCompletion(prev, t)) plays++
      prev = t
    }
    expect(plays).toBe(1)
  })
})

describe('daysSinceCeremony', () => {
  it('counts calendar days from ceremony day', () => {
    expect(daysSinceCeremony(at('2027-04-07T22:00:00'))).toBe(0)
    expect(daysSinceCeremony(at('2027-04-08T00:00:00'))).toBe(1)
    expect(daysSinceCeremony(at('2027-04-09T10:00:00'))).toBe(2)
    expect(daysSinceCeremony(at('2027-04-01T10:00:00'))).toBe(0)
  })
})

