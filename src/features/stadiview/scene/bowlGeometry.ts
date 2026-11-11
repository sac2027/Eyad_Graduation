import type { BufferGeometry } from 'three'
import { VENUE } from '@/features/stadiview/config/venue'
import type { VenueConfig, Vec3 } from '@/features/stadiview/config/venue'
import { bowlPieces, bowlRadii } from '@/features/stadiview/engine/decor'
import { MeshBuilder } from '@/features/stadiview/scene/meshBuilder'
import { PAINT } from '@/features/stadiview/scene/palette'

/** The bench stripes on the closed terraces: the photo's pale concrete seating, without chairs. */
const BENCH = '#3A5550'
const STAIR = '#203834'
/** The dark mouth of a tunnel at each opening. */
const TUNNEL = '#071512'
/** Angular step of the terraces' curve, in degrees. */
const STEP_DEG = 2

const rad = (d: number) => (d * Math.PI) / 180

/**
 * The terraces that close the bowl round the bends: rows of steps with a pale bench along each,
 * radial stairs, a rear wall, closed ends and dark tunnel mouths at the openings. No seats, no
 * figures, nothing to pick: they are for the eye, and Task 1's tests prove they hide no seat.
 */
export function buildBowlGeometry(cfg: VenueConfig = VENUE): BufferGeometry {
  const b = cfg.bowl
  const r = bowlRadii(cfg)
  const m = new MeshBuilder()
  const UP: Vec3 = [0, 1, 0]

  for (const piece of bowlPieces(cfg)) {
    const span = piece.toDeg - piece.fromDeg
    const n = Math.max(1, Math.ceil(span / STEP_DEG))
    const at = (deg: number, radius: number, y: number): Vec3 => [piece.cx + radius * Math.cos(rad(deg)), y, piece.cz + radius * Math.sin(rad(deg))]
    // Is this short stretch one of the radial stairs?
    const stair = (deg: number) => Math.abs(((deg - piece.fromDeg + b.stairEveryDeg / 2) % b.stairEveryDeg) - b.stairEveryDeg / 2) < 0.9

    for (let s = 0; s < n; s++) {
      const a0 = piece.fromDeg + (span * s) / n
      const a1 = piece.fromDeg + (span * (s + 1)) / n
      const mid = (a0 + a1) / 2
      const outward: Vec3 = [Math.cos(rad(mid)), 0, Math.sin(rad(mid))]
      const inward: Vec3 = [-outward[0], 0, -outward[2]]
      const onStair = stair(mid)
      for (let k = 0; k < b.rows; k++) {
        const front = r.inner + k * b.tread
        const back = front + b.tread
        const y = b.firstY + k * b.riser
        const below = k === 0 ? 0 : y - b.riser
        // The riser, facing the pitch.
        m.face([at(a0, front, below), at(a1, front, below), at(a1, front, y), at(a0, front, y)], inward, PAINT.riser)
        if (onStair) {
          m.face([at(a0, front, y), at(a1, front, y), at(a1, back, y), at(a0, back, y)], UP, STAIR)
        } else {
          // The tread, with a bench along its back half.
          const split = front + b.tread * 0.45
          m.face([at(a0, front, y), at(a1, front, y), at(a1, split, y), at(a0, split, y)], UP, PAINT.tread)
          m.face([at(a0, split, y), at(a1, split, y), at(a1, back, y), at(a0, back, y)], UP, BENCH)
        }
      }
      // The rear wall: its inside above the last step, its outside to the ground, and its top.
      m.face([at(a0, r.back, r.lastFloor), at(a1, r.back, r.lastFloor), at(a1, r.back, r.top), at(a0, r.back, r.top)], inward, PAINT.wall)
      m.face([at(a0, r.outer, 0), at(a1, r.outer, 0), at(a1, r.outer, r.top), at(a0, r.outer, r.top)], outward, PAINT.wallDark)
      m.face([at(a0, r.back, r.top), at(a1, r.back, r.top), at(a1, r.outer, r.top), at(a0, r.outer, r.top)], UP, PAINT.fascia)
    }

    // The two ends: a wall stepping up with the rows, and a dark tunnel mouth at its foot where the opening is.
    for (const [deg, sign] of [[piece.fromDeg, -1], [piece.toDeg, 1]] as const) {
      const tangent: Vec3 = [-Math.sin(rad(deg)) * sign, 0, Math.cos(rad(deg)) * sign]
      for (let k = 0; k < b.rows; k++) {
        const front = r.inner + k * b.tread
        const y = b.firstY + k * b.riser
        m.face([at(deg, front, 0), at(deg, front + b.tread, 0), at(deg, front + b.tread, y), at(deg, front, y)], tangent, PAINT.wall)
      }
      m.face([at(deg, r.back, 0), at(deg, r.outer, 0), at(deg, r.outer, r.top), at(deg, r.back, r.top)], tangent, PAINT.wallDark)
      const isGap = cfg.bowl.sections.some((sec) => sec.id === piece.id && sec.gaps.some((g) => Math.abs(deg - (g.atDeg + sign * -g.halfWidthDeg)) < 0.01))
      if (isGap) m.face([at(deg, r.inner + 2, 0.02), at(deg, r.back - 1, 0.02), at(deg, r.back - 1, 2.6), at(deg, r.inner + 2, 2.6)], tangent, TUNNEL)
    }
  }
  return m.build()
}
