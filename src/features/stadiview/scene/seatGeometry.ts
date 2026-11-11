import { BufferAttribute, BufferGeometry } from 'three'

/**
 * The chair every seat is drawn with: one solid shape, a seat block with a back rising from its
 * rear edge. It is drawn 7,998 times, so it is as plain as a chair can be and still read as one.
 *
 * The chair stands on the floor at its origin and faces -Z, the direction a seat with yaw 0 faces.
 * It fits inside the pick box (CHAIR_BOX), so the pointer is over a seat wherever its chair shows.
 */

/** Half the chair's width. */
export const CHAIR_HALF_WIDTH = 0.23

/**
 * The chair's outline seen from its right-hand side, as [z, y] points in order round it: up the
 * front, back along the seat, up the back rest, over its top and down the rear. Negative z is the
 * front. The underside is left open; nobody sees it.
 */
export const CHAIR_PROFILE: [number, number][] = [
  [-0.22, 0], // front, on the floor
  [-0.22, 0.44], // front edge of the seat
  [0.11, 0.42], // where the seat meets the back rest
  [0.19, 0.93], // top of the back rest, front
  [0.245, 0.93], // top of the back rest, rear
  [0.215, 0], // rear, on the floor
]

/**
 * How brightly each face is drawn, as a share of the seat's own colour. The seats are not lit by
 * the scene's lamps (that would cost a phone too much for 7,998 chairs), so the shading a lamp
 * would give is painted on instead: tops full, upright faces dimmer, the rear dimmest.
 */
const SHADE = { seat: 1, backFront: 0.9, backTop: 1, front: 0.76, side: 0.7, rear: 0.7 }

/**
 * Upright faces also darken toward the floor, as they would in the shadow between rows: this much
 * of their shade is left at floor level. Without it a row of chair backs seen from the seat behind
 * is one flat band of colour; with it every row has a light top edge against the dark foot of the
 * row beyond.
 */
const FLOOR_SHADE = 0.42
const TOP = Math.max(...CHAIR_PROFILE.map((p) => p[1]))

/** The outline cut into triangles. The corner where the seat meets the back rest points inward, so a simple fan would spill outside it. */
const SIDE_TRIANGLES = [
  [0, 1, 2],
  [0, 2, 5],
  [2, 3, 4],
  [2, 4, 5],
]

/** Triangles in one chair. */
export const CHAIR_TRIANGLES = 5 * 2 + SIDE_TRIANGLES.length * 2

export function chairGeometry(): BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const w = CHAIR_HALF_WIDTH
  const P = CHAIR_PROFILE

  // One triangle, wound so that its lit side looks along `out` (a rough direction is enough).
  const tri = (a: number[], b: number[], c: number[], out: [number, number, number], shade: number) => {
    const ux = b[0] - a[0]
    const uy = b[1] - a[1]
    const uz = b[2] - a[2]
    const vx = c[0] - a[0]
    const vy = c[1] - a[1]
    const vz = c[2] - a[2]
    const facing = (uy * vz - uz * vy) * out[0] + (uz * vx - ux * vz) * out[1] + (ux * vy - uy * vx) * out[2]
    // Faces that look up keep one shade; the others fade toward the floor.
    const upward = shade === 1
    for (const p of facing >= 0 ? [a, b, c] : [a, c, b]) {
      positions.push(p[0], p[1], p[2])
      const k = upward ? shade : shade * (FLOOR_SHADE + (1 - FLOOR_SHADE) * (p[1] / TOP))
      colors.push(k, k, k)
    }
  }

  // The five strips that run across the chair, each between two neighbouring points of the outline.
  const strips: [number, number][] = [
    [0, SHADE.front],
    [1, SHADE.seat],
    [2, SHADE.backFront],
    [3, SHADE.backTop],
    [4, SHADE.rear],
  ]
  for (const [k, shade] of strips) {
    const [z0, y0] = P[k]
    const [z1, y1] = P[k + 1]
    // Outward from the outline: a quarter turn from its direction of travel, on the side away from the chair's inside.
    const out: [number, number, number] = [0, z1 - z0, -(y1 - y0)]
    tri([-w, y0, z0], [w, y0, z0], [w, y1, z1], out, shade)
    tri([-w, y0, z0], [w, y1, z1], [-w, y1, z1], out, shade)
  }

  // The two sides.
  for (const x of [-w, w]) {
    for (const [a, b, c] of SIDE_TRIANGLES) {
      tri([x, P[a][1], P[a][0]], [x, P[b][1], P[b][0]], [x, P[c][1], P[c][0]], [x, 0, 0], SHADE.side)
    }
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  g.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  g.computeBoundingSphere()
  return g
}

/**
 * Writes the placement of one chair into slot `slot` of an instance-matrix array: turned to `yaw`
 * about the upright axis, grown by `scale` about its foot, and moved to (x, y, z).
 *
 * The matrix is written out by hand, column by column as three.js stores it, because building
 * 7,998 of them through matrix objects is slow enough to notice on a phone.
 */
export function seatMatrix(out: Float32Array, slot: number, x: number, y: number, z: number, yaw: number, scale: number): void {
  const c = Math.cos(yaw) * scale
  const s = Math.sin(yaw) * scale
  const o = slot * 16
  out[o] = c
  out[o + 1] = 0
  out[o + 2] = -s
  out[o + 3] = 0
  out[o + 4] = 0
  out[o + 5] = scale
  out[o + 6] = 0
  out[o + 7] = 0
  out[o + 8] = s
  out[o + 9] = 0
  out[o + 10] = c
  out[o + 11] = 0
  out[o + 12] = x
  out[o + 13] = y
  out[o + 14] = z
  out[o + 15] = 1
}
