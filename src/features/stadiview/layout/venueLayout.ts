import { VENUE } from '@/features/stadiview/config/venue'
import type { VenueConfig } from '@/features/stadiview/config/venue'
import { buildPitch } from '@/features/stadiview/layout/pitchLayout'
import { buildStands } from '@/features/stadiview/layout/standsLayout'
import { NO_ZONE, SeatKind } from '@/features/stadiview/layout/types'
import type { SectionId, SectionInfo, StandRow, VenueLayout } from '@/features/stadiview/layout/types'

/** Pitch chairs and bays face the stage at the west end: +90 degrees about +Y turns north (-Z) to west (-X). */
const FACING_WEST = Math.PI / 2

const pad = (value: number, digits: number) => String(value).padStart(digits, '0')

function assemble(cfg: VenueConfig): VenueLayout {
  // A seat stores its zone in one byte and 255 means "no zone", so more zones than that would be
  // silently mixed up. Fail loudly instead.
  if (cfg.zones.length > NO_ZONE) throw new Error(`Too many zones: ${cfg.zones.length}. A seat can name at most ${NO_ZONE} zones.`)

  const pitch = buildPitch(cfg)
  const stands = buildStands(cfg)
  const blocks = cfg.blocks.genders.length
  const perBlockRow = cfg.blocks.seatsPerRow
  const bayCount = pitch.bays.block.length

  // Seat order: the pitch in line-up order, then the bays, then the stands.
  const baysStart = pitch.count
  const standsStart = baysStart + bayCount
  const count = standsStart + stands.count

  const position = new Float32Array(count * 3)
  const yaw = new Float32Array(count)
  const kind = new Uint8Array(count)
  const section = new Uint8Array(count)
  const zone = new Uint8Array(count).fill(NO_ZONE)
  const row = new Uint16Array(count)
  const number = new Uint16Array(count)
  const lineup = new Uint16Array(count)

  // Pitch blocks come first in the section list, so a block's section index is its number minus one.
  const sections: SectionInfo[] = cfg.blocks.genders.map((gender, b) => ({
    id: `P${b + 1}` as SectionId,
    kind: 'pitch',
    rows: 0,
    start: -1,
    count: 0,
    gate: cfg.blocks.gate[gender],
  }))

  const pitchRows = pitch.rows
  const pitchCell = new Int32Array(blocks * pitchRows * perBlockRow).fill(-1)

  position.set(pitch.position, 0)
  for (let i = 0; i < pitch.count; i++) {
    const b = pitch.block[i]
    yaw[i] = FACING_WEST
    kind[i] = SeatKind.Pitch
    section[i] = b - 1
    zone[i] = pitch.zone[i]
    row[i] = pitch.row[i]
    number[i] = pitch.number[i]
    lineup[i] = pitch.lineup[i]
    pitchCell[((b - 1) * pitchRows + (pitch.row[i] - 1)) * perBlockRow + (pitch.number[i] - 1)] = i

    // The men's blocks share each line-up row, so a block's seats are not one run of indexes.
    // Its section only records where the block first appears and how big it is.
    const s = sections[b - 1]
    if (s.count === 0) s.start = i
    s.count++
    if (pitch.row[i] > s.rows) s.rows = pitch.row[i]
  }

  // Bays belong to their block's section but are not counted in it: the section's count is its
  // zone seats. A bay has no row; its number is its place among the block's bays (1 is the north one).
  position.set(pitch.bays.position, baysStart * 3)
  const baysSeen = new Uint8Array(blocks)
  for (let j = 0; j < bayCount; j++) {
    const i = baysStart + j
    const b = pitch.bays.block[j]
    yaw[i] = FACING_WEST
    kind[i] = SeatKind.AccessBay
    section[i] = b - 1
    number[i] = ++baysSeen[b - 1]
  }

  position.set(stands.position, standsStart * 3)
  yaw.set(stands.yaw, standsStart)
  row.set(stands.row, standsStart)
  number.set(stands.number, standsStart)
  for (let k = 0; k < stands.count; k++) {
    kind[standsStart + k] = SeatKind.Stand
    section[standsStart + k] = blocks + stands.stand[k]
  }
  for (const s of stands.stands) sections.push({ id: s.id, kind: 'stand', rows: s.rows, start: standsStart + s.start, count: s.count, gate: s.gate })

  // The stand rows were counted from the first stand seat and the first stand; move them to their place in the whole venue.
  const standRows: StandRow[] = stands.rows.map((r) => ({ ...r, section: blocks + r.section, start: standsStart + r.start }))

  const idOf = (index: number): string => {
    if (!Number.isInteger(index) || index < 0 || index >= count) return ''
    const prefix = sections[section[index]].id
    if (kind[index] === SeatKind.AccessBay) return `${prefix}-A${number[index]}`
    // Stand rows are longer than 99 seats, so stand seat numbers take three digits and pitch ones two.
    return `${prefix}-${pad(row[index], 2)}-${pad(number[index], kind[index] === SeatKind.Pitch ? 2 : 3)}`
  }

  // Looking an id up in a table of the ids we hand out means only the exact spelling is known,
  // and a seat that does not exist can never be found. The table is only built if someone asks.
  let byId: Map<string, number> | undefined
  const indexOf = (id: string): number => {
    if (!byId) {
      byId = new Map()
      for (let i = 0; i < count; i++) byId.set(idOf(i), i)
    }
    return byId.get(id) ?? -1
  }

  return {
    count,
    position,
    yaw,
    kind,
    section,
    zone,
    row,
    number,
    lineup,
    sections,
    zones: pitch.zones,
    ranges: { pitch: [0, pitch.count], bays: [baysStart, standsStart], stands: [standsStart, count] },
    pitchCell,
    pitchRows,
    standRows,
    idOf,
    indexOf,
  }
}

let defaultLayout: VenueLayout | undefined

/**
 * Builds the whole venue from the config: every seat's place, facing, section, zone and id.
 *
 * The layout for the default config is built once and shared, because the scene, the picking and
 * the services all read the same 7,998 seats. Any other config object is built afresh each time.
 */
export function buildVenue(cfg: VenueConfig = VENUE): VenueLayout {
  if (cfg !== VENUE) return assemble(cfg)
  defaultLayout ??= assemble(VENUE)
  return defaultLayout
}

/** The shared layout of the default venue. */
export function getVenue(): VenueLayout {
  return buildVenue()
}
