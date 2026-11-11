import type { PlanBounds } from '@/features/stadiview/engine/planIndex'

/**
 * Looking at the plan: which part of the stadium the 2D matrix shows, and at what size.
 *
 * A view is the point of the plan at the middle of the picture and a scale in pixels per metre.
 * East is to the right and south is down, so north is up, as on a map.
 */
export interface PlanView {
  /** The plan point at the centre of the picture, in metres. */
  cx: number
  cz: number
  /** Pixels per metre. */
  scale: number
}

/** From a view of the whole stadium on a small card down to one where a chair is a finger wide. */
export const SCALE_MIN = 0.8
export const SCALE_MAX = 40

const clampScale = (s: number) => Math.min(Math.max(s, SCALE_MIN), SCALE_MAX)

/** The view that shows the whole of `bounds` in a picture of the given size, with `pad` pixels to spare all round. */
export function fitView(bounds: PlanBounds, width: number, height: number, pad = 12): PlanView {
  const w = Math.max(bounds.x1 - bounds.x0, 0.5)
  const h = Math.max(bounds.z1 - bounds.z0, 0.5)
  const scale = clampScale(Math.min((width - 2 * pad) / w, (height - 2 * pad) / h))
  return { cx: (bounds.x0 + bounds.x1) / 2, cz: (bounds.z0 + bounds.z1) / 2, scale }
}

/** The plan point under a pixel of the picture. */
export function toPlan(view: PlanView, px: number, py: number, width: number, height: number): [number, number] {
  return [view.cx + (px - width / 2) / view.scale, view.cz + (py - height / 2) / view.scale]
}

/** The pixel of the picture a plan point falls on. */
export function toScreen(view: PlanView, x: number, z: number, width: number, height: number): [number, number] {
  return [width / 2 + (x - view.cx) * view.scale, height / 2 + (z - view.cz) * view.scale]
}

/** Zooms by `factor` while keeping the plan point under the pixel (px, py) where it is: zooming toward the pointer. */
export function zoomAt(view: PlanView, factor: number, px: number, py: number, width: number, height: number): PlanView {
  const scale = clampScale(view.scale * factor)
  const [x, z] = toPlan(view, px, py, width, height)
  return { cx: x - (px - width / 2) / scale, cz: z - (py - height / 2) / scale, scale }
}

/** Moves the picture by a drag of (dx, dy) pixels: the plan follows the pointer. */
export function panBy(view: PlanView, dx: number, dy: number): PlanView {
  return { cx: view.cx - dx / view.scale, cz: view.cz - dy / view.scale, scale: view.scale }
}
