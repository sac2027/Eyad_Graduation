import { VENUE } from '@/features/stadiview/config/venue'
import type { VenueConfig } from '@/features/stadiview/config/venue'
import { archCurve, archPosts } from '@/features/stadiview/engine/marchPath'
import type { Occluder } from '@/features/stadiview/engine/occluders'

/**
 * The new solid pieces that are only for the eye: the Procession Gate and the bowl's terraces.
 *
 * They are described in the same terms as the occluders, but they are **not** occluders: picking
 * never sees them. The list exists so tests can prove that none of them stands between the camera
 * and a seat that picking can reach.
 */

const rad = (d: number) => (d * Math.PI) / 180

/** One stretch of terraces with no gap in it: a ring sector about (cx, cz), angles in degrees. */
export interface BowlPiece {
  id: string
  cx: number
  cz: number
  fromDeg: number
  toDeg: number
}

/** The bowl's sections with their gaps cut out. */
export function bowlPieces(cfg: VenueConfig = VENUE): BowlPiece[] {
  const out: BowlPiece[] = []
  for (const s of cfg.bowl.sections) {
    let cuts = [[s.fromDeg, s.toDeg]]
    for (const g of s.gaps) {
      const g0 = g.atDeg - g.halfWidthDeg
      const g1 = g.atDeg + g.halfWidthDeg
      cuts = cuts.flatMap(([a, b]) => {
        if (g1 <= a || g0 >= b) return [[a, b]]
        return [[a, Math.min(b, g0)], [Math.max(a, g1), b]].filter(([x, y]) => y - x > 0.5)
      })
    }
    for (const [a, b] of cuts) out.push({ id: s.id, cx: s.cx, cz: s.cz, fromDeg: a, toDeg: b })
  }
  return out
}

/** The bowl's radii: the front of the first step, the back of the last, and the outside of the rear wall. */
export function bowlRadii(cfg: VenueConfig = VENUE): { inner: number; back: number; outer: number; top: number; lastFloor: number } {
  const b = cfg.bowl
  const inner = b.firstRadius - b.tread / 2
  const back = b.firstRadius + (b.rows - 1) * b.tread + b.tread / 2
  const lastFloor = b.firstY + (b.rows - 1) * b.riser
  return { inner, back, outer: back + cfg.walls.thickness, top: lastFloor + b.rise, lastFloor }
}

/**
 * The Procession Gate's solids. No post tall enough to walk under can avoid standing in front of
 * some chair from some angle, so outside first person the scene draws the arch as see-through light
 * (see ProcessionGate); these solids are for measuring how much it would cover if it were not.
 */
export function archSolids(cfg: VenueConfig = VENUE): Occluder[] {
  const list: Occluder[] = []
  const a = cfg.arch
  // The posts, up to where the arch springs; above them the pointed band, as one box per short
  // piece of it (each box holds its whole piece, so the list hides a little more than the band does).
  const posts = archPosts(cfg)
  for (const [x0, x1, z0, z1] of posts) list.push({ kind: 'box', min: [x0, 0, z0], max: [x1, a.springY, z1] })
  const curve = archCurve(cfg, 48)
  const t = a.band / 2
  for (let k = 1; k < curve.length; k++) {
    const [za, ya] = curve[k - 1]
    const [zb, yb] = curve[k]
    list.push({ kind: 'box', min: [a.x - a.bandDepth / 2, Math.min(ya, yb) - t, Math.min(za, zb) - t], max: [a.x + a.bandDepth / 2, Math.max(ya, yb) + t, Math.max(za, zb) + t] })
  }
  return list
}

/** The bowl's solids: each step's riser as a curved wall from the ground to its tread, and the rear wall. */
export function bowlSolids(cfg: VenueConfig = VENUE): Occluder[] {
  const list: Occluder[] = []
  const b = cfg.bowl
  const r = bowlRadii(cfg)
  for (const piece of bowlPieces(cfg)) {
    const from = rad(piece.fromDeg)
    const to = rad(piece.toDeg)
    for (let k = 0; k < b.rows; k++) {
      list.push({ kind: 'arc', cx: piece.cx, cz: piece.cz, radius: r.inner + k * b.tread, from, to, y0: 0, y1: b.firstY + k * b.riser })
    }
    list.push({ kind: 'arc', cx: piece.cx, cz: piece.cz, radius: r.back, from, to, y0: 0, y1: r.top })
  }
  return list
}

/** Everything new and solid. */
export function decorSolids(cfg: VenueConfig = VENUE): Occluder[] {
  return [...archSolids(cfg), ...bowlSolids(cfg)]
}
