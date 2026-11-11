import { normalise } from '@/features/stadiview/data/textSearch'
import { SeatKind } from '@/features/stadiview/layout/types'
import type { VenueLayout } from '@/features/stadiview/layout/types'

/**
 * The stadium seen from straight above, as the 2D seat matrix shows it: which seat is at a point
 * of the plan, and which seat a typed seat number means.
 */

/** Seats sorted into one-metre squares, so finding the seat at a point looks at nine squares, not 7,998 seats. */
const grids = new WeakMap<VenueLayout, Map<number, number[]>>()
const CELL = 1
const key = (cx: number, cz: number) => (cx + 512) * 2048 + (cz + 512)

function gridOf(v: VenueLayout): Map<number, number[]> {
  let grid = grids.get(v)
  if (!grid) {
    grid = new Map()
    for (let i = 0; i < v.count; i++) {
      const k = key(Math.floor(v.position[i * 3] / CELL), Math.floor(v.position[i * 3 + 2] / CELL))
      const list = grid.get(k)
      if (list) list.push(i)
      else grid.set(k, [i])
    }
    grids.set(v, grid)
  }
  return grid
}

/**
 * The seat whose centre is nearest the point (x, z) of the plan, if it is within `reach` metres;
 * otherwise -1. Height is ignored: this is the view from above.
 */
export function seatAtPlan(x: number, z: number, v: VenueLayout, reach = 0.35): number {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return -1
  const grid = gridOf(v)
  const cx = Math.floor(x / CELL)
  const cz = Math.floor(z / CELL)
  let best = -1
  let bestD = reach * reach
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const list = grid.get(key(cx + dx, cz + dz))
      if (!list) continue
      for (const i of list) {
        const d = (v.position[i * 3] - x) ** 2 + (v.position[i * 3 + 2] - z) ** 2
        if (d <= bestD) {
          bestD = d
          best = i
        }
      }
    }
  }
  return best
}

export interface PlanBounds {
  x0: number
  z0: number
  x1: number
  z1: number
}

/** The rectangle of the plan that holds a set of seats: all of them, the pitch, one zone, or one section. */
export function planBounds(v: VenueLayout, what: 'all' | 'pitch' | { zone: number } | { section: number }): PlanBounds {
  const b = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity }
  const take = (i: number) => {
    const x = v.position[i * 3]
    const z = v.position[i * 3 + 2]
    if (x < b.x0) b.x0 = x
    if (x > b.x1) b.x1 = x
    if (z < b.z0) b.z0 = z
    if (z > b.z1) b.z1 = z
  }
  if (what === 'all') for (let i = 0; i < v.count; i++) take(i)
  else if (what === 'pitch') for (let i = 0; i < v.ranges.bays[1]; i++) take(i)
  else if ('zone' in what) {
    const zone = v.zones[what.zone]
    if (zone) for (let i = zone.start; i < zone.start + zone.count; i++) take(i)
  } else for (let i = 0; i < v.count; i++) if (v.section[i] === what.section && v.kind[i] !== SeatKind.AccessBay) take(i)
  // Nothing to show: a small square at the middle, rather than an inside-out rectangle.
  if (b.x0 > b.x1) return { x0: -1, z0: -1, x1: 1, z1: 1 }
  return b
}

/**
 * Reads a seat number as someone might type it. The exact id works (P3-12-07, S-10-060, P2-A1),
 * and so does the same thing with spaces, lower case, missing zeros or Arabic digits ("p3 12 7").
 * Three numbers alone mean a pitch block, row and seat ("3 12 7"). Returns -1 for no such seat.
 */
export function parseSeatQuery(text: string, v: VenueLayout): number {
  const plain = normalise(text).toUpperCase()
  const exact = v.indexOf(plain)
  if (exact >= 0) return exact
  const parts = plain.split(/[^A-Z0-9]+/).filter(Boolean)
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) parts[0] = `P${parts[0]}`
  if (parts.length === 2 && /^P\d+$/.test(parts[0]) && /^A\d+$/.test(parts[1])) return v.indexOf(`${parts[0]}-${parts[1]}`)
  if (parts.length !== 3 || !/^\d+$/.test(parts[1]) || !/^\d+$/.test(parts[2])) return -1
  const pitch = /^P\d+$/.test(parts[0])
  return v.indexOf(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(pitch ? 2 : 3, '0')}`)
}
