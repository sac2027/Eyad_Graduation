import { describe, expect, it } from 'vitest'
import { detectCapability } from '@/features/honors/capability'
import { buildIcs } from '@/features/honors/ics'
import { fitFontSize, splitName } from '@/features/honors/namePlaque'

describe('detectCapability', () => {
  it('falls back without WebGL or when the low-end flag is on', () => {
    expect(detectCapability({ hasWebGL: false, lowEndFlag: false })).toBe('fallback')
    expect(detectCapability({ hasWebGL: true, lowEndFlag: true })).toBe('fallback')
  })
  it('falls back on very small devices', () => {
    expect(detectCapability({ hasWebGL: true, lowEndFlag: false, deviceMemory: 2 })).toBe('fallback')
    expect(detectCapability({ hasWebGL: true, lowEndFlag: false, cores: 2 })).toBe('fallback')
  })
  it('gives a modern device the full scene', () => {
    expect(detectCapability({ hasWebGL: true, lowEndFlag: false, deviceMemory: 8, cores: 8 })).toBe('full')
    expect(detectCapability({ hasWebGL: true, lowEndFlag: false })).toBe('full')
  })
})

describe('name plaque text fitting', () => {
  const ctx = { font: '', measureText(t: string) { const px = Number(/(\d+)px/.exec(this.font)![1]); return { width: t.length * px * 0.6 } } }
  it('keeps short names large and shrinks long ones to fit', () => {
    expect(fitFontSize(ctx, 'ن', 900, 120, 36, 'x')).toBe(120)
    const long = 'عبدالرحمن بن محمد بن عبدالعزيز بن سعود بن فيصل آل سعود الغامدي الشمري'
    const s = fitFontSize(ctx, long, 900, 120, 36, 'x')
    expect(s).toBeLessThan(120)
    ctx.font = `900 ${s}px x`
    expect(ctx.measureText(long).width <= 900 || s === 36).toBe(true)
  })
  it('splits very long names over two lines at a space', () => {
    const lines = splitName('عبدالرحمن بن محمد بن عبدالعزيز بن سعود بن فيصل آل سعود الغامدي')
    expect(lines).toHaveLength(2)
    expect(lines.join(' ')).toBe('عبدالرحمن بن محمد بن عبدالعزيز بن سعود بن فيصل آل سعود الغامدي')
    expect(splitName('خالد العتيبي')).toEqual(['خالد العتيبي'])
  })
})

describe('buildIcs', () => {
  it('writes a valid single-event calendar with UTC times', () => {
    const ics = buildIcs({ uid: 'x@y', title: 'Honors, ceremony', start: Date.parse('2027-04-06T19:00:00+03:00'), end: Date.parse('2027-04-06T21:00:00+03:00'), location: 'Stadium', description: 'Line1\nLine2' })
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics).toContain('DTSTART:20270406T160000Z')
    expect(ics).toContain('DTEND:20270406T180000Z')
    expect(ics).toContain('SUMMARY:Honors\\, ceremony')
    expect(ics).toContain('DESCRIPTION:Line1\\nLine2')
    expect(ics.endsWith('END:VCALENDAR')).toBe(true)
    expect(ics.split('\r\n').length).toBeGreaterThan(8)
  })
})

describe('detectCapability: CPU benchmark', () => {
  it('falls back on a slow benchmark and keeps the full scene on a fast one', () => {
    expect(detectCapability({ hasWebGL: true, lowEndFlag: false, benchMs: 40 })).toBe('fallback')
    expect(detectCapability({ hasWebGL: true, lowEndFlag: false, benchMs: 23 })).toBe('fallback')
    expect(detectCapability({ hasWebGL: true, lowEndFlag: false, benchMs: 6 })).toBe('full')
    expect(detectCapability({ hasWebGL: true, lowEndFlag: false, benchMs: 22 })).toBe('full')
  })
})
