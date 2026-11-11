import type { Vec3 } from '@/features/stadiview/config/venue'

/**
 * Requests to turn a seated viewer's head toward a point (the landmark chips). The camera rig
 * listens and turns the view; the camera never leaves the seat.
 */
type Listener = (point: Vec3) => void
const listeners = new Set<Listener>()

export function requestLook(point: Vec3): void {
  for (const fn of listeners) fn(point)
}

export function onLookRequest(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
