/**
 * Where the pointer is over the stadium, for HUD elements that follow it (the seat tooltip).
 *
 * The 3D scene finds the seat under the pointer once per frame. Sending the pointer's position
 * through React state would re-render on every mouse move, so it goes through this small channel
 * instead and the listener moves its element directly.
 */
type Listener = (x: number, y: number) => void

const listeners = new Set<Listener>()
let lastX = 0
let lastY = 0

/** Reports the pointer's position in CSS pixels from the top-left of the viewport. */
export function setPointerAnchor(x: number, y: number): void {
  lastX = x
  lastY = y
  for (const fn of listeners) fn(x, y)
}

/** The most recent position reported. */
export function pointerAnchor(): { x: number; y: number } {
  return { x: lastX, y: lastY }
}

/** Calls `fn` on every report until the returned function is called. */
export function onPointerAnchor(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
