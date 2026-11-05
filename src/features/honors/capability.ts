export interface CapabilityEnv {
  hasWebGL: boolean
  deviceMemory?: number
  cores?: number
  lowEndFlag: boolean
}

export type Capability = 'full' | 'fallback'

/** Decides whether this device gets the 3D scene or the 2D version of the same moment. */
export function detectCapability(env: CapabilityEnv): Capability {
  if (!env.hasWebGL || env.lowEndFlag) return 'fallback'
  if (env.deviceMemory !== undefined && env.deviceMemory <= 2) return 'fallback'
  if (env.cores !== undefined && env.cores <= 2) return 'fallback'
  return 'full'
}

export function probeEnv(lowEndFlag: boolean): CapabilityEnv {
  let hasWebGL: boolean
  try {
    const c = document.createElement('canvas')
    hasWebGL = !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    hasWebGL = false
  }
  const nav = navigator as Navigator & { deviceMemory?: number }
  return { hasWebGL, deviceMemory: nav.deviceMemory, cores: nav.hardwareConcurrency, lowEndFlag }
}
