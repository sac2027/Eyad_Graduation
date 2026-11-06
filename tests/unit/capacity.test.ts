import { describe, expect, it } from 'vitest'
import { computeCapacity } from '@/domain/capacity'

describe('computeCapacity', () => {
  it('matches the planned 5,000-seat stadium with 3,000 graduates', () => {
    const c = computeCapacity({ totalSeats: 5000, graduates: 3000, reserved: { vip: 300, easyAccess: 300, ops: 100 } })
    expect(c.pool).toBe(4300)
    expect(c.guaranteed).toBe(3000)
    expect(c.secondPool).toBe(1300)
    expect(c.perGraduate).toBeCloseTo(1.4333, 3)
    expect(c.breakEvenTakeUp).toBeCloseTo(0.4333, 3)
  })
  it('caps guaranteed seats at the pool when graduates outnumber seats', () => {
    const c = computeCapacity({ totalSeats: 5000, graduates: 6000, reserved: { vip: 300, easyAccess: 300, ops: 100 } })
    expect(c.guaranteed).toBe(4300)
    expect(c.secondPool).toBe(0)
  })
  it('handles zero graduates', () => {
    const c = computeCapacity({ totalSeats: 100, graduates: 0, reserved: { vip: 0, easyAccess: 0, ops: 0 } })
    expect(c.perGraduate).toBe(0)
    expect(c.breakEvenTakeUp).toBe(0)
  })
})
