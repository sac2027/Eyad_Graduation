import { BufferAttribute, BufferGeometry, Color } from 'three'
import type { AvatarKind } from '@/features/stadiview/data/occupancy'

/**
 * The seated figures, as plain geometry.
 *
 * Every figure is a dark, faceless silhouette (head, hands, feet) inside its garment: a black bisht
 * with gold zari trim over the KFUPM shawl for the men graduating, a graduation abaya and shayla
 * for the women, a white thobe for the men in the stands and a black abaya for the women. They are
 * drawn thousands of times, so each is a handful of simple shapes with its shading painted on, like
 * the chairs; there are no faces, no fingers and nothing comic.
 *
 * A figure sits on the chair at its origin, on the floor, facing -Z (a seat with yaw 0). It stays
 * inside the chair's footprint plus 0.12 m each side, so neighbours 0.6 m apart never meet.
 */

export type Lod = 'near' | 'far'
export type Headwear = 'ghutra' | 'shemagh'

/** The garment colours, as written in the plan. */
export const AVATAR_COLORS = {
  silhouette: '#0D1513',
  bisht: '#0B0B0C',
  zari: '#C9A227',
  thobe: '#ECE9E1',
  ghutra: '#F1EEE6',
  shemagh: '#A3202C',
  iqal: '#050505',
  abaya: '#111112',
  shayla: '#141415',
  shawl: '#005A50',
  shawlEdge: '#E7A614',
  wheel: '#2B3432',
} as const
type Paint = keyof typeof AVATAR_COLORS

export interface AvatarMesh {
  /** Three floats per corner, three corners per triangle, no index. */
  positions: Float32Array
  /** Linear-light colours, shading included. */
  colors: Float32Array
  triangles: number
  /** Which triangles belong to which named part: [first, count]. For tests. */
  parts: Record<string, [number, number]>
  /** Which paint each triangle used, for tests. */
  paints: Paint[]
}

type V = [number, number, number]

class FigureBuilder {
  positions: number[] = []
  colors: number[] = []
  paints: Paint[] = []
  parts: Record<string, [number, number]> = {}
  private linear = new Map<Paint, [number, number, number]>()

  private rgb(paint: Paint): [number, number, number] {
    let c = this.linear.get(paint)
    if (!c) {
      const col = new Color(AVATAR_COLORS[paint])
      c = [col.r, col.g, col.b]
      this.linear.set(paint, c)
    }
    return c
  }

  /** One triangle, wound to face away from `inside`, with shading painted on from its direction and height. */
  tri(a: V, b: V, c: V, paint: Paint, inside: V) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const mx = (a[0] + b[0] + c[0]) / 3 - inside[0]
    const my = (a[1] + b[1] + c[1]) / 3 - inside[1]
    const mz = (a[2] + b[2] + c[2]) / 3 - inside[2]
    const flip = nx * mx + ny * my + nz * mz < 0
    if (flip) {
      nx = -nx
      ny = -ny
      nz = -nz
    }
    const len = Math.hypot(nx, ny, nz) || 1
    // Tops catch the floodlights; faces toward the stage a little more than those away from it.
    const face = 0.58 + 0.42 * Math.max(0, ny / len) + 0.12 * Math.max(0, -nz / len) - 0.08 * Math.max(0, nz / len)
    const [r, g, bl] = this.rgb(paint)
    for (const p of flip ? [a, c, b] : [a, b, c]) {
      this.positions.push(p[0], p[1], p[2])
      // Darker toward the floor, as in the shadow between rows.
      const k = Math.min(1, face * (0.62 + 0.38 * Math.min(1, p[1] / 1.25)))
      this.colors.push(r * k, g * k, bl * k)
    }
    this.paints.push(paint)
  }

  quad(a: V, b: V, c: V, d: V, paint: Paint, inside: V) {
    this.tri(a, b, c, paint, inside)
    this.tri(a, c, d, paint, inside)
  }

  /**
   * A tapered block: a bottom rectangle at y0 and a top one at y1, each [xHalf, zFront, zBack].
   * `open` leaves faces out: 'bottom' is always left out (nobody sees it).
   */
  block(y0: number, bottom: [number, number, number], y1: number, top: [number, number, number], paint: Paint, open: ('front' | 'top' | 'back' | 'sides')[] = []) {
    const [bx, bf, bb] = bottom
    const [tx, tf, tb] = top
    const B: V[] = [[-bx, y0, bf], [bx, y0, bf], [bx, y0, bb], [-bx, y0, bb]]
    const T: V[] = [[-tx, y1, tf], [tx, y1, tf], [tx, y1, tb], [-tx, y1, tb]]
    const inside: V = [0, (y0 + y1) / 2, (bf + bb + tf + tb) / 4]
    if (!open.includes('front')) this.quad(B[0], B[1], T[1], T[0], paint, inside)
    if (!open.includes('sides')) {
      this.quad(B[1], B[2], T[2], T[1], paint, inside)
      this.quad(B[3], B[0], T[0], T[3], paint, inside)
    }
    if (!open.includes('back')) this.quad(B[2], B[3], T[3], T[2], paint, inside)
    if (!open.includes('top')) this.quad(T[0], T[1], T[2], T[3], paint, inside)
  }

  /** A four-sided peak on a rectangle [xHalf, zFront, zBack] at y, rising to `apex`: the crown of a head-cloth. */
  crown(y: number, base: [number, number, number], apex: V, paint: Paint) {
    const [x, f0, b0] = base
    const c: V[] = [[-x, y, f0], [x, y, f0], [x, y, b0], [-x, y, b0]]
    const inside: V = [0, y - 0.05, (f0 + b0) / 2]
    for (let k = 0; k < 4; k++) this.tri(c[k], c[(k + 1) % 4], apex, paint, inside)
  }

  /** A flat panel facing -Z (toward the stage) at depth z, from x0 to x1 and y0 to y1. */
  panel(x0: number, x1: number, y0: number, y1: number, z: number, paint: Paint) {
    this.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], paint, [(x0 + x1) / 2, (y0 + y1) / 2, z + 1])
  }

  /** A head with no features: an eight-sided lozenge. */
  head(cy: number, rx: number, ry: number, rz: number, cz: number) {
    const top: V = [0, cy + ry, cz]
    const bottom: V = [0, cy - ry, cz]
    const ring: V[] = [[rx, cy, cz], [0, cy, cz - rz], [-rx, cy, cz], [0, cy, cz + rz]]
    const c: V = [0, cy, cz]
    for (let k = 0; k < 4; k++) {
      this.tri(top, ring[k], ring[(k + 1) % 4], 'silhouette', c)
      this.tri(bottom, ring[k], ring[(k + 1) % 4], 'silhouette', c)
    }
  }

  /** A wheel: a flat ring of `n` segments in the plane x = x, about (y, z). */
  wheel(x: number, cy: number, cz: number, r0: number, r1: number, n: number) {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2
      const a1 = ((k + 1) / n) * Math.PI * 2
      const p = (r: number, a: number): V => [x, cy + r * Math.sin(a), cz + r * Math.cos(a)]
      this.quad(p(r0, a0), p(r1, a0), p(r1, a1), p(r0, a1), 'wheel', [x - Math.sign(x), cy, cz])
    }
  }

  part(name: string, build: () => void) {
    const first = this.paints.length
    build()
    this.parts[name] = [first, this.paints.length - first]
  }

  done(): AvatarMesh {
    return { positions: new Float32Array(this.positions), colors: new Float32Array(this.colors), triangles: this.paints.length, parts: this.parts, paints: this.paints }
  }
}

/** Heights and depths shared by every seated figure, in metres, on a chair whose seat is 0.44 m up. */
const SEAT = 0.44
const KNEE = { z: -0.33, y: 0.56 }
const SHOULDER = 1.0
const HEAD = { y: 1.12, z: 0.02 }

function nearFigure(kind: AvatarKind, headwear: Headwear): AvatarMesh {
  const f = new FigureBuilder()
  const graduate = kind === 'grad-m' || kind === 'grad-f' || kind === 'bay-m' || kind === 'bay-f'
  const man = kind === 'grad-m' || kind === 'bay-m' || kind === 'family-m'
  // The outer garment: a bisht, a graduation abaya, a thobe, or an abaya.
  const robe: Paint = man ? (graduate ? 'bisht' : 'thobe') : 'abaya'

  f.part('feet', () => f.block(0, [0.15, -0.35, -0.22], 0.08, [0.15, -0.34, -0.23], 'silhouette'))
  f.part('legs', () => {
    // The garment falls from the knees to the ankles (a little flared), or to the floor for an abaya.
    const hem = man ? 0.08 : 0.02
    f.block(hem, [man ? 0.26 : 0.28, -0.35, -0.2], KNEE.y - 0.04, [0.25, -0.35, -0.22], robe, ['top'])
  })
  f.part('lap', () => f.block(SEAT, [0.25, KNEE.z, 0.08], KNEE.y + 0.04, [0.25, KNEE.z, 0.08], robe, ['back']))
  f.part('hands', () => f.block(KNEE.y + 0.04, [0.16, -0.2, -0.1], KNEE.y + 0.09, [0.15, -0.19, -0.11], 'silhouette', ['back', 'sides']))
  // The torso leans back a little against the chair.
  f.part('torso', () => f.block(KNEE.y, [0.25, -0.1, 0.13], SHOULDER, [0.22, -0.07, 0.13], robe))

  if (man && graduate) {
    // The bisht is open at the front: the white thobe shows down the chest, edged in gold zari.
    const zf = -0.077
    f.part('thobe', () => f.panel(-0.05, 0.05, KNEE.y + 0.06, SHOULDER - 0.02, zf - 0.004, 'thobe'))
    f.part('trim', () => {
      f.panel(-0.072, -0.05, KNEE.y + 0.02, SHOULDER, zf - 0.006, 'zari')
      f.panel(0.05, 0.072, KNEE.y + 0.02, SHOULDER, zf - 0.006, 'zari')
    })
    f.part('collar', () => f.block(SHOULDER - 0.05, [0.225, -0.083, 0.135], SHOULDER + 0.005, [0.225, -0.083, 0.135], 'zari', ['back', 'top']))
  }
  if (graduate) {
    // The KFUPM shawl: two green bands down the front, tipped in gold.
    f.part('shawl', () => {
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? -0.16 : 0.09
        const x1 = s < 0 ? -0.09 : 0.16
        f.panel(x0, x1, KNEE.y + 0.12, SHOULDER - 0.01, -0.086, 'shawl')
        f.panel(x0, x1, KNEE.y + 0.06, KNEE.y + 0.12, -0.087, 'shawlEdge')
      }
    })
  }

  f.part('face', () => f.head(HEAD.y, 0.085, 0.115, 0.1, HEAD.z))
  if (man) {
    const cloth: Paint = headwear === 'shemagh' ? 'shemagh' : 'ghutra'
    // The ghutra or shemagh: draped from a peaked crown down over the shoulders, open in front of the face.
    f.part('headcloth', () => {
      f.block(0.93, [0.21, -0.04, 0.18], 1.17, [0.115, -0.085, 0.13], cloth, ['front', 'top'])
      f.crown(1.17, [0.115, -0.085, 0.13], [0, 1.28, 0.03], cloth)
    })
    f.part('iqal', () => f.block(1.165, [0.125, -0.095, 0.14], 1.2, [0.12, -0.093, 0.137], 'iqal', ['top']))
  } else {
    // The shayla: wrapped over the head and round the face, falling over the shoulders.
    f.part('headcloth', () => {
      f.block(0.86, [0.22, -0.05, 0.18], 1.16, [0.115, -0.09, 0.13], 'shayla', ['front', 'top'])
      f.crown(1.16, [0.115, -0.09, 0.13], [0, 1.26, 0.03], 'shayla')
    })
    f.part('wrap', () => f.panel(-0.1, 0.1, 0.94, 1.02, -0.092, 'shayla'))
  }

  if (kind === 'bay-m' || kind === 'bay-f') {
    f.part('wheels', () => {
      f.wheel(-0.33, 0.3, 0.02, 0.24, 0.3, 8)
      f.wheel(0.33, 0.3, 0.02, 0.24, 0.3, 8)
    })
  }
  return f.done()
}

function farFigure(kind: AvatarKind, headwear: Headwear): AvatarMesh {
  const f = new FigureBuilder()
  const graduate = kind.startsWith('grad') || kind.startsWith('bay')
  const man = kind.endsWith('-m')
  const robe: Paint = man ? (graduate ? 'bisht' : 'thobe') : 'abaya'
  f.part('lap', () => f.block(SEAT, [0.25, KNEE.z, 0.08], KNEE.y + 0.04, [0.25, KNEE.z, 0.08], robe, ['back', 'sides']))
  // The head-cloth covers the shoulders' top, so the torso needs none.
  f.part('torso', () => f.block(KNEE.y, [0.25, -0.1, 0.13], SHOULDER, [0.22, -0.07, 0.13], robe, ['top']))
  const top: Paint = man ? (headwear === 'shemagh' ? 'shemagh' : 'ghutra') : 'shayla'
  f.part('headcloth', () => {
    f.block(SHOULDER - 0.06, [0.2, -0.08, 0.16], 1.16, [0.11, -0.085, 0.13], top, ['top'])
    f.crown(1.16, [0.11, -0.085, 0.13], [0, 1.27, 0.03], top)
  })
  if (kind.startsWith('bay')) {
    f.part('wheels', () => {
      f.panel(-0.34, -0.33, 0.02, 0.58, 0, 'wheel')
      f.panel(0.33, 0.34, 0.02, 0.58, 0, 'wheel')
    })
  }
  return f.done()
}

/** A seated figure of a kind, near (detailed) or far (a silhouette in the same colours). */
export function avatarMesh(kind: AvatarKind, lod: Lod, headwear: Headwear = 'ghutra'): AvatarMesh {
  return lod === 'near' ? nearFigure(kind, headwear) : farFigure(kind, headwear)
}

/** The same, as a three.js geometry with `color` per corner. */
export function avatarGeometry(kind: AvatarKind, lod: Lod, headwear: Headwear = 'ghutra'): BufferGeometry {
  const m = avatarMesh(kind, lod, headwear)
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(m.positions, 3))
  g.setAttribute('color', new BufferAttribute(m.colors, 3))
  g.computeBoundingSphere()
  return g
}
