import { describe, expect, it } from 'vitest'
import { SCHEDULE, STAGE_ORDER } from '@/time/schedule'
import { checkpointStates, currentCheckpoint, pathProgress } from '@/time/pathEngine'

const at = (iso: string) => Date.parse(`${iso}+03:00`)

describe('pathEngine', () => {
  it('has nine checkpoints with arrival between rehearsal and ceremony', () => {
    expect(STAGE_ORDER).toEqual(['candidacy', 'information', 'attire', 'tickets', 'rehearsal', 'arrival', 'ceremony', 'celebration', 'certificate'])
    expect(SCHEDULE.milestones.map((m) => m.id)).toEqual(STAGE_ORDER)
  })
  it('places checkpoint i at i/8', () => {
    SCHEDULE.milestones.forEach((m, i) => expect(pathProgress(m.at)).toBeCloseTo(i / 8, 6))
  })
  it('is 0 before launch and 1 from 21:30 on ceremony night', () => {
    expect(pathProgress(at('2026-11-06T09:00:00'))).toBe(0)
    expect(pathProgress(at('2027-04-07T21:30:00'))).toBe(1)
    expect(pathProgress(at('2027-05-01T00:00:00'))).toBe(1)
  })
  it('puts arrival at 15:00 and the march at 20:00 on ceremony day', () => {
    expect(pathProgress(at('2027-04-07T15:00:00'))).toBeCloseTo(5 / 8, 6)
    expect(pathProgress(at('2027-04-07T20:00:00'))).toBeCloseTo(6 / 8, 6)
  })
  it('marks passed, current, next and future', () => {
    const s = checkpointStates(at('2027-03-16T10:00:00'))
    expect([s.candidacy, s.information, s.attire, s.tickets, s.rehearsal]).toEqual(['passed', 'passed', 'current', 'next', 'future'])
    expect(currentCheckpoint(at('2027-03-16T10:00:00'))).toBe('attire')
  })
  it('has no current checkpoint before launch: candidacy is next', () => {
    const s = checkpointStates(at('2026-11-06T09:00:00'))
    expect(s.candidacy).toBe('next')
    expect(s.information).toBe('future')
  })
  it('passes everything except the certificate, which is current, from 21:30', () => {
    const s = checkpointStates(at('2027-04-08T10:00:00'))
    expect(s.celebration).toBe('passed')
    expect(s.certificate).toBe('current')
  })
  it('marks a step late only when the caller says so and it is not current', () => {
    const now = at('2027-03-16T10:00:00')
    expect(checkpointStates(now, { late: { candidacy: true } }).candidacy).toBe('late')
    expect(checkpointStates(now, { late: { attire: true } }).attire).toBe('current')
  })
  it('rests at the gate while the date is TBC', () => {
    expect(pathProgress(at('2027-03-16T10:00:00'), { ...SCHEDULE, ceremonyDateStatus: 'tbc' })).toBe(0)
  })
})
