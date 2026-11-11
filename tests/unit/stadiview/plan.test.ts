import { describe, expect, it } from 'vitest'
import { parseSeatQuery, planBounds, seatAtPlan } from '@/features/stadiview/engine/planIndex'
import { fitView, panBy, SCALE_MAX, SCALE_MIN, toPlan, toScreen, zoomAt } from '@/features/stadiview/engine/planView'
import { getDirectory } from '@/features/stadiview/data/graduateDirectory'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

const v = getVenue()

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a * 16807) % 2147483647
    return a / 2147483647
  }
}

describe('seatAtPlan', () => {
  it('agrees with a search of every seat, on 5,000 points across the venue', () => {
    const random = seeded(99)
    let hits = 0
    let misses = 0
    for (let k = 0; k < 5000; k++) {
      // Half the points near a seat, half anywhere.
      let x: number
      let z: number
      if (k % 2 === 0) {
        const i = Math.floor(random() * v.count)
        x = v.position[i * 3] + (random() - 0.5) * 1.2
        z = v.position[i * 3 + 2] + (random() - 0.5) * 1.2
      } else {
        x = -110 + 220 * random()
        z = -80 + 160 * random()
      }
      let best = -1
      let bestD = 0.35 * 0.35
      for (let i = 0; i < v.count; i++) {
        const d = (v.position[i * 3] - x) ** 2 + (v.position[i * 3 + 2] - z) ** 2
        if (d <= bestD) {
          bestD = d
          best = i
        }
      }
      const got = seatAtPlan(x, z, v)
      if (got !== best) {
        // Two seats at exactly the same distance may be reported either way round; anything else is wrong.
        const dGot = got < 0 ? Infinity : (v.position[got * 3] - x) ** 2 + (v.position[got * 3 + 2] - z) ** 2
        expect(Math.abs(dGot - bestD)).toBeLessThan(1e-9)
      }
      if (best >= 0) hits++
      else misses++
    }
    expect(hits).toBeGreaterThan(1500)
    expect(misses).toBeGreaterThan(1500)
  })

  it('finds a seat at its own position and nothing in an aisle, on the grass or off the map', () => {
    const i = v.indexOf('P3-12-07')
    expect(seatAtPlan(v.position[i * 3], v.position[i * 3 + 2], v)).toBe(i)
    expect(seatAtPlan(v.position[i * 3] + 0.2, v.position[i * 3 + 2] - 0.2, v)).toBe(i)
    // The aisle between blocks 1 and 2.
    expect(seatAtPlan(-26, -21.6, v)).toBe(-1)
    expect(seatAtPlan(40, 0, v)).toBe(-1)
    expect(seatAtPlan(5000, 5000, v)).toBe(-1)
    expect(seatAtPlan(Number.NaN, 0, v)).toBe(-1)
    // A wider reach picks up the nearest seat from the edge of the aisle.
    expect(seatAtPlan(-26, -22.2, v, 1)).toBeGreaterThanOrEqual(0)
  })
})

describe('planBounds', () => {
  it('frames the whole stadium, the pitch, a zone and a section', () => {
    const all = planBounds(v, 'all')
    expect(all.x1).toBeGreaterThan(95)
    expect(all.z1).toBeGreaterThan(65)
    const pitch = planBounds(v, 'pitch')
    expect(pitch).toEqual({ x0: -31.5, x1: 18, z0: expect.closeTo(-30.9, 4), z1: expect.closeTo(30.9, 4) })
    const khaled = getDirectory().byPersona('grad-m-gold')!
    const zone = planBounds(v, { zone: khaled.zone })
    // Engineering bachelors: the first 342 men's seats, five rows across blocks 2 to 6.
    expect(zone.x0).toBe(-30)
    expect(zone.x1).toBe(-26)
    expect(zone.z0).toBeGreaterThan(-21)
    const south = planBounds(v, { section: v.sections.findIndex((s) => s.id === 'S') })
    expect(south.z0).toBe(53)
    expect(planBounds(v, { zone: 999 })).toEqual({ x0: -1, z0: -1, x1: 1, z1: 1 })
  })
})

describe('parseSeatQuery', () => {
  it('reads a seat number however it is typed', () => {
    const seat = v.indexOf('P3-12-07')
    for (const q of ['P3-12-07', 'p3-12-7', ' P3 12 7 ', '3 12 7', '3-12-07', 'P3/12/7', 'P٣-١٢-٠٧']) expect(parseSeatQuery(q, v), q).toBe(seat)
    expect(parseSeatQuery('S-10-060', v)).toBe(v.indexOf('S-10-060'))
    expect(parseSeatQuery('s 10 60', v)).toBe(v.indexOf('S-10-060'))
    expect(parseSeatQuery('vip 3 25', v)).toBe(v.indexOf('VIP-03-025'))
    expect(parseSeatQuery('P2-A1', v)).toBe(v.indexOf('P2-A1'))
    expect(parseSeatQuery('p2 a1', v)).toBe(v.indexOf('P2-A1'))
  })
  it('gives -1 for a seat that does not exist or text that is not a seat', () => {
    for (const q of ['P9-01-01', 'P3-99-01', 'P3-12-15', '', 'hello', '12', 'S-10', 'TICKET-G1-204']) expect(parseSeatQuery(q, v), q).toBe(-1)
  })
})

describe('the plan view', () => {
  const view = { cx: 3, cz: -7, scale: 6 }

  it('turns pixels into plan points and back', () => {
    for (const [px, py] of [[0, 0], [180, 110], [360, 220], [47.5, 201]]) {
      const [x, z] = toPlan(view, px, py, 360, 220)
      const [bx, by] = toScreen(view, x, z, 360, 220)
      expect(bx).toBeCloseTo(px, 9)
      expect(by).toBeCloseTo(py, 9)
    }
    // The centre of the picture is the centre of the view; east is right and south is down.
    expect(toPlan(view, 180, 110, 360, 220)).toEqual([3, -7])
    expect(toPlan(view, 186, 110, 360, 220)[0]).toBeCloseTo(4, 9)
    expect(toPlan(view, 180, 116, 360, 220)[1]).toBeCloseTo(-6, 9)
  })

  it('zooms about the pointer: the point under it stays under it', () => {
    const before = toPlan(view, 300, 40, 360, 220)
    const zoomed = zoomAt(view, 1.8, 300, 40, 360, 220)
    expect(zoomed.scale).toBeCloseTo(10.8, 9)
    const after = toPlan(zoomed, 300, 40, 360, 220)
    expect(after[0]).toBeCloseTo(before[0], 9)
    expect(after[1]).toBeCloseTo(before[1], 9)
  })

  it('never zooms out past the whole stadium or in past a chair the size of a finger', () => {
    expect(zoomAt(view, 0.0001, 0, 0, 360, 220).scale).toBe(SCALE_MIN)
    expect(zoomAt(view, 10000, 0, 0, 360, 220).scale).toBe(SCALE_MAX)
    expect(fitView({ x0: 0, z0: 0, x1: 0.1, z1: 0.1 }, 360, 220).scale).toBe(SCALE_MAX)
    expect(fitView({ x0: -5000, z0: -5000, x1: 5000, z1: 5000 }, 360, 220).scale).toBe(SCALE_MIN)
  })

  it('fits bounds inside the picture with the padding to spare', () => {
    const b = { x0: -31.5, z0: -30.9, x1: 18, z1: 30.9 }
    const fit = fitView(b, 360, 220, 12)
    const [l, t] = toScreen(fit, b.x0, b.z0, 360, 220)
    const [r, bottom] = toScreen(fit, b.x1, b.z1, 360, 220)
    expect(l).toBeGreaterThanOrEqual(12 - 1e-9)
    expect(t).toBeGreaterThanOrEqual(12 - 1e-9)
    expect(r).toBeLessThanOrEqual(348 + 1e-9)
    expect(bottom).toBeLessThanOrEqual(208 + 1e-9)
    // One of the two directions is filled exactly.
    expect(Math.min(l - 12, t - 12)).toBeCloseTo(0, 6)
  })

  it('pans with the pointer', () => {
    const moved = panBy(view, 12, -6)
    expect(moved).toEqual({ cx: 1, cz: -6, scale: 6 })
    // The point that was under (100, 100) is now under (112, 94).
    const p = toPlan(view, 100, 100, 360, 220)
    expect(toScreen(moved, p[0], p[1], 360, 220)).toEqual([112, 94])
  })
})
