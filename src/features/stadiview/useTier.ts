import { useMemo } from 'react'
import { useDemoFlags } from '@/features/demo-console/flags'
import { probeEnv } from '@/features/honors/capability'
import { resolveTier } from '@/features/stadiview/engine/tiers'
import type { Tier, TierEnv } from '@/features/stadiview/engine/tiers'

/**
 * How much of the 3D scene this device gets: 0 (no 3D) to 3 (everything).
 *
 * The device is probed once per page load and shared with the honor page. The demo console's
 * "Low-end device" switch is read live, so flipping it changes the tier without a reload, and a
 * `?tier=` in the URL overrides everything except missing WebGL.
 */
export function useTier(): Tier {
  const lowEnd = useDemoFlags((s) => s.lowEnd)
  return useMemo(() => {
    const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    const env: TierEnv = { ...probeEnv(lowEnd), coarsePointer }
    return resolveTier(env, window.location.search)
  }, [lowEnd])
}
