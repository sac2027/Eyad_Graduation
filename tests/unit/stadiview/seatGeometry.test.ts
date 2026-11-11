import { describe, expect, it } from 'vitest'
import { CHAIR_BOX } from '@/features/stadiview/engine/seatFrame'
import { CHAIR_HALF_WIDTH, CHAIR_PROFILE, CHAIR_TRIANGLES, chairGeometry, seatMatrix } from '@/features/stadiview/scene/seatGeometry'

type V3 = [number, number, number]

describe('the chair', () => {
  const g = chairGeometry()
  const p = g.getAttribute('position')
  const index = g.getIndex()
  const count = index ? index.count : p.count
  const corner = (k: number): V3 => {
    const i = index ? index.getX(k) : k
    return [p.getX(i), p.getY(i), p.getZ(i)]
  }

  it('is cheap: no more than 24 triangles, since it is drawn 7,998 times', () => {
    expect(count / 3).toBe(CHAIR_TRIANGLES)
    expect(CHAIR_TRIANGLES).toBeLessThanOrEqual(24)
    // 7,998 chairs must leave room for the rest of the stadium in the 450,000 triangle budget.
    expect(CHAIR_TRIANGLES * 7998).toBeLessThan(200_000)
  })

  it('stands on the floor and fits inside the box the pointer picks', () => {
    g.computeBoundingBox()
    const b = g.boundingBox!
    expect(b.min.y).toBe(0)
    expect(b.max.y).toBeLessThanOrEqual(CHAIR_BOX.height)
    expect(b.max.y).toBeGreaterThan(CHAIR_BOX.height - 0.1)
    expect(b.min.x).toBeGreaterThanOrEqual(-CHAIR_BOX.halfW)
    expect(b.max.x).toBeLessThanOrEqual(CHAIR_BOX.halfW)
    expect(b.min.z).toBeGreaterThanOrEqual(-CHAIR_BOX.halfD)
    expect(b.max.z).toBeLessThanOrEqual(CHAIR_BOX.halfD)
  })

  it('faces -Z: the tall back is behind the seat', () => {
    let top: V3 = [0, -1, 0]
    for (let k = 0; k < count; k++) {
      const c = corner(k)
      if (c[1] > top[1]) top = c
    }
    expect(top[2]).toBeGreaterThan(0.1)
  })

  it('is closed everywhere but underneath: a step out of any face leaves the chair, a step in enters it', () => {
    // Inside the chair means between its two sides and inside its side outline.
    const insideOutline = (z: number, y: number) => {
      let inside = false
      for (let i = 0, j = CHAIR_PROFILE.length - 1; i < CHAIR_PROFILE.length; j = i++) {
        const [zi, yi] = CHAIR_PROFILE[i]
        const [zj, yj] = CHAIR_PROFILE[j]
        if (yi > y !== yj > y && z < ((zj - zi) * (y - yi)) / (yj - yi) + zi) inside = !inside
      }
      return inside
    }
    const inChair = (q: V3) => Math.abs(q[0]) < CHAIR_HALF_WIDTH && insideOutline(q[2], q[1])
    for (let k = 0; k < count; k += 3) {
      const a = corner(k)
      const b = corner(k + 1)
      const c = corner(k + 2)
      const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const w: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const n: V3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
      const l = Math.hypot(...n)
      expect(l).toBeGreaterThan(0)
      const mid: V3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]
      const step = (d: number): V3 => [mid[0] + (n[0] / l) * d, mid[1] + (n[1] / l) * d, mid[2] + (n[2] / l) * d]
      expect(inChair(step(0.002)), `triangle ${k / 3} faces out`).toBe(false)
      expect(inChair(step(-0.002)), `triangle ${k / 3} has the chair behind it`).toBe(true)
    }
  })

  it('carries its own shading: brightest on top, never black', () => {
    const color = g.getAttribute('color')
    expect(color).toBeDefined()
    let brightestUp = 0
    let brightest = 0
    for (let k = 0; k < count; k += 3) {
      const a = corner(k)
      const b = corner(k + 1)
      const c = corner(k + 2)
      const i = index ? index.getX(k) : k
      const shade = color.getX(i)
      expect(shade).toBeGreaterThan(0.2)
      expect(shade).toBeLessThanOrEqual(1)
      // The same shade on all three channels: it only dims the seat's own colour.
      expect(color.getY(i)).toBe(shade)
      expect(color.getZ(i)).toBe(shade)
      brightest = Math.max(brightest, shade)
      const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2])
      const flatUp = ny > 0 && Math.abs(a[1] - b[1]) < 0.05 && Math.abs(a[1] - c[1]) < 0.05
      if (flatUp) brightestUp = Math.max(brightestUp, shade)
    }
    expect(brightestUp).toBe(1)
    expect(brightest).toBe(1)
  })

  it('darkens upright faces toward the floor, so rows of chair backs read as rows', () => {
    const color = g.getAttribute('color')
    // The rear face runs from the top of the back rest down to the floor behind the chair.
    let atTop = 0
    let atFloor = 1
    for (let k = 0; k < count; k++) {
      const c = corner(k)
      const i = index ? index.getX(k) : k
      if (c[2] < 0.2) continue // only the rear edge of the chair
      if (c[1] > 0.9) atTop = Math.max(atTop, color.getX(i))
      if (c[1] === 0) atFloor = Math.min(atFloor, color.getX(i))
    }
    expect(atFloor).toBeLessThan(atTop * 0.6)
  })
})

describe('placing a chair', () => {
  const m = new Float32Array(32)

  it('writes a column-major matrix that turns the chair to its yaw and moves it to its place', () => {
    seatMatrix(m, 1, 10, 2, -5, Math.PI / 2, 1)
    const at = (x: number, y: number, z: number): V3 => [
      m[16] * x + m[20] * y + m[24] * z + m[28],
      m[17] * x + m[21] * y + m[25] * z + m[29],
      m[18] * x + m[22] * y + m[26] * z + m[30],
    ]
    // The chair's forward direction is -Z. At a yaw of +90 degrees it must face west (-X), like every pitch seat.
    const origin = at(0, 0, 0)
    const ahead = at(0, 0, -1)
    expect(origin).toEqual([10, 2, -5])
    expect(ahead[0] - origin[0]).toBeCloseTo(-1, 6)
    expect(ahead[1] - origin[1]).toBeCloseTo(0, 6)
    expect(ahead[2] - origin[2]).toBeCloseTo(0, 6)
    expect(Array.from(m.slice(28, 32))).toEqual([10, 2, -5, 1])
    // The first slot was not touched.
    expect(Array.from(m.slice(0, 16)).every((x) => x === 0)).toBe(true)
  })

  it('faces north at yaw 0 and south at yaw pi, as the stands do', () => {
    seatMatrix(m, 0, 0, 0, 0, 0, 1)
    expect(-m[10]).toBeCloseTo(-1, 6) // -Z stays -Z
    seatMatrix(m, 0, 0, 0, 0, Math.PI, 1)
    expect(-m[10]).toBeCloseTo(1, 6)
  })

  it('scales about the foot of the chair, so a highlighted seat grows upward and outward but stays on its floor', () => {
    seatMatrix(m, 0, 3, 1.2, 4, 0.7, 1.25)
    expect(Math.hypot(m[0], m[1], m[2])).toBeCloseTo(1.25, 6)
    expect(m[5]).toBeCloseTo(1.25, 6)
    expect(Array.from(m.slice(12, 15))).toEqual([3, Math.fround(1.2), 4])
  })
})
