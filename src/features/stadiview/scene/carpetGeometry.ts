import { BufferAttribute, BufferGeometry } from 'three'
import { VENUE } from '@/features/stadiview/config/venue'
import type { VenueConfig, Vec3 } from '@/features/stadiview/config/venue'
import { leftOf } from '@/features/stadiview/engine/marchPath'
import type { MarchPath } from '@/features/stadiview/engine/marchPath'
import { MeshBuilder } from '@/features/stadiview/scene/meshBuilder'
import { CARPET } from '@/features/stadiview/scene/palette'

/** The gold trim along each edge, in metres. */
export const TRIM = 0.15
/** The carpet lies at the seating pads' level: above the grass by 4 cm and the old runner by 2, so nothing flickers. */
export const CARPET_Y = 0

/** The side offsets of a point of the path, at distances `offsets` to its left (negative: to its right). */
function across(path: MarchPath, k: number, offsets: number[], y: number): Vec3[] {
  const p = path.points[k]
  const l = leftOf(path.at(path.along[k]).dir)
  return offsets.map((o) => [p[0] + l[0] * o, y, p[2] + l[2] * o] as Vec3)
}

/**
 * The runner: a crimson ribbon with a gold trim along each edge, in three strips across its width,
 * lit like the ground (it shares the baked floodlight).
 */
export function buildCarpetGeometry(path: MarchPath, cfg: VenueConfig = VENUE): BufferGeometry {
  const half = cfg.march.width / 2
  const offsets = [half, half - TRIM, -(half - TRIM), -half]
  const paints = [CARPET.trim, CARPET.crimson, CARPET.trim]
  const m = new MeshBuilder()
  let prev = across(path, 0, offsets, CARPET_Y)
  for (let k = 1; k < path.points.length; k++) {
    const next = across(path, k, offsets, CARPET_Y)
    for (let s = 0; s < 3; s++) m.face([prev[s], prev[s + 1], next[s + 1], next[s]], [0, 1, 0], paints[s])
    prev = next
  }
  return m.build()
}

/**
 * A ribbon over the carpet for the arrows, `width` across. Its UV runs `along` the path in metres
 * (x), so arrows drawn in UV space point the way the graduates walk, and across it from 0 to 1 (y).
 */
export function buildArrowRibbon(path: MarchPath, width: number, y = CARPET_Y + 0.02): BufferGeometry {
  const n = path.points.length
  const positions = new Float32Array(n * 2 * 3)
  const uv = new Float32Array(n * 2 * 2)
  const index: number[] = []
  for (let k = 0; k < n; k++) {
    const [a, b] = across(path, k, [width / 2, -width / 2], y)
    positions.set(a, k * 6)
    positions.set(b, k * 6 + 3)
    uv.set([path.along[k], 0, path.along[k], 1], k * 4)
    if (k > 0) {
      const p = (k - 1) * 2
      const q = k * 2
      index.push(p, q, p + 1, p + 1, q, q + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(positions, 3))
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  g.setIndex(index)
  g.computeBoundingSphere()
  return g
}
