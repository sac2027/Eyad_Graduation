import { useEffect, useMemo } from 'react'
import { BufferGeometry, MeshBasicMaterial, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { VENUE } from '@/features/stadiview/config/venue'
import { extendDebugHook } from '@/features/stadiview/debugHook'
import { archCurve, archPosts } from '@/features/stadiview/engine/marchPath'
import { PLACES, publishPlaces } from '@/features/stadiview/hud/placeAnchors'
import type { PlaceScreen } from '@/features/stadiview/hud/placeAnchors'
import { MeshBuilder } from '@/features/stadiview/scene/meshBuilder'
import { SV } from '@/features/stadiview/scene/palette'
import { useStadium } from '@/features/stadiview/state/stadiumStore'

/** How solid the lit frames are outside first person: see-through, so no seat behind them is hidden. */
export const FRAME_OPACITY_OVERVIEW = 0.42
/** The teal of the Procession Start's link from the blocks, as in the march plan. */
const TEAL = '#2BB3C0'

/** The arch: two slim posts and a pointed band, all lit gold. */
function archGeometry(): BufferGeometry {
  const a = VENUE.arch
  const m = new MeshBuilder()
  for (const [x0, x1, z0, z1] of archPosts()) m.box([x0, 0, z0], [x1, a.springY + 0.05, z1], SV.gold, ['-y'])
  const curve = archCurve(VENUE, 14)
  const half = a.band / 2
  const d = a.bandDepth / 2
  for (let k = 1; k < curve.length; k++) {
    const [za, ya] = curve[k - 1]
    const [zb, yb] = curve[k]
    // Each piece of the band: a short beam from one point of the curve to the next, `band` thick.
    const tz = zb - za
    const ty = yb - ya
    const len = Math.hypot(tz, ty) || 1
    const nz = (-ty / len) * half
    const ny = (tz / len) * half
    const corners = (x: number) => [
      [x, ya - ny, za - nz],
      [x, yb - ny, zb - nz],
      [x, yb + ny, zb + nz],
      [x, ya + ny, za + nz],
    ] as [number, number, number][]
    const front = corners(a.x - d)
    const back = corners(a.x + d)
    m.face(front, [-1, 0, 0], SV.gold)
    m.face(back, [1, 0, 0], SV.gold)
    m.face([front[2], front[3], back[3], back[2]], [0, ny, nz], SV.gold)
    m.face([front[0], front[1], back[1], back[0]], [0, -ny, -nz], SV.gold)
  }
  return m.build()
}

/** The exit's frame: two posts and a lintel across the exit leg, square to it. */
function exitGeometry(): BufferGeometry {
  const m = VENUE.march
  const [ex, , ez] = m.exit
  // Square to the last stretch of the exit leg.
  const dx = ex - m.exitVia[0]
  const dz = ez - m.exitVia[2]
  const len = Math.hypot(dx, dz) || 1
  const side = [-dz / len, dx / len]
  const b = new MeshBuilder()
  const half = m.width / 2 + 0.6
  for (const s of [-1, 1]) {
    const cx = ex + side[0] * half * s
    const cz = ez + side[1] * half * s
    b.box([cx - 0.12, 0, cz - 0.12], [cx + 0.12, 3.6, cz + 0.12], SV.gold, ['-y'])
  }
  const x0 = ex - side[0] * half
  const z0 = ez - side[1] * half
  const x1 = ex + side[0] * half
  const z1 = ez + side[1] * half
  b.face([[x0, 3.45, z0], [x1, 3.45, z1], [x1, 3.75, z1], [x0, 3.75, z0]], [dx, 0, dz], SV.gold)
  b.face([[x0, 3.45, z0], [x1, 3.45, z1], [x1, 3.75, z1], [x0, 3.75, z0]], [-dx, 0, -dz], SV.gold)
  return b.build()
}

/** The Procession Start: a gold ring on the carpet, a short light post, and the teal link from the blocks. */
function startGeometry(): BufferGeometry {
  const m = VENUE.march
  const [sx, , sz] = m.start
  const b = new MeshBuilder()
  const n = 24
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2
    const a1 = ((k + 1) / n) * Math.PI * 2
    const p = (r: number, a: number): [number, number, number] => [sx + r * Math.cos(a), 0.03, sz + r * Math.sin(a)]
    b.face([p(0.85, a0), p(1.1, a0), p(1.1, a1), p(0.85, a1)], [0, 1, 0], SV.gold)
  }
  b.box([sx - 0.07, 0, sz - 0.07], [sx + 0.07, 2.4, sz + 0.07], SV.gold, ['-y'])
  b.box([sx - 0.18, 2.4, sz - 0.18], [sx + 0.18, 2.62, sz + 0.18], '#FFF3C4', ['-y'])
  // The link: from the east end of Block 6 to the carpet's inner edge, a gentle curve on the grass.
  const [lx, , lz] = m.startLink
  const endX = m.east - m.width / 2
  const steps = 12
  let prev: [number, number] | null = null
  for (let k = 0; k <= steps; k++) {
    const t = k / steps
    const x = lx + (endX - lx) * t
    const z = lz + (sz - lz) * (t * t * (3 - 2 * t))
    if (prev) {
      const nx = -(z - prev[1])
      const nz = x - prev[0]
      const l = Math.hypot(nx, nz) || 1
      const w = 0.3
      b.face(
        [
          [prev[0] + (nx / l) * w, 0.005, prev[1] + (nz / l) * w],
          [x + (nx / l) * w, 0.005, z + (nz / l) * w],
          [x - (nx / l) * w, 0.005, z - (nz / l) * w],
          [prev[0] - (nx / l) * w, 0.005, prev[1] - (nz / l) * w],
        ],
        [0, 1, 0],
        TEAL,
      )
    }
    prev = [x, z]
  }
  return b.build()
}

/**
 * The Procession Gate (بوابة المسيرة) over the north leg, the Procession Start (نقطة بداية
 * المسيرة) and the Procession Exit (بوابة الخروج).
 *
 * The arch and the exit frame are light, not walls: outside first person they are drawn see-through,
 * so every seat behind them stays in sight and hover and click stay truthful (no picking sees them).
 * Seated, where nothing is picked, they are solid.
 */
export function ProcessionGate() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const built = useMemo(() => {
    const frame = new MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: FRAME_OPACITY_OVERVIEW, depthWrite: false })
    const solid = new MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    return { arch: archGeometry(), exit: exitGeometry(), start: startGeometry(), frame, solid, scratch: new Vector3() }
  }, [])
  useEffect(
    () => () => {
      for (const g of [built.arch, built.exit, built.start]) g.dispose()
      built.frame.dispose()
      built.solid.dispose()
    },
    [built],
  )

  const mode = useStadium((s) => s.mode)
  const seated = mode === 'pov'

  useEffect(() => {
    extendDebugHook({ archOpacity: () => (useStadium.getState().mode === 'pov' ? 1 : FRAME_OPACITY_OVERVIEW) })
  }, [])

  // The labels follow their places in the overview, and hide in first person and in flight.
  useFrame(() => {
    const out = { gate: null, start: null, exit: null } as PlaceScreen
    if (useStadium.getState().mode === 'orbit') {
      const rect = gl.domElement.getBoundingClientRect()
      camera.updateMatrixWorld()
      for (const p of PLACES) {
        const v = built.scratch.set(p.at[0], p.at[1], p.at[2]).applyMatrix4(camera.matrixWorldInverse)
        if (v.z > -camera.near) continue
        v.applyMatrix4(camera.projectionMatrix)
        if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue
        out[p.id] = { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height }
      }
    }
    publishPlaces(out)
  })

  return (
    <group name="procession-places">
      <mesh geometry={built.arch} material={seated ? built.solid : built.frame} renderOrder={3} name="procession-arch" />
      <mesh geometry={built.exit} material={seated ? built.solid : built.frame} renderOrder={3} />
      <mesh geometry={built.start} material={built.solid} />
    </group>
  )
}

