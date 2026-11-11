import { useEffect } from 'react'
import { Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import { useThree } from '@react-three/fiber'
import type { Vec3 } from '@/features/stadiview/config/venue'
import { extendDebugHook } from '@/features/stadiview/debugHook'
import { seatAim } from '@/features/stadiview/engine/seatFrame'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useStadium } from '@/features/stadiview/state/stadiumStore'

/**
 * Gives the debug hook its eyes: where a seat or a point is on screen, and what the store holds.
 * Browser tests use these to hover and click real seats. Draws nothing.
 */
export function SceneDebug() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera) as PerspectiveCamera

  useEffect(() => {
    const scratch = new Vector3()
    const v = getVenue()

    const projectPoint = (p: Vec3): { x: number; y: number } | null => {
      camera.updateMatrixWorld()
      scratch.set(p[0], p[1], p[2]).applyMatrix4(camera.matrixWorldInverse)
      // The camera looks down its own -Z; a point at or behind the near plane is not on screen.
      if (scratch.z > -camera.near) return null
      scratch.applyMatrix4(camera.projectionMatrix)
      if (Math.abs(scratch.x) > 1 || Math.abs(scratch.y) > 1) return null
      const rect = gl.domElement.getBoundingClientRect()
      return { x: rect.left + ((scratch.x + 1) / 2) * rect.width, y: rect.top + ((1 - scratch.y) / 2) * rect.height }
    }
    const idOrNull = (i: number) => v.idOf(i) || null

    extendDebugHook({
      projectPoint,
      project: (seatId) => {
        const i = v.indexOf(seatId)
        return i < 0 ? null : projectPoint(seatAim(i, v))
      },
      state: () => {
        const s = useStadium.getState()
        return { mode: s.mode, hover: idOrNull(s.hover), selected: idOrNull(s.selected) }
      },
      select: (seatId) => useStadium.getState().select(v.indexOf(seatId)),
      back: () => useStadium.getState().back(),
    })
  }, [gl, camera])

  return null
}
