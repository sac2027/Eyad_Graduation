import { useEffect, useMemo, useRef } from 'react'
import { Color, InstancedBufferAttribute, InstancedMesh, MeshBasicMaterial, Vector4 } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { avatarKindOf, headwearOf, OCCUPANT } from '@/features/stadiview/data/occupancy'
import type { AvatarKind } from '@/features/stadiview/data/occupancy'
import { extendDebugHook } from '@/features/stadiview/debugHook'
import { seatEye } from '@/features/stadiview/engine/cameraMath'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { avatarGeometry, farColors, farTemplate } from '@/features/stadiview/scene/avatarGeometry'
import type { Headwear } from '@/features/stadiview/scene/avatarGeometry'
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
/**
 * The nearest figures are chosen again once the camera has come to rest this long, having moved
 * this far since the last choice. While it moves (a drag, the idle turn) nothing is re-sent: from the
 * overview the detail cannot be seen anyway, and seated the camera does not move.
 */
const RESELECT_METRES = 3
const SETTLE_SECONDS = 0.4

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
function figureMaterial(far = false): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uClear = avatarClear
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', far ? '#include <common>\nuniform vec4 uClear;\nattribute vec3 aRobe;\nattribute vec3 aHead;' : '#include <common>\nuniform vec4 uClear;')
      // A far figure's corner says how it is shaded and which of its two colours it wears.
      .replace('#include <color_vertex>', far ? '#include <color_vertex>\n  vColor.rgb = color.r * (color.g < 0.5 ? aRobe : aHead) * instanceColor.rgb;' : '#include <color_vertex>')
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
  m.customProgramCacheKey = () => (far ? 'sv-figure-far' : 'sv-figure')
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
    // The detailed figures: one mesh per kind, each as large as the tier's crowd number.
    const near = VARIANTS.map((x, k) => {
      const capacity = Math.max(1, Math.min(perVariant[k], crowd))
      const mesh = new InstancedMesh(avatarGeometry(x.kind, 'near', x.headwear), material, capacity)
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
      mesh.count = 0
      mesh.frustumCulled = false
      mesh.matrixAutoUpdate = false
      mesh.name = `figures-near-${x.kind}-${x.headwear}`
      return mesh
    })
    // The silhouettes: every kind in one mesh, each instance wearing its own two colours.
    const farMaterial = figureMaterial(true)
    const farMesh = new InstancedMesh(farTemplate(), farMaterial, v.count)
    farMesh.instanceColor = new InstancedBufferAttribute(new Float32Array(v.count * 3), 3)
    const robe = new InstancedBufferAttribute(new Float32Array(v.count * 3), 3)
    const head = new InstancedBufferAttribute(new Float32Array(v.count * 3), 3)
    farMesh.geometry.setAttribute('aRobe', robe)
    farMesh.geometry.setAttribute('aHead', head)
    farMesh.count = 0
    farMesh.frustumCulled = false
    farMesh.matrixAutoUpdate = false
    farMesh.name = 'figures-far'
    const scratch = new Color()
    const variantColors = VARIANTS.map((x) => {
      const c = farColors(x.kind, x.headwear)
      scratch.set(c.robe)
      const r: [number, number, number] = [scratch.r, scratch.g, scratch.b]
      scratch.set(c.head)
      return { robe: r, head: [scratch.r, scratch.g, scratch.b] as [number, number, number] }
    })
    const far = { mesh: farMesh, robe, head, variantColors, material: farMaterial }
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
      for (const m of [...built.near, built.far.mesh, built.highlight]) m.geometry.dispose()
      built.material.dispose()
      built.far.material.dispose()
      built.goldMaterial.dispose()
    },
    [built],
  )

  const state = useRef({ seats: new Int32Array(0), nearOnes: new Set<number>(), lastEye: [Infinity, 0, 0] as [number, number, number], lastPos: [Infinity, 0, 0] as [number, number, number], still: 0, highlighted: [] as number[] })

  /** Writes every figure into the near or far meshes. */
  const layout = (eye: [number, number, number]) => {
    const { v, variant, light, near, far } = built
    const seats = state.current.seats
    const nearOnes = new Set(nearestSet(seats, v.position, eye, crowd))
    state.current.nearOnes = nearOnes
    for (const m of near) m.count = 0
    const f = far.mesh
    f.count = 0
    const robe = far.robe.array as Float32Array
    const head = far.head.array as Float32Array
    for (let k = 0; k < seats.length; k++) {
      const s = seats[k]
      const detailed = nearOnes.has(s)
      const mesh = detailed ? near[variant[s]] : f
      if (mesh.count >= mesh.instanceMatrix.count) continue
      const slot = mesh.count++
      seatMatrix(mesh.instanceMatrix.array as Float32Array, slot, v.position[s * 3], v.position[s * 3 + 1], v.position[s * 3 + 2], v.yaw[s], 1)
      const c = mesh.instanceColor!.array as Float32Array
      c[slot * 3] = c[slot * 3 + 1] = c[slot * 3 + 2] = light[s]
      if (!detailed) {
        const vc = far.variantColors[variant[s]]
        robe.set(vc.robe, slot * 3)
        head.set(vc.head, slot * 3)
      }
    }
    for (const m of [...near, f]) {
      m.instanceMatrix.needsUpdate = true
      m.instanceColor!.needsUpdate = true
    }
    far.robe.needsUpdate = true
    far.head.needsUpdate = true
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
  useFrame((_, delta) => {
    const { v } = built
    const s = useStadium.getState()
    if ((s.mode === 'pov' || s.mode === 'fly') && s.selected >= 0) {
      const eye = seatEye(s.selected, v)
      avatarClear.value.set(eye[0], eye[1], eye[2], CLEAR_RADIUS)
    } else avatarClear.value.set(0, 0, 0, 0)

    // Not during a flight: the camera crosses the stadium in two seconds, and re-sending every figure
    // on the way would cost frames when they matter most. The nearest are chosen again on landing.
    if (s.mode === 'fly') return
    const p = camera.position
    const st = state.current
    // How long the camera has been at rest.
    const step = Math.hypot(p.x - st.lastPos[0], p.y - st.lastPos[1], p.z - st.lastPos[2])
    st.lastPos = [p.x, p.y, p.z]
    st.still = step < 0.01 ? st.still + delta : 0
    const moved = Math.hypot(p.x - st.lastEye[0], p.y - st.lastEye[1], p.z - st.lastEye[2])
    if (moved > RESELECT_METRES && st.still >= SETTLE_SECONDS) layout([p.x, p.y, p.z])
  })

  useEffect(() => {
    const { v } = built
    extendDebugHook({
      avatars: () => {
        const near = built.near.reduce((n, m) => n + m.count, 0)
        const far = built.far.mesh.count
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
      <primitive object={built.far.mesh} />
      <primitive object={built.highlight} />
    </>
  )
}
