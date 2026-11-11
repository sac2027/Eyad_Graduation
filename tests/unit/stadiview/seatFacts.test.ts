import { describe, expect, it } from 'vitest'
import { seatFacts } from '@/features/stadiview/hud/seatFacts'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

const v = getVenue()
const facts = (id: string) => seatFacts(v.indexOf(id), v)

describe('seat facts', () => {
  it('measures the way to the podium and how far off its centre line the seat is', () => {
    // Block 3's last seat is 1.5 m north of the centre line, 12 m in front of the podium.
    const front = facts('P3-01-14')
    expect(front.toStage).toBeCloseTo(Math.hypot(12, 1.5), 3)
    expect(front.stageAngle).toBeCloseTo(7.1, 1)
    expect(front.side).toBe('right')
    // The same seat of block 4 mirrors it on the other side.
    const mirror = facts('P4-01-01')
    expect(mirror.toStage).toBeCloseTo(front.toStage, 3)
    expect(mirror.side).toBe('left')
    // A corner of the women's block is far off to the side.
    const corner = facts('P1-01-01')
    expect(corner.stageAngle).toBeGreaterThan(60)
    expect(corner.side).toBe('right')
    // Far back on the centre line counts as straight ahead.
    expect(facts('P3-34-14').side).toBe('centre')
    expect(facts('P3-34-14').toStage).toBeGreaterThan(48)
  })

  it('names the gate: 5 for the women\'s block, 2 for the men\'s, and each stand\'s own', () => {
    expect(facts('P1-10-07').gate).toBe(5)
    expect(facts('P4-10-07').gate).toBe(2)
    expect(facts('P2-A1').gate).toBe(2)
    expect(facts('S-10-060').gate).toBe(1)
    expect(facts('VIP-03-025').gate).toBe(4)
    expect(facts('ACC-02-020').gate).toBe(3)
    expect(facts('NE-08-015').gate).toBe(2)
  })

  it('measures the way to the nearest walkway', () => {
    // 14 seats of 0.6 m: an end seat is 0.3 m from the aisle, a middle one 3.9 m.
    expect(facts('P3-12-01').toAisle).toBeCloseTo(0.3, 6)
    expect(facts('P3-12-14').toAisle).toBeCloseTo(0.3, 6)
    expect(facts('P3-12-07').toAisle).toBeCloseTo(3.9, 6)
    expect(facts('P3-12-08').toAisle).toBeCloseTo(3.9, 6)
    expect(facts('P2-A1').toAisle).toBe(0)
    // In a stand, the end of the row: 120 seats of 0.6 m.
    expect(facts('S-10-001').toAisle).toBeCloseTo(0.3, 6)
    expect(facts('S-10-060').toAisle).toBeCloseTo(35.7, 4)
    expect(facts('E-06-001').toAisle).toBeLessThan(0.5)
  })

  it('finds a clear line to the speaker from the pitch and the open stands', () => {
    for (const id of ['P3-12-07', 'P1-01-01', 'P6-33-14', 'S-10-060', 'S-20-120', 'E-06-075', 'ACC-02-020', 'VIP-03-025']) {
      expect(facts(id).clearView, id).toBe(true)
    }
  })

  it('answers for every seat without a NaN', () => {
    for (let i = 0; i < v.count; i += 13) {
      const f = seatFacts(i, v)
      expect(Number.isFinite(f.toStage) && Number.isFinite(f.stageAngle) && Number.isFinite(f.toAisle)).toBe(true)
      expect(f.toAisle).toBeGreaterThanOrEqual(0)
    }
  })
})
