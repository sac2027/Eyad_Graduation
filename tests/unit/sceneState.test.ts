import { describe, expect, it } from 'vitest'
import { sceneState } from '@/features/stadium/sceneState'
import { countdownParts } from '@/features/stadium/countdown'
import { SCHEDULE } from '@/time/schedule'

const at = (iso: string) => Date.parse(`${iso}+03:00`)

describe('sceneState', () => {
  it('waits at the gate in the dark before launch', () => {
    expect(sceneState(at('2026-11-06T09:00:00'))).toMatchObject({ figure: 'gate', lampsLit: 0, beams: false, stageGlow: 0 })
  })
  it('lights a lamp for every checkpoint reached during the journey', () => {
    expect(sceneState(at('2027-03-16T10:00:00'))).toMatchObject({ figure: 'path', lampsLit: 3, flags: false })
  })
  it('adds flags in the final week and gold accents on honors day', () => {
    expect(sceneState(at('2027-04-02T10:00:00'))).toMatchObject({ flags: true, stageGlow: 1 })
    expect(sceneState(at('2027-04-06T19:30:00')).goldAccents).toBe(true)
  })
  it('follows ceremony day: crowd at arrival, chairs filled when seated, beams from the afternoon', () => {
    expect(sceneState(at('2027-04-07T09:00:00')).beams).toBe(false)
    expect(sceneState(at('2027-04-07T16:00:00'))).toMatchObject({ crowd: 1, beams: true, chairsFilled: false })
    expect(sceneState(at('2027-04-07T19:00:00'))).toMatchObject({ crowd: 2, chairsFilled: true })
  })
  it('puts the graduate on stage from 20:00 and in his hands the certificate from 21:30', () => {
    expect(sceneState(at('2027-04-07T20:20:00'))).toMatchObject({ figure: 'stage', stageGlow: 3 })
    expect(sceneState(at('2027-04-07T21:30:00'))).toMatchObject({ figure: 'holding', stageGlow: 3, beams: true })
    expect(sceneState(at('2027-04-20T10:00:00')).figure).toBe('holding')
  })
})

describe('countdownParts', () => {
  it('splits the time left into days, hours, minutes and seconds', () => {
    const target = SCHEDULE.afterglowStart
    expect(countdownParts(target - 90_061_000, target)).toEqual({ days: 1, h: 1, m: 1, s: 1, done: false })
    expect(countdownParts(target, target).done).toBe(true)
    expect(countdownParts(target + 5000, target)).toEqual({ days: 0, h: 0, m: 0, s: 0, done: true })
  })
})
