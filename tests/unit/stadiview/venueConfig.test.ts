import { describe, expect, it } from 'vitest'
import { COLLEGE_COLORS, COLLEGE_NAMES } from '@/domain/types'
import { COLLEGE_ID, VENUE } from '@/features/stadiview/config/venue'
import type { ArcStandConfig, LineStandConfig } from '@/features/stadiview/config/venue'

const line = (id: string) => VENUE.stands.find((s): s is LineStandConfig => s.kind === 'line' && s.id === id)!
const east = VENUE.stands.find((s): s is ArcStandConfig => s.kind === 'arc')!
const capacity = (id: string) => {
  const s = VENUE.stands.find((x) => x.id === id)!
  return s.kind === 'line' ? s.rows * s.seatsPerRow : s.rows * s.spans.reduce((a, sp) => a + sp.seats, 0)
}

describe('venue config', () => {
  it('is plain data: a clone is equal to it and it survives a JSON round trip', () => {
    expect(structuredClone(VENUE)).toEqual(VENUE)
    expect(JSON.parse(JSON.stringify(VENUE))).toEqual(VENUE)
  })

  it('lists the 24 zones with the baseline head counts: 629 women, 2,357 men', () => {
    expect(VENUE.zones).toHaveLength(24)
    expect(new Set(VENUE.zones.map((z) => z.id)).size).toBe(24)
    for (const z of VENUE.zones) expect(z.id).toBe(`${z.gender.toUpperCase()}-${z.college}-${z.degree}`)
    const sum = (g: string, d?: string) => VENUE.zones.filter((z) => z.gender === g && (!d || z.degree === d)).reduce((a, z) => a + z.count, 0)
    expect(sum('f', 'B')).toBe(285)
    expect(sum('f', 'G')).toBe(344)
    expect(sum('m')).toBe(2357)
    expect(VENUE.zones.map((z) => z.count)).toEqual([101, 71, 58, 27, 25, 3, 102, 70, 68, 49, 39, 16, 342, 272, 430, 176, 141, 207, 32, 305, 146, 121, 96, 89])
    expect(VENUE.zones.slice(0, 6).map((z) => z.college)).toEqual(['CCM', 'CEP', 'CMM', 'KBS', 'CPEG', 'CDBE'])
    expect(VENUE.zones.slice(6, 12).map((z) => z.college)).toEqual(['CCM', 'CMM', 'CDBE', 'KBS', 'CEP', 'CPEG'])
  })

  it('maps the six college codes to the existing colleges, so names and colours are reused', () => {
    expect(COLLEGE_ID).toEqual({ CEP: 'engineering', CCM: 'computing', KBS: 'business', CDBE: 'design', CMM: 'chemicals', CPEG: 'petroleum' })
    for (const id of Object.values(COLLEGE_ID)) {
      expect(COLLEGE_NAMES[id].ar).toBeTruthy()
      expect(COLLEGE_COLORS[id]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('has one women\'s block to the north and five men\'s blocks, 14 seats across', () => {
    expect(VENUE.blocks.genders).toEqual(['f', 'm', 'm', 'm', 'm', 'm'])
    expect(VENUE.blocks.seatsPerRow).toBe(14)
    expect(VENUE.blocks.gate).toEqual({ f: 5, m: 2 })
    // The six blocks and five aisles fit across the 68 m pitch.
    const width = 6 * 14 * VENUE.blocks.seatPitch + 5 * VENUE.blocks.aisle
    expect(width).toBeCloseTo(62.4, 9)
    expect(width).toBeLessThan(VENUE.pitch.width)
  })

  it('holds 5,000 grandstand seats in the order VIP, NW, NE, S, E, ACC', () => {
    expect(VENUE.stands.map((s) => s.id)).toEqual(['VIP', 'NW', 'NE', 'S', 'E', 'ACC'])
    expect(VENUE.stands.map((s) => capacity(s.id))).toEqual([300, 450, 450, 2400, 1200, 200])
    expect(VENUE.stands.reduce((a, s) => a + capacity(s.id), 0)).toBe(5000)
  })

  it('makes every straight stand exactly as wide as its row of seats', () => {
    for (const s of VENUE.stands) if (s.kind === 'line') expect(s.xMax - s.xMin).toBeCloseTo(s.seatsPerRow * s.seatPitch, 9)
    expect([line('S').xMin, line('S').xMax]).toEqual([-36, 36])
    expect([line('VIP').xMin, line('VIP').xMax]).toEqual([-15, 15])
    expect([line('NW').xMin, line('NW').xMax]).toEqual([-35, -17])
    expect([line('NE').xMin, line('NE').xMax]).toEqual([17, 35])
    expect([line('ACC').xMin, line('ACC').xMax]).toEqual([-35, 0])
  })

  it('steps the stands as specified', () => {
    expect(line('S')).toMatchObject({ side: 'south', rows: 20, firstRowZ: 53, firstRowY: 1.2, tread: 0.85, riser: 0.42 })
    expect(line('NW')).toMatchObject({ side: 'north', rows: 15, firstRowZ: -52, firstRowY: 1.2, tread: 0.85, riser: 0.42 })
    expect(line('NE')).toMatchObject({ side: 'north', rows: 15, firstRowZ: -52, firstRowY: 1.2, tread: 0.85, riser: 0.42 })
    expect(line('VIP')).toMatchObject({ side: 'north', rows: 6, firstRowZ: -52, firstRowY: 3.0, tread: 1.1, riser: 0.45 })
    // The accessibility platform is flat (step-free) and sits between the track and the south stand.
    const acc = line('ACC')
    expect(acc).toMatchObject({ side: 'south', rows: 4, firstRowZ: 47.3, firstRowY: 0.3, tread: 1.1, riser: 0, seatPitch: 0.7 })
    const trackOuter = VENUE.track.innerRadius + VENUE.track.lanes * VENUE.track.laneWidth
    expect(trackOuter).toBeCloseTo(46.26, 9)
    expect(acc.firstRowZ - acc.tread / 2).toBeGreaterThan(trackOuter)
    expect(acc.firstRowZ + (acc.rows - 0.5) * acc.tread).toBeLessThan(line('S').firstRowZ - line('S').tread / 2)
  })

  it('assigns the gates: families 1, flanks 2, accessibility 3 (south-west), VIP 4 (north centre)', () => {
    expect(Object.fromEntries(VENUE.stands.map((s) => [s.id, s.gate]))).toEqual({ VIP: 4, NW: 2, NE: 2, S: 1, E: 1, ACC: 3 })
    expect(VENUE.gates.map((g) => g.id)).toEqual([1, 2, 3, 4, 5])
    expect(VENUE.gates.map((g) => g.position)).toEqual([[0, 0, 78], [62, 0, 62], [-50, 0, 70], [0, 0, -76], [62, 0, -62]])
    const [x3, , z3] = VENUE.gates[2].position
    expect(x3).toBeLessThan(0)
    expect(z3).toBeGreaterThan(0)
  })

  it('leaves an 8 degree gap in the east curve for the procession entrance', () => {
    expect(east.id).toBe('E')
    expect(east.spans).toEqual([{ fromDeg: -34, toDeg: -4, seats: 50 }, { fromDeg: 4, toDeg: 34, seats: 50 }])
    expect(east.spans[1].fromDeg - east.spans[0].toDeg).toBe(8)
    // The gap is centred on due east, where the entrance is.
    expect(east.spans[0].toDeg + east.spans[1].fromDeg).toBe(0)
    expect(VENUE.procession.entrance[2]).toBe(0)
    // About 7 m wide at the front row, as the design says.
    expect((east.firstRowRadius * 8 * Math.PI) / 180).toBeCloseTo(7.26, 2)
    // The entrance point lies inside the depth of the curve, so it sits in the tunnel between the two halves.
    const lastRadius = east.firstRowRadius + (east.rows - 1) * east.tread
    expect(VENUE.procession.entrance[0]).toBeGreaterThan(east.cx + east.firstRowRadius)
    expect(VENUE.procession.entrance[0]).toBeLessThan(east.cx + lastRadius)
  })

  it('wraps the east curve round the track bend', () => {
    expect([east.cx, east.cz]).toEqual([VENUE.track.straightHalf, 0])
    expect(east).toMatchObject({ rows: 12, firstRowRadius: 52, firstRowY: 1.2, tread: 0.85, riser: 0.42, gate: 1 })
    // 0.6 degrees per seat.
    for (const sp of east.spans) expect((sp.toDeg - sp.fromDeg) / sp.seats).toBeCloseTo(0.6, 9)
  })

  it('opens the camera north-east of the stadium so the south stand letters read the right way up', () => {
    expect(VENUE.camera.home).toEqual({ position: [72, 64, -88], target: [-8, 0, 0], fov: 42 })
    // The letters are read from the pitch side of the south stand, so the camera must be north of it.
    expect(VENUE.camera.home.position[2]).toBeLessThan(line('S').firstRowZ)
    expect(VENUE.camera.home.position[0]).toBeGreaterThan(0)
  })

  it('aims pitch seats above the podium and stand seats at the pitch', () => {
    expect(VENUE.stage.podium).toEqual([-42, 1.6, 0])
    expect(VENUE.camera.pitchLook).toEqual([-42, 3.2, 0])
    expect(VENUE.camera.standLook).toEqual([-20, 1.5, 0])
  })

  it('limits the overview orbit and the first-person look, with the opening camera inside the orbit limits', () => {
    expect(VENUE.camera.orbit).toEqual({ polarMinDeg: 18, polarMaxDeg: 80, radiusMin: 60, radiusMax: 220 })
    expect(VENUE.camera.look).toEqual({ pitchMinDeg: -35, pitchMaxDeg: 50 })
    const { position, target } = VENUE.camera.home
    const radius = Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2])
    const polarDeg = (Math.acos((position[1] - target[1]) / radius) * 180) / Math.PI
    expect(radius).toBeGreaterThan(VENUE.camera.orbit.radiusMin)
    expect(radius).toBeLessThan(VENUE.camera.orbit.radiusMax)
    expect(polarDeg).toBeGreaterThan(VENUE.camera.orbit.polarMinDeg)
    expect(polarDeg).toBeLessThan(VENUE.camera.orbit.polarMaxDeg)
    // The orbit can never go level with the ground or under it, and the look stops short of straight up and down.
    expect(VENUE.camera.orbit.polarMaxDeg).toBeLessThan(90)
    expect(VENUE.camera.look.pitchMinDeg).toBeGreaterThan(-90)
    expect(VENUE.camera.look.pitchMaxDeg).toBeLessThan(90)
  })

  it('describes the pitch, the track and the stage', () => {
    expect(VENUE.pitch).toEqual({ length: 105, width: 68 })
    expect(VENUE.track).toMatchObject({ lanes: 8, laneWidth: 1.22, straightHalf: 42.195, innerRadius: 36.5 })
    expect(VENUE.stage.deck).toEqual({ xMin: -52, xMax: -40, zMin: -20, zMax: 20, height: 1.6 })
    expect(VENUE.stage.backdrop).toMatchObject({ x: -52, zMin: -22, zMax: 22, yBottom: 1.6, yTop: 12.6 })
    expect(VENUE.stage.screens).toMatchObject({ width: 12, height: 6.75, turnDeg: 20, centres: [[-50, 8, -29], [-50, 8, 29]] })
    // The steps on the stage's east face stop short of the accessible bays.
    const stepsEnd = VENUE.stage.deck.xMax + VENUE.stage.steps.count * VENUE.stage.steps.run
    expect(stepsEnd).toBeLessThan(VENUE.blocks.row1X - VENUE.bays.setback - 0.5)
  })

  it('gives the occluders their heights: walls 1.1 above the last row, the canopy at 9.5 to 9.8 over the VIP box', () => {
    expect(VENUE.walls).toEqual({ thickness: 0.3, rise: 1.1, stands: ['VIP', 'NW', 'NE', 'S', 'E'] })
    // Only real stands are walled, and the flat accessibility platform is left open.
    for (const id of VENUE.walls.stands) expect(VENUE.stands.some((s) => s.id === id)).toBe(true)
    expect(VENUE.walls.stands).not.toContain('ACC')
    expect(VENUE.canopy).toMatchObject({ over: 'VIP', xMin: -17, xMax: 17, zMin: -60, zMax: -50, yBottom: 9.5, yTop: 9.8, columns: 4 })
    const vip = line('VIP')
    expect(VENUE.canopy.xMin).toBeLessThan(vip.xMin)
    expect(VENUE.canopy.xMax).toBeGreaterThan(vip.xMax)
    expect(VENUE.canopy.zMin).toBeLessThan(vip.firstRowZ - (vip.rows - 1) * vip.tread)
    // Head room: the canopy clears the back row by more than a standing person.
    expect(VENUE.canopy.yBottom - (vip.firstRowY + (vip.rows - 1) * vip.riser)).toBeGreaterThan(2.2)
  })

  it('fits KFUPM into the south stand: five letters of 16 seats with 6-seat gaps, rows 4 to 16', () => {
    const l = VENUE.lettering
    expect(l).toEqual({ stand: 'S', text: 'KFUPM', firstRow: 4, lastRow: 16, letterWidth: 16, letterGap: 6 })
    expect(l.text.length * l.letterWidth + (l.text.length - 1) * l.letterGap).toBe(104)
    expect(l.lastRow).toBeLessThanOrEqual(line('S').rows)
  })

  it('stands four 42 m floodlight masts at the corners, aimed at the pitch centre', () => {
    expect(VENUE.floodlights.height).toBe(42)
    expect(VENUE.floodlights.aim).toEqual([0, 0, 0])
    expect(VENUE.floodlights.masts.map((m) => `${m[0]},${m[1]},${m[2]}`).sort()).toEqual(['-75,0,-62', '-75,0,62', '75,0,-62', '75,0,62'])
  })

  it('brings the graduates in through the east tunnel to one march round the carpet (Phase 4, decision H)', () => {
    expect(VENUE.procession).toEqual({ entrance: [97, 0, 0] })
    expect(VENUE.march).toMatchObject({ north: -33.7, south: 33.7, west: -34.7, east: 22, width: 2.6, start: [22, 0, 30], exit: [58, 0, 52] })
    expect(VENUE.arch.x).toBe(0)
  })
})
