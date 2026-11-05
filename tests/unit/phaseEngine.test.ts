import { describe, expect, it } from 'vitest'
import { getPhase } from '@/time/phaseEngine'

const at = (iso: string) => Date.parse(iso)

describe('getPhase', () => {
  const cases: [string, string, string | undefined][] = [
    ['2026-11-05T09:00:00+03:00', 'pre-launch', undefined],
    ['2027-01-30T23:59:59+03:00', 'pre-launch', undefined],
    ['2027-01-31T00:00:00+03:00', 'journey', undefined],
    ['2027-03-30T23:59:59+03:00', 'journey', undefined],
    ['2027-03-31T00:00:00+03:00', 'final-week', undefined],
    ['2027-04-05T23:59:59+03:00', 'final-week', undefined],
    ['2027-04-06T00:00:00+03:00', 'honors-day', undefined],
    ['2027-04-06T23:59:59+03:00', 'honors-day', undefined],
    ['2027-04-07T00:00:00+03:00', 'ceremony-day', 'morning'],
    ['2027-04-07T14:59:59+03:00', 'ceremony-day', 'morning'],
    ['2027-04-07T15:00:00+03:00', 'ceremony-day', 'arrival'],
    ['2027-04-07T18:45:00+03:00', 'ceremony-day', 'seated'],
    ['2027-04-07T20:00:00+03:00', 'ceremony-day', 'ceremony'],
    ['2027-04-07T21:00:00+03:00', 'ceremony-day', 'photos'],
    ['2027-04-07T21:29:59+03:00', 'ceremony-day', 'photos'],
    ['2027-04-07T21:30:00+03:00', 'afterglow', undefined],
    ['2027-04-20T12:00:00+03:00', 'afterglow', undefined],
  ]
  it.each(cases)('%s -> %s %s', (iso, phase, slot) => {
    const r = getPhase(at(iso))
    expect(r.phase).toBe(phase)
    expect(r.slot).toBe(slot)
  })
})
