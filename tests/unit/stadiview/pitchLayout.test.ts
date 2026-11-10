import { describe, expect, it } from 'vitest'
import { VENUE } from '@/features/stadiview/config/venue'
import { blockZ, buildPitch, rowX } from '@/features/stadiview/layout/pitchLayout'

const p = buildPitch()

/** Seats per row number among the seats that pass the filter. */
const rowSizes = (q: ReturnType<typeof buildPitch>, pred: (i: number) => boolean) => {
  const m = new Map<number, number>()
  for (let i = 0; i < q.count; i++) if (pred(i)) m.set(q.row[i], (m.get(q.row[i]) ?? 0) + 1)
  return m
}

describe('pitch layout at the baseline numbers', () => {
  it('has exactly 2,986 pitch seats and 12 bays', () => {
    expect(p.count).toBe(2986)
    expect(p.rows).toBe(45)
    expect(p.bays.block.length).toBe(12)
    expect(p.bays.position[0]).toBe(-31.5)
  })

  it('sizes every array to the seat count', () => {
    expect(p.position.length).toBe(p.count * 3)
    for (const a of [p.block, p.row, p.number, p.zone, p.lineup]) expect(a.length).toBe(p.count)
    expect(p.bays.position.length).toBe(p.bays.block.length * 3)
  })

  it('gives every zone exactly its head count, in line-up order', () => {
    expect(p.zones).toHaveLength(24)
    expect(p.zones.map((z) => z.count)).toEqual(VENUE.zones.map((z) => z.count))
    expect(p.zones.filter((z) => z.gender === 'f').reduce((a, z) => a + z.count, 0)).toBe(629)
    expect(p.zones.filter((z) => z.gender === 'm').reduce((a, z) => a + z.count, 0)).toBe(2357)
    p.zones.forEach((z, i) => {
      for (let k = z.start; k < z.start + z.count; k++) expect(p.zone[k]).toBe(i)
    })
  })

  it('runs the zones end to end with no gap and no overlap', () => {
    let next = 0
    for (const z of p.zones) {
      expect(z.start).toBe(next)
      next += z.count
    }
    expect(next).toBe(p.count)
  })

  it('carries each zone over from the config and sends women to gate 5 and men to gate 2', () => {
    p.zones.forEach((z, i) => {
      const c = VENUE.zones[i]
      expect({ id: z.id, gender: z.gender, college: z.college, degree: z.degree }).toEqual({ id: c.id, gender: c.gender, college: c.college, degree: c.degree })
      expect(z.gate).toBe(z.gender === 'f' ? 5 : 2)
    })
  })

  it('puts bachelors in front of postgraduates in block 1 and inside every male college', () => {
    expect(p.zones.slice(0, 6).every((z) => z.gender === 'f' && z.degree === 'B')).toBe(true)
    expect(p.zones.slice(6, 12).every((z) => z.gender === 'f' && z.degree === 'G')).toBe(true)
    expect(p.zones.slice(12).map((z) => `${z.college}-${z.degree}`)).toEqual(['CEP-B', 'CEP-G', 'CCM-B', 'CCM-G', 'KBS-B', 'KBS-G', 'CDBE-B', 'CDBE-G', 'CMM-B', 'CMM-G', 'CPEG-B', 'CPEG-G'])
  })

  it('puts females in block 1 and males in blocks 2 to 6', () => {
    for (let i = 0; i < p.count; i++) expect(p.block[i] === 1).toBe(p.zones[p.zone[i]].gender === 'f')
  })

  it('lays block 1 out in 45 rows with 13 seats in the last, and the male rows in 34 with 47 in the last', () => {
    const f = rowSizes(p, (i) => p.block[i] === 1)
    expect(f.size).toBe(45)
    expect(f.get(45)).toBe(13)
    const m = rowSizes(p, (i) => p.block[i] !== 1)
    expect(m.size).toBe(34)
    expect(m.get(34)).toBe(47)
  })

  it('fills every row but the last completely: 14 across block 1, 70 across the male blocks', () => {
    const f = rowSizes(p, (i) => p.block[i] === 1)
    for (let r = 1; r < 45; r++) expect(f.get(r)).toBe(14)
    const m = rowSizes(p, (i) => p.block[i] !== 1)
    for (let r = 1; r < 34; r++) expect(m.get(r)).toBe(70)
  })

  it('ends the male line-up with blocks 2 to 4 full and 5 seats in block 5', () => {
    const last = new Map<number, number>()
    for (let i = 0; i < p.count; i++) if (p.block[i] !== 1 && p.row[i] === 34) last.set(p.block[i], (last.get(p.block[i]) ?? 0) + 1)
    expect([...last.entries()].sort((a, b) => a[0] - b[0])).toEqual([[2, 14], [3, 14], [4, 14], [5, 5]])
  })

  it('keeps every seat inside the pitch, row 1 at x = -30', () => {
    for (let i = 0; i < p.count; i++) {
      const x = p.position[i * 3]
      const z = p.position[i * 3 + 2]
      expect(Math.abs(x)).toBeLessThanOrEqual(52.5)
      expect(Math.abs(z)).toBeLessThanOrEqual(34)
    }
    expect(rowX(1)).toBe(-30)
    expect(rowX(16)).toBe(-13)
    expect(rowX(45)).toBe(18)
    expect(blockZ(1, 1)).toBeCloseTo(-30.9, 6)
    expect(blockZ(6, 14)).toBeCloseTo(30.9, 6)
  })

  it('opens a cross aisle after rows 15 and 30 and nowhere else', () => {
    expect(rowX(15)).toBe(-16)
    expect(rowX(30)).toBe(1)
    expect(rowX(31)).toBe(4)
    for (let r = 2; r <= 45; r++) expect(rowX(r) - rowX(r - 1)).toBe(r === 16 || r === 31 ? 3 : 1)
    expect(rowX(34)).toBe(7)   // the men's back row
  })

  it('spaces the blocks 10.8 apart with seat 1 on the north side', () => {
    for (let b = 1; b <= 6; b++) {
      expect(blockZ(b, 1)).toBeCloseTo(-31.2 + (b - 1) * 10.8 + 0.3, 6)
      expect(blockZ(b, 14) - blockZ(b, 1)).toBeCloseTo(13 * 0.6, 6)
    }
    // The aisle between two blocks is the 2.4 between the edges of their facing seats.
    expect(blockZ(2, 1) - blockZ(1, 14) - 0.6).toBeCloseTo(2.4, 6)
  })

  it('puts every seat on the grass at the centre given by its block, row and seat number', () => {
    for (let i = 0; i < p.count; i++) {
      expect(p.position[i * 3]).toBeCloseTo(rowX(p.row[i]), 4)
      expect(p.position[i * 3 + 1]).toBe(0)
      expect(p.position[i * 3 + 2]).toBeCloseTo(blockZ(p.block[i], p.number[i]), 4)
      expect(p.number[i]).toBeGreaterThanOrEqual(1)
      expect(p.number[i]).toBeLessThanOrEqual(14)
    }
  })

  it('never uses a block, row and seat number twice', () => {
    const seen = new Set<number>()
    for (let i = 0; i < p.count; i++) seen.add((p.block[i] * 100 + p.row[i]) * 100 + p.number[i])
    expect(seen.size).toBe(p.count)
  })

  it('keeps every two seats at least a seat pitch apart', () => {
    let closest = Infinity
    for (let i = 0; i < p.count; i++) {
      for (let j = i + 1; j < p.count; j++) {
        const d = Math.hypot(p.position[i * 3] - p.position[j * 3], p.position[i * 3 + 2] - p.position[j * 3 + 2])
        if (d < closest) closest = d
      }
    }
    expect(closest).toBeGreaterThan(0.6 - 1e-4)
  })

  it('fills in procession order: block 1 row by row, then each male row across blocks 2 to 6', () => {
    const at = (i: number) => [p.block[i], p.row[i], p.number[i]]
    expect(at(0)).toEqual([1, 1, 1])
    expect(at(13)).toEqual([1, 1, 14])
    expect(at(14)).toEqual([1, 2, 1])
    expect(at(628)).toEqual([1, 45, 13])
    expect(at(629)).toEqual([2, 1, 1])
    expect(at(629 + 13)).toEqual([2, 1, 14])
    expect(at(629 + 14)).toEqual([3, 1, 1])
    expect(at(629 + 69)).toEqual([6, 1, 14])
    expect(at(629 + 70)).toEqual([2, 2, 1])
    expect(at(2985)).toEqual([5, 34, 5])
  })

  it('numbers the line-up from 1 inside each zone', () => {
    for (const z of p.zones) {
      expect(p.lineup[z.start]).toBe(1)
      expect(p.lineup[z.start + z.count - 1]).toBe(z.count)
    }
  })

  it('counts the line-up up by one seat at a time', () => {
    for (const z of p.zones) for (let k = 0; k < z.count; k++) expect(p.lineup[z.start + k]).toBe(k + 1)
  })

  it('places two bays per block in front of row 1, at the outer seats, north one first', () => {
    for (let b = 1; b <= 6; b++) {
      for (const [k, seat] of [[0, 1], [1, 14]] as const) {
        const j = (b - 1) * 2 + k
        expect(p.bays.block[j]).toBe(b)
        expect(p.bays.position[j * 3]).toBe(-31.5)
        expect(p.bays.position[j * 3 + 1]).toBe(0)
        expect(p.bays.position[j * 3 + 2]).toBeCloseTo(blockZ(b, seat), 4)
      }
    }
  })
})

describe('pitch layout follows the config', () => {
  it('lets the female order be flipped by reordering the zone list', () => {
    const cfg = structuredClone(VENUE)
    cfg.zones = [...cfg.zones.slice(6, 12), ...cfg.zones.slice(0, 6), ...cfg.zones.slice(12)]
    const q = buildPitch(cfg)
    expect(q.count).toBe(2986)
    expect(q.zones[0].degree).toBe('G')
    expect(q.block[0]).toBe(1)
  })

  it('keeps the same seats when the female order is flipped; only who sits where changes', () => {
    const cfg = structuredClone(VENUE)
    cfg.zones = [...cfg.zones.slice(6, 12), ...cfg.zones.slice(0, 6), ...cfg.zones.slice(12)]
    const q = buildPitch(cfg)
    expect(q.position).toEqual(p.position)
    expect(q.block).toEqual(p.block)
    expect(q.row).toEqual(p.row)
    expect(q.number).toEqual(p.number)
    expect(q.zones.slice(0, 6).every((z) => z.gender === 'f' && z.degree === 'G')).toBe(true)
    expect(q.zones[6].start).toBe(344)
    // The men are untouched.
    expect(q.zones.slice(12)).toEqual(p.zones.slice(12))
  })

  it('grows by exactly the seats added to one zone', () => {
    const cfg = structuredClone(VENUE)
    cfg.zones[0].count += 5
    const q = buildPitch(cfg)
    expect(q.count).toBe(2991)
    expect(q.rows).toBe(46)                       // 634 women need a 46th row
    expect(q.zones[0].count).toBe(VENUE.zones[0].count + 5)
    expect(q.zones[1].start).toBe(p.zones[1].start + 5)
    expect(rowSizes(q, (i) => q.block[i] === 1).get(46)).toBe(4)
    expect(rowSizes(q, (i) => q.block[i] !== 1).size).toBe(34)   // the men do not move
  })

  it('reports the largest row number of any block, also when the men have more rows', () => {
    const cfg = structuredClone(VENUE)
    cfg.zones = cfg.zones.filter((z) => z.gender === 'm' || z.degree === 'B')
    const q = buildPitch(cfg)
    expect(q.count).toBe(285 + 2357)
    expect(q.rows).toBe(34)
  })

  it('keeps each gender in its own blocks even when the zone list mixes them', () => {
    const cfg = structuredClone(VENUE)
    cfg.zones = [cfg.zones[12], cfg.zones[0], cfg.zones[13], cfg.zones[1]]
    const q = buildPitch(cfg)
    expect(q.zones.map((z) => z.start)).toEqual([0, 342, 443, 715])
    for (let i = 0; i < q.count; i++) expect(q.block[i] === 1).toBe(q.zones[q.zone[i]].gender === 'f')
    // The second male zone carries on from the seat after the first one's last.
    const lastOfFirst = 341
    const firstOfSecond = q.zones[2].start
    expect([q.block[lastOfFirst], q.row[lastOfFirst], q.number[lastOfFirst]]).toEqual([6, 5, 6])
    expect([q.block[firstOfSecond], q.row[firstOfSecond], q.number[firstOfSecond]]).toEqual([6, 5, 7])
  })

  it('accepts an empty zone', () => {
    const cfg = structuredClone(VENUE)
    cfg.zones[5].count = 0   // the three female design bachelors
    const q = buildPitch(cfg)
    expect(q.count).toBe(2983)
    expect(q.zones[5]).toMatchObject({ count: 0, start: q.zones[6].start })
    expect(q.lineup[q.zones[6].start]).toBe(1)
  })

  it('reads the row and block spacing from the config', () => {
    const cfg = structuredClone(VENUE)
    cfg.blocks.row1X = -28
    cfg.blocks.rowPitch = 1.2
    cfg.blocks.crossAisleEvery = 10
    cfg.blocks.crossAisle = 3
    cfg.blocks.aisle = 3
    cfg.blocks.seatPitch = 0.5
    expect(rowX(1, cfg)).toBe(-28)
    expect(rowX(10, cfg)).toBeCloseTo(-28 + 9 * 1.2, 9)
    expect(rowX(11, cfg)).toBeCloseTo(-28 + 10 * 1.2 + 3, 9)
    // Six blocks of 7.0 and five aisles of 3.0 are 57 wide, centred on the pitch.
    expect(blockZ(1, 1, cfg)).toBeCloseTo(-28.5 + 0.25, 9)
    expect(blockZ(6, 14, cfg)).toBeCloseTo(28.5 - 0.25, 9)
    const q = buildPitch(cfg)
    expect(q.position[0]).toBe(-28)
    expect(q.bays.position[0]).toBe(-29.5)
  })

  it('moves the bays with their setback from row 1', () => {
    const cfg = structuredClone(VENUE)
    cfg.bays.setback = 2
    expect(buildPitch(cfg).bays.position[0]).toBe(-32)
  })

  it('follows the block-to-gender list: two female blocks share each female row', () => {
    const cfg = structuredClone(VENUE)
    cfg.blocks.genders = ['f', 'f', 'm', 'm', 'm', 'm']
    const q = buildPitch(cfg)
    expect(q.count).toBe(2986)
    for (let i = 0; i < q.count; i++) expect(q.block[i] <= 2).toBe(q.zones[q.zone[i]].gender === 'f')
    expect([q.block[14], q.row[14], q.number[14]]).toEqual([2, 1, 1])
    expect([q.block[28], q.row[28], q.number[28]]).toEqual([1, 2, 1])
    expect(q.bays.block.length).toBe(12)
  })

  it('refuses a zone whose gender has no block, rather than seating it nowhere', () => {
    const cfg = structuredClone(VENUE)
    cfg.blocks.genders = ['m', 'm', 'm', 'm', 'm', 'm']
    expect(() => buildPitch(cfg)).toThrow(/F-CCM-B/)
  })

  it('builds from the config it is given and leaves it unchanged', () => {
    const cfg = structuredClone(VENUE)
    const q = buildPitch(cfg)
    expect(cfg).toEqual(VENUE)
    expect(q.position).toEqual(p.position)
    expect(q.zones).toEqual(p.zones)
  })
})
