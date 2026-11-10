import { VENUE } from '@/features/stadiview/config/venue'
import type { GateId, StandConfig, StandId, VenueConfig } from '@/features/stadiview/config/venue'
import type { StandRow } from '@/features/stadiview/layout/types'

/**
 * The grandstand seats, stand by stand in the config's order, each stand row by row from the front
 * and each row from seat 1. One entry per seat in each array.
 *
 * Everything here counts from this result's own first seat. The venue layout puts the stands after
 * the pitch seats and the bays, and shifts `rows[].start` and `rows[].section` to match.
 */
export interface StandSeats {
  count: number
  /** count x 3: the centre of each seat's footprint, on the floor of its row. */
  position: Float32Array
  /** Facing direction in radians about +Y; 0 faces north (-Z). */
  yaw: Float32Array
  /** Index into `stands` (the same as the index into the config's stands). */
  stand: Uint8Array
  /** 1-based row within the stand; row 1 is nearest the pitch. */
  row: Uint16Array
  /** 1-based seat within the row; seat 1 is at the left end as seen from the pitch. */
  number: Uint16Array
  /** One entry per stand: its seats are `start` to `start + count - 1`. */
  stands: { id: StandId; rows: number; start: number; count: number; gate: GateId }[]
  /** One entry per row of every stand, in seat order. `section` is the index into `stands`. */
  rows: StandRow[]
}

const radians = (degrees: number) => (degrees * Math.PI) / 180

const seatsInStand = (s: StandConfig) =>
  s.kind === 'line' ? s.rows * s.seatsPerRow : s.rows * s.spans.reduce((sum, span) => sum + span.seats, 0)

/** Places every grandstand seat and describes each row compactly for picking and for drawing the tiers. */
export function buildStands(cfg: VenueConfig = VENUE): StandSeats {
  const count = cfg.stands.reduce((sum, s) => sum + seatsInStand(s), 0)

  const position = new Float32Array(count * 3)
  const yaw = new Float32Array(count)
  const stand = new Uint8Array(count)
  const row = new Uint16Array(count)
  const number = new Uint16Array(count)
  const rows: StandRow[] = []

  let index = 0
  const place = (standIndex: number, r: number, n: number, x: number, y: number, z: number, facing: number) => {
    position[index * 3] = x
    position[index * 3 + 1] = y
    position[index * 3 + 2] = z
    yaw[index] = facing
    stand[index] = standIndex
    row[index] = r
    number[index] = n
    index++
  }

  const stands = cfg.stands.map((s, standIndex) => {
    const start = index
    if (s.kind === 'line') {
      // Seat 1 is at the left end for someone on the pitch facing the stand. Facing south that is the
      // east end, so a south stand counts down from xMax; facing north it is the west end (xMin).
      // Rows step back away from the pitch, and the seats face back toward it.
      const south = s.side === 'south'
      const end = south ? s.xMax : s.xMin
      const along = south ? -1 : 1
      const back = south ? 1 : -1
      const facing = south ? 0 : Math.PI
      for (let r = 1; r <= s.rows; r++) {
        const y = s.firstRowY + (r - 1) * s.riser
        const z = s.firstRowZ + back * (r - 1) * s.tread
        rows.push({ kind: 'line', section: standIndex, row: r, y, start: index, count: s.seatsPerRow, z, x0: end + along * 0.5 * s.seatPitch, dx: along * s.seatPitch, yaw: facing })
        for (let n = 1; n <= s.seatsPerRow; n++) place(standIndex, r, n, end + along * (n - 0.5) * s.seatPitch, y, z, facing)
      }
    } else {
      // Angles run from east (+X) toward south (+Z), so seat numbers grow clockwise seen from above:
      // left to right for someone at the centre looking out at the curve.
      const perRow = s.spans.reduce((sum, span) => sum + span.seats, 0)
      for (let r = 1; r <= s.rows; r++) {
        const y = s.firstRowY + (r - 1) * s.riser
        const radius = s.firstRowRadius + (r - 1) * s.tread
        rows.push({
          kind: 'arc', section: standIndex, row: r, y, start: index, count: perRow, cx: s.cx, cz: s.cz, radius,
          spans: s.spans.map((span) => ({ from: radians(span.fromDeg), step: radians((span.toDeg - span.fromDeg) / span.seats), count: span.seats })),
        })
        let n = 1
        for (const span of s.spans) {
          const stepDeg = (span.toDeg - span.fromDeg) / span.seats
          for (let k = 0; k < span.seats; k++, n++) {
            // Each seat sits in the middle of its slice of the span, so a span's two ends stay half a seat clear.
            const phi = radians(span.fromDeg + (k + 0.5) * stepDeg)
            // A yaw of 90 degrees minus the angle turns the seat to face the centre of the curve.
            place(standIndex, r, n, s.cx + radius * Math.cos(phi), y, s.cz + radius * Math.sin(phi), Math.PI / 2 - phi)
          }
        }
      }
    }
    return { id: s.id, rows: s.rows, start, count: index - start, gate: s.gate }
  })

  return { count, position, yaw, stand, row, number, stands, rows }
}

// The letters are drawn on a 16 x 13 grid: the top line is the highest row of the lettering, and the
// left edge is the lowest seat number, which is how someone on the pitch sees the stand. Upright
// strokes are three seats wide and level strokes two rows deep, which come out about the same
// thickness (1.8 m) on the raked stand.
const GLYPH_WIDTH = 16
const GLYPH_HEIGHT = 13
const GLYPHS: Record<string, string[]> = {
  K: [
    '###.........####',
    '###.......####..',
    '###......####...',
    '###....####.....',
    '###..####.......',
    '###.####........',
    '######..........',
    '###.####........',
    '###..####.......',
    '###....####.....',
    '###......####...',
    '###.......####..',
    '###.........####',
  ],
  F: [
    '################',
    '################',
    '###.............',
    '###.............',
    '###.............',
    '############....',
    '############....',
    '###.............',
    '###.............',
    '###.............',
    '###.............',
    '###.............',
    '###.............',
  ],
  U: [
    '###..........###',
    '###..........###',
    '###..........###',
    '###..........###',
    '###..........###',
    '###..........###',
    '###..........###',
    '###..........###',
    '###..........###',
    '###..........###',
    '###..........###',
    '################',
    '.##############.',
  ],
  P: [
    '##############..',
    '################',
    '###..........###',
    '###..........###',
    '###..........###',
    '###..........###',
    '################',
    '##############..',
    '###.............',
    '###.............',
    '###.............',
    '###.............',
    '###.............',
  ],
  M: [
    '####........####',
    '#####......#####',
    '######....######',
    '#######..#######',
    '###.########.###',
    '###..######..###',
    '###...####...###',
    '###....##....###',
    '###..........###',
    '###..........###',
    '###..........###',
    '###..........###',
    '###..........###',
  ],
}

/**
 * Whether a seat of the lettered stand (the south stand) is part of the word spelled across it.
 *
 * The word is centred along the row. Its first letter is at the seat-1 end, which is the left end
 * as seen from the pitch, so it reads left to right from the pitch, the VIP box and the opening
 * camera. The top of each letter is in the highest row, further back and higher up.
 *
 * The drawings above match the baseline lettering (16 seats by 13 rows) seat for seat. Another
 * letter size in the config samples the same drawings at the nearest point. A character with no
 * drawing is left blank.
 */
export function southLetterMask(row: number, seat: number, cfg: VenueConfig = VENUE): boolean {
  const l = cfg.lettering
  if (row < l.firstRow || row > l.lastRow) return false
  const stand = cfg.stands.find((s) => s.id === l.stand)
  // Only a straight stand has rows that line up into a picture.
  if (!stand || stand.kind !== 'line') return false
  if (row > stand.rows || seat < 1 || seat > stand.seatsPerRow) return false

  const period = l.letterWidth + l.letterGap
  const wordWidth = l.text.length * l.letterWidth + (l.text.length - 1) * l.letterGap
  const margin = Math.floor((stand.seatsPerRow - wordWidth) / 2)
  const along = seat - 1 - margin
  if (along < 0 || along >= wordWidth) return false
  const column = along % period
  if (column >= l.letterWidth) return false

  const glyph = GLYPHS[l.text[Math.floor(along / period)]]
  if (!glyph) return false
  const fromTop = l.lastRow - row
  const height = l.lastRow - l.firstRow + 1
  const gx = Math.floor(((column + 0.5) * GLYPH_WIDTH) / l.letterWidth)
  const gy = Math.floor(((fromTop + 0.5) * GLYPH_HEIGHT) / height)
  return glyph[gy]?.[gx] === '#'
}
