import { VENUE } from '@/features/stadiview/config/venue'
import type { GateId, VenueConfig } from '@/features/stadiview/config/venue'
import { seatEye } from '@/features/stadiview/engine/cameraMath'
import { getOccluders, occluderDistance } from '@/features/stadiview/engine/occluders'
import { SeatKind } from '@/features/stadiview/layout/types'
import type { VenueLayout } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

/** The three things worth knowing about a seat before choosing it. */
export interface SeatFacts {
  /** Metres from the seat to the podium, along the ground. */
  toStage: number
  /** How far off the stage's centre line the seat is, in degrees, as seen from the podium; and to which side for someone facing the stage. */
  stageAngle: number
  side: 'left' | 'right' | 'centre'
  /** The gate its holder comes in by. */
  gate: GateId
  /** Metres from the seat to the nearest walkway: the edge of its block, or the end of its row. */
  toAisle: number
  /** Whether the speaker at the podium can be seen without a wall or the canopy in the way. */
  clearView: boolean
}

/** Within this many degrees the seat counts as in line with the stage. */
const CENTRE = 3

export function seatFacts(seat: number, v: VenueLayout = getVenue(), cfg: VenueConfig = VENUE): SeatFacts {
  const x = v.position[seat * 3]
  const z = v.position[seat * 3 + 2]
  const [px, , pz] = cfg.stage.podium
  const toStage = Math.hypot(x - px, z - pz)
  // The stage faces east. Off its centre line by the angle between that line and the line to the seat.
  const stageAngle = (Math.atan2(Math.abs(z - pz), Math.abs(x - px)) * 180) / Math.PI
  // Facing the stage from the east, north (-Z) is on the right hand.
  const side = stageAngle < CENTRE ? 'centre' : z < pz ? 'right' : 'left'

  const section = v.sections[v.section[seat]]
  let toAisle: number
  if (v.kind[seat] === SeatKind.Stand) {
    // In a stand the way out is at either end of the row.
    const row = v.standRows.find((r) => r.section === v.section[seat] && r.row === v.row[seat])
    const pitch = row && row.kind === 'line' ? Math.abs(row.dx) : row ? row.radius * Math.abs(row.spans[0].step) : 0.6
    toAisle = (Math.min(v.number[seat], (row?.count ?? v.number[seat]) - v.number[seat] + 1) - 0.5) * pitch
  } else if (v.kind[seat] === SeatKind.AccessBay) {
    toAisle = 0
  } else {
    const b = cfg.blocks
    toAisle = (Math.min(v.number[seat], b.seatsPerRow - v.number[seat] + 1) - 0.5) * b.seatPitch
  }

  // The line from the viewer's eyes to the speaker's head.
  const eye = seatEye(seat, v)
  const head = cfg.camera.pitchLook
  const d = [head[0] - eye[0], head[1] - eye[1], head[2] - eye[2]]
  const reach = Math.hypot(d[0], d[1], d[2])
  const ray = { ox: eye[0], oy: eye[1], oz: eye[2], dx: d[0] / reach, dy: d[1] / reach, dz: d[2] / reach }
  const clearView = occluderDistance(ray, getOccluders()) > reach

  return { toStage, stageAngle, side, gate: section.gate, toAisle, clearView }
}
