import type { HonorTier } from './types'

/** Cumulative GPA before the ceremony semester. Lower bounds are inclusive. */
export function honorTier(gpa: number): HonorTier | null {
  if (!Number.isFinite(gpa) || gpa < 0 || gpa > 4) {
    throw new RangeError(`GPA must be between 0 and 4.00, received ${gpa}`)
  }
  if (gpa >= 3.75) return 'gold'
  if (gpa >= 3.25) return 'silver'
  if (gpa >= 3.0) return 'bronze'
  return null
}
