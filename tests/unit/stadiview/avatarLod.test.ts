import { describe, expect, it } from 'vitest'
import { insideClear, nearestSet } from '@/features/stadiview/scene/avatarLod'

function random(seed: number) {
  let a = seed
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0
    return a / 4294967296
  }
}

describe('choosing the detailed figures', () => {
  const r = random(7)
  const count = 3000
  const positions = new Float32Array(count * 3)
  for (let k = 0; k < positions.length; k++) positions[k] = (r() - 0.5) * 200
  const seats = Int32Array.from({ length: 1800 }, (_, k) => k * 1 + (k % 3))
  const eye = [10, 40, -20] as const
  const d = (s: number) => Math.hypot(positions[s * 3] - eye[0], positions[s * 3 + 1] - eye[1], positions[s * 3 + 2] - eye[2])

  it('picks exactly the n nearest', () => {
    for (const n of [1, 150, 400, 900]) {
      const picked = nearestSet(seats, positions, eye, n)
      expect(picked).toHaveLength(n)
      const sorted = [...seats].sort((a, b) => d(a) - d(b))
      const cutoff = d(sorted[n - 1])
      for (const s of picked) expect(d(s)).toBeLessThanOrEqual(cutoff + 1e-9)
      expect(new Set(picked).size).toBe(n)
    }
  })

  it('gives the same set for the same eye', () => {
    const a = [...nearestSet(seats, positions, eye, 150)].sort()
    const b = [...nearestSet(seats, positions, eye, 150)].sort()
    expect(a).toEqual(b)
  })

  it('copes with none, and with asking for more than there are', () => {
    expect(nearestSet([], positions, eye, 10)).toHaveLength(0)
    expect(nearestSet(seats, positions, eye, 0)).toHaveLength(0)
    expect(nearestSet(seats.slice(0, 5), positions, eye, 10)).toHaveLength(5)
  })
})

describe('the clear circle', () => {
  const eye = [0, 1.15, 0] as const
  it('clears the seat itself, its neighbours and the row in front, not two rows away', () => {
    expect(insideClear(0, 0, 0, eye, 1.5)).toBe(true)
    expect(insideClear(0.6, 0, 0, eye, 1.5)).toBe(true)
    expect(insideClear(-1, 0, 0, eye, 1.5)).toBe(true)
    expect(insideClear(-1, 0, 0.6, eye, 1.5)).toBe(true)
    expect(insideClear(-2, 0, 0, eye, 1.5)).toBe(false)
  })
  it('ignores seats far above or below, and clears nothing with a radius of 0', () => {
    expect(insideClear(0.6, 4, 0, eye, 1.5)).toBe(false)
    expect(insideClear(0, 0, 0, eye, 0)).toBe(false)
  })
})
