import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const files = { horizontal: 450.11, 'horizontal-negative': 450.11, stacked: 227.69, 'stacked-negative': 227.69 }

describe('KFUPM-only logo', () => {
  for (const [name, originalWidth] of Object.entries(files)) {
    it(`${name} keeps only the mark and the wordmark`, () => {
      const svg = readFileSync(`src/brand/logo/${name}.svg`, 'utf8')
      expect(svg.match(/<g\b/g)).toHaveLength(3)
      expect(svg).toContain('KFUPM_Wordmark')
      expect(svg).toContain('KFUPM_Iconmark')
      const w = Number(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+) /.exec(svg)![1])
      expect(w).toBeLessThan(originalWidth)
    })
  }
})
