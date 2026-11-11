import { useEffect, useMemo } from 'react'
import { Color, InstancedBufferAttribute, InstancedMesh, MeshBasicMaterial } from 'three'
import { useThree } from '@react-three/fiber'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { colorFor, SEAT_COLORS } from '@/features/stadiview/scene/seatColors'
import { chairGeometry, seatMatrix } from '@/features/stadiview/scene/seatGeometry'
import { poolAt } from '@/features/stadiview/scene/sceneKit'
import { useStadium } from '@/features/stadiview/state/stadiumStore'

/** A hovered or selected chair is drawn this much larger, so one gold seat can be found among thousands. */
const ACTIVE_SCALE = 1.3

/**
 * How bright a seat is drawn, from the floodlight that reaches it: full in the middle of the pitch,
 * about three quarters at the back of the stands. Seats are kept brighter than the concrete under
 * them so their colours stay readable everywhere.
 */
function seatLight(x: number, z: number): number {
  return 0.6 + 0.4 * poolAt(x, z)
}

/**
 * All 7,998 seats, drawn as two instanced meshes: the pitch chairs with the wheelchair bays, and
 * the stand seats. Each mesh is one draw call however many chairs it holds.
 *
 * Nothing here re-renders when the pointer moves. Hover and selection arrive through a store
 * subscription and repaint only the seats that changed.
 */
export function Seats() {
  const invalidate = useThree((s) => s.invalidate)

  const built = useMemo(() => {
    const v = getVenue()
    // Venue indexes below `split` are in the first mesh, the rest in the second.
    const split = v.ranges.stands[0]
    const geometry = chairGeometry()
    // The chairs carry their own shading and floodlight, so they need no lamps: the cheapest material there is.
    const material = new MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    const meshes = [new InstancedMesh(geometry, material, split), new InstancedMesh(geometry, material, v.count - split)]
    meshes[0].instanceColor = new InstancedBufferAttribute(new Float32Array(split * 3), 3)
    meshes[1].instanceColor = new InstancedBufferAttribute(new Float32Array((v.count - split) * 3), 3)

    // The palette as linear light, worked out once.
    const linear = new Map<string, Color>()
    for (const hex of Object.values(SEAT_COLORS)) linear.set(hex, new Color(hex))

    /** Writes seat i's colour and size for the given hover and selection. Returns the mesh it lives in. */
    const paint = (i: number, state: { hover: number; selected: number }): 0 | 1 => {
      const which = i < split ? 0 : 1
      const slot = which === 0 ? i : i - split
      const mesh = meshes[which]
      const active = i === state.hover || i === state.selected
      const x = v.position[i * 3]
      const y = v.position[i * 3 + 1]
      const z = v.position[i * 3 + 2]
      const c = linear.get(colorFor(i, v, state))!
      // A highlighted seat is shown at full strength wherever it is.
      const light = active ? 1 : seatLight(x, z)
      const colors = mesh.instanceColor!.array as Float32Array
      colors[slot * 3] = c.r * light
      colors[slot * 3 + 1] = c.g * light
      colors[slot * 3 + 2] = c.b * light
      seatMatrix(mesh.instanceMatrix.array as Float32Array, slot, x, y, z, v.yaw[i], active ? ACTIVE_SCALE : 1)
      return which
    }

    const start = useStadium.getState()
    for (let i = 0; i < v.count; i++) paint(i, start)
    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor!.needsUpdate = true
      // The chairs never move as a whole, and their bounds are worked out once from the matrices just written.
      mesh.matrixAutoUpdate = false
      mesh.computeBoundingSphere()
    }
    return { v, split, geometry, material, meshes, paint }
  }, [])

  useEffect(() => {
    const { split, meshes, paint } = built
    // Repaint the seats whose state changed, and send only those to the graphics card.
    const repaint = (state: { hover: number; selected: number }, previous: { hover: number; selected: number }) => {
      const touched = new Set<number>()
      for (const i of [previous.hover, previous.selected, state.hover, state.selected]) if (i >= 0) touched.add(i)
      for (const i of touched) {
        const which = paint(i, state)
        const slot = which === 0 ? i : i - split
        const mesh = meshes[which]
        mesh.instanceColor!.addUpdateRange(slot * 3, 3)
        mesh.instanceColor!.needsUpdate = true
        mesh.instanceMatrix.addUpdateRange(slot * 16, 16)
        mesh.instanceMatrix.needsUpdate = true
      }
      if (touched.size > 0) invalidate()
    }
    // The store may have changed between building the meshes and this effect.
    repaint(useStadium.getState(), { hover: -1, selected: -1 })
    return useStadium.subscribe(repaint)
  }, [built, invalidate])

  useEffect(
    () => () => {
      built.geometry.dispose()
      built.material.dispose()
      for (const mesh of built.meshes) mesh.dispose()
    },
    [built],
  )

  return (
    <>
      <primitive object={built.meshes[0]} />
      <primitive object={built.meshes[1]} />
    </>
  )
}
