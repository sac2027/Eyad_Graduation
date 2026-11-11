import { BufferAttribute, BufferGeometry, Color } from 'three'
import type { Vec3 } from '@/features/stadiview/config/venue'

/**
 * The baked floodlight texture covers a square of the venue this many metres either side of the
 * origin. Every geometry made here carries a UV that maps its x and z onto that square, so any
 * lit surface can read how much floodlight falls on it.
 */
export const POOL_SPAN = 180

/** A face of a box: the direction its outside looks. */
export type BoxFace = '+x' | '-x' | '+y' | '-y' | '+z' | '-z'

const ALL_FACES: BoxFace[] = ['+x', '-x', '+y', '-y', '+z', '-z']

/**
 * Collects flat, coloured faces into one geometry.
 *
 * The stadium is drawn as a handful of large meshes, not thousands of small ones: every mesh costs
 * the graphics card a separate draw, and a phone can afford only a few dozen. Each scene part
 * builds all its boxes, floors and walls into one of these and draws them together.
 *
 * Faces are flat-shaded (each has its own corners and one normal) and coloured per corner, so one
 * material serves the whole stadium.
 */
export class MeshBuilder {
  private readonly positions: number[] = []
  private readonly normals: number[] = []
  private readonly colors: number[] = []
  private readonly linear = new Map<string, [number, number, number]>()
  private readonly scratch = new Color()

  /** Triangles collected so far. */
  get triangles(): number {
    return this.positions.length / 9
  }

  /** The colour as the renderer wants it: linear light, not the sRGB of the hex code. */
  private rgb(hex: string): [number, number, number] {
    let c = this.linear.get(hex)
    if (!c) {
      this.scratch.set(hex)
      c = [this.scratch.r, this.scratch.g, this.scratch.b]
      this.linear.set(hex, c)
    }
    return c
  }

  private corner(p: Vec3, n: Vec3, hex: string): void {
    const c = this.rgb(hex)
    this.positions.push(p[0], p[1], p[2])
    this.normals.push(n[0], n[1], n[2])
    this.colors.push(c[0], c[1], c[2])
  }

  /**
   * A flat face with three or four corners, given in order round its edge (either way round).
   *
   * `toward` is any direction the face's visible side should look along, for example straight up
   * for a floor. The corners are wound to match, so callers never have to think about winding.
   * `paint` is one colour for the face, or one per corner for a gradient.
   */
  face(corners: Vec3[], toward: Vec3, paint: string | string[]): this {
    const [a, b, c] = corners
    const ux = b[0] - a[0]
    const uy = b[1] - a[1]
    const uz = b[2] - a[2]
    const vx = c[0] - a[0]
    const vy = c[1] - a[1]
    const vz = c[2] - a[2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const length = Math.hypot(nx, ny, nz)
    if (length === 0) return this // a face with no area draws nothing
    nx /= length
    ny /= length
    nz /= length
    const flip = nx * toward[0] + ny * toward[1] + nz * toward[2] < 0
    const n: Vec3 = flip ? [-nx, -ny, -nz] : [nx, ny, nz]
    const order = flip ? [...corners.keys()].reverse() : [...corners.keys()]
    const colorOf = (k: number) => (typeof paint === 'string' ? paint : paint[k])
    // A fan from the first corner: one triangle for three corners, two for four.
    for (let k = 1; k < order.length - 1; k++) {
      for (const j of [order[0], order[k], order[k + 1]]) this.corner(corners[j], n, colorOf(j))
    }
    return this
  }

  /** A level rectangle facing up, from (x0, z0) to (x1, z1) at height y. */
  floor(x0: number, z0: number, x1: number, z1: number, y: number, paint: string): this {
    return this.face([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, 1, 0], paint)
  }

  /**
   * A box square to the axes. `paint` is one colour, or a colour per face (faces left out of the
   * record are not drawn). `omit` leaves faces out, for example the bottom of a box that stands on
   * the ground.
   */
  box(min: Vec3, max: Vec3, paint: string | Partial<Record<BoxFace, string>>, omit: BoxFace[] = []): this {
    const [x0, y0, z0] = min
    const [x1, y1, z1] = max
    for (const f of ALL_FACES) {
      if (omit.includes(f)) continue
      const color = typeof paint === 'string' ? paint : paint[f]
      if (!color) continue
      if (f === '+x') this.face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0], color)
      else if (f === '-x') this.face([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0], color)
      else if (f === '+y') this.face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], color)
      else if (f === '-y') this.face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], color)
      else if (f === '+z') this.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], color)
      else this.face([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1], color)
    }
    return this
  }

  /**
   * A box standing on level ground but turned about the upright axis: its long side runs along the
   * level unit vector (dirX, dirZ). `along` and `across` are half-lengths. The bottom is not drawn.
   */
  turnedBox(cx: number, cz: number, y0: number, y1: number, along: number, across: number, dirX: number, dirZ: number, paint: string): this {
    // The level vector a quarter turn from the long side.
    const px = -dirZ
    const pz = dirX
    const at = (a: number, c: number, y: number): Vec3 => [cx + a * dirX + c * px, y, cz + a * dirZ + c * pz]
    for (const sign of [1, -1]) {
      this.face([at(sign * along, -across, y0), at(sign * along, across, y0), at(sign * along, across, y1), at(sign * along, -across, y1)], [sign * dirX, 0, sign * dirZ], paint)
      this.face([at(-along, sign * across, y0), at(along, sign * across, y0), at(along, sign * across, y1), at(-along, sign * across, y1)], [sign * px, 0, sign * pz], paint)
    }
    this.face([at(-along, -across, y1), at(along, -across, y1), at(along, across, y1), at(-along, across, y1)], [0, 1, 0], paint)
    return this
  }

  /**
   * An upright prism with a regular polygon as its cross-section: a column, a mast, a pylon.
   * It may taper (`r0` at the bottom, `r1` at the top). The top is capped; the bottom is not.
   */
  prism(cx: number, cz: number, y0: number, y1: number, r0: number, r1: number, sides: number, paint: string, turn = 0): this {
    const at = (k: number, r: number, y: number): Vec3 => {
      const a = turn + (k / sides) * Math.PI * 2
      return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)]
    }
    for (let k = 0; k < sides; k++) {
      const mid = turn + ((k + 0.5) / sides) * Math.PI * 2
      this.face([at(k, r0, y0), at(k + 1, r0, y0), at(k + 1, r1, y1), at(k, r1, y1)], [Math.cos(mid), 0, Math.sin(mid)], paint)
      this.face([[cx, y1, cz], at(k, r1, y1), at(k + 1, r1, y1)], [0, 1, 0], paint)
    }
    return this
  }

  /**
   * A level strip that follows part of a circle: the tread of a curved stand row, a lane of a bend.
   * Angles are radians from east (+X) toward south (+Z), as everywhere in the venue.
   */
  ring(cx: number, cz: number, r0: number, r1: number, from: number, to: number, y: number, segments: number, paint: string): this {
    for (let k = 0; k < segments; k++) {
      const a = from + ((to - from) * k) / segments
      const b = from + ((to - from) * (k + 1)) / segments
      this.face(
        [
          [cx + r0 * Math.cos(a), y, cz + r0 * Math.sin(a)],
          [cx + r1 * Math.cos(a), y, cz + r1 * Math.sin(a)],
          [cx + r1 * Math.cos(b), y, cz + r1 * Math.sin(b)],
          [cx + r0 * Math.cos(b), y, cz + r0 * Math.sin(b)],
        ],
        [0, 1, 0],
        paint,
      )
    }
    return this
  }

  /**
   * An upright curved wall on part of a circle, from height y0 to y1. `outward` says which side is
   * drawn: true for the side looking away from the centre, false for the side looking at it.
   */
  curvedWall(cx: number, cz: number, r: number, from: number, to: number, y0: number, y1: number, segments: number, paint: string, outward: boolean): this {
    for (let k = 0; k < segments; k++) {
      const a = from + ((to - from) * k) / segments
      const b = from + ((to - from) * (k + 1)) / segments
      const mid = (a + b) / 2
      const sign = outward ? 1 : -1
      this.face(
        [
          [cx + r * Math.cos(a), y0, cz + r * Math.sin(a)],
          [cx + r * Math.cos(b), y0, cz + r * Math.sin(b)],
          [cx + r * Math.cos(b), y1, cz + r * Math.sin(b)],
          [cx + r * Math.cos(a), y1, cz + r * Math.sin(a)],
        ],
        [sign * Math.cos(mid), 0, sign * Math.sin(mid)],
        paint,
      )
    }
    return this
  }

  /** The finished geometry: positions, normals, colours and the floodlight UV. */
  build(): BufferGeometry {
    const count = this.positions.length / 3
    const uv = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      uv[i * 2] = (this.positions[i * 3] + POOL_SPAN) / (2 * POOL_SPAN)
      uv[i * 2 + 1] = (this.positions[i * 3 + 2] + POOL_SPAN) / (2 * POOL_SPAN)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3))
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.normals), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3))
    g.setAttribute('uv', new BufferAttribute(uv, 2))
    g.computeBoundingSphere()
    return g
  }
}

/**
 * One flat rectangle with a UV that runs 0 to 1 across it, for surfaces that carry a picture or a
 * shader: the LED screens and the stage backdrop. The corners are given as the viewer sees them
 * (bottom-left, bottom-right, top-right, top-left), so text on it reads the right way round.
 */
export function pictureQuad(bottomLeft: Vec3, bottomRight: Vec3, topRight: Vec3, topLeft: Vec3): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array([...bottomLeft, ...bottomRight, ...topRight, ...topLeft]), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}
