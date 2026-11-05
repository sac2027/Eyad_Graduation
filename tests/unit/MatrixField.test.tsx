import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatrixField, buildMatrix } from '@/brand/matrix/MatrixField'

describe('MatrixField', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = buildMatrix({ seed: 7, density: 0.6, frequency: 0.06, cols: 12, rows: 6 })
    const b = buildMatrix({ seed: 7, density: 0.6, frequency: 0.06, cols: 12, rows: 6 })
    const c = buildMatrix({ seed: 8, density: 0.6, frequency: 0.06, cols: 12, rows: 6 })
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    expect(a.length).toBeGreaterThan(0)
  })
  it('renders the same markup in RTL and never mirrors the pattern', () => {
    const render1 = () => render(<MatrixField background="turquoise" stripes="green" seed={3} />).container.innerHTML
    document.documentElement.dir = 'ltr'
    const ltr = render1()
    document.documentElement.dir = 'rtl'
    const rtl = render1()
    expect(rtl).toBe(ltr)
    expect(rtl).toContain('skewX(-5)')
    expect(rtl).not.toMatch(/scale\(-|scaleX|rotate/)
    document.documentElement.dir = 'rtl'
  })
  it('refuses an unapproved colour pair', () => {
    expect(() => render(<MatrixField background="sand" stripes="green" />)).toThrow()
  })
  it('uses only brand hex colours', () => {
    const html = render(<MatrixField background="beige" stripes="turquoise" />).container.innerHTML
    expect(html).toContain('#ece0c7')
    expect(html).toContain('#115f66')
    expect(html).not.toMatch(/gradient/i)
  })
  it('more density means more stripes', () => {
    const sparse = buildMatrix({ seed: 1, density: 0.2, frequency: 0.06, cols: 24, rows: 12 }).length
    const dense = buildMatrix({ seed: 1, density: 0.9, frequency: 0.06, cols: 24, rows: 12 }).length
    expect(dense).toBeGreaterThan(sparse)
  })
})
