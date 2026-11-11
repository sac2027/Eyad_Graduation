import type { Vec3 } from '@/features/stadiview/config/venue'

/** The arc leaves the guest's eyes this far along the line, so it never fills the lens. */
export const ARC_START = 1.5
/** How high it rises above its higher end, as a share of the distance, within these limits. */
const RISE = 0.22
const RISE_MIN = 8
const RISE_MAX = 30

/**
 * The gold sightline arc from a guest's eyes to their graduate's seat: a smooth curve rising above
 * both ends, so it reads over the crowd from anywhere. A quadratic curve whose control point is set
 * so that its middle reaches the wanted height.
 */
export function arcPoints(eye: Vec3, target: Vec3, n = 64): Vec3[] {
  const dx = target[0] - eye[0]
  const dy = target[1] - eye[1]
  const dz = target[2] - eye[2]
  const dist = Math.hypot(dx, dy, dz) || 1
  const start: Vec3 = [eye[0] + (dx / dist) * ARC_START, eye[1] + (dy / dist) * ARC_START, eye[2] + (dz / dist) * ARC_START]
  const level = Math.hypot(target[0] - start[0], target[2] - start[2])
  const top = Math.max(start[1], target[1]) + Math.min(RISE_MAX, Math.max(RISE_MIN, RISE * level))
  // The middle of a quadratic curve is a quarter of each end plus half its control point.
  const control: Vec3 = [(start[0] + target[0]) / 2, 2 * top - (start[1] + target[1]) / 2, (start[2] + target[2]) / 2]
  const out: Vec3[] = []
  for (let k = 0; k <= n; k++) {
    const t = k / n
    const u = 1 - t
    out.push([
      u * u * start[0] + 2 * u * t * control[0] + t * t * target[0],
      u * u * start[1] + 2 * u * t * control[1] + t * t * target[1],
      u * u * start[2] + 2 * u * t * control[2] + t * t * target[2],
    ])
  }
  return out
}
