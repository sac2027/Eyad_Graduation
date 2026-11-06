import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useClock } from '@/time/clockStore'
import { useJourney } from '@/features/journey/useJourney'

const at = (iso: string) => Date.parse(`${iso}+03:00`)

afterEach(() => useClock.getState().useReal())

describe('useJourney', () => {
  it('follows the simulated clock and moves backwards cleanly', () => {
    const { result } = renderHook(() => useJourney())
    act(() => useClock.getState().setSimulated(at('2027-03-14T09:00:00')))
    const attire = result.current.progress
    expect(result.current.stageId).toBe('attire')
    act(() => useClock.getState().setSimulated(at('2027-04-06T09:00:00')))
    const later = result.current.progress
    expect(later).toBeGreaterThan(attire)
    expect(result.current.phase).toBe('honors-day')
    act(() => useClock.getState().setSimulated(at('2027-03-14T09:00:00')))
    expect(result.current.progress).toBeCloseTo(attire, 10)
  })
  it('reports the ceremony-day slot', () => {
    const { result } = renderHook(() => useJourney())
    act(() => useClock.getState().setSimulated(at('2027-04-07T20:20:00')))
    expect(result.current.phase).toBe('ceremony-day')
    expect(result.current.slot).toBe('ceremony')
  })
})
