import { describe, expect, it } from 'vitest'
import { VENUE } from '@/features/stadiview/config/venue'
import type { ArcStandConfig, LineStandConfig, VenueConfig } from '@/features/stadiview/config/venue'
import { blockZ, buildPitch, rowX } from '@/features/stadiview/layout/pitchLayout'
import { buildStands, southLetterMask } from '@/features/stadiview/layout/standsLayout'
import { NO_ZONE, SeatKind } from '@/features/stadiview/layout/types'
import type { VenueLayout } from '@/features/stadiview/layout/types'
import { buildVenue, getVenue } from '@/features/stadiview/layout/venueLayout'

const v = buildVenue()
const pos = (id: string) => {
  const i = v.indexOf(id)
  return [v.position[i * 3], v.position[i * 3 + 1], v.position[i * 3 + 2], v.yaw[i]]
}
const rad = (deg: number) => (deg * Math.PI) / 180
/** The horizontal direction a seat faces, as [x, z]. */
const facing = (w: VenueLayout, i: number) => [-Math.sin(w.yaw[i]), -Math.cos(w.yaw[i])]
const section = (w: VenueLayout, id: string) => w.sections.find((s) => s.id === id)!
const distance = (w: VenueLayout, a: number, b: number) =>
  Math.hypot(w.position[a * 3] - w.position[b * 3], w.position[a * 3 + 1] - w.position[b * 3 + 1], w.position[a * 3 + 2] - w.position[b * 3 + 2])

describe('the assembled venue at the baseline numbers', () => {
  it('has 7,998 seats in the documented ranges', () => {
    expect(v.count).toBe(7998)
    expect(v.ranges).toEqual({ pitch: [0, 2986], bays: [2986, 2998], stands: [2998, 7998] })
    expect(v.standRows).toHaveLength(72)
  })

  it('sizes every array to the seat count', () => {
    expect(v.position.length).toBe(v.count * 3)
    for (const a of [v.yaw, v.kind, v.section, v.zone, v.row, v.number, v.lineup]) expect(a.length).toBe(v.count)
  })

  it('sizes each stand section as specified', () => {
    const n = Object.fromEntries(v.sections.map((s) => [s.id, s.count]))
    expect(n).toMatchObject({ P1: 629, VIP: 300, NW: 450, NE: 450, S: 2400, E: 1200, ACC: 200 })
    expect(v.sections.map((s) => s.id)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'VIP', 'NW', 'NE', 'S', 'E', 'ACC'])
  })

  it('sizes each pitch block: the last male row stops five seats into block 5', () => {
    const blocks = v.sections.slice(0, 6)
    expect(blocks.map((s) => s.kind)).toEqual(['pitch', 'pitch', 'pitch', 'pitch', 'pitch', 'pitch'])
    expect(blocks.map((s) => s.count)).toEqual([629, 476, 476, 476, 467, 462])
    expect(blocks.map((s) => s.rows)).toEqual([45, 34, 34, 34, 34, 33])
    // The first seat of each block: block 1 opens the line-up, then the first male row runs across blocks 2 to 6.
    expect(blocks.map((s) => s.start)).toEqual([0, 629, 643, 657, 671, 685])
    expect(blocks.map((s) => v.idOf(s.start))).toEqual(['P1-01-01', 'P2-01-01', 'P3-01-01', 'P4-01-01', 'P5-01-01', 'P6-01-01'])
  })

  it('lists the stands one after another with no gap, in the order VIP, NW, NE, S, E, ACC', () => {
    const stands = v.sections.slice(6)
    expect(stands.map((s) => s.kind)).toEqual(['stand', 'stand', 'stand', 'stand', 'stand', 'stand'])
    expect(stands.map((s) => s.rows)).toEqual([6, 15, 15, 20, 12, 4])
    expect(stands.map((s) => s.start)).toEqual([2998, 3298, 3748, 4198, 6598, 7798])
    let next = v.ranges.stands[0]
    for (const s of stands) {
      expect(s.start).toBe(next)
      next += s.count
    }
    expect(next).toBe(v.ranges.stands[1])
  })

  it('counts each section exactly as the section array says, bays aside', () => {
    const counted = v.sections.map(() => 0)
    for (let i = 0; i < v.count; i++) if (v.kind[i] !== SeatKind.AccessBay) counted[v.section[i]]++
    expect(counted).toEqual(v.sections.map((s) => s.count))
    // Stand sections are contiguous, so start and count alone enumerate them.
    v.sections.forEach((s, si) => {
      if (s.kind === 'stand') for (let i = s.start; i < s.start + s.count; i++) expect(v.section[i]).toBe(si)
    })
  })

  it('assigns the gates', () => {
    const g = Object.fromEntries(v.sections.map((s) => [s.id, s.gate]))
    expect(g).toMatchObject({ P1: 5, P2: 2, P6: 2, S: 1, E: 1, NW: 2, NE: 2, ACC: 3, VIP: 4 })
    expect(g).toEqual({ P1: 5, P2: 2, P3: 2, P4: 2, P5: 2, P6: 2, VIP: 4, NW: 2, NE: 2, S: 1, E: 1, ACC: 3 })
  })

  it('marks what each seat is by its range', () => {
    for (let i = 0; i < v.count; i++) {
      const expected = i < v.ranges.bays[0] ? SeatKind.Pitch : i < v.ranges.stands[0] ? SeatKind.AccessBay : SeatKind.Stand
      expect(v.kind[i]).toBe(expected)
    }
  })

  it('carries the pitch seats over from the pitch layout unchanged', () => {
    const p = buildPitch()
    expect(v.zones).toEqual(p.zones)
    for (let i = 0; i < p.count; i++) {
      expect(v.position[i * 3]).toBe(p.position[i * 3])
      expect(v.position[i * 3 + 1]).toBe(0)
      expect(v.position[i * 3 + 2]).toBe(p.position[i * 3 + 2])
      expect(v.section[i]).toBe(p.block[i] - 1)
      expect(v.row[i]).toBe(p.row[i])
      expect(v.number[i]).toBe(p.number[i])
      expect(v.zone[i]).toBe(p.zone[i])
      expect(v.lineup[i]).toBe(p.lineup[i])
    }
  })

  it('keeps zones and the line-up to the pitch seats', () => {
    for (let i = v.ranges.bays[0]; i < v.count; i++) {
      expect(v.zone[i]).toBe(NO_ZONE)
      expect(v.lineup[i]).toBe(0)
    }
    for (let i = 0; i < v.ranges.pitch[1]; i++) {
      expect(v.zone[i]).toBeLessThan(v.zones.length)
      expect(v.lineup[i]).toBeGreaterThan(0)
    }
  })

  it('places two bays in front of each block, in line with its outer seats', () => {
    for (let b = 1; b <= 6; b++) {
      for (const [k, seat] of [[1, 1], [2, 14]] as const) {
        const i = v.ranges.bays[0] + (b - 1) * 2 + (k - 1)
        expect(v.idOf(i)).toBe(`P${b}-A${k}`)
        expect(v.indexOf(`P${b}-A${k}`)).toBe(i)
        expect(v.kind[i]).toBe(SeatKind.AccessBay)
        expect(v.section[i]).toBe(b - 1)
        expect(v.row[i]).toBe(0)
        expect(v.number[i]).toBe(k)
        expect(v.position[i * 3]).toBe(-31.5)
        expect(v.position[i * 3 + 1]).toBe(0)
        expect(v.position[i * 3 + 2]).toBeCloseTo(blockZ(b, seat), 5)
      }
    }
    // A1 is the north bay, A2 the south one.
    expect(pos('P1-A1')[2]).toBeLessThan(pos('P1-A2')[2])
  })
})

describe('seat ids', () => {
  it('gives every seat a unique id that round-trips', () => {
    const seen = new Set<string>()
    for (let i = 0; i < v.count; i++) {
      const id = v.idOf(i)
      expect(seen.has(id)).toBe(false)
      seen.add(id)
      expect(v.indexOf(id)).toBe(i)
    }
    expect(v.idOf(v.indexOf('P3-12-07'))).toBe('P3-12-07')
    expect(v.idOf(2986)).toBe('P1-A1')
    expect(v.idOf(2997)).toBe('P6-A2')
    expect(v.indexOf('P9-01-01')).toBe(-1)
    expect(v.indexOf('P6-34-01')).toBe(-1)
    expect(v.indexOf('')).toBe(-1)
  })

  it('writes ids the way the design does: two-digit rows, two-digit pitch seats, three-digit stand seats', () => {
    for (const id of ['P3-12-07', 'P3-A1', 'S-07-112', 'E-03-045', 'NW-10-021', 'VIP-02-030', 'ACC-01-018']) {
      expect(v.indexOf(id)).toBeGreaterThanOrEqual(0)
      expect(v.idOf(v.indexOf(id))).toBe(id)
    }
    const i = v.indexOf('S-07-112')
    expect([v.sections[v.section[i]].id, v.row[i], v.number[i]]).toEqual(['S', 7, 112])
    const j = v.indexOf('P3-12-07')
    expect([v.sections[v.section[j]].id, v.row[j], v.number[j], v.kind[j]]).toEqual(['P3', 12, 7, SeatKind.Pitch])
    expect(v.idOf(0)).toBe('P1-01-01')
    expect(v.idOf(v.ranges.stands[0])).toBe('VIP-01-001')
    expect(v.idOf(v.count - 1)).toBe('ACC-04-050')
  })

  it('knows no id but the exact one: loose spellings and seats that do not exist are unknown', () => {
    for (const id of ['P3-12-7', 'p3-12-07', 'P3-12-07 ', 'S-7-112', 'S-07-0112', 'S-21-001', 'S-01-121', 'S-00-001', 'E-01-101', 'VIP-07-001', 'P1-A3', 'P7-A1', 'P1-45-14', 'X-01-001', 'S', '-']) {
      expect(v.indexOf(id)).toBe(-1)
    }
    // The last seats that do exist, next to the ones above that do not.
    for (const id of ['P1-45-13', 'P5-34-05', 'P6-33-14', 'S-20-120', 'E-12-100', 'VIP-06-050']) expect(v.indexOf(id)).toBeGreaterThanOrEqual(0)
    expect(v.indexOf('P5-34-06')).toBe(-1)
  })

  it('has no id for an index outside the venue', () => {
    expect(v.idOf(-1)).toBe('')
    expect(v.idOf(v.count)).toBe('')
    expect(v.idOf(1.5)).toBe('')
  })
})

describe('stand seat positions', () => {
  it('puts seat 1 at the left end of each stand as seen from the pitch', () => {
    expect(pos('S-01-001')[0]).toBeCloseTo(35.7, 4)
    expect(pos('S-01-001')[2]).toBeCloseTo(53, 4)
    expect(pos('S-01-001')[1]).toBeCloseTo(1.2, 4)
    expect(pos('S-20-120')[0]).toBeCloseTo(-35.7, 4)
    expect(pos('S-20-120')[2]).toBeCloseTo(69.15, 4)
    expect(pos('S-20-120')[1]).toBeCloseTo(9.18, 4)
    expect(pos('NW-01-001')[0]).toBeCloseTo(-34.7, 4)
    expect(pos('NE-01-001')[0]).toBeCloseTo(17.3, 4)
    expect(pos('VIP-01-001')[0]).toBeCloseTo(-14.7, 4)
    expect(pos('VIP-01-001')[1]).toBeCloseTo(3.0, 4)
    expect(pos('VIP-06-050')[2]).toBeCloseTo(-57.5, 4)
    expect(pos('ACC-01-001')[0]).toBeCloseTo(-0.35, 4)
    expect(pos('ACC-04-050')[2]).toBeCloseTo(50.6, 4)
    expect(pos('ACC-01-001')[1]).toBeCloseTo(0.3, 4)
    expect(pos('E-01-001')[2]).toBeLessThan(0)
    expect(pos('E-01-100')[2]).toBeGreaterThan(0)
    expect(pos('E-01-001')[0]).toBeCloseTo(42.195 + 52 * Math.cos((33.7 * Math.PI) / 180), 3)
  })

  it('numbers every stand row from the left as seen by someone on the pitch facing it', () => {
    // Someone facing a stand looks along the opposite of its seats' facing f. Seen from above, that
    // viewer's right-hand direction is (f.z, -f.x): facing the south stand (f points north) it is west.
    // Seat 1 is at the viewer's left end, so each next seat must lie further to the viewer's right.
    for (const s of v.sections.filter((x) => x.kind === 'stand')) {
      for (let i = s.start; i < s.start + s.count - 1; i++) {
        if (v.row[i + 1] !== v.row[i]) continue
        const [fx, fz] = facing(v, i)
        const stepX = v.position[(i + 1) * 3] - v.position[i * 3]
        const stepZ = v.position[(i + 1) * 3 + 2] - v.position[i * 3 + 2]
        expect(stepX * fz + stepZ * -fx).toBeGreaterThan(0.5)
      }
    }
  })

  it('matches the design formula for every one of the 5,000 stand seats', () => {
    // Written out from the design with literal numbers, on purpose independent of the config and the builder.
    const expected = (id: string, r: number, n: number): [number, number, number, number] => {
      switch (id) {
        case 'S': return [36 - (n - 0.5) * 0.6, 1.2 + (r - 1) * 0.42, 53 + (r - 1) * 0.85, 0]
        case 'ACC': return [-(n - 0.5) * 0.7, 0.3, 47.3 + (r - 1) * 1.1, 0]
        case 'NW': return [-35 + (n - 0.5) * 0.6, 1.2 + (r - 1) * 0.42, -52 - (r - 1) * 0.85, Math.PI]
        case 'VIP': return [-15 + (n - 0.5) * 0.6, 3.0 + (r - 1) * 0.45, -52 - (r - 1) * 1.1, Math.PI]
        case 'NE': return [17 + (n - 0.5) * 0.6, 1.2 + (r - 1) * 0.42, -52 - (r - 1) * 0.85, Math.PI]
        default: {
          const R = 52 + (r - 1) * 0.85
          const phi = rad(n <= 50 ? -34 + (n - 0.5) * 0.6 : 4 + (n - 50.5) * 0.6)
          return [42.195 + R * Math.cos(phi), 1.2 + (r - 1) * 0.42, R * Math.sin(phi), Math.PI / 2 - phi]
        }
      }
    }
    const perRow: Record<string, number> = { VIP: 50, NW: 30, NE: 30, S: 120, E: 100, ACC: 50 }
    let checked = 0
    for (const s of v.sections.filter((x) => x.kind === 'stand')) {
      for (let k = 0; k < s.count; k++) {
        const i = s.start + k
        const r = Math.floor(k / perRow[s.id]) + 1
        const n = (k % perRow[s.id]) + 1
        expect(v.row[i]).toBe(r)
        expect(v.number[i]).toBe(n)
        const [x, y, z, yaw] = expected(s.id, r, n)
        expect(v.position[i * 3]).toBeCloseTo(x, 4)
        expect(v.position[i * 3 + 1]).toBeCloseTo(y, 4)
        expect(v.position[i * 3 + 2]).toBeCloseTo(z, 4)
        expect(v.yaw[i]).toBeCloseTo(yaw, 5)
        checked++
      }
    }
    expect(checked).toBe(5000)
  })

  it('faces every stand seat at the pitch and every pitch seat west', () => {
    for (let i = 0; i < 2998; i++) {
      expect(facing(v, i)[0]).toBeCloseTo(-1, 5)
      expect(facing(v, i)[1]).toBeCloseTo(0, 5)
    }
    expect(facing(v, v.indexOf('S-05-010'))[1]).toBeCloseTo(-1, 5) // south stand faces north
    expect(facing(v, v.indexOf('NW-05-010'))[1]).toBeCloseTo(1, 5) // north stands face south
    for (const id of ['E-01-001', 'E-06-050', 'E-12-100']) {
      const i = v.indexOf(id)
      const dx = 42.195 - v.position[i * 3]
      const dz = -v.position[i * 3 + 2]
      const l = Math.hypot(dx, dz)
      expect(facing(v, i)[0]).toBeCloseTo(dx / l, 4)
      expect(facing(v, i)[1]).toBeCloseTo(dz / l, 4)
    }
  })

  it('turns every straight stand squarely toward the pitch: south seats face north, north seats face south', () => {
    for (const id of ['S', 'ACC', 'VIP', 'NW', 'NE']) {
      const s = section(v, id)
      for (let i = s.start; i < s.start + s.count; i++) {
        expect(facing(v, i)[0]).toBeCloseTo(0, 5)
        // Toward z = 0 from wherever the seat is.
        expect(facing(v, i)[1]).toBeCloseTo(-Math.sign(v.position[i * 3 + 2]), 5)
      }
    }
  })

  it('leaves the procession entrance open: no east-curve seat within 4 degrees of due east', () => {
    const [a, b] = v.sections.filter((s) => s.id === 'E').map((s) => [s.start, s.start + s.count])[0]
    for (let i = a; i < b; i++) expect(Math.abs(Math.atan2(v.position[i * 3 + 2], v.position[i * 3] - 42.195))).toBeGreaterThan((4 * Math.PI) / 180 - 1e-6)
  })

  it('splits the east curve evenly: 50 seats north of the entrance and 50 south in every row, none beyond 34 degrees', () => {
    const e = section(v, 'E')
    for (let i = e.start; i < e.start + e.count; i++) {
      const phi = Math.atan2(v.position[i * 3 + 2], v.position[i * 3] - 42.195)
      expect(Math.abs(phi)).toBeLessThan(rad(34))
      // Seats 1 to 50 are the north half, 51 to 100 the south half.
      expect(phi < 0).toBe(v.number[i] <= 50)
      expect(Math.hypot(v.position[i * 3] - 42.195, v.position[i * 3 + 2])).toBeCloseTo(52 + (v.row[i] - 1) * 0.85, 3)
    }
    // The walkway between the two halves is about 7 m wide at the front row.
    expect(distance(v, v.indexOf('E-01-050'), v.indexOf('E-01-051'))).toBeGreaterThan(7)
  })

  it('keeps every pair of seats in the same row at least 0.5 m apart, and rows at least 0.8 m apart', () => {
    // Group the seats by section and row, each row in seat-number order.
    const rows = new Map<string, number[]>()
    for (let i = 0; i < v.count; i++) {
      if (v.kind[i] === SeatKind.AccessBay) continue
      const key = `${v.section[i]}:${v.row[i]}`
      const list = rows.get(key) ?? []
      list[v.number[i]] = i
      rows.set(key, list)
    }
    let neighbours = 0
    let rowPairs = 0
    for (const [key, list] of rows) {
      const seats = list.filter((i) => i !== undefined)
      for (let k = 1; k < seats.length; k++) {
        expect(distance(v, seats[k - 1], seats[k])).toBeGreaterThanOrEqual(0.5)
        neighbours++
      }
      // The same seat number one row back, wherever both rows have it.
      const [sec, r] = key.split(':').map(Number)
      const behind = rows.get(`${sec}:${r + 1}`)
      if (!behind) continue
      for (const i of seats) {
        const j = behind[v.number[i]]
        if (j === undefined) continue
        expect(distance(v, i, j)).toBeGreaterThanOrEqual(0.8)
        rowPairs++
      }
    }
    expect(neighbours).toBeGreaterThan(7000)
    expect(rowPairs).toBeGreaterThan(7000)
  })

  it('never puts two seats anywhere closer than 0.5 m', () => {
    // A coarse grid of 1 m cells: only seats in the same or a neighbouring cell can be that close.
    const cells = new Map<string, number[]>()
    const cellOf = (i: number) => [Math.floor(v.position[i * 3]), Math.floor(v.position[i * 3 + 1]), Math.floor(v.position[i * 3 + 2])]
    for (let i = 0; i < v.count; i++) {
      const key = cellOf(i).join(',')
      const list = cells.get(key)
      if (list) list.push(i)
      else cells.set(key, [i])
    }
    let closest = Infinity
    for (let i = 0; i < v.count; i++) {
      const [cx, cy, cz] = cellOf(i)
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const j of cells.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) if (j > i) closest = Math.min(closest, distance(v, i, j))
      }
    }
    expect(closest).toBeGreaterThanOrEqual(0.5)
    // The tightest pair is two front-row neighbours on the east curve.
    expect(closest).toBeCloseTo(2 * 52 * Math.sin(rad(0.3)), 3)
  })

  it('raises stand rows as they go back', () => {
    expect(pos('S-20-060')[1]).toBeGreaterThan(pos('S-01-060')[1])
    expect(pos('E-12-010')[1]).toBeCloseTo(1.2 + 11 * 0.42, 4)
  })

  it('steps every stand back and up away from the pitch, except the flat accessibility platform', () => {
    for (const s of v.sections.filter((x) => x.kind === 'stand')) {
      for (let r = 1; r < s.rows; r++) {
        const tag = (row: number) => `${s.id}-${String(row).padStart(2, '0')}-001`
        const [x0, y0, z0] = pos(tag(r))
        const [x1, y1, z1] = pos(tag(r + 1))
        // Further from the middle of the pitch each row.
        expect(Math.hypot(x1, z1)).toBeGreaterThan(Math.hypot(x0, z0))
        if (s.id === 'ACC') expect(y1).toBe(y0)
        else expect(y1).toBeGreaterThan(y0 + 0.4)
      }
    }
  })

  it('keeps the grandstands off the pitch and the track', () => {
    const trackOuter = VENUE.track.innerRadius + VENUE.track.lanes * VENUE.track.laneWidth
    for (let i = v.ranges.stands[0]; i < v.count; i++) {
      const x = v.position[i * 3]
      const z = v.position[i * 3 + 2]
      // Distance from the track's centre line: the straights' axis, or a bend's centre beyond them.
      const beyond = Math.max(0, Math.abs(x) - VENUE.track.straightHalf)
      expect(Math.hypot(beyond, z)).toBeGreaterThan(trackOuter + 0.25)
    }
  })
})

describe('stand rows', () => {
  it('lists the 72 rows stand by stand, front to back: 6 + 15 + 15 + 20 + 12 + 4', () => {
    const order: [string, number][] = [['VIP', 6], ['NW', 15], ['NE', 15], ['S', 20], ['E', 12], ['ACC', 4]]
    let k = 0
    let next = v.ranges.stands[0]
    for (const [id, rows] of order) {
      for (let r = 1; r <= rows; r++, k++) {
        const row = v.standRows[k]
        expect(v.sections[row.section].id).toBe(id)
        expect(row.row).toBe(r)
        expect(row.start).toBe(next)
        expect(v.idOf(row.start)).toBe(`${id}-${String(r).padStart(2, '0')}-001`)
        next += row.count
      }
    }
    expect(k).toBe(72)
    expect(next).toBe(v.count)
    expect(v.standRows.filter((r) => r.kind === 'arc')).toHaveLength(12)
  })

  it('describes every seat of a straight row by x0 + (n - 1) x dx on the line z', () => {
    let checked = 0
    for (const row of v.standRows) {
      if (row.kind !== 'line') continue
      for (let n = 1; n <= row.count; n++) {
        const i = row.start + n - 1
        expect(v.row[i]).toBe(row.row)
        expect(v.number[i]).toBe(n)
        expect(v.section[i]).toBe(row.section)
        expect(v.position[i * 3]).toBeCloseTo(row.x0 + (n - 1) * row.dx, 4)
        expect(v.position[i * 3 + 1]).toBeCloseTo(row.y, 5)
        expect(v.position[i * 3 + 2]).toBeCloseTo(row.z, 4)
        expect(v.yaw[i]).toBeCloseTo(row.yaw, 6)
        checked++
      }
    }
    expect(checked).toBe(3800)
    const s1 = v.standRows.find((r) => v.sections[r.section].id === 'S' && r.row === 1)!
    expect(s1).toMatchObject({ kind: 'line', count: 120, z: 53, y: 1.2, yaw: 0 })
    if (s1.kind === 'line') {
      expect(s1.x0).toBeCloseTo(35.7, 9)
      expect(s1.dx).toBeCloseTo(-0.6, 9)
    }
    const vip6 = v.standRows.find((r) => v.sections[r.section].id === 'VIP' && r.row === 6)!
    expect(vip6).toMatchObject({ kind: 'line', count: 50, yaw: Math.PI })
    if (vip6.kind === 'line') {
      expect(vip6.x0).toBeCloseTo(-14.7, 9)
      expect(vip6.dx).toBeCloseTo(0.6, 9)
      expect(vip6.z).toBeCloseTo(-57.5, 9)
      expect(vip6.y).toBeCloseTo(5.25, 9)
    }
  })

  it('describes every seat of a curved row by its span angle, in radians from east toward south', () => {
    let checked = 0
    for (const row of v.standRows) {
      if (row.kind !== 'arc') continue
      expect([row.cx, row.cz]).toEqual([42.195, 0])
      expect(row.radius).toBeCloseTo(52 + (row.row - 1) * 0.85, 9)
      expect(row.spans).toHaveLength(2)
      expect(row.spans.reduce((a, sp) => a + sp.count, 0)).toBe(row.count)
      expect(row.spans[0].from).toBeCloseTo(rad(-34), 9)
      expect(row.spans[1].from).toBeCloseTo(rad(4), 9)
      let i = row.start
      for (const sp of row.spans) {
        expect(sp.step).toBeCloseTo(rad(0.6), 9)
        for (let k = 0; k < sp.count; k++, i++) {
          const phi = sp.from + (k + 0.5) * sp.step
          expect(v.position[i * 3]).toBeCloseTo(row.cx + row.radius * Math.cos(phi), 4)
          expect(v.position[i * 3 + 1]).toBeCloseTo(row.y, 5)
          expect(v.position[i * 3 + 2]).toBeCloseTo(row.cz + row.radius * Math.sin(phi), 4)
          expect(v.yaw[i]).toBeCloseTo(Math.PI / 2 - phi, 5)
          expect(v.section[i]).toBe(row.section)
          checked++
        }
      }
    }
    expect(checked).toBe(1200)
  })
})

describe('buildStands on its own', () => {
  const st = buildStands()

  it('holds the 5,000 stand seats and their 72 rows, counted from its own first seat', () => {
    expect(st.count).toBe(5000)
    expect(st.position.length).toBe(15000)
    for (const a of [st.yaw, st.stand, st.row, st.number]) expect(a.length).toBe(5000)
    expect(st.rows).toHaveLength(72)
    expect(st.stands.map((s) => [s.id, s.rows, s.start, s.count, s.gate])).toEqual([
      ['VIP', 6, 0, 300, 4], ['NW', 15, 300, 450, 2], ['NE', 15, 750, 450, 2], ['S', 20, 1200, 2400, 1], ['E', 12, 3600, 1200, 1], ['ACC', 4, 4800, 200, 3],
    ])
    // Rows point at this result's own arrays: the first row starts at 0 and belongs to stand 0.
    expect(st.rows[0]).toMatchObject({ section: 0, row: 1, start: 0, count: 50 })
    expect(st.rows[71]).toMatchObject({ section: 5, row: 4, start: 4950, count: 50 })
    for (let i = 0; i < st.count; i++) expect(st.stands[st.stand[i]].start).toBeLessThanOrEqual(i)
  })

  it('is what the venue holds after the pitch seats and the bays', () => {
    const base = v.ranges.stands[0]
    for (let i = 0; i < st.count; i++) {
      for (let c = 0; c < 3; c++) expect(v.position[(base + i) * 3 + c]).toBe(st.position[i * 3 + c])
      expect(v.yaw[base + i]).toBe(st.yaw[i])
      expect(v.row[base + i]).toBe(st.row[i])
      expect(v.number[base + i]).toBe(st.number[i])
      expect(v.section[base + i]).toBe(st.stand[i] + 6)
    }
    st.rows.forEach((r, k) => {
      expect(v.standRows[k].start).toBe(r.start + base)
      expect(v.standRows[k].section).toBe(r.section + 6)
    })
  })
})

describe('the venue follows the config', () => {
  it('follows the config: changing one zone count changes the totals and nothing else breaks', () => {
    const cfg = structuredClone(VENUE)
    cfg.zones[0].count += 5
    const w = buildVenue(cfg)
    expect(w.ranges.pitch[1]).toBe(2991)
    expect(w.count).toBe(8003)
    expect(w.pitchRows).toBe(46)
    expect(w.pitchCell.length).toBe(6 * 46 * 14)
    expect(w.indexOf(w.idOf(w.count - 1))).toBe(w.count - 1)
    expect(getVenue()).toBe(getVenue())
    expect(getVenue().count).toBe(7998)
  })

  it('keeps ids, ranges, sections and the pitch grid in step after a zone count changes', () => {
    const cfg = structuredClone(VENUE)
    cfg.zones[0].count += 5
    const w = buildVenue(cfg)
    expect(w.ranges).toEqual({ pitch: [0, 2991], bays: [2991, 3003], stands: [3003, 8003] })
    expect(section(w, 'P1').count).toBe(634)
    expect(section(w, 'P1').rows).toBe(46)
    expect(section(w, 'VIP').start).toBe(3003)
    expect(w.standRows[0].start).toBe(3003)
    expect(w.idOf(2991)).toBe('P1-A1')
    expect(w.indexOf('P1-46-04')).toBeGreaterThanOrEqual(0)
    expect(w.indexOf('P1-46-05')).toBe(-1)
    for (let i = 0; i < w.count; i++) expect(w.indexOf(w.idOf(i))).toBe(i)
    let filled = 0
    for (let c = 0; c < w.pitchCell.length; c++) if (w.pitchCell[c] >= 0) filled++
    expect(filled).toBe(2991)
  })

  it('builds the default layout once and a changed config afresh', () => {
    expect(buildVenue()).toBe(getVenue())
    expect(buildVenue(VENUE)).toBe(getVenue())
    const w = buildVenue(structuredClone(VENUE))
    expect(w).not.toBe(getVenue())
    // An equal config gives an equal layout.
    expect(w.count).toBe(v.count)
    expect(Array.from(w.position)).toEqual(Array.from(v.position))
    expect(w.sections).toEqual(v.sections)
    expect(w.standRows).toEqual(v.standRows)
  })

  it('follows a changed stand: one more south row and a wider entrance gap', () => {
    const cfg = structuredClone(VENUE)
    const south = cfg.stands.find((s): s is LineStandConfig => s.kind === 'line' && s.id === 'S')!
    south.rows = 21
    const east = cfg.stands.find((s): s is ArcStandConfig => s.kind === 'arc')!
    // Ten seats fewer in each half, taken from beside the entrance.
    east.spans = [{ fromDeg: -34, toDeg: -10, seats: 40 }, { fromDeg: 10, toDeg: 34, seats: 40 }]
    const w = buildVenue(cfg)
    expect(section(w, 'S').count).toBe(2520)
    expect(section(w, 'E').count).toBe(960)
    expect(w.count).toBe(7998 + 120 - 240)
    expect(w.standRows).toHaveLength(73)
    expect(w.indexOf('S-21-120')).toBeGreaterThanOrEqual(0)
    expect(w.indexOf('E-01-080')).toBeGreaterThanOrEqual(0)
    expect(w.indexOf('E-01-081')).toBe(-1)
    const e = section(w, 'E')
    for (let i = e.start; i < e.start + e.count; i++) {
      expect(Math.abs(Math.atan2(w.position[i * 3 + 2], w.position[i * 3] - 42.195))).toBeGreaterThan(rad(10) - 1e-6)
    }
    for (let i = 0; i < w.count; i++) expect(w.indexOf(w.idOf(i))).toBe(i)
  })

  it('follows the gates and the block genders in the config', () => {
    const cfg = structuredClone(VENUE)
    cfg.stands[0].gate = 1
    cfg.blocks.gate = { f: 2, m: 5 }
    const w = buildVenue(cfg)
    expect(section(w, 'VIP').gate).toBe(1)
    expect(section(w, 'P1').gate).toBe(2)
    expect(section(w, 'P4').gate).toBe(5)
  })

  it('copes with a block nobody sits in: the block stays in the list, empty, and keeps its bays', () => {
    const cfg = structuredClone(VENUE)
    for (const z of cfg.zones) if (z.gender === 'f') z.count = 0
    const w = buildVenue(cfg)
    expect(w.count).toBe(7998 - 629)
    expect(w.pitchRows).toBe(34)
    expect(section(w, 'P1')).toMatchObject({ count: 0, rows: 0, start: -1 })
    expect(w.sections.map((s) => s.id).slice(0, 6)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6'])
    expect(w.idOf(0)).toBe('P2-01-01')
    expect(w.indexOf('P1-01-01')).toBe(-1)
    expect(w.indexOf('P1-A1')).toBe(w.ranges.bays[0])
    for (let i = 0; i < w.count; i++) expect(w.indexOf(w.idOf(i))).toBe(i)
  })

  it('refuses a config with more zones than a seat can name', () => {
    const cfg: VenueConfig = structuredClone(VENUE)
    // 255 marks "no zone", so only 255 zones (0 to 254) can be told apart.
    while (cfg.zones.length < 256) cfg.zones.push({ id: `M-X${cfg.zones.length}-B`, gender: 'm', college: 'CEP', degree: 'B', count: 1 })
    expect(() => buildVenue(cfg)).toThrow(/zones/)
  })
})

describe('the pitch grid', () => {
  it('maps every pitch seat through pitchCell and nothing else', () => {
    let filled = 0
    for (let c = 0; c < v.pitchCell.length; c++) if (v.pitchCell[c] >= 0) filled++
    expect(filled).toBe(2986)
    const i = v.indexOf('P3-12-07')
    expect(v.pitchCell[((3 - 1) * v.pitchRows + (12 - 1)) * 14 + (7 - 1)]).toBe(i)
  })

  it('agrees with every pitch seat in both directions', () => {
    expect(v.pitchRows).toBe(45)
    expect(v.pitchCell.length).toBe(6 * 45 * 14)
    const cell = (b: number, r: number, s: number) => v.pitchCell[((b - 1) * v.pitchRows + (r - 1)) * 14 + (s - 1)]
    for (let i = 0; i < v.ranges.pitch[1]; i++) expect(cell(v.section[i] + 1, v.row[i], v.number[i])).toBe(i)
    for (let b = 1; b <= 6; b++) for (let r = 1; r <= 45; r++) for (let s = 1; s <= 14; s++) {
      const i = cell(b, r, s)
      if (i < 0) continue
      expect(v.position[i * 3]).toBeCloseTo(rowX(r), 5)
      expect(v.position[i * 3 + 2]).toBeCloseTo(blockZ(b, s), 5)
    }
    // Empty where there is no chair: past block 1's short last row, and behind the men's last row.
    expect(cell(1, 45, 13)).toBe(v.indexOf('P1-45-13'))
    expect(cell(1, 45, 14)).toBe(-1)
    expect(cell(5, 34, 5)).toBe(v.indexOf('P5-34-05'))
    expect(cell(5, 34, 6)).toBe(-1)
    expect(cell(6, 34, 1)).toBe(-1)
    expect(cell(2, 35, 1)).toBe(-1)
  })
})

describe('the KFUPM lettering in the south stand', () => {
  // The picture the seats must make, as someone on the pitch sees it: the top line is row 16, the
  // bottom line row 4, and the left edge of each letter is its lowest seat number.
  const ART: Record<string, string[]> = {
    K: [
      '###.........####',
      '###.......####..',
      '###......####...',
      '###....####.....',
      '###..####.......',
      '###.####........',
      '######..........',
      '###.####........',
      '###..####.......',
      '###....####.....',
      '###......####...',
      '###.......####..',
      '###.........####',
    ],
    F: [
      '################',
      '################',
      '###.............',
      '###.............',
      '###.............',
      '############....',
      '############....',
      '###.............',
      '###.............',
      '###.............',
      '###.............',
      '###.............',
      '###.............',
    ],
    U: [
      '###..........###',
      '###..........###',
      '###..........###',
      '###..........###',
      '###..........###',
      '###..........###',
      '###..........###',
      '###..........###',
      '###..........###',
      '###..........###',
      '###..........###',
      '################',
      '.##############.',
    ],
    P: [
      '##############..',
      '################',
      '###..........###',
      '###..........###',
      '###..........###',
      '###..........###',
      '################',
      '##############..',
      '###.............',
      '###.............',
      '###.............',
      '###.............',
      '###.............',
    ],
    M: [
      '####........####',
      '#####......#####',
      '######....######',
      '#######..#######',
      '###.########.###',
      '###..######..###',
      '###...####...###',
      '###....##....###',
      '###..........###',
      '###..........###',
      '###..........###',
      '###..........###',
      '###..........###',
    ],
  }
  /** What the picture says about a seat: the letters sit at seats 9-24, 31-46, 53-68, 75-90 and 97-112. */
  const drawn = (row: number, seat: number): boolean => {
    if (row < 4 || row > 16) return false
    const along = seat - 9
    if (along < 0 || along >= 104) return false
    const letter = Math.floor(along / 22)
    const column = along % 22
    if (column >= 16) return false
    return ART['KFUPM'[letter]][16 - row][column] === '#'
  }

  it('spells KFUPM only inside rows 4 to 16 of the south stand', () => {
    expect(southLetterMask(2, 60)).toBe(false)
    expect(southLetterMask(17, 60)).toBe(false)
    let lit = 0
    for (let r = 4; r <= 16; r++) for (let s = 1; s <= 120; s++) if (southLetterMask(r, s)) lit++
    expect(lit).toBeGreaterThan(300)
  })

  it('draws K, F, U, P, M upright and left to right from seat 1, seat for seat', () => {
    for (let r = 1; r <= 20; r++) for (let s = 1; s <= 120; s++) {
      if (southLetterMask(r, s) !== drawn(r, s)) throw new Error(`row ${r}, seat ${s}: expected ${drawn(r, s)}`)
    }
    // The stem of the K is at the low seat numbers (the east end), top to bottom.
    for (let r = 4; r <= 16; r++) for (const s of [9, 10, 11]) expect(southLetterMask(r, s)).toBe(true)
    // The bar of the F is at the top, in the highest rows; nothing of it lies bottom right.
    expect(southLetterMask(16, 46)).toBe(true)
    expect(southLetterMask(4, 46)).toBe(false)
    // The U is closed at the bottom and open at the top.
    expect(southLetterMask(5, 60)).toBe(true)
    expect(southLetterMask(16, 60)).toBe(false)
  })

  it('is blank outside the word: the margins, the gaps between letters, and seats that do not exist', () => {
    for (let r = 1; r <= 20; r++) {
      for (let s = 1; s <= 8; s++) expect(southLetterMask(r, s)).toBe(false)
      for (let s = 113; s <= 120; s++) expect(southLetterMask(r, s)).toBe(false)
      for (const gapStart of [25, 47, 69, 91]) for (let s = gapStart; s < gapStart + 6; s++) expect(southLetterMask(r, s)).toBe(false)
    }
    for (const [r, s] of [[0, 10], [10, 0], [10, 121], [-3, 10], [10, -5], [21, 10]]) expect(southLetterMask(r, s)).toBe(false)
  })

  it('gives each letter strokes three seats wide and a mirror-symmetric U and M', () => {
    const lit = (first: number) => {
      let n = 0
      for (let r = 4; r <= 16; r++) for (let s = first; s < first + 16; s++) if (southLetterMask(r, s)) n++
      return n
    }
    // Every letter is bold enough to read from across the pitch: between a third and two thirds of its cell.
    for (const first of [9, 31, 53, 75, 97]) {
      expect(lit(first)).toBeGreaterThan((16 * 13) / 3)
      expect(lit(first)).toBeLessThan((16 * 13 * 2) / 3)
    }
    for (const first of [53, 97]) {
      for (let r = 4; r <= 16; r++) for (let c = 0; c < 16; c++) expect(southLetterMask(r, first + c)).toBe(southLetterMask(r, first + 15 - c))
    }
    // The left stem of every letter is exactly three seats wide half-way up.
    for (const first of [31, 53, 75, 97]) {
      expect([0, 1, 2, 3].map((c) => southLetterMask(12, first + c))).toEqual([true, true, true, false])
    }
  })

  it('reads from the lettering in the config: other rows, a shorter word, smaller letters', () => {
    const cfg = structuredClone(VENUE)
    cfg.lettering.firstRow = 6
    cfg.lettering.lastRow = 18
    for (let s = 1; s <= 120; s++) {
      expect(southLetterMask(5, s, cfg)).toBe(false)
      expect(southLetterMask(19, s, cfg)).toBe(false)
      // The same picture, two rows further back.
      for (let r = 6; r <= 18; r++) expect(southLetterMask(r, s, cfg)).toBe(drawn(r - 2, s))
    }
    // A shorter word stays centred: "KFU" is 16 x 3 + 6 x 2 = 60 seats, so it starts at seat 31.
    const short = structuredClone(VENUE)
    short.lettering.text = 'KFU'
    expect(southLetterMask(10, 30, short)).toBe(false)
    expect(southLetterMask(10, 31, short)).toBe(true)
    for (let r = 4; r <= 16; r++) for (let c = 0; c < 16; c++) expect(southLetterMask(r, 31 + c, short)).toBe(drawn(r, 9 + c))
    // Letters half the size keep their shape roughly: still inside the centred span and still lit.
    const small = structuredClone(VENUE)
    small.lettering.letterWidth = 8
    small.lettering.letterGap = 3
    // 5 x 8 + 4 x 3 = 52 seats, centred on 120: seats 35 to 86.
    let lit = 0
    for (let r = 4; r <= 16; r++) for (let s = 1; s <= 120; s++) {
      if (!southLetterMask(r, s, small)) continue
      lit++
      expect(s).toBeGreaterThanOrEqual(35)
      expect(s).toBeLessThanOrEqual(86)
    }
    expect(lit).toBeGreaterThan(150)
  })

  it('leaves a character it has no drawing for blank instead of guessing', () => {
    const cfg = structuredClone(VENUE)
    cfg.lettering.text = 'K?UPM'
    for (let r = 4; r <= 16; r++) {
      for (let s = 31; s <= 46; s++) expect(southLetterMask(r, s, cfg)).toBe(false)
      for (let s = 53; s <= 68; s++) expect(southLetterMask(r, s, cfg)).toBe(drawn(r, s))
    }
  })

  it('lies entirely on real south-stand seats', () => {
    const s = section(v, 'S')
    let lit = 0
    for (let i = s.start; i < s.start + s.count; i++) if (southLetterMask(v.row[i], v.number[i])) lit++
    let all = 0
    for (let r = -5; r <= 30; r++) for (let n = -5; n <= 130; n++) if (southLetterMask(r, n)) all++
    expect(lit).toBe(all)
  })

  it('has its K at the east end, so the word reads left to right from the pitch and from the opening camera', () => {
    // Someone looking south at the stand has east on their left.
    const kStem = v.indexOf('S-10-009')
    const mStem = v.indexOf('S-10-112')
    expect(southLetterMask(10, 9)).toBe(true)
    expect(southLetterMask(10, 112)).toBe(true)
    expect(v.position[kStem * 3]).toBeGreaterThan(v.position[mStem * 3])
    // The top of the letters (row 16) is higher up and further back than the bottom (row 4).
    expect(pos('S-16-060')[1]).toBeGreaterThan(pos('S-04-060')[1])
    expect(pos('S-16-060')[2]).toBeGreaterThan(pos('S-04-060')[2])
    // The opening camera is on the pitch side of the stand, so it sees the same face of the letters.
    expect(VENUE.camera.home.position[2]).toBeLessThan(pos('S-01-001')[2])
  })
})
