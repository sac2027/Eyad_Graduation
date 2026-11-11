import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'
import { VENUE } from '@/features/stadiview/config/venue'
import { SeatKind } from '@/features/stadiview/layout/types'
import { buildVenue, getVenue } from '@/features/stadiview/layout/venueLayout'
import { buildOccluders } from '@/features/stadiview/engine/occluders'
import { buildCones, buildHalos, buildMasts } from '@/features/stadiview/scene/Floodlights'
import { buildGroundGeometry, buildGroundLines, buildTrackGeometry, laneTexture } from '@/features/stadiview/scene/Ground'
import { MeshBuilder, pictureQuad, POOL_SPAN } from '@/features/stadiview/scene/meshBuilder'
import { floodlightPool } from '@/features/stadiview/scene/sceneKit'
import { buildStage } from '@/features/stadiview/scene/Stage'
import { buildStands } from '@/features/stadiview/scene/Stands'

type V3 = [number, number, number]

/** Every triangle of a geometry, as corner positions plus the normal its winding gives. */
function triangles(g: BufferGeometry): { a: V3; b: V3; c: V3; normal: V3; stored: V3 | null }[] {
  const p = g.getAttribute('position')
  const n = g.getAttribute('normal')
  const index = g.getIndex()
  const count = index ? index.count : p.count
  const at = (i: number): V3 => [p.getX(i), p.getY(i), p.getZ(i)]
  const out = []
  for (let k = 0; k < count; k += 3) {
    const ia = index ? index.getX(k) : k
    const ib = index ? index.getX(k + 1) : k + 1
    const ic = index ? index.getX(k + 2) : k + 2
    const a = at(ia)
    const b = at(ib)
    const c = at(ic)
    const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const cross: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const l = Math.hypot(...cross)
    out.push({ a, b, c, normal: [cross[0] / l, cross[1] / l, cross[2] / l] as V3, stored: n ? ([n.getX(ia), n.getY(ia), n.getZ(ia)] as V3) : null })
  }
  return out
}

function allFinite(g: BufferGeometry): boolean {
  for (const name of Object.keys(g.attributes)) {
    const array = g.getAttribute(name).array as ArrayLike<number>
    for (let i = 0; i < array.length; i++) if (!Number.isFinite(array[i])) return false
  }
  return true
}

function bounds(g: BufferGeometry) {
  g.computeBoundingBox()
  return g.boundingBox!
}

describe('MeshBuilder', () => {
  it('winds a face so that it looks the way it was asked to, whichever way its corners were listed', () => {
    const corners: V3[] = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]
    for (const order of [corners, [...corners].reverse()]) {
      for (const toward of [[0, 1, 0], [0, -1, 0]] as V3[]) {
        const g = new MeshBuilder().face(order, toward, '#ffffff').build()
        const ts = triangles(g)
        expect(ts).toHaveLength(2)
        for (const t of ts) {
          expect(t.normal[1]).toBeCloseTo(toward[1], 6)
          // The normal stored for the renderer is the one the winding gives.
          t.normal.forEach((x, k) => expect(t.stored![k]).toBeCloseTo(x, 6))
        }
      }
    }
  })

  it('draws a triangle for three corners and nothing for a face with no area', () => {
    expect(new MeshBuilder().face([[0, 0, 0], [1, 0, 0], [0, 0, 1]], [0, 1, 0], '#fff').triangles).toBe(1)
    expect(new MeshBuilder().face([[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]], [0, 1, 0], '#fff').triangles).toBe(0)
  })

  it('gives every face of a box a normal pointing out of the box', () => {
    const g = new MeshBuilder().box([1, 2, 3], [2, 4, 6], '#ffffff').build()
    const ts = triangles(g)
    expect(ts).toHaveLength(12)
    const centre: V3 = [1.5, 3, 4.5]
    for (const t of ts) {
      const mid: V3 = [(t.a[0] + t.b[0] + t.c[0]) / 3, (t.a[1] + t.b[1] + t.c[1]) / 3, (t.a[2] + t.b[2] + t.c[2]) / 3]
      const out = (mid[0] - centre[0]) * t.normal[0] + (mid[1] - centre[1]) * t.normal[1] + (mid[2] - centre[2]) * t.normal[2]
      expect(out).toBeGreaterThan(0)
    }
  })

  it('leaves out the faces it is told to, and those missing from a per-face paint list', () => {
    expect(new MeshBuilder().box([0, 0, 0], [1, 1, 1], '#fff', ['-y']).triangles).toBe(10)
    expect(new MeshBuilder().box([0, 0, 0], [1, 1, 1], { '+y': '#fff', '+x': '#000' }).triangles).toBe(4)
  })

  it('turns a box, a prism, a ring and a curved wall the right way out', () => {
    const outwardFrom = (g: BufferGeometry, cx: number, cz: number) =>
      triangles(g).every((t) => {
        const mid: V3 = [(t.a[0] + t.b[0] + t.c[0]) / 3, 0, (t.a[2] + t.b[2] + t.c[2]) / 3]
        return Math.abs(t.normal[1]) > 0.99 || (mid[0] - cx) * t.normal[0] + (mid[2] - cz) * t.normal[2] > 0
      })
    expect(outwardFrom(new MeshBuilder().turnedBox(5, -3, 0, 2, 4, 1, Math.SQRT1_2, Math.SQRT1_2, '#fff').build(), 5, -3)).toBe(true)
    expect(outwardFrom(new MeshBuilder().prism(5, -3, 0, 9, 1, 0.5, 6, '#fff').build(), 5, -3)).toBe(true)
    expect(outwardFrom(new MeshBuilder().curvedWall(5, -3, 10, 0.2, 1.1, 0, 3, 8, '#fff', true).build(), 5, -3)).toBe(true)
    // The inward-looking side of a curved wall faces the centre.
    expect(outwardFrom(new MeshBuilder().curvedWall(5, -3, 10, 0.2, 1.1, 0, 3, 8, '#fff', false).build(), 5, -3)).toBe(false)
    for (const t of triangles(new MeshBuilder().ring(5, -3, 8, 10, 1.1, 0.2, 2, 8, '#fff').build())) expect(t.normal[1]).toBeCloseTo(1, 6)
  })

  it('stores colours as linear light, and a UV that maps the venue from above', () => {
    const g = new MeshBuilder().floor(-POOL_SPAN, -POOL_SPAN, POOL_SPAN, POOL_SPAN, 0, '#808080').build()
    const color = g.getAttribute('color')
    // sRGB 0x80 is about 21.6% in linear light, not 50%.
    expect(color.getX(0)).toBeCloseTo(0.2158, 3)
    const uv = g.getAttribute('uv')
    const p = g.getAttribute('position')
    for (let i = 0; i < p.count; i++) {
      expect(uv.getX(i)).toBeCloseTo((p.getX(i) + POOL_SPAN) / (2 * POOL_SPAN), 6)
      expect(uv.getY(i)).toBeCloseTo((p.getZ(i) + POOL_SPAN) / (2 * POOL_SPAN), 6)
    }
  })

  it('makes a picture rectangle whose UV runs from the bottom-left corner to the top-right', () => {
    const g = pictureQuad([0, 0, 0], [2, 0, 0], [2, 1, 0], [0, 1, 0])
    expect(Array.from(g.getAttribute('uv').array)).toEqual([0, 0, 1, 0, 1, 1, 0, 1])
    // Listed as the viewer sees them, the corners make a face that looks back at the viewer (+Z here).
    for (const t of triangles(g)) expect(t.normal[2]).toBeCloseTo(1, 6)
  })
})

describe('the ground', () => {
  const ground = buildGroundGeometry()
  const lines = buildGroundLines()
  const track = buildTrackGeometry()

  it('is made only of level faces that look up, at or below the level the chairs stand on', () => {
    for (const g of [ground, lines, track]) {
      expect(allFinite(g)).toBe(true)
      for (const t of triangles(g)) {
        expect(t.normal[1]).toBeCloseTo(1, 5)
        expect(Math.max(t.a[1], t.b[1], t.c[1])).toBeLessThanOrEqual(0)
      }
    }
  })

  it('puts a pad at chair level under every pitch seat and every bay', () => {
    const v = getVenue()
    const pads = triangles(ground).filter((t) => t.a[1] === 0)
    const covered = (x: number, z: number) =>
      pads.some((t) => {
        const xs = [t.a[0], t.b[0], t.c[0]]
        const zs = [t.a[2], t.b[2], t.c[2]]
        // Pads are rectangles square to the axes, so two triangles tile each one; a point inside the rectangle is on a pad.
        return x >= Math.min(...xs) && x <= Math.max(...xs) && z >= Math.min(...zs) && z <= Math.max(...zs)
      })
    for (let i = 0; i < v.ranges.bays[1]; i++) {
      // The chair is half a metre square about its position.
      for (const [dx, dz] of [[-0.25, -0.25], [0.25, 0.25]]) {
        expect(covered(v.position[i * 3] + dx, v.position[i * 3 + 2] + dz), v.idOf(i)).toBe(true)
      }
    }
  })

  it('keeps the seating floor inside the pitch and off the stage', () => {
    const b = bounds(buildGroundLines())
    expect(b.min.x).toBeCloseTo(-VENUE.pitch.length / 2, 5)
    expect(b.max.x).toBeCloseTo(VENUE.pitch.length / 2, 5)
    const pads = triangles(ground).filter((t) => t.a[1] === 0)
    for (const t of pads) {
      for (const p of [t.a, t.b, t.c]) {
        expect(Math.abs(p[2])).toBeLessThan(VENUE.pitch.width / 2)
        expect(p[0]).toBeGreaterThan(VENUE.stage.deck.xMax + VENUE.stage.steps.count * VENUE.stage.steps.run)
        expect(p[0]).toBeLessThan(VENUE.pitch.length / 2)
      }
    }
  })

  it('follows a changed config: a longer block gets a longer floor', () => {
    const cfg = structuredClone(VENUE)
    cfg.zones[0].count += 14 * 20 // twenty more rows in the women's block
    const longer = buildGroundGeometry(cfg, buildVenue(cfg))
    const maxPadX = (g: BufferGeometry) => Math.max(...triangles(g).filter((t) => t.a[1] === 0).map((t) => Math.max(t.a[0], t.b[0], t.c[0])))
    expect(maxPadX(longer)).toBeGreaterThan(maxPadX(ground) + 15)
  })

  it('draws the track as a band between the kerb and the outer lane, with matching UVs', () => {
    const t = VENUE.track
    const outer = t.innerRadius + t.lanes * t.laneWidth
    const b = bounds(track)
    expect(b.max.x).toBeCloseTo(t.straightHalf + outer, 4)
    expect(b.min.x).toBeCloseTo(-t.straightHalf - outer, 4)
    expect(b.max.z).toBeCloseTo(outer, 4)
    const p = track.getAttribute('position')
    const uv = track.getAttribute('uv')
    const uv1 = track.getAttribute('uv1')
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      // Distance from the track's centre line shape: the kerb is at innerRadius, the outside at `outer`.
      const d = Math.abs(x) <= t.straightHalf ? Math.abs(z) : Math.hypot(Math.abs(x) - t.straightHalf, z)
      expect(d).toBeCloseTo(uv.getX(i) === 0 ? t.innerRadius : outer, 3)
      expect(uv1.getX(i)).toBeCloseTo((x + POOL_SPAN) / (2 * POOL_SPAN), 5)
      expect(uv1.getY(i)).toBeCloseTo((z + POOL_SPAN) / (2 * POOL_SPAN), 5)
    }
  })

  it('paints one line per lane edge across the lane texture', () => {
    const texture = laneTexture(8)
    const data = texture.image.data as Uint8Array
    const width = texture.image.width
    // Count runs of line-coloured pixels along the first row: a line is lighter than the surface.
    const surface = data[Math.round(width / 16) * 4 + 1]
    let runs = 0
    let inRun = false
    for (let i = 0; i < width; i++) {
      const light = data[i * 4 + 1] > surface + 30
      if (light && !inRun) runs++
      inRun = light
    }
    expect(runs).toBe(9)
  })
})

describe('the stands', () => {
  const v = getVenue()
  const parts = buildStands()
  const ts = triangles(parts.lit)

  it('builds finite geometry well inside the triangle budget', () => {
    expect(allFinite(parts.lit)).toBe(true)
    expect(allFinite(parts.glow)).toBe(true)
    expect(ts.length).toBeGreaterThan(1500)
    expect(ts.length).toBeLessThan(20_000)
  })

  it('puts a level tread under every stand seat, at the seat\'s own floor height', () => {
    const treads = ts.filter((t) => t.normal[1] > 0.999)
    // Sort the treads by height once, so each seat only looks at treads on its own level.
    const byHeight = new Map<number, typeof treads>()
    for (const t of treads) {
      const key = Math.round(t.a[1] * 100)
      if (!byHeight.has(key)) byHeight.set(key, [])
      byHeight.get(key)!.push(t)
    }
    const inside = (t: (typeof treads)[number], x: number, z: number) => {
      const sign = (p: V3, q: V3) => (x - q[0]) * (p[2] - q[2]) - (p[0] - q[0]) * (z - q[2])
      const d1 = sign(t.a, t.b)
      const d2 = sign(t.b, t.c)
      const d3 = sign(t.c, t.a)
      return !((d1 < -1e-4 || d2 < -1e-4 || d3 < -1e-4) && (d1 > 1e-4 || d2 > 1e-4 || d3 > 1e-4))
    }
    let missing = 0
    let first = ''
    for (let i = v.ranges.stands[0]; i < v.ranges.stands[1]; i++) {
      const [x, y, z] = [v.position[i * 3], v.position[i * 3 + 1], v.position[i * 3 + 2]]
      const level = byHeight.get(Math.round(y * 100)) ?? []
      if (!level.some((t) => inside(t, x, z))) {
        missing++
        first ||= v.idOf(i)
      }
    }
    expect({ missing, first }).toEqual({ missing: 0, first: '' })
  })

  it('draws every wall that blocks picking', () => {
    const occ = buildOccluders()
    const b = bounds(parts.lit)
    for (const o of occ.slice(1)) {
      if (o.kind === 'box') {
        expect(b.min.x).toBeLessThanOrEqual(o.min[0])
        expect(b.max.x).toBeGreaterThanOrEqual(o.max[0])
        // A face of the drawn geometry lies in the plane of the wall's far side.
        const z = Math.abs(o.min[2]) > Math.abs(o.max[2]) ? o.min[2] : o.max[2]
        expect(ts.some((t) => [t.a, t.b, t.c].every((p) => Math.abs(p[2] - z) < 1e-4)), JSON.stringify(o)).toBe(true)
      } else if (o.kind === 'side') {
        expect(ts.some((t) => [t.a, t.b, t.c].every((p) => Math.abs(p[0] - o.x) < 1e-4) && Math.max(t.a[1], t.b[1], t.c[1]) > o.y1 - 1e-3), JSON.stringify(o)).toBe(true)
      } else {
        const onArc = (p: V3) => Math.abs(Math.hypot(p[0] - o.cx, p[2] - o.cz) - o.radius) < 1e-3
        expect(ts.some((t) => [t.a, t.b, t.c].every(onArc)), JSON.stringify(o)).toBe(true)
      }
    }
  })

  it('carries the brand pattern on the back of the canopy stand, sized to that wall', () => {
    const vip = VENUE.stands.find((s) => s.id === VENUE.canopy.over)!
    expect(parts.vipBack).not.toBeNull()
    expect(parts.vipBack!.size).toEqual([vip.kind === 'line' ? vip.xMax - vip.xMin : 0, VENUE.canopy.yBottom])
    // The pattern faces away from the pitch: north, for a stand on the north side.
    for (const t of triangles(parts.vipBack!.geometry)) expect(t.normal[2]).toBeCloseTo(-1, 6)
  })

  it('follows a changed config: no canopy stand, no pattern wall; more rows, a taller stand', () => {
    const cfg = structuredClone(VENUE)
    const south = cfg.stands.find((s) => s.id === 'S')!
    south.rows = 30
    const taller = buildStands(cfg, buildVenue(cfg), buildOccluders(cfg))
    // Ten more rows of 0.42 m, and the rear wall rises with them.
    expect(bounds(taller.lit).max.y).toBeCloseTo(bounds(parts.lit).max.y + 10 * south.riser, 4)
    const bare = structuredClone(VENUE)
    bare.stands = bare.stands.filter((s) => s.id !== 'VIP')
    bare.walls.stands = bare.walls.stands.filter((id) => id !== 'VIP')
    expect(buildStands(bare, buildVenue(bare), buildOccluders(bare)).vipBack).toBeNull()
  })
})

describe('the stage', () => {
  const parts = buildStage()

  it('builds the deck, the backdrop picture and one picture per screen', () => {
    expect(allFinite(parts.lit)).toBe(true)
    expect(allFinite(parts.glow)).toBe(true)
    const { backdrop, screens, deck } = VENUE.stage
    expect(parts.bars.size).toEqual([backdrop.zMax - backdrop.zMin, backdrop.yTop - backdrop.yBottom])
    expect(parts.screens).toHaveLength(screens.centres.length)
    const b = bounds(parts.lit)
    // Nothing reaches further west than the back of the backdrop, bar the turned end of a screen frame.
    expect(b.min.x).toBeLessThanOrEqual(backdrop.x - backdrop.thickness)
    expect(b.min.x).toBeGreaterThan(backdrop.x - backdrop.thickness - 0.5)
    expect(b.max.y).toBeGreaterThanOrEqual(backdrop.yTop)
    // The steps come down the east face and stop where the config says.
    expect(b.max.x).toBeLessThanOrEqual(deck.xMax + VENUE.stage.steps.count * VENUE.stage.steps.run + 1e-6)
  })

  it('faces the backdrop and both screens toward the seats', () => {
    for (const t of triangles(parts.bars.geometry)) expect(t.normal[0]).toBeCloseTo(1, 6)
    parts.screens.forEach((g, i) => {
      const centre = VENUE.stage.screens.centres[i]
      for (const t of triangles(g)) {
        // East, and turned toward the centre line of the pitch.
        expect(t.normal[0]).toBeCloseTo(Math.cos((VENUE.stage.screens.turnDeg * Math.PI) / 180), 5)
        expect(Math.sign(t.normal[2])).toBe(-Math.sign(centre[2]))
      }
      const b = bounds(g)
      expect(b.max.y - b.min.y).toBeCloseTo(VENUE.stage.screens.height, 5)
    })
  })

  it('reads left to right for someone in the seats: the left edge of the backdrop picture is its south end', () => {
    const p = parts.bars.geometry.getAttribute('position')
    const uv = parts.bars.geometry.getAttribute('uv')
    for (let i = 0; i < p.count; i++) {
      // Looking west from the pitch, south (+Z) is on the left.
      expect(uv.getX(i)).toBe(p.getZ(i) > 0 ? 0 : 1)
    }
  })
})

describe('the floodlights', () => {
  it('builds a mast, a lamp bank, a halo and a light cone per mast', () => {
    const masts = buildMasts()
    const halos = buildHalos()
    const cones = buildCones()
    const n = VENUE.floodlights.masts.length
    for (const g of [masts.lit, masts.glow, halos, cones]) expect(allFinite(g)).toBe(true)
    expect(halos.getAttribute('position').count).toBe(n * 4)
    expect(triangles(masts.glow)).toHaveLength(n * 6 * 4 * 2)
    expect(bounds(masts.lit).max.y).toBeGreaterThan(VENUE.floodlights.height)
    expect(bounds(masts.lit).max.y).toBeLessThan(VENUE.floodlights.height + 6)
  })

  it('aims every lamp at the configured point', () => {
    const masts = buildMasts()
    const aim = VENUE.floodlights.aim
    for (const t of triangles(masts.glow)) {
      const mid: V3 = [(t.a[0] + t.b[0] + t.c[0]) / 3, (t.a[1] + t.b[1] + t.c[1]) / 3, (t.a[2] + t.b[2] + t.c[2]) / 3]
      const to: V3 = [aim[0] - mid[0], aim[1] - mid[1], aim[2] - mid[2]]
      const l = Math.hypot(...to)
      const facing = (to[0] * t.normal[0] + to[1] * t.normal[1] + to[2] * t.normal[2]) / l
      expect(facing).toBeGreaterThan(0.99)
    }
  })

  it('ends each cone short of the ground', () => {
    expect(bounds(buildCones()).min.y).toBeGreaterThan(0)
  })
})

describe('the baked floodlight', () => {
  const pool = floodlightPool()
  const data = pool.image.data as Uint8Array
  const size = pool.image.width
  const at = (x: number, z: number) => {
    const i = Math.min(size - 1, Math.max(0, Math.floor(((x + POOL_SPAN) / (2 * POOL_SPAN)) * size)))
    const j = Math.min(size - 1, Math.max(0, Math.floor(((z + POOL_SPAN) / (2 * POOL_SPAN)) * size)))
    return data[(j * size + i) * 4]
  }

  it('is brightest on the pitch, still lights the stands, and is nearly dark outside the stadium', () => {
    expect(at(0, 0)).toBeGreaterThan(240)
    expect(at(0, 60)).toBeGreaterThan(90)
    expect(at(0, 60)).toBeLessThan(at(0, 0))
    expect(at(170, 170)).toBeLessThan(20)
    expect(at(0, 170)).toBeLessThan(30)
  })

  it('only ever falls away from the middle', () => {
    for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1], [0.7, 0.7]]) {
      let last = 256
      for (let d = 0; d < POOL_SPAN; d += 6) {
        const value = at(d * dx, d * dz)
        expect(value).toBeLessThanOrEqual(last)
        last = value
      }
    }
  })
})

describe('seat kinds in the layout used by the scene', () => {
  it('has the three kinds the scene distinguishes', () => {
    const v = getVenue()
    expect(v.kind[0]).toBe(SeatKind.Pitch)
    expect(v.kind[v.ranges.bays[0]]).toBe(SeatKind.AccessBay)
    expect(v.kind[v.ranges.stands[0]]).toBe(SeatKind.Stand)
  })
})
