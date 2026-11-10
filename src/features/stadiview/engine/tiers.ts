import { SLOW_BENCH_MS } from '@/features/honors/capability'
import type { CapabilityEnv } from '@/features/honors/capability'

/**
 * How much of the 3D scene a device gets: 0 is no 3D at all, 3 is everything.
 * This file is plain logic with no React and no three.js, because the tier is decided
 * before the 3D code is fetched.
 */
export type Tier = 0 | 1 | 2 | 3

/** What the page can find out about the device. `coarsePointer` is true for touch screens. */
export type TierEnv = CapabilityEnv & { coarsePointer: boolean }

export interface TierSettings {
  /** Upper limit of the canvas pixel ratio. */
  maxDpr: number
  antialias: boolean
  /** Real spot lights from the four masts. Without them the masts only show glow sprites. */
  spotLights: boolean
  bloom: boolean
  /** The most avatars drawn around the viewer in first person. */
  crowd: number
  /** Whether the inspector's seat preview is a live render or a still. */
  livePreview: boolean
}

export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  0: { maxDpr: 1, antialias: false, spotLights: false, bloom: false, crowd: 0, livePreview: false },
  1: { maxDpr: 1, antialias: false, spotLights: false, bloom: false, crowd: 150, livePreview: false },
  2: { maxDpr: 1.5, antialias: true, spotLights: true, bloom: false, crowd: 400, livePreview: false },
  3: { maxDpr: 2, antialias: true, spotLights: true, bloom: true, crowd: 900, livePreview: true },
}

// The weak-device limits are the honor page's (detectCapability in honors/capability.ts), so a
// device that gets the light version of one page gets the light version of the other.
const WEAK_MEMORY_GB = 2
const WEAK_CORES = 2
// A desktop-class machine. Chrome never reports more than 8 GB, so 8 is the highest usable bar.
const STRONG_CORES = 8
const STRONG_MEMORY_GB = 8

/** True when the browser reported the number and it is at most `limit`. */
function atMost(n: number | undefined, limit: number): boolean {
  return n !== undefined && n <= limit
}

/** True when the browser reported the number and it is at least `limit`. */
function atLeast(n: number | undefined, limit: number): boolean {
  return n !== undefined && n >= limit
}

/** Picks the tier from what the device reports about itself. */
export function detectTier(env: TierEnv): Tier {
  if (!env.hasWebGL) return 0

  const slowBench = env.benchMs !== undefined && env.benchMs > SLOW_BENCH_MS
  if (env.lowEndFlag || atMost(env.deviceMemory, WEAK_MEMORY_GB) || atMost(env.cores, WEAK_CORES) || slowBench) return 1

  // Safari and Firefox do not report memory at all, so a missing value must not hold a desktop
  // back. A missing core count does: without it there is nothing to say the machine is strong.
  const memoryUnknown = env.deviceMemory === undefined || Number.isNaN(env.deviceMemory)
  const enoughMemory = memoryUnknown || atLeast(env.deviceMemory, STRONG_MEMORY_GB)
  if (!env.coarsePointer && atLeast(env.cores, STRONG_CORES) && enoughMemory) return 3

  return 2
}

/**
 * Reads a forced tier from a URL search string such as "?lang=en&tier=1".
 * Only the single digits 0 to 3 count. Anything else is null, never a guess: an empty
 * "?tier=" must not be read as 0 and switch the 3D off.
 */
export function tierFromSearch(search: string): Tier | null {
  const raw = new URLSearchParams(search).get('tier')
  if (raw === '0') return 0
  if (raw === '1') return 1
  if (raw === '2') return 2
  if (raw === '3') return 3
  return null
}

/**
 * The tier to use: the URL's when it names one, otherwise the detected one.
 * The URL cannot conjure up WebGL, so a device without it stays on tier 0 whatever the URL says.
 */
export function resolveTier(env: TierEnv, search: string): Tier {
  if (!env.hasWebGL) return 0
  return tierFromSearch(search) ?? detectTier(env)
}
