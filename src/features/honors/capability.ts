export interface CapabilityEnv {
  hasWebGL: boolean
  deviceMemory?: number
  cores?: number
  lowEndFlag: boolean
  /** Median time (ms) of a small CPU benchmark. Undefined when not measured. */
  benchMs?: number
}

export type Capability = 'full' | 'fallback'

/** Measured on a desktop: about 6 ms. A phone about four times slower lands near 25 ms or more. */
export const SLOW_BENCH_MS = 22

/** Decides whether this device gets the 3D scene and the scroll story, or the 2D version of the same moment. */
export function detectCapability(env: CapabilityEnv): Capability {
  if (!env.hasWebGL || env.lowEndFlag) return 'fallback'
  if (env.deviceMemory !== undefined && env.deviceMemory <= 2) return 'fallback'
  if (env.cores !== undefined && env.cores <= 2) return 'fallback'
  if (env.benchMs !== undefined && env.benchMs > SLOW_BENCH_MS) return 'fallback'
  return 'full'
}

export function cpuBenchMs(): number {
  const runs: number[] = []
  for (let r = 0; r < 3; r++) {
    const t0 = performance.now()
    let x = 0
    for (let i = 0; i < 3e6; i++) x += Math.sqrt(i)
    const dt = performance.now() - t0
    runs.push(dt + (x < 0 ? 1 : 0))
  }
  return runs.sort((a, b) => a - b)[1]
}

/**
 * Browser automation (webdriver) skips the benchmark, because a busy test runner would make it flaky.
 * Add ?bench=1 to measure anyway.
 */
function shouldBench(): boolean {
  try {
    return !navigator.webdriver || new URLSearchParams(window.location.search).get('bench') === '1'
  } catch {
    return false
  }
}

let probed: Omit<CapabilityEnv, 'lowEndFlag'> | null = null

/** Probes once per page load and shares the result between the Journey and the honor page. */
export function probeEnv(lowEndFlag: boolean): CapabilityEnv {
  if (!probed) {
    let hasWebGL: boolean
    try {
      const c = document.createElement('canvas')
      hasWebGL = !!(c.getContext('webgl2') ?? c.getContext('webgl'))
    } catch {
      hasWebGL = false
    }
    const nav = navigator as Navigator & { deviceMemory?: number }
    probed = { hasWebGL, deviceMemory: nav.deviceMemory, cores: nav.hardwareConcurrency, benchMs: shouldBench() ? cpuBenchMs() : undefined }
  }
  return { ...probed, lowEndFlag }
}
