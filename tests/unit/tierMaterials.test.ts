import { describe, expect, it } from 'vitest'
import { TIER_MATERIALS } from '@/features/honors/tierMaterials'

describe('tier materials', () => {
  it('uses the same light intensity for every tier', () => {
    const v = new Set(Object.values(TIER_MATERIALS).map((m) => m.lightIntensity))
    expect(v.size).toBe(1)
  })
  it('uses the same metalness and roughness for every tier', () => {
    expect(new Set(Object.values(TIER_MATERIALS).map((m) => `${m.metalness}/${m.roughness}`)).size).toBe(1)
  })
  it('has the agreed metal colours', () => {
    expect(TIER_MATERIALS.gold.color).toBe('#E6B84A')
    expect(TIER_MATERIALS.silver.color).toBe('#C9CED4')
    expect(TIER_MATERIALS.bronze.color).toBe('#B87333')
  })
})
