import { useEffect, useMemo } from 'react'
import type { BufferGeometry } from 'three'
import { useFrame } from '@react-three/fiber'
import { VENUE } from '@/features/stadiview/config/venue'
import type { LineStandConfig, VenueConfig } from '@/features/stadiview/config/venue'
import { getOccluders } from '@/features/stadiview/engine/occluders'
import type { Occluder } from '@/features/stadiview/engine/occluders'
import type { VenueLayout } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { MeshBuilder, pictureQuad } from '@/features/stadiview/scene/meshBuilder'
import { matrixBarsMaterial } from '@/features/stadiview/scene/matrixShader'
import { PAINT, SV } from '@/features/stadiview/scene/palette'
import { useSceneKit } from '@/features/stadiview/scene/sceneKit'

/** Structures reach a little below the ground's top layer, so no gap shows at their feet. */
const GROUND = -0.12

/** How finely a curved stand is cut into flat pieces: one piece for about this many degrees. */
const ARC_STEP = (2 * Math.PI) / 180

/** The lit ribbon along the top of every stand's front wall. */
const RIBBON = 0.14

interface StandParts {
  /** Concrete, walls, canopy and gates: everything the scene's light falls on. */
  lit: BufferGeometry
  /** The self-lit trim: ribbons, the warm light of the VIP box, gate markers. */
  glow: BufferGeometry
  /** The outside of the VIP box's rear wall, which carries the brand pattern; null when there is no canopy stand. */
  vipBack: { geometry: BufferGeometry; size: [number, number] } | null
}

/**
 * Builds the grandstands from the layout's rows and the picking occluders, so what is drawn is
 * exactly what the seats stand on and exactly what blocks the pointer.
 */
export function buildStands(cfg: VenueConfig = VENUE, v: VenueLayout = getVenue(), occ: Occluder[] = getOccluders()): StandParts {
  const lit = new MeshBuilder()
  const glow = new MeshBuilder()
  const firstStandSection = cfg.blocks.genders.length
  const canopy = cfg.canopy

  cfg.stands.forEach((s, k) => {
    const rows = v.standRows.filter((r) => r.section === firstStandSection + k)
    const walled = cfg.walls.stands.includes(s.id)
    const vip = s.id === canopy.over
    const front = vip ? PAINT.fascia : s.riser === 0 ? PAINT.platform : PAINT.fascia
    const ribbon = vip ? PAINT.gold : PAINT.goldDim

    if (s.kind === 'line') {
      // +1 when the rows step back toward the south, -1 toward the north.
      const back = s.side === 'south' ? 1 : -1
      const half = s.tread / 2
      for (const row of rows) {
        if (row.kind !== 'line') continue
        const zFront = row.z - back * half
        const zRear = row.z + back * half
        const below = row.row === 1 ? GROUND : row.y - s.riser
        lit.floor(s.xMin, Math.min(zFront, zRear), s.xMax, Math.max(zFront, zRear), row.y, s.riser === 0 ? PAINT.platform : PAINT.tread)
        lit.face([[s.xMin, below, zFront], [s.xMax, below, zFront], [s.xMax, row.y, zFront], [s.xMin, row.y, zFront]], [0, 0, -back], row.row === 1 ? front : PAINT.riser)
        if (row.row === 1 && s.riser > 0) {
          // The ribbon stands a finger's width proud of the wall so it never flickers against it.
          const z = zFront - back * 0.03
          glow.face([[s.xMin, row.y - RIBBON, z], [s.xMax, row.y - RIBBON, z], [s.xMax, row.y, z], [s.xMin, row.y, z]], [0, 0, -back], ribbon)
        }
        if (!walled) {
          // An open stand shows its ends and, behind the last row, its back.
          for (const [x, out] of [[s.xMin, -1], [s.xMax, 1]] as const) {
            lit.face([[x, GROUND, zFront], [x, GROUND, zRear], [x, row.y, zRear], [x, row.y, zFront]], [out, 0, 0], PAINT.riser)
          }
          if (row.row === s.rows) lit.face([[s.xMin, GROUND, zRear], [s.xMax, GROUND, zRear], [s.xMax, row.y, zRear], [s.xMin, row.y, zRear]], [0, 0, back], PAINT.riser)
        }
      }
      if (!walled && s.riser === 0) ramp(lit, s, cfg)
    } else {
      const half = s.tread / 2
      for (const row of rows) {
        if (row.kind !== 'arc') continue
        const r0 = row.radius - half
        const r1 = row.radius + half
        const below = row.row === 1 ? GROUND : row.y - s.riser
        for (const span of row.spans) {
          const from = span.from
          const to = span.from + span.step * span.count
          const pieces = Math.max(4, Math.ceil(Math.abs(to - from) / ARC_STEP))
          lit.ring(row.cx, row.cz, r0, r1, from, to, row.y, pieces, PAINT.tread)
          lit.curvedWall(row.cx, row.cz, r0, from, to, below, row.y, pieces, row.row === 1 ? front : PAINT.riser, false)
          if (row.row === 1) glow.curvedWall(row.cx, row.cz, r0 - 0.03, from, to, row.y - RIBBON, row.y, pieces, ribbon, false)
          // The two cut ends of the span: one is the side of the entrance tunnel, the other the stand's outer end.
          for (const [angle, sign] of [[from, to > from ? -1 : 1], [to, to > from ? 1 : -1]] as const) {
            const c = Math.cos(angle)
            const sn = Math.sin(angle)
            lit.face(
              [[row.cx + r0 * c, GROUND, row.cz + r0 * sn], [row.cx + r1 * c, GROUND, row.cz + r1 * sn], [row.cx + r1 * c, row.y, row.cz + r1 * sn], [row.cx + r0 * c, row.y, row.cz + r0 * sn]],
              [-sign * sn, 0, sign * c],
              PAINT.riser,
            )
          }
        }
      }
    }
  })

  // The walls come straight from the list that blocks picking. Entries 0 and 1 are the stage
  // backdrop (drawn with the stage) and the canopy; then each walled stand gives a rear wall
  // followed by its two end walls, or a curved rear wall per span.
  const T = cfg.walls.thickness
  let rear: Extract<Occluder, { kind: 'box' }> | null = null
  occ.slice(2).forEach((o) => {
    if (o.kind === 'box') {
      rear = o
      lit.box([o.min[0], GROUND, o.min[2]], o.max, PAINT.wall, ['-y'])
    } else if (o.kind === 'side') {
      // The end wall at the stand's low-x end thickens toward -x, the other toward +x: away from the seats.
      const out = rear && Math.abs(o.x - rear.min[0]) < 1e-6 ? -1 : 1
      const x0 = o.x
      const x1 = o.x + out * T
      for (const [x, look] of [[x1, out], [x0, -out]] as const) {
        lit.face([[x, GROUND, o.z0], [x, GROUND, o.z1], [x, o.y1, o.z1], [x, o.y0, o.z0]], [look, 0, 0], look === out ? PAINT.wall : PAINT.wallDark)
      }
      lit.face([[x0, o.y0, o.z0], [x1, o.y0, o.z0], [x1, o.y1, o.z1], [x0, o.y1, o.z1]], [0, 1, 0], PAINT.wall)
      lit.face([[x0, GROUND, o.z0], [x1, GROUND, o.z0], [x1, o.y0, o.z0], [x0, o.y0, o.z0]], [0, 0, o.z0 - o.z1], PAINT.wall)
    } else {
      const pieces = Math.max(4, Math.ceil(Math.abs(o.to - o.from) / ARC_STEP))
      lit.curvedWall(o.cx, o.cz, o.radius, o.from, o.to, GROUND, o.y1, pieces, PAINT.wallDark, false)
      lit.curvedWall(o.cx, o.cz, o.radius + T, o.from, o.to, GROUND, o.y1, pieces, PAINT.wall, true)
      lit.ring(o.cx, o.cz, o.radius, o.radius + T, o.from, o.to, o.y1, pieces, PAINT.wall)
      for (const [angle, sign] of [[o.from, o.to > o.from ? -1 : 1], [o.to, o.to > o.from ? 1 : -1]] as const) {
        const c = Math.cos(angle)
        const sn = Math.sin(angle)
        const r1 = o.radius + T
        lit.face(
          [[o.cx + o.radius * c, GROUND, o.cz + o.radius * sn], [o.cx + r1 * c, GROUND, o.cz + r1 * sn], [o.cx + r1 * c, o.y1, o.cz + r1 * sn], [o.cx + o.radius * c, o.y1, o.cz + o.radius * sn]],
          [-sign * sn, 0, sign * c],
          PAINT.wall,
        )
      }
    }
  })

  // The canopy slab on its columns, with a warm strip of light under its front edge and a warm
  // wash on the wall behind the VIP seats, as if the box were lit from inside.
  let vipBack: StandParts['vipBack'] = null
  const covered = cfg.stands.find((s) => s.id === canopy.over)
  if (covered && covered.kind === 'line') {
    lit.box([canopy.xMin, canopy.yBottom, canopy.zMin], [canopy.xMax, canopy.yTop, canopy.zMax], {
      '+y': PAINT.canopyTop, '-y': PAINT.canopyUnder, '+x': PAINT.wallDark, '-x': PAINT.wallDark, '+z': PAINT.wallDark, '-z': PAINT.wallDark,
    })
    const back = covered.side === 'south' ? 1 : -1
    const zFrontEdge = back === 1 ? canopy.zMin : canopy.zMax
    const zBackEdge = back === 1 ? canopy.zMax : canopy.zMin
    const w = canopy.columnWidth
    const perEdge = Math.max(1, Math.ceil(canopy.columns / 2))
    for (let i = 0; i < perEdge; i++) {
      const x = perEdge === 1 ? (canopy.xMin + canopy.xMax) / 2 : canopy.xMin + w / 2 + ((canopy.xMax - canopy.xMin - w) * i) / (perEdge - 1)
      for (const z of [zFrontEdge + back * (w / 2), zBackEdge - back * (w / 2)]) {
        lit.prism(x, z, GROUND, canopy.yBottom, w / Math.SQRT2, w / Math.SQRT2, 4, PAINT.column, Math.PI / 4)
      }
    }
    // The strip light, just inside the front edge and facing down and out.
    const zStrip = zFrontEdge + back * 0.35
    glow.box([canopy.xMin + 0.6, canopy.yBottom - 0.1, Math.min(zStrip, zStrip + back * 0.25)], [canopy.xMax - 0.6, canopy.yBottom, Math.max(zStrip, zStrip + back * 0.25)], PAINT.warm, ['+y'])

    const rearWall = occ.find((o): o is Extract<Occluder, { kind: 'box' }> => o.kind === 'box' && o.min[0] === covered.xMin && o.max[0] === covered.xMax && o.max[1] === canopy.yBottom)
    if (rearWall) {
      const lastFloor = covered.firstRowY + (covered.rows - 1) * covered.riser
      const zInside = (back === 1 ? rearWall.min[2] : rearWall.max[2]) - back * 0.03
      glow.face(
        [[covered.xMin + 0.3, lastFloor + 1.3, zInside], [covered.xMax - 0.3, lastFloor + 1.3, zInside], [covered.xMax - 0.3, canopy.yBottom - 0.25, zInside], [covered.xMin + 0.3, canopy.yBottom - 0.25, zInside]],
        [0, 0, -back],
        ['#3B3016', '#3B3016', '#7A6224', '#7A6224'],
      )
      // The outside of the same wall, seen by the opening camera, carries the brand pattern.
      const zOutside = (back === 1 ? rearWall.max[2] : rearWall.min[2]) + back * 0.03
      const left = back === 1 ? covered.xMin : covered.xMax
      const right = back === 1 ? covered.xMax : covered.xMin
      vipBack = {
        geometry: pictureQuad([left, 0, zOutside], [right, 0, zOutside], [right, canopy.yBottom, zOutside], [left, canopy.yBottom, zOutside]),
        size: [covered.xMax - covered.xMin, canopy.yBottom],
      }
    }
  }

  gates(lit, glow, cfg)
  return { lit: lit.build(), glow: glow.build(), vipBack }
}

/** A step-free ramp up to a flat platform, at the end nearer the platform's gate. Its slope is 1 in 12. */
function ramp(m: MeshBuilder, s: LineStandConfig, cfg: VenueConfig): void {
  const gate = cfg.gates.find((g) => g.id === s.gate)
  const back = s.side === 'south' ? 1 : -1
  const zFront = s.firstRowZ - back * (s.tread / 2)
  const zRear = s.firstRowZ + back * ((s.rows - 1) * s.tread + s.tread / 2)
  const atLowEnd = !gate || gate.position[0] < (s.xMin + s.xMax) / 2
  const top = atLowEnd ? s.xMin : s.xMax
  const out = atLowEnd ? -1 : 1
  const foot = top + out * (s.firstRowY - GROUND) * 12
  m.face([[foot, GROUND, zFront], [foot, GROUND, zRear], [top, s.firstRowY, zRear], [top, s.firstRowY, zFront]], [0, 1, 0], PAINT.platform)
  for (const [z, look] of [[zFront, -back], [zRear, back]] as const) {
    m.face([[foot, GROUND, z], [top, GROUND, z], [top, s.firstRowY, z]], [0, 0, look], PAINT.riser)
  }
}

/** A portal at each gate: two pylons and a beam, with a gold line of light, opening toward the stadium. */
function gates(lit: MeshBuilder, glow: MeshBuilder, cfg: VenueConfig): void {
  const halfSpan = 4.5
  const height = 6.5
  for (const g of cfg.gates) {
    const [x, , z] = g.position
    const distance = Math.hypot(x, z)
    if (distance === 0) continue
    // The beam runs across the way in, a quarter turn from the line to the middle of the stadium.
    const inX = -x / distance
    const inZ = -z / distance
    const acrossX = -inZ
    const acrossZ = inX
    for (const side of [-1, 1]) {
      lit.turnedBox(x + side * halfSpan * acrossX, z + side * halfSpan * acrossZ, GROUND, height, 0.6, 0.6, acrossX, acrossZ, PAINT.column)
    }
    lit.turnedBox(x, z, height, height + 0.9, halfSpan + 0.6, 0.6, acrossX, acrossZ, PAINT.wall)
    // The line of light along both faces of the beam.
    for (const side of [-1, 1]) {
      glow.turnedBox(x + side * 0.62 * inX, z + side * 0.62 * inZ, height + 0.3, height + 0.6, halfSpan + 0.3, 0.02, acrossX, acrossZ, PAINT.gold)
    }
  }
}

/** The grandstands, their walls, the VIP canopy, the accessibility platform and the five gates. */
export function Stands({ animate }: { animate: boolean }) {
  const kit = useSceneKit()
  const parts = useMemo(() => buildStands(), [])
  // "Stadium & Journey": the calmer of the two brand pairings, for the back of the VIP box.
  const journey = useMemo(() => (parts.vipBack ? matrixBarsMaterial([SV.deep, SV.green], 5, parts.vipBack.size) : null), [parts])

  useEffect(
    () => () => {
      parts.lit.dispose()
      parts.glow.dispose()
      parts.vipBack?.geometry.dispose()
      journey?.dispose()
    },
    [parts, journey],
  )

  // Half the stage's pace: this wall is background.
  useFrame((state) => {
    if (animate && journey) journey.uniforms.uTime.value = state.clock.elapsedTime * 0.5
  })

  return (
    <group dispose={null}>
      <mesh geometry={parts.lit} material={kit.lit} />
      <mesh geometry={parts.glow} material={kit.glow} />
      {parts.vipBack && journey && <mesh geometry={parts.vipBack.geometry} material={journey} />}
    </group>
  )
}
