import type { HonorTier } from '@/domain/types'

export interface TierMaterial {
  color: string
  metalness: number
  roughness: number
  lightColor: string
  /** Identical for every tier, so no tier is ever shown dimmer than another. */
  lightIntensity: number
  /** Plaque base colour (a deeper tone of the metal). */
  plaque: string
}

export const LIGHT_INTENSITY = 3.2

export const TIER_MATERIALS: Record<HonorTier, TierMaterial> = {
  gold: { color: '#E6B84A', metalness: 1, roughness: 0.26, lightColor: '#ffd58a', lightIntensity: LIGHT_INTENSITY, plaque: '#a8832a' },
  silver: { color: '#C9CED4', metalness: 1, roughness: 0.26, lightColor: '#dfe9ff', lightIntensity: LIGHT_INTENSITY, plaque: '#8d949c' },
  bronze: { color: '#B87333', metalness: 1, roughness: 0.26, lightColor: '#ffb06a', lightIntensity: LIGHT_INTENSITY, plaque: '#7d4b22' },
}
