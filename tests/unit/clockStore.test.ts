import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getNow, useClock } from '@/time/clockStore'

const T0 = Date.parse('2027-03-14T09:00:00+03:00')

describe('clockStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-11-05T09:00:00+03:00'))
    useClock.getState().useReal()
  })
  afterEach(() => {
    useClock.getState().pause()
    useClock.getState().useReal()
    vi.useRealTimers()
  })

  it('follows the real clock in real mode', () => {
    expect(getNow()).toBe(Date.now())
    vi.advanceTimersByTime(5000)
    expect(getNow()).toBe(Date.now())
  })

  it('setSimulated freezes the clock at the chosen time', () => {
    useClock.getState().setSimulated(T0)
    expect(useClock.getState().mode).toBe('frozen')
    vi.advanceTimersByTime(10_000)
    expect(getNow()).toBe(T0)
  })

  it('play advances simulated time at the chosen speed and pause stops it', () => {
    useClock.getState().setSimulated(T0)
    useClock.getState().play(86_400_000)
    vi.advanceTimersByTime(1000)
    expect(getNow() - T0).toBeGreaterThanOrEqual(86_400_000 * 0.75)
    expect(getNow() - T0).toBeLessThanOrEqual(86_400_000 * 1.25)
    useClock.getState().pause()
    const frozenAt = getNow()
    vi.advanceTimersByTime(5000)
    expect(getNow()).toBe(frozenAt)
    expect(useClock.getState().mode).toBe('frozen')
  })

  it('useReal goes back to the real clock', () => {
    useClock.getState().setSimulated(T0)
    useClock.getState().useReal()
    expect(useClock.getState().mode).toBe('real')
    expect(getNow()).toBe(Date.now())
  })
})
