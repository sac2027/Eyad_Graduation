import type { CameraMode } from '@/features/stadiview/state/stadiumStore'

/**
 * Where the 3D camera is over the plan, for the arrow the 2D matrix draws. The camera rig reports
 * a few times a second through this channel, so the matrix can follow without React re-rendering.
 */
export interface CameraOnPlan {
  x: number
  z: number
  /** The compass direction the camera looks along, in radians clockwise from north. */
  heading: number
  mode: CameraMode
}

type Listener = (c: CameraOnPlan) => void
const listeners = new Set<Listener>()
let last: CameraOnPlan = { x: 0, z: 0, heading: 0, mode: 'orbit' }

export function setCameraOnPlan(c: CameraOnPlan): void {
  last = c
  for (const fn of listeners) fn(c)
}

export function cameraOnPlan(): CameraOnPlan {
  return last
}

export function onCameraOnPlan(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
