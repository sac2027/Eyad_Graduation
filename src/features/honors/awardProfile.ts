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
