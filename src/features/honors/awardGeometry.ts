import * as THREE from 'three'

import { AWARD_PROFILE, AWARD_SEGMENTS } from './awardProfile'

export { AWARD_PROFILE, AWARD_SEGMENTS }

export function buildAwardGeometry(): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(
    AWARD_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
    AWARD_SEGMENTS,
  )
  g.computeVertexNormals()
  return g
}

/** Height of the crown windows: the eight arched openings sit on the flat faces of the crown. */
export const WINDOW_Y = 4.0
export const WINDOW_APOTHEM = 0.595 * Math.cos(Math.PI / 8)

export function buildWindowShape(): THREE.Shape {
  const w = 0.07
  const s = new THREE.Shape()
  s.moveTo(-w, 0)
  s.lineTo(-w, 0.22)
  s.absarc(0, 0.22, w, Math.PI, 0, true)
  s.lineTo(w, 0)
  s.lineTo(-w, 0)
  return s
}

/** Where each of the eight windows sits (angle around Y, radius from the axis). */
export function windowPlacements(): { angle: number; radius: number }[] {
  return Array.from({ length: AWARD_SEGMENTS }, (_, k) => ({
    angle: (k + 0.5) * ((Math.PI * 2) / AWARD_SEGMENTS),
    radius: WINDOW_APOTHEM,
  }))
}
