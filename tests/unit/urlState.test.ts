import { describe, expect, it } from 'vitest'
import { formatTimeParam, parseTimeParam } from '@/time/urlState'

describe('time URL param', () => {
  it('parses a minute-precision Riyadh time', () => {
    expect(parseTimeParam('?t=2027-04-07T18:30')).toBe(Date.parse('2027-04-07T18:30:00+03:00'))
  })
  it('parses date-only and seconds forms', () => {
    expect(parseTimeParam('?t=2027-04-07')).toBe(Date.parse('2027-04-07T00:00:00+03:00'))
    expect(parseTimeParam('?t=2027-04-07T18:30:15')).toBe(Date.parse('2027-04-07T18:30:15+03:00'))
  })
  it('returns null for missing or invalid values', () => {
    expect(parseTimeParam('')).toBeNull()
    expect(parseTimeParam('?t=banana')).toBeNull()
    expect(parseTimeParam('?t=2027-13-45')).toBeNull()
  })
  it('round-trips', () => {
    const ms = Date.parse('2027-04-07T20:00:00+03:00')
    expect(formatTimeParam(ms)).toBe('2027-04-07T20:00')
    expect(parseTimeParam(`?t=${formatTimeParam(ms)}`)).toBe(ms)
    const withSeconds = Date.parse('2027-04-07T20:00:09+03:00')
    expect(parseTimeParam(`?t=${formatTimeParam(withSeconds)}`)).toBe(withSeconds)
  })
})
