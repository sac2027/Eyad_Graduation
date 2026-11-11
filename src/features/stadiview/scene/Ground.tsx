import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color, DataTexture, LinearMipmapLinearFilter, MeshLambertMaterial, RGBAFormat, RepeatWrapping, SRGBColorSpace, UnsignedByteType } from 'three'
import { useThree } from '@react-three/fiber'
import { VENUE } from '@/features/stadiview/config/venue'
import type { VenueConfig } from '@/features/stadiview/config/venue'
import { blockZ, rowX } from '@/features/stadiview/layout/pitchLayout'
import type { VenueLayout } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { MeshBuilder, POOL_SPAN } from '@/features/stadiview/scene/meshBuilder'
import { PAINT } from '@/features/stadiview/scene/palette'
import { POOL_INTENSITY, useSceneKit } from '@/features/stadiview/scene/sceneKit'

/**
 * Heights of the ground's layers, in metres. Chairs stand at 0, so the seating pads are at 0 and
 * everything else sits a little lower. Layers that overlap are kept 2 cm or more apart: closer
 * than that and a distant camera can no longer tell which is on top, and they flicker.
 */
const LEVEL = { pad: 0, floor: -0.02, grass: -0.04, track: -0.06, apron: -0.1, land: -0.4 } as const

/** Painted pitch lines, a little wider than the real 12 cm so they hold together seen from across the stadium. */
const LINE = 0.2
const UP: [number, number, number] = [0, 1, 0]

/**
 * The points of a running-track oval, in order round it: two straights of half-length `half`
 * joined by half circles of `radius`. The same `perBend` for two ovals gives matching points, so
 * a band can be stretched between them.
 */
function oval(half: number, radius: number, perBend: number): [number, number][] {
  const points: [number, number][] = []
  for (let k = 0; k <= perBend; k++) {
    const a = Math.PI / 2 - (Math.PI * k) / perBend // the east bend, from the south straight round to the north
    points.push([half + radius * Math.cos(a), radius * Math.sin(a)])
  }
  for (let k = 0; k <= perBend; k++) {
    const a = -Math.PI / 2 - (Math.PI * k) / perBend // the west bend, back round to the south
    points.push([-half + radius * Math.cos(a), radius * Math.sin(a)])
  }
  return points
}

/** Where the seating floor is, block by block, read from the layout so it follows any config. */
function seatingPlan(cfg: VenueConfig, v: VenueLayout) {
  const b = cfg.blocks
  const blocks = b.genders.length
  const width = b.seatsPerRow * b.seatPitch
  const north = (k: number) => blockZ(k, 1, cfg) - b.seatPitch / 2
  const rowsOf = (k: number) => v.sections[k - 1]?.rows ?? 0
  // The floor starts just west of the wheelchair bays and ends just behind each block's last row.
  const frontX = rowX(1, cfg) - cfg.bays.setback - 0.8
  const backX = (rows: number) => (rows > 0 ? rowX(rows, cfg) + 0.8 : frontX)
  const maxRows = Math.max(...Array.from({ length: blocks }, (_, i) => rowsOf(i + 1)))
  // The ceremonial aisle is the one in line with the podium.
  let centralAisle = 1
  for (let k = 1; k < blocks; k++) {
    const mid = (north(k) + width + north(k + 1)) / 2
    const best = (north(centralAisle) + width + north(centralAisle + 1)) / 2
    if (Math.abs(mid - cfg.stage.podium[2]) < Math.abs(best - cfg.stage.podium[2])) centralAisle = k
  }
  return { blocks, width, north, rowsOf, frontX, backX, maxRows, centralAisle }
}

/** Everything lit that lies on the ground: land, apron, infield, grass, the seating floor and its pads. */
export function buildGroundGeometry(cfg: VenueConfig = VENUE, v: VenueLayout = getVenue()): BufferGeometry {
  const m = new MeshBuilder()
  const t = cfg.track

  // The land out to the horizon: a wide fan well below everything else.
  const far = 1500
  const rim = 64
  for (let k = 0; k < rim; k++) {
    const a = (k / rim) * Math.PI * 2
    const c = ((k + 1) / rim) * Math.PI * 2
    m.face([[0, LEVEL.land, 0], [far * Math.cos(a), LEVEL.land, far * Math.sin(a)], [far * Math.cos(c), LEVEL.land, far * Math.sin(c)]], UP, PAINT.land)
  }

  // The paved apron the stadium stands on: a rounded rectangle reaching past the gates.
  const reachX = Math.max(...cfg.gates.map((g) => Math.abs(g.position[0])), Math.abs(cfg.procession.entrance[0])) + 22
  const reachZ = Math.max(...cfg.gates.map((g) => Math.abs(g.position[2]))) + 14
  const corner = 44
  const apron: [number, number][] = []
  for (const [sx, sz, start] of [[1, 1, 0], [-1, 1, 1], [-1, -1, 2], [1, -1, 3]] as const) {
    for (let k = 0; k <= 10; k++) {
      const a = ((start + k / 10) * Math.PI) / 2
      apron.push([sx * (reachX - corner) + corner * Math.cos(a), sz * (reachZ - corner) + corner * Math.sin(a)])
    }
  }
  apron.forEach((p, k) => {
    const q = apron[(k + 1) % apron.length]
    m.face([[0, LEVEL.apron, 0], [p[0], LEVEL.apron, p[1]], [q[0], LEVEL.apron, q[1]]], UP, PAINT.apron)
  })

  // The infield inside the track's kerb.
  const kerb = oval(t.straightHalf, t.innerRadius, 40)
  kerb.forEach((p, k) => {
    const q = kerb[(k + 1) % kerb.length]
    m.face([[0, LEVEL.track, 0], [p[0], LEVEL.track, p[1]], [q[0], LEVEL.track, q[1]]], UP, PAINT.infield)
  })

  // The grass, mown in bands across the pitch.
  const halfL = cfg.pitch.length / 2
  const halfW = cfg.pitch.width / 2
  const bands = 18
  for (let k = 0; k < bands; k++) {
    const x0 = -halfL + (k * cfg.pitch.length) / bands
    m.floor(x0, -halfW, x0 + cfg.pitch.length / bands, halfW, LEVEL.grass, k % 2 === 0 ? PAINT.grassLight : PAINT.grassDark)
  }

  // A mat where the procession comes in through the gap in the east curve.
  const outer = t.straightHalf + t.innerRadius + t.lanes * t.laneWidth
  const gateX = cfg.procession.entrance[0]
  const gateZ = cfg.procession.entrance[2]
  m.floor(Math.min(outer, gateX) + 0.3, gateZ - 2.4, Math.max(outer, gateX) + 9, gateZ + 2.4, LEVEL.track, PAINT.runner)

  // The seating floor. Each block stands on a dark floor that runs under its aisles too, with a
  // sand-coloured pad under each bank of rows, so the aisles and cross aisles read as walkways.
  const s = seatingPlan(cfg, v)
  const b = cfg.blocks
  const margin = 0.6
  for (let k = 1; k <= s.blocks; k++) {
    const rows = s.rowsOf(k)
    if (rows === 0) continue
    const z0 = s.north(k)
    const z1 = z0 + s.width
    m.floor(s.frontX, z0, s.backX(rows), z1, LEVEL.floor, PAINT.aisle)
    for (let first = 1; first <= rows; first += b.crossAisleEvery) {
      const last = Math.min(rows, first + b.crossAisleEvery - 1)
      m.floor(rowX(first, cfg) - 0.5, z0 - 0.1, rowX(last, cfg) + 0.5, z1 + 0.1, LEVEL.pad, PAINT.pad)
    }
    // A pad under each wheelchair bay, in front of the block's two outer seats.
    const bayX = rowX(1, cfg) - cfg.bays.setback
    for (const seat of [1, b.seatsPerRow]) {
      const z = blockZ(k, seat, cfg)
      m.floor(bayX - 0.55, z - 0.55, bayX + 0.55, z + 0.55, LEVEL.pad, PAINT.pad)
    }
    // The strip of floor outside the two outermost blocks.
    if (k === 1) m.floor(s.frontX, z0 - margin, s.backX(rows), z0, LEVEL.floor, PAINT.aisle)
    if (k === s.blocks) m.floor(s.frontX, z1, s.backX(rows), z1 + margin, LEVEL.floor, PAINT.aisle)
    // The aisle between this block and the next. The central one is drawn with the runner below.
    if (k < s.blocks && k !== s.centralAisle) {
      m.floor(s.frontX, z1, s.backX(Math.max(rows, s.rowsOf(k + 1))), s.north(k + 1), LEVEL.floor, PAINT.aisle)
    }
  }

  // The ceremonial runner: from the foot of the stage steps, down the central aisle and out past the last row.
  const runner = runnerExtent(cfg, s)
  m.floor(runner.x0, runner.z0 + runner.stripe, runner.x1, runner.z1 - runner.stripe, LEVEL.floor, PAINT.runner)

  return m.build()
}

function runnerExtent(cfg: VenueConfig, s: ReturnType<typeof seatingPlan>) {
  const steps = cfg.stage.steps
  const z0 = s.north(s.centralAisle) + s.width
  const z1 = s.north(s.centralAisle + 1)
  return { x0: cfg.stage.deck.xMax + steps.count * steps.run, x1: s.backX(s.maxRows) + 2, z0, z1, stripe: 0.16 }
}

/** The self-lit lines on the ground: pitch markings and the gold edges of the ceremonial runner. */
export function buildGroundLines(cfg: VenueConfig = VENUE, v: VenueLayout = getVenue()): BufferGeometry {
  const m = new MeshBuilder()
  const halfL = cfg.pitch.length / 2
  const halfW = cfg.pitch.width / 2
  const y = LEVEL.floor
  const line = (x0: number, z0: number, x1: number, z1: number) => m.floor(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), y, PAINT.pitchLine)

  // The boundary.
  line(-halfL, -halfW, halfL, -halfW + LINE)
  line(-halfL, halfW - LINE, halfL, halfW)
  line(-halfL, -halfW, -halfL + LINE, halfW)
  line(halfL - LINE, -halfW, halfL, halfW)

  // The halfway line shows only where the seating floor does not cover it.
  const s = seatingPlan(cfg, v)
  const floorNorth = s.north(1) - 0.6
  const floorSouth = s.north(s.blocks) + s.width + 0.6
  line(-LINE / 2, -halfW, LINE / 2, Math.min(floorNorth, halfW))
  line(-LINE / 2, Math.max(floorSouth, -halfW), LINE / 2, halfW)

  // The east penalty area, goal area and penalty spot: standard sizes. The west ones are under the stage.
  const box = (depth: number, halfWidth: number) => {
    line(halfL - depth, -halfWidth, halfL - depth + LINE, halfWidth)
    line(halfL - depth, -halfWidth, halfL, -halfWidth + LINE)
    line(halfL - depth, halfWidth - LINE, halfL, halfWidth)
  }
  box(16.5, 20.16)
  box(5.5, 9.16)
  line(halfL - 11 - 0.15, -0.15, halfL - 11 + 0.15, 0.15)

  // The runner's gold edges.
  const r = runnerExtent(cfg, s)
  m.floor(r.x0, r.z0, r.x1, r.z0 + r.stripe, y, PAINT.gold)
  m.floor(r.x0, r.z1 - r.stripe, r.x1, r.z1, y, PAINT.gold)

  return m.build()
}

/**
 * The running track as one band, with two UVs: the first runs across the lanes (for the lane
 * lines) and the second maps the venue from above (for the baked floodlight).
 */
export function buildTrackGeometry(cfg: VenueConfig = VENUE): BufferGeometry {
  const t = cfg.track
  const perBend = 48
  const inner = oval(t.straightHalf, t.innerRadius, perBend)
  const outer = oval(t.straightHalf, t.innerRadius + t.lanes * t.laneWidth, perBend)
  const n = inner.length
  const position = new Float32Array(n * 2 * 3)
  const normal = new Float32Array(n * 2 * 3)
  const uv = new Float32Array(n * 2 * 2)
  const uv1 = new Float32Array(n * 2 * 2)
  const put = (i: number, p: [number, number], across: number) => {
    position.set([p[0], LEVEL.track, p[1]], i * 3)
    normal.set([0, 1, 0], i * 3)
    uv.set([across, 0.5], i * 2)
    uv1.set([(p[0] + POOL_SPAN) / (2 * POOL_SPAN), (p[1] + POOL_SPAN) / (2 * POOL_SPAN)], i * 2)
  }
  const index: number[] = []
  for (let k = 0; k < n; k++) {
    put(k * 2, inner[k], 0)
    put(k * 2 + 1, outer[k], 1)
    const a = k * 2
    const c = ((k + 1) % n) * 2
    // Inner, outer, next outer: with the oval's direction this winding faces up (a unit test checks it).
    index.push(a, a + 1, c + 1, a, c + 1, c)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(position, 3))
  g.setAttribute('normal', new BufferAttribute(normal, 3))
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  g.setAttribute('uv1', new BufferAttribute(uv1, 2))
  g.setIndex(index)
  g.computeBoundingSphere()
  return g
}

/** One strip of pixels across the track: its surface colour with a painted line at every lane edge. */
export function laneTexture(lanes: number): DataTexture {
  const width = 512
  const height = 4
  const data = new Uint8Array(width * height * 4)
  const surface = new Color(PAINT.track)
  const paint = new Color(PAINT.trackLine)
  const mixed = new Color()
  // Colours are written as sRGB bytes, so read them back out of the linear working values.
  const lineHalf = 3
  for (let i = 0; i < width; i++) {
    const nearest = Math.round((i / (width - 1)) * lanes) * ((width - 1) / lanes)
    const onLine = Math.abs(i - nearest) <= lineHalf
    mixed.copy(surface)
    if (onLine) mixed.lerp(paint, 0.7)
    const hex = mixed.getHex(SRGBColorSpace)
    for (let j = 0; j < height; j++) {
      const k = (j * width + i) * 4
      data[k] = (hex >> 16) & 255
      data[k + 1] = (hex >> 8) & 255
      data[k + 2] = hex & 255
      data[k + 3] = 255
    }
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType)
  texture.colorSpace = SRGBColorSpace
  texture.wrapT = RepeatWrapping
  texture.generateMipmaps = true
  texture.minFilter = LinearMipmapLinearFilter
  texture.needsUpdate = true
  return texture
}

/** The ground of the stadium: land, apron, track, infield, pitch, and the floor the graduates' chairs stand on. */
export function Ground() {
  const kit = useSceneKit()
  const gl = useThree((s) => s.gl)

  const ground = useMemo(() => buildGroundGeometry(), [])
  const lines = useMemo(() => buildGroundLines(), [])
  const track = useMemo(() => buildTrackGeometry(), [])

  const trackMaterial = useMemo(() => {
    const lanes = laneTexture(VENUE.track.lanes)
    // Seen at a low angle the lanes smear into a blur without this.
    lanes.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    // The same floodlight picture as every other surface, read through the track's second UV.
    const pool = kit.pool.clone()
    pool.channel = 1
    pool.needsUpdate = true
    return new MeshLambertMaterial({ map: lanes, lightMap: pool, lightMapIntensity: POOL_INTENSITY })
  }, [gl, kit.pool])

  useEffect(
    () => () => {
      ground.dispose()
      lines.dispose()
      track.dispose()
    },
    [ground, lines, track],
  )
  useEffect(
    () => () => {
      trackMaterial.map?.dispose()
      trackMaterial.lightMap?.dispose()
      trackMaterial.dispose()
    },
    [trackMaterial],
  )

  return (
    <group dispose={null}>
      <mesh geometry={ground} material={kit.lit} />
      <mesh geometry={track} material={trackMaterial} />
      <mesh geometry={lines} material={kit.glow} />
    </group>
  )
}
