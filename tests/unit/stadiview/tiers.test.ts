import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SLOW_BENCH_MS, detectCapability } from '@/features/honors/capability'
import type { CapabilityEnv } from '@/features/honors/capability'
import { TIER_SETTINGS, detectTier, resolveTier, tierFromSearch, bloomTooSlow, BLOOM_SLOW_MS } from '@/features/stadiview/engine/tiers'
import type { Tier } from '@/features/stadiview/engine/tiers'

type Env = CapabilityEnv & { coarsePointer: boolean }

/** A laptop the rules know nothing bad about: WebGL, a mouse, and no numbers reported. */
const env = (over: Partial<Env> = {}): Env => ({ hasWebGL: true, lowEndFlag: false, coarsePointer: false, ...over })
/** A desktop that qualifies for the top tier. */
const desktop = (over: Partial<Env> = {}): Env => env({ cores: 8, deviceMemory: 8, ...over })

describe('detectTier', () => {
  it('gives tier 0 without WebGL, whatever else the device reports', () => {
    expect(detectTier(env({ hasWebGL: false }))).toBe(0)
    expect(detectTier(desktop({ hasWebGL: false }))).toBe(0)
    expect(detectTier(env({ hasWebGL: false, lowEndFlag: true }))).toBe(0)
    expect(detectTier(env({ hasWebGL: false, coarsePointer: true, cores: 2, deviceMemory: 1, benchMs: 90 }))).toBe(0)
  })

  it('gives tier 1 with the low-end flag, even on a strong desktop', () => {
    expect(detectTier(env({ lowEndFlag: true }))).toBe(1)
    expect(detectTier(desktop({ lowEndFlag: true }))).toBe(1)
    expect(detectTier(desktop({ lowEndFlag: true, cores: 32, benchMs: 2 }))).toBe(1)
  })

  it('gives tier 1 for two cores or fewer and tier 2 from three', () => {
    expect(detectTier(env({ cores: 1 }))).toBe(1)
    expect(detectTier(env({ cores: 2 }))).toBe(1)
    expect(detectTier(env({ cores: 3 }))).toBe(2)
    expect(detectTier(env({ cores: 4 }))).toBe(2)
  })

  it('gives tier 1 for device memory of 2 GB or less and tier 2 above it', () => {
    expect(detectTier(env({ deviceMemory: 0.5 }))).toBe(1)
    expect(detectTier(env({ deviceMemory: 2 }))).toBe(1)
    expect(detectTier(env({ deviceMemory: 4 }))).toBe(2)
    expect(detectTier(env({ deviceMemory: 8 }))).toBe(2) // memory alone does not make a desktop
  })

  it('gives tier 1 only for a benchmark slower than the limit, not for one exactly on it', () => {
    expect(detectTier(env({ benchMs: SLOW_BENCH_MS }))).toBe(2)
    expect(detectTier(env({ benchMs: SLOW_BENCH_MS + 0.01 }))).toBe(1)
    expect(detectTier(env({ benchMs: SLOW_BENCH_MS - 0.01 }))).toBe(2)
    expect(detectTier(env({ benchMs: 90 }))).toBe(1)
    expect(detectTier(desktop({ benchMs: SLOW_BENCH_MS }))).toBe(3)
    expect(detectTier(desktop({ benchMs: SLOW_BENCH_MS + 0.01 }))).toBe(1)
  })

  it('lets any one weak signal pull a strong desktop down to tier 1', () => {
    expect(detectTier(desktop({ cores: 2 }))).toBe(1)
    expect(detectTier(desktop({ deviceMemory: 2 }))).toBe(1)
    expect(detectTier(desktop({ benchMs: 40 }))).toBe(1)
  })

  it('gives tier 3 to a fine pointer with eight cores or more: seven is not enough', () => {
    expect(detectTier(desktop({ cores: 7 }))).toBe(2)
    expect(detectTier(desktop({ cores: 8 }))).toBe(3)
    expect(detectTier(desktop({ cores: 16 }))).toBe(3)
  })

  it('gives tier 3 with 8 GB or with memory not reported, and tier 2 with less', () => {
    expect(detectTier(desktop({ deviceMemory: 8 }))).toBe(3)
    expect(detectTier(desktop({ deviceMemory: undefined }))).toBe(3) // Safari and Firefox do not report it
    expect(detectTier(desktop({ deviceMemory: 4 }))).toBe(2)
    expect(detectTier(desktop({ deviceMemory: 7.9 }))).toBe(2)
    expect(detectTier(desktop({ deviceMemory: 16 }))).toBe(3)
  })

  it('never gives tier 3 to a touch device or to a device that does not report its cores', () => {
    expect(detectTier(desktop({ coarsePointer: true }))).toBe(2)
    expect(detectTier(desktop({ coarsePointer: true, cores: 12, deviceMemory: undefined }))).toBe(2)
    expect(detectTier(desktop({ cores: undefined }))).toBe(2)
    expect(detectTier(env())).toBe(2)
    expect(detectTier(env({ coarsePointer: true }))).toBe(2)
  })

  it('gives tier 2 to a typical phone and a typical laptop', () => {
    expect(detectTier(env({ coarsePointer: true, cores: 8, deviceMemory: 4, benchMs: 14 }))).toBe(2)
    expect(detectTier(env({ cores: 4, deviceMemory: 8, benchMs: 7 }))).toBe(2)
  })

  it('treats a number that is not a number as not reported', () => {
    expect(detectTier(env({ cores: NaN, deviceMemory: NaN, benchMs: NaN }))).toBe(2)
    expect(detectTier(desktop({ deviceMemory: NaN }))).toBe(3)
    expect(detectTier(desktop({ cores: NaN }))).toBe(2)
    expect(detectTier(desktop({ benchMs: NaN }))).toBe(3)
  })

  it('does not change the object it is given', () => {
    const e = desktop({ benchMs: 5 })
    const before = structuredClone(e)
    detectTier(e)
    expect(e).toEqual(before)
  })

  it('draws the line between tiers 1 and 2 exactly where the honor page draws its fallback', () => {
    // The two features share one benchmark and one set of thresholds, so a device cannot get the
    // heavy version of one page and the light version of the other.
    const opt = <T>(...xs: T[]): (T | undefined)[] => [undefined, ...xs]
    let checked = 0
    for (const hasWebGL of [true, false])
      for (const lowEndFlag of [false, true])
        for (const coarsePointer of [false, true])
          for (const cores of opt(1, 2, 3, 4, 7, 8, 16))
            for (const deviceMemory of opt(0.5, 2, 4, 8))
              for (const benchMs of opt(6, SLOW_BENCH_MS, SLOW_BENCH_MS + 0.01, 60)) {
                const e: Env = { hasWebGL, lowEndFlag, coarsePointer, cores, deviceMemory, benchMs }
                const tier = detectTier(e)
                expect(tier <= 1, JSON.stringify(e)).toBe(detectCapability(e) === 'fallback')
                expect(tier === 0, JSON.stringify(e)).toBe(!hasWebGL)
                checked++
              }
    expect(checked).toBe(2 * 2 * 2 * 8 * 5 * 5)
  })
})

describe('tierFromSearch', () => {
  it('reads tier=0 to tier=3', () => {
    expect(tierFromSearch('?tier=0')).toBe(0)
    expect(tierFromSearch('?tier=1')).toBe(1)
    expect(tierFromSearch('?tier=2')).toBe(2)
    expect(tierFromSearch('?tier=3')).toBe(3)
  })

  it('finds the parameter among others, with or without the question mark', () => {
    expect(tierFromSearch('?lang=en&tier=1')).toBe(1)
    expect(tierFromSearch('?tier=3&lang=en&idle=1')).toBe(3)
    expect(tierFromSearch('tier=2')).toBe(2)
    expect(tierFromSearch('?tier=1&tier=3')).toBe(1) // the first one wins, as everywhere else in the app
    expect(tierFromSearch('?tier=%31')).toBe(1) // an encoded "1" is still a 1
  })

  it('returns null with no parameter', () => {
    expect(tierFromSearch('')).toBeNull()
    expect(tierFromSearch('?')).toBeNull()
    expect(tierFromSearch('?lang=en')).toBeNull()
    expect(tierFromSearch('?tiers=1')).toBeNull()
    expect(tierFromSearch('?xtier=1')).toBeNull()
    expect(tierFromSearch('?TIER=1')).toBeNull()
  })

  it('returns null for anything that is not exactly one of the four digits', () => {
    for (const bad of ['9', '4', '-1', 'x', '', '1.0', '1.5', '01', '11', ' 1', '1 ', '+1', '1e0', '0x1', 'true', 'null', 'NaN', '٣', '１']) {
      expect(tierFromSearch(`?tier=${encodeURIComponent(bad)}`), JSON.stringify(bad)).toBeNull()
    }
    expect(tierFromSearch('?tier')).toBeNull()
    expect(tierFromSearch('?tier=+1')).toBeNull() // a raw plus is a space
    expect(tierFromSearch('?tier=1#x')).toBeNull() // a hash is not part of a search string
    expect(tierFromSearch('?tier=%')).toBeNull() // a broken escape must not throw
    expect(tierFromSearch('?tier=%E0%A4%A')).toBeNull()
  })

  it('never returns 0 by accident: an empty value is null, not tier 0', () => {
    // Number('') is 0, so a careless conversion would switch the 3D off for "?tier=".
    expect(tierFromSearch('?tier=')).toBeNull()
    expect(tierFromSearch('?tier=%20')).toBeNull()
  })
})

describe('resolveTier', () => {
  it('uses the detected tier when the URL does not name one', () => {
    expect(resolveTier(env(), '')).toBe(2)
    expect(resolveTier(desktop(), '?lang=en')).toBe(3)
    expect(resolveTier(env({ lowEndFlag: true }), '')).toBe(1)
    expect(resolveTier(env({ hasWebGL: false }), '')).toBe(0)
  })

  it('ignores a tier parameter it cannot read', () => {
    expect(resolveTier(desktop(), '?tier=9')).toBe(3)
    expect(resolveTier(desktop(), '?tier=x')).toBe(3)
    expect(resolveTier(env({ cores: 2 }), '?tier=')).toBe(1)
  })

  it('lets the URL raise or lower the tier on a device with WebGL', () => {
    for (const t of [0, 1, 2, 3] as const) {
      expect(resolveTier(env(), `?tier=${t}`)).toBe(t)
      expect(resolveTier(desktop(), `?lang=ar&tier=${t}`)).toBe(t)
      expect(resolveTier(env({ lowEndFlag: true, cores: 2, deviceMemory: 1, benchMs: 80 }), `?tier=${t}`)).toBe(t)
    }
  })

  it('keeps tier 0 without WebGL, even with ?tier=3', () => {
    for (const t of [0, 1, 2, 3]) {
      expect(resolveTier(env({ hasWebGL: false }), `?tier=${t}`)).toBe(0)
      expect(resolveTier(desktop({ hasWebGL: false }), `?tier=${t}`)).toBe(0)
    }
  })
})

describe('TIER_SETTINGS', () => {
  it('holds the table from the plan', () => {
    expect(TIER_SETTINGS).toEqual({
      0: { maxDpr: 1, antialias: false, spotLights: false, bloom: false, crowd: 0, livePreview: false },
      1: { maxDpr: 1, antialias: false, spotLights: false, bloom: false, crowd: 150, livePreview: false },
      2: { maxDpr: 1.5, antialias: true, spotLights: true, bloom: false, crowd: 400, livePreview: false },
      3: { maxDpr: 2, antialias: true, spotLights: true, bloom: true, crowd: 900, livePreview: true },
    })
  })

  it('has a row for each tier and nothing else', () => {
    expect(Object.keys(TIER_SETTINGS)).toEqual(['0', '1', '2', '3'])
  })

  it('never takes something away on a higher tier', () => {
    const tiers: Tier[] = [0, 1, 2, 3]
    for (let k = 1; k < tiers.length; k++) {
      const lo = TIER_SETTINGS[tiers[k - 1]]
      const hi = TIER_SETTINGS[tiers[k]]
      expect(hi.maxDpr).toBeGreaterThanOrEqual(lo.maxDpr)
      expect(hi.crowd).toBeGreaterThanOrEqual(lo.crowd)
      for (const key of ['antialias', 'spotLights', 'bloom', 'livePreview'] as const) expect(Number(hi[key])).toBeGreaterThanOrEqual(Number(lo[key]))
    }
  })

  it('keeps the pixel ratio at 1 or more, so the canvas dpr range [1, maxDpr] is never upside down', () => {
    for (const t of [0, 1, 2, 3] as const) expect(TIER_SETTINGS[t].maxDpr).toBeGreaterThanOrEqual(1)
  })

  it('gives each tier its own row, so changing one cannot change another', () => {
    const rows = [0, 1, 2, 3].map((t) => TIER_SETTINGS[t as Tier])
    expect(new Set(rows).size).toBe(4)
  })
})

describe('tiers.ts is pure logic', () => {
  /** Every module a source file imports or re-exports from, type-only ones included. */
  const specifiers = (file: string): string[] => {
    // Comments go first, so a sentence such as "taken from 'x'" is not read as an import.
    const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const patterns = [
      /^\s*(?:import|export)\s[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/gm, // import x from 'm', export { x } from 'm'
      /^\s*import\s*['"]([^'"]+)['"]/gm, // import 'm'
      /\bimport\s*\(\s*['"]([^'"]+)['"]/g, // import('m')
    ]
    return patterns.flatMap((re) => [...src.matchAll(re)].map((m) => m[1]))
  }

  it('finds imports the way this test needs it to', () => {
    // The check below is only worth something if the reader above really sees imports.
    const store = specifiers('src/features/stadiview/state/stadiumStore.ts')
    expect(store).toContain('zustand')
    expect(specifiers('src/features/stadiview/engine/cameraMath.ts')).toContain('@/features/stadiview/engine/seatFrame')
    expect(specifiers('src/features/honors/capability.ts')).toEqual([])
  })

  it('reaches no package at all, so it can be loaded before the 3D chunk', () => {
    // The tier is decided before anything heavy is fetched. Walk everything tiers.ts imports,
    // directly or through other files, and make sure it all stays inside src/.
    const seen = new Set<string>()
    const queue = ['src/features/stadiview/engine/tiers.ts']
    const packages = new Set<string>()
    while (queue.length) {
      const file = queue.pop()!
      if (seen.has(file)) continue
      seen.add(file)
      for (const spec of specifiers(file)) {
        if (!spec.startsWith('@/')) {
          packages.add(spec)
          continue
        }
        const base = `src/${spec.slice(2)}`
        const found = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((p) => existsSync(p))
        expect(found, `${file} imports ${spec}`).toBeDefined()
        queue.push(found!)
      }
    }
    expect([...packages]).toEqual([])
    expect([...seen].sort()).toEqual(['src/features/honors/capability.ts', 'src/features/stadiview/engine/tiers.ts'])
  })

  it('takes the benchmark limit from the honor page and does not keep its own copy', () => {
    const src = readFileSync('src/features/stadiview/engine/tiers.ts', 'utf8')
    expect(specifiers('src/features/stadiview/engine/tiers.ts')).toContain('@/features/honors/capability')
    expect(src).toContain('SLOW_BENCH_MS')
    expect(src).not.toMatch(/\b22\b/)
  })
})

describe('bloom', () => {
  it('is on tier 3 only', () => {
    expect([0, 1, 2, 3].map((t) => TIER_SETTINGS[t as 0 | 1 | 2 | 3].bloom)).toEqual([false, false, false, true])
  })

  it('gives up only when 90 frames have been measured and their median is slower than 25 ms', () => {
    expect(bloomTooSlow(Array(89).fill(100))).toBe(false)
    expect(bloomTooSlow(Array(90).fill(16.7))).toBe(false)
    expect(bloomTooSlow(Array(90).fill(30))).toBe(true)
    // A few slow frames among fast ones are not enough.
    expect(bloomTooSlow([...Array(60).fill(16), ...Array(30).fill(200)])).toBe(false)
    expect(BLOOM_SLOW_MS).toBe(25)
  })
})
