import { VENUE } from '@/features/stadiview/config/venue'
import type { Gender, VenueConfig } from '@/features/stadiview/config/venue'
import type { ZoneInfo } from '@/features/stadiview/layout/types'

/** The graduate seats on the pitch, in line-up order, plus the accessible bays. One entry per seat in each array. */
export interface PitchSeats {
  count: number
  /** The largest row number in any block. */
  rows: number
  /** count x 3: the centre of each seat's footprint, on the grass. */
  position: Float32Array
  /** 1-based block number, north to south. */
  block: Uint8Array
  /** 1-based row within the block; row 1 is nearest the stage. */
  row: Uint16Array
  /** 1-based seat within the block's row; seat 1 is the north-most. */
  number: Uint16Array
  /** Index into `zones`. */
  zone: Uint8Array
  /** 1-based position in the zone's procession order. */
  lineup: Uint16Array
  zones: ZoneInfo[]
  /** Two bays per block in block order, the north one first. */
  bays: { position: Float32Array; block: Uint8Array }
}

/** x of a pitch row. Rows count up from the stage toward the east, with a cross aisle after every bank of rows. */
export function rowX(row: number, cfg: VenueConfig = VENUE): number {
  const b = cfg.blocks
  const crossAislesPassed = Math.floor((row - 1) / b.crossAisleEvery)
  return b.row1X + (row - 1) * b.rowPitch + crossAislesPassed * b.crossAisle
}

/** z of the centre of a seat in a block. Blocks and seats both count from the north; the set of blocks is centred on the pitch. */
export function blockZ(block: number, seat: number, cfg: VenueConfig = VENUE): number {
  const b = cfg.blocks
  const blocks = b.genders.length
  const blockWidth = b.seatsPerRow * b.seatPitch
  const northEdge = -(blocks * blockWidth + (blocks - 1) * b.aisle) / 2
  return northEdge + (block - 1) * (blockWidth + b.aisle) + (seat - 0.5) * b.seatPitch
}

/**
 * Seats every graduate on the pitch.
 *
 * The line-up is continuous: a row runs across all the blocks of one gender, north to south, and the
 * rows fill front to back. Each zone takes the next free seats of its gender in the order the config
 * lists the zones. That keeps every block a solid rectangle with only the last row part-filled, and
 * makes a seat's place in its zone the graduate's place in the procession.
 */
export function buildPitch(cfg: VenueConfig = VENUE): PitchSeats {
  const { genders, seatsPerRow } = cfg.blocks
  const count = cfg.zones.reduce((sum, z) => sum + z.count, 0)

  const position = new Float32Array(count * 3)
  const block = new Uint8Array(count)
  const row = new Uint16Array(count)
  const number = new Uint16Array(count)
  const zone = new Uint8Array(count)
  const lineup = new Uint16Array(count)

  const blocksOf: Record<Gender, number[]> = { f: [], m: [] }
  genders.forEach((g, i) => blocksOf[g].push(i + 1))

  // How far each gender's line-up has got. Kept per gender so a zone carries on from where the
  // previous zone of the same gender stopped, wherever the other gender's zones fall in the list.
  const seated: Record<Gender, number> = { f: 0, m: 0 }

  let rows = 0
  let index = 0
  const zones = cfg.zones.map((z, zoneIndex): ZoneInfo => {
    const own = blocksOf[z.gender]
    if (z.count > 0 && own.length === 0) throw new Error(`Zone ${z.id} has no block to sit in: no block is assigned to its gender.`)
    const acrossRow = own.length * seatsPerRow
    const start = index
    for (let k = 0; k < z.count; k++, index++) {
      const place = seated[z.gender]++
      const r = Math.floor(place / acrossRow) + 1
      const inRow = place % acrossRow
      const b = own[Math.floor(inRow / seatsPerRow)]
      const s = (inRow % seatsPerRow) + 1
      position[index * 3] = rowX(r, cfg)
      // y stays 0: the chairs stand on the grass.
      position[index * 3 + 2] = blockZ(b, s, cfg)
      block[index] = b
      row[index] = r
      number[index] = s
      zone[index] = zoneIndex
      lineup[index] = k + 1
      if (r > rows) rows = r
    }
    return { id: z.id, gender: z.gender, college: z.college, degree: z.degree, start, count: z.count, gate: cfg.blocks.gate[z.gender] }
  })

  // The bays sit in front of row 1 so a wheelchair user has the clear run to the stage, in line with
  // the block's two outer seats so each bay is next to an aisle.
  const bayX = rowX(1, cfg) - cfg.bays.setback
  const bayPosition = new Float32Array(genders.length * 2 * 3)
  const bayBlock = new Uint8Array(genders.length * 2)
  for (let b = 1; b <= genders.length; b++) {
    for (const [side, seat] of [[0, 1], [1, seatsPerRow]] as const) {
      const j = (b - 1) * 2 + side
      bayPosition[j * 3] = bayX
      bayPosition[j * 3 + 2] = blockZ(b, seat, cfg)
      bayBlock[j] = b
    }
  }

  return { count, rows, position, block, row, number, zone, lineup, zones, bays: { position: bayPosition, block: bayBlock } }
}
