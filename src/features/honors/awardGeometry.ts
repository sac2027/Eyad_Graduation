import * as THREE from 'three'

/** Octagonal, like the KFUPM seal. */
export const AWARD_SEGMENTS = 8

/**
 * Profile of the campus tower as [radius, height]: a stepped base, a slender tapering shaft,
 * then a flared crown with a lip and a cap. Revolved in 8 segments so every face is a flat facet.
 */
export const AWARD_PROFILE: [number, number][] = [
  [0, 0],
  [0.5, 0],
  [0.5, 0.1],
  [0.4, 0.1],
  [0.4, 0.22],
  [0.34, 0.3],
  [0.3, 0.5],
  [0.25, 2.4],
  [0.23, 3.4],
  [0.26, 3.55],
  [0.4, 3.75],
  [0.55, 3.98],
  [0.62, 4.22],
  [0.62, 4.42],
  [0.5, 4.52],
  [0.42, 4.52],
  [0, 4.55],
]

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
