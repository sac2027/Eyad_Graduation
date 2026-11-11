import { describe, expect, it } from 'vitest'
import { VENUE } from '@/features/stadiview/config/venue'
import { bowlPieces, bowlRadii } from '@/features/stadiview/engine/decor'
import { concourse, routeTo, walkMinutes } from '@/features/stadiview/engine/routes'
import { SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

const v = getVenue()
const gatePos = (id: number) => VENUE.gates.find((g) => g.id === id)!.position

/** Ground rectangles of the pitch blocks, with a little margin. */
function blockBoxes() {
  const boxes = new Map<number, [number, number, number, number]>()
  for (let i = 0; i < v.ranges.pitch[1]; i++) {
    const b = boxes.get(v.section[i]) ?? [Infinity, -Infinity, Infinity, -Infinity]
    b[0] = Math.min(b[0], v.position[i * 3])
    b[1] = Math.max(b[1], v.position[i * 3])
    b[2] = Math.min(b[2], v.position[i * 3 + 2])
    b[3] = Math.max(b[3], v.position[i * 3 + 2])
    boxes.set(v.section[i], b)
  }
  return [...boxes.values()]
}

describe('the concourse', () => {
  it('passes through every gate', () => {
    const ring = concourse()
    for (const id of [1, 2, 3, 4, 5] as const) expect(ring.gates[id]).toBeGreaterThanOrEqual(0)
  })

  it('stays outside every stand and the bowl', () => {
    const { points } = concourse()
    const R = bowlRadii()
    const standSeats: [number, number][] = []
    for (let i = v.ranges.stands[0]; i < v.ranges.stands[1]; i++) standSeats.push([v.position[i * 3], v.position[i * 3 + 2]])
    for (let k = 0; k < points.length; k++) {
      const a = points[k]
      const b = points[(k + 1) % points.length]
      for (let t = 0; t <= 1; t += 0.02) {
        const x = a[0] + (b[0] - a[0]) * t
        const z = a[1] + (b[1] - a[1]) * t
        for (const [px, pz] of standSeats) if (Math.hypot(px - x, pz - z) < 1.5) expect.fail(`the concourse passes a seat at (${x.toFixed(1)}, ${z.toFixed(1)})`)
        for (const p of bowlPieces()) {
          const r = Math.hypot(x - p.cx, z - p.cz)
          const ang = (Math.atan2(z - p.cz, x - p.cx) * 180) / Math.PI
          const inside = r > R.inner - 1 && r < R.outer + 1 && ((ang >= p.fromDeg && ang <= p.toDeg) || (ang + 360 >= p.fromDeg && ang + 360 <= p.toDeg))
          if (inside) expect.fail(`the concourse crosses the bowl at (${x.toFixed(1)}, ${z.toFixed(1)})`)
        }
      }
    }
  })
})

describe('routes', () => {
  const sample: number[] = []
  for (let i = 0; i < v.count; i += 37) sample.push(i)
  sample.push(v.indexOf('S-02-084'), v.indexOf('VIP-03-025'), v.indexOf('P1-01-01'), v.indexOf('P6-20-14'), v.ranges.bays[0], v.ranges.bays[1] - 1)

  it('start at the right gate and end on the seat', () => {
    for (const s of sample) {
      const r = routeTo(s)
      const stand = v.kind[s] === SeatKind.Stand
      const gate = stand ? v.sections[v.section[s]].gate : VENUE.blocks.gate[VENUE.blocks.genders[v.section[s]]]
      expect(r.gate, v.idOf(s)).toBe(gate)
      const g = gatePos(gate)
      expect(Math.hypot(r.points[0][0] - g[0], r.points[0][2] - g[2]), v.idOf(s)).toBeLessThan(0.01)
      const end = r.points[r.points.length - 1]
      expect(end).toEqual([v.position[s * 3], v.position[s * 3 + 1], v.position[s * 3 + 2]])
    }
  })

  it('never step more than 6 m, and measure what they draw', () => {
    for (const s of sample) {
      const r = routeTo(s)
      let sum = 0
      for (let k = 1; k < r.points.length; k++) {
        const a = r.points[k - 1]
        const b = r.points[k]
        const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
        expect(d).toBeLessThanOrEqual(6)
        sum += d
      }
      expect(Math.abs(sum - r.length) / r.length).toBeLessThan(0.05)
      expect(r.legs).toHaveLength(r.points.length)
    }
  })

  it('keep guests off the pitch blocks', () => {
    const boxes = blockBoxes()
    for (const s of sample) {
      if (v.kind[s] !== SeatKind.Stand) continue
      for (const p of routeTo(s).points) {
        for (const [x0, x1, z0, z1] of boxes) expect(p[0] > x0 - 0.5 && p[0] < x1 + 0.5 && p[2] > z0 - 0.5 && p[2] < z1 + 0.5, v.idOf(s)).toBe(false)
      }
    }
  })

  it('take graduates past the Procession Start and up the carpet the way the march goes', () => {
    for (const s of sample) {
      if (v.kind[s] === SeatKind.Stand) continue
      const r = routeTo(s)
      const start = VENUE.march.start
      expect(r.points.some((p) => Math.hypot(p[0] - start[0], p[2] - start[2]) < 0.01), v.idOf(s)).toBe(true)
      // On the carpet (the march leg) they only ever go north.
      const march = r.points.filter((_, k) => r.legs[k] === 'march')
      for (let k = 1; k < march.length; k++) expect(march[k][2]).toBeLessThanOrEqual(march[k - 1][2] + 1e-9)
      expect(r.legs).toContain('tunnel')
    }
  })

  it('come in words: metres and minutes', () => {
    const r = routeTo(v.indexOf('S-02-084'))
    expect(r.length).toBeGreaterThan(20)
    expect(r.length).toBeLessThan(400)
    expect(walkMinutes(r)).toBeGreaterThanOrEqual(1)
  })
})
