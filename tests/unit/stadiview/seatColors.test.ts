import { describe, expect, it } from 'vitest'
import { VENUE } from '@/features/stadiview/config/venue'
import { buildVenue, getVenue } from '@/features/stadiview/layout/venueLayout'
import { baseColor, colorFor, SEAT_COLORS } from '@/features/stadiview/scene/seatColors'

const v = getVenue()
const idle = { hover: -1, selected: -1 }

describe('seat colours', () => {
  it('uses the palette: green on the pitch, deep green in the stands, sand for the lettering, gold for the chosen seat', () => {
    expect(SEAT_COLORS).toEqual({ pitch: '#009C5A', stand: '#005A50', letter: '#E8DEC3', active: '#E7A614' })
  })

  it('paints graduate seats and wheelchair bays green', () => {
    expect(baseColor(v.indexOf('P1-01-01'), v)).toBe('#009C5A')
    expect(baseColor(v.indexOf('P6-33-14'), v)).toBe('#009C5A')
    expect(baseColor(v.indexOf('P3-A1'), v)).toBe('#009C5A')
  })

  it('paints stand seats deep green, and the seats that spell KFUPM sand', () => {
    expect(baseColor(v.indexOf('S-01-001'), v)).toBe('#005A50')
    expect(baseColor(v.indexOf('VIP-03-025'), v)).toBe('#005A50')
    expect(baseColor(v.indexOf('E-06-075'), v)).toBe('#005A50')
    // Row 10, seats 9 to 14, is the middle of the K's stem and arm.
    expect(baseColor(v.indexOf('S-10-009'), v)).toBe('#E8DEC3')
    // Seats 1 to 8 are the margin before the first letter.
    expect(baseColor(v.indexOf('S-10-008'), v)).toBe('#005A50')
  })

  it('letters only the stand named in the config, even where another stand has the same row and seat', () => {
    expect(baseColor(v.indexOf('NW-10-009'), v)).toBe('#005A50')
    expect(baseColor(v.indexOf('NE-10-009'), v)).toBe('#005A50')
    expect(baseColor(v.indexOf('E-10-009'), v)).toBe('#005A50')
  })

  it('letters exactly the 486 seats of the word', () => {
    let sand = 0
    for (let i = 0; i < v.count; i++) if (baseColor(i, v) === '#E8DEC3') sand++
    expect(sand).toBe(486)
  })

  it('turns the hovered seat and the selected seat gold, whatever their own colour', () => {
    const pitch = v.indexOf('P3-12-07')
    const letter = v.indexOf('S-10-009')
    const plain = v.indexOf('S-01-001')
    for (const i of [pitch, letter, plain]) {
      expect(colorFor(i, v, { hover: i, selected: -1 })).toBe('#E7A614')
      expect(colorFor(i, v, { hover: -1, selected: i })).toBe('#E7A614')
      expect(colorFor(i, v, { hover: i, selected: i })).toBe('#E7A614')
    }
  })

  it('leaves every other seat its own colour', () => {
    const pitch = v.indexOf('P3-12-07')
    expect(colorFor(pitch, v, idle)).toBe('#009C5A')
    expect(colorFor(pitch, v, { hover: pitch + 1, selected: pitch - 1 })).toBe('#009C5A')
    expect(colorFor(v.indexOf('S-10-009'), v, { hover: pitch, selected: pitch })).toBe('#E8DEC3')
  })

  it('reads the lettering from the config the layout was built from', () => {
    const cfg = structuredClone(VENUE)
    cfg.lettering.stand = 'NW'
    cfg.lettering.text = 'K'
    cfg.lettering.firstRow = 2
    cfg.lettering.lastRow = 14
    const w = buildVenue(cfg)
    let inNorthWest = 0
    let elsewhere = 0
    for (let i = 0; i < w.count; i++) {
      if (baseColor(i, w, cfg) !== '#E8DEC3') continue
      if (w.sections[w.section[i]].id === 'NW') inNorthWest++
      else elsewhere++
    }
    expect(inNorthWest).toBeGreaterThan(40)
    expect(elsewhere).toBe(0)
  })
})
