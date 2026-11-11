import { useEffect, useMemo, useRef } from 'react'
import { InstancedBufferAttribute, InstancedMesh, MeshBasicMaterial, Vector4 } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { avatarKindOf, headwearOf, OCCUPANT } from '@/features/stadiview/data/occupancy'
import type { AvatarKind } from '@/features/stadiview/data/occupancy'
import { extendDebugHook } from '@/features/stadiview/debugHook'
import { seatEye } from '@/features/stadiview/engine/cameraMath'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { avatarGeometry } from '@/features/stadiview/scene/avatarGeometry'
import type { Headwear, Lod } from '@/features/stadiview/scene/avatarGeometry'
import { insideClear, nearestSet } from '@/features/stadiview/scene/avatarLod'
import { poolAt } from '@/features/stadiview/scene/sceneKit'
import { seatMatrix } from '@/features/stadiview/scene/seatGeometry'
import { SV } from '@/features/stadiview/scene/palette'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useOccupancy } from '@/features/stadiview/state/useOccupancy'
import { useStadium } from '@/features/stadiview/state/stadiumStore'

/** Decision B: in first person, figures within this distance of the eyes (on the ground) are not drawn. */
export const CLEAR_RADIUS = 1.5
/** A highlighted chair is drawn 1.3 times larger in the overview; its figure goes with it. */
const ACTIVE_SCALE = 1.3
/** How far the camera must move, and how long since the last time, before the nearest figures are chosen again. */
const RESELECT_METRES = 3
const RESELECT_SECONDS = 0.5

/**
 * The clear circle: (x, y, z) of a seated viewer's eyes, and the radius; a radius of 0 clears
 * nothing. Shared by every figure material, so setting it moves no instance data. The preview
 * camera sets it to its own eyes for its one drawing, then puts it back.
 */
export const avatarClear = { value: new Vector4(0, 0, 0, 0) }

const VARIANTS: { kind: AvatarKind; headwear: Headwear }[] = [
  { kind: 'grad-m', headwear: 'ghutra' },
  { kind: 'grad-f', headwear: 'ghutra' },
  { kind: 'bay-m', headwear: 'ghutra' },
  { kind: 'bay-f', headwear: 'ghutra' },
  { kind: 'family-m', headwear: 'ghutra' },
  { kind: 'family-m', headwear: 'shemagh' },
  { kind: 'family-f', headwear: 'ghutra' },
]

function variantOf(seat: number): number {
  const kind = avatarKindOf(seat)
  if (kind === 'family-m') return headwearOf(seat) === 'shemagh' ? 5 : 4
  return VARIANTS.findIndex((x) => x.kind === kind)
}

/** The figures' material: the chairs' cheap unlit kind, plus the clear circle in the vertex shader. */
function figureMaterial(): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uClear = avatarClear
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uClear;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vec3 seatAt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec2 off = seatAt.xz - uClear.xz;
          if (uClear.w > 0.0 && dot(off, off) < uClear.w * uClear.w && abs(seatAt.y - uClear.y) < 2.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        #endif`,
      )
  }
  m.customProgramCacheKey = () => 'sv-figure'
  return m
}

/**
 * Everyone in the stadium: a seated figure on every seat that holds someone, and on no other. The
 * nearest figures to the camera use the detailed model, up to the tier's `crowd` number.
 */
export function Avatars({ crowd }: { crowd: number }) {
  const invalidate = useThree((s) => s.invalidate)
  const camera = useThree((s) => s.camera)
  const occ = useOccupancy()
  const inspected = useHud((s) => s.inspected)

  const built = useMemo(() => {
    const v = getVenue()
    const material = figureMaterial()
    const variant = new Int8Array(v.count)
    const perVariant = VARIANTS.map(() => 0)
    for (let i = 0; i < v.count; i++) {
      variant[i] = variantOf(i)
      perVariant[variant[i]]++
    }
    const light = new Float32Array(v.count)
    for (let i = 0; i < v.count; i++) light[i] = 0.6 + 0.4 * poolAt(v.position[i * 3], v.position[i * 3 + 2])
    const make = (lod: Lod) =>
      VARIANTS.map((x, k) => {
        const capacity = lod === 'near' ? Math.min(perVariant[k], Math.max(crowd, 1)) : perVariant[k]
        const mesh = new InstancedMesh(avatarGeometry(x.kind, lod, x.headwear), material, Math.max(capacity, 1))
        mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(Math.max(capacity, 1) * 3), 3)
        mesh.count = 0
        mesh.frustumCulled = false
        mesh.matrixAutoUpdate = false
        mesh.name = `figures-${lod}-${x.kind}-${x.headwear}`
        return mesh
      })
    const near = make('near')
    const far = make('far')
    // The highlight: a gold figure over a highlighted seat that holds someone, so the gold shows through a black bisht.
    const goldMaterial = new MeshBasicMaterial({ color: SV.gold, toneMapped: false })
    const highlight = new InstancedMesh(avatarGeometry('grad-m', 'far'), goldMaterial, 8)
    highlight.count = 0
    highlight.frustumCulled = false
    highlight.matrixAutoUpdate = false
    highlight.name = 'figures-highlight'
    return { v, material, goldMaterial, variant, light, near, far, highlight }
  }, [crowd])
  useEffect(
    () => () => {
      for (const m of [...built.near, ...built.far, built.highlight]) m.geometry.dispose()
      built.material.dispose()
      built.goldMaterial.dispose()
    },
    [built],
  )

  const state = useRef({ seats: new Int32Array(0), nearOnes: new Set<number>(), lastEye: [Infinity, 0, 0] as [number, number, number], lastPick: -Infinity, highlighted: [] as number[] })

  /** Writes every figure into the near or far meshes. */
  const layout = (eye: [number, number, number]) => {
    const { v, variant, light, near, far } = built
    const seats = state.current.seats
    const nearOnes = new Set(nearestSet(seats, v.position, eye, crowd))
    state.current.nearOnes = nearOnes
    for (const m of [...near, ...far]) m.count = 0
    for (let k = 0; k < seats.length; k++) {
      const s = seats[k]
      const mesh = (nearOnes.has(s) ? near : far)[variant[s]]
      if (mesh.count >= mesh.instanceMatrix.count) continue
      const slot = mesh.count++
      seatMatrix(mesh.instanceMatrix.array as Float32Array, slot, v.position[s * 3], v.position[s * 3 + 1], v.position[s * 3 + 2], v.yaw[s], 1)
      const c = mesh.instanceColor!.array as Float32Array
      c[slot * 3] = c[slot * 3 + 1] = c[slot * 3 + 2] = light[s]
    }
    for (const m of [...near, ...far]) {
      m.instanceMatrix.needsUpdate = true
      m.instanceColor!.needsUpdate = true
    }
    state.current.lastEye = eye
    invalidate()
  }

  /** The gold figures over highlighted seats: hovered, selected, inspected, and the viewer's own. */
  const highlight = () => {
    const { v, highlight: mesh } = built
    const s = useStadium.getState()
    const o = occRef.current
    const wanted = new Set<number>()
    if (s.mode === 'orbit') {
      for (const i of [s.hover, s.selected, useHud.getState().inspected]) if (i >= 0 && o.occupant[i]) wanted.add(i)
      for (let i = 0; i < v.count; i++) if (o.occupant[i] === OCCUPANT.viewer) wanted.add(i)
    }
    mesh.count = 0
    for (const i of wanted) {
      if (mesh.count >= 8) break
      seatMatrix(mesh.instanceMatrix.array as Float32Array, mesh.count++, v.position[i * 3], v.position[i * 3 + 1], v.position[i * 3 + 2], v.yaw[i], ACTIVE_SCALE * 1.02)
    }
    mesh.instanceMatrix.needsUpdate = true
    state.current.highlighted = [...wanted]
    invalidate()
  }

  const occRef = useRef(occ)
  occRef.current = occ

  // Whenever who sits where changes.
  useEffect(() => {
    const seats: number[] = []
    for (let i = 0; i < occ.occupant.length; i++) if (occ.occupant[i]) seats.push(i)
    state.current.seats = Int32Array.from(seats)
    layout([camera.position.x, camera.position.y, camera.position.z])
    highlight()
    // `layout` and `highlight` read refs and the built meshes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occ.key, built])

  // Hover, selection and mode: only the gold figures change.
  useEffect(() => {
    highlight()
    return useStadium.subscribe((now, before) => {
      if (now.hover !== before.hover || now.selected !== before.selected || now.mode !== before.mode) highlight()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, inspected])

  // The clear circle follows a seated (or arriving) viewer; the nearest set follows the camera.
  useFrame(({ clock }) => {
    const { v } = built
    const s = useStadium.getState()
    if ((s.mode === 'pov' || s.mode === 'fly') && s.selected >= 0) {
      const eye = seatEye(s.selected, v)
      avatarClear.value.set(eye[0], eye[1], eye[2], CLEAR_RADIUS)
    } else avatarClear.value.set(0, 0, 0, 0)

    // Not during a flight: the camera crosses the stadium in two seconds, and re-sending every figure
    // on the way would cost frames when they matter most. The nearest are chosen again on landing.
    if (s.mode === 'fly') return
    const t = clock.elapsedTime
    const p = camera.position
    const last = state.current.lastEye
    const moved = Math.hypot(p.x - last[0], p.y - last[1], p.z - last[2])
    if (moved > RESELECT_METRES && t - state.current.lastPick > RESELECT_SECONDS) {
      state.current.lastPick = t
      layout([p.x, p.y, p.z])
    }
  })

  useEffect(() => {
    const { v } = built
    extendDebugHook({
      avatars: () => {
        const near = built.near.reduce((n, m) => n + m.count, 0)
        const far = built.far.reduce((n, m) => n + m.count, 0)
        const c = avatarClear.value
        const hiddenNear: string[] = []
        if (c.w > 0) for (const i of state.current.seats) if (insideClear(v.position[i * 3], v.position[i * 3 + 1], v.position[i * 3 + 2], [c.x, c.y, c.z], c.w)) hiddenNear.push(v.idOf(i))
        return { drawn: near + far - hiddenNear.length, near, far, hiddenNear, highlight: state.current.highlighted.map((i) => v.idOf(i)) }
      },
    })
  }, [built])

  return (
    <>
      {built.near.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
      {built.far.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
      <primitive object={built.highlight} />
    </>
  )
}
