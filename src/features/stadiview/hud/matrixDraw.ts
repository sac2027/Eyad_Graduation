import { VENUE } from '@/features/stadiview/config/venue'
import { toScreen } from '@/features/stadiview/engine/planView'
import type { PlanView } from '@/features/stadiview/engine/planView'
import type { VenueLayout } from '@/features/stadiview/layout/types'
import { SV } from '@/features/stadiview/scene/palette'
import type { CameraOnPlan } from '@/features/stadiview/state/cameraOnPlan'

/**
 * Draws the stadium from above on a 2D canvas: the pitch, the track, the stage, the gates and
 * every seat as a small square in its state colour.
 */

/** One entry per seat: an index into PAINTS, and how strongly to draw it (1, or a dim share). */
export interface SeatStyles {
  paint: Uint8Array
  strength: Float32Array
}

/** The colours a seat square can have, in the order `SeatStyles.paint` refers to them. */
export const PAINTS = ['#009C5A', '#1F3F38', '#E7A614', '#005A50', '#E8DEC3'] as const
export const PAINT = { free: 0, taken: 1, gold: 2, stand: 3, letter: 4 } as const

export interface MatrixScene {
  v: VenueLayout
  styles: SeatStyles
  view: PlanView
  /** The picture's size in CSS pixels, and how many device pixels make one of them. */
  width: number
  height: number
  ratio: number
  hover: number
  inspected: number
  camera: CameraOnPlan
  labels: { stage: string; north: string; gate: (n: number) => string }
}

/** A chair is 0.46 m wide; its square is drawn a little smaller so neighbours never touch. */
const SEAT_SIZE = 0.5

export function drawMatrix(ctx: CanvasRenderingContext2D, s: MatrixScene): void {
  const { v, view, width, height } = s
  ctx.setTransform(s.ratio, 0, 0, s.ratio, 0, 0)
  ctx.fillStyle = SV.night
  ctx.fillRect(0, 0, width, height)
  const at = (x: number, z: number) => toScreen(view, x, z, width, height)
  const k = view.scale

  // The track: a wide stroke along the middle of its lanes.
  const t = VENUE.track
  const mid = t.innerRadius + (t.lanes * t.laneWidth) / 2
  ctx.beginPath()
  const [ex, ez] = at(t.straightHalf, 0)
  const [wx, wz] = at(-t.straightHalf, 0)
  ctx.arc(ex, ez, mid * k, -Math.PI / 2, Math.PI / 2)
  ctx.arc(wx, wz, mid * k, Math.PI / 2, (3 * Math.PI) / 2)
  ctx.closePath()
  ctx.lineWidth = t.lanes * t.laneWidth * k
  ctx.strokeStyle = '#3A3626'
  ctx.stroke()

  // The grass.
  const [gx, gz] = at(-VENUE.pitch.length / 2, -VENUE.pitch.width / 2)
  ctx.fillStyle = '#0A2119'
  ctx.fillRect(gx, gz, VENUE.pitch.length * k, VENUE.pitch.width * k)

  // The stage: the deck, with the backdrop as a gold line along its west side.
  const d = VENUE.stage.deck
  const [sx, sz] = at(d.xMin, d.zMin)
  ctx.fillStyle = '#0C3F38'
  ctx.fillRect(sx, sz, (d.xMax - d.xMin) * k, (d.zMax - d.zMin) * k)
  ctx.fillStyle = SV.gold
  const b = VENUE.stage.backdrop
  const [bx, bz] = at(b.x - 0.6, b.zMin)
  ctx.fillRect(bx, bz, Math.max(1.5, 0.6 * k), (b.zMax - b.zMin) * k)
  if (k >= 2.2) {
    ctx.save()
    ctx.translate(...at((d.xMin + d.xMax) / 2, 0))
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = SV.sand
    ctx.font = `600 ${Math.min(13, Math.max(9, 3 * k))}px "IBM Plex Sans Arabic", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.labels.stage, 0, 0)
    ctx.restore()
  }

  // The seats, one colour at a time and one strength at a time, so the canvas changes state rarely.
  const size = Math.max(1.5, SEAT_SIZE * k)
  const half = size / 2
  const P = v.position
  for (let paint = 0; paint < PAINTS.length; paint++) {
    ctx.fillStyle = PAINTS[paint]
    for (const dim of [true, false]) {
      let alpha = -1
      for (let i = 0; i < v.count; i++) {
        if (s.styles.paint[i] !== paint) continue
        const strength = s.styles.strength[i]
        if (strength < 1 !== dim) continue
        const x = (P[i * 3] - view.cx) * k + width / 2
        const y = (P[i * 3 + 2] - view.cz) * k + height / 2
        if (x < -size || y < -size || x > width + size || y > height + size) continue
        if (strength !== alpha) {
          alpha = strength
          ctx.globalAlpha = strength
        }
        ctx.fillRect(x - half, y - half, size, size)
      }
    }
  }
  ctx.globalAlpha = 1

  // The gates, as numbered gold squares on the perimeter.
  ctx.font = '700 10px "IBM Plex Sans Arabic", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const g of VENUE.gates) {
    const [x, y] = at(g.position[0], g.position[2])
    if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue
    ctx.fillStyle = SV.gold
    ctx.fillRect(x - 7, y - 7, 14, 14)
    ctx.fillStyle = SV.night
    ctx.fillText(s.labels.gate(g.id), x, y + 0.5)
  }

  // The seat under the pointer, and the inspected seat, each in a ring that stays visible at any zoom.
  const ring = (i: number, radius: number, line: number) => {
    if (i < 0) return
    const [x, y] = at(P[i * 3], P[i * 3 + 2])
    ctx.beginPath()
    ctx.arc(x, y, Math.max(radius, size * 0.9), 0, Math.PI * 2)
    ctx.lineWidth = line
    ctx.strokeStyle = SV.gold
    ctx.stroke()
  }
  if (s.inspected >= 0) {
    const [x, y] = at(P[s.inspected * 3], P[s.inspected * 3 + 2])
    ctx.fillStyle = SV.gold
    const big = Math.max(size, 4)
    ctx.fillRect(x - big / 2, y - big / 2, big, big)
    ring(s.inspected, 7, 2)
  }
  if (s.hover !== s.inspected) ring(s.hover, 5, 1.5)

  // Where the 3D camera is: an arrow pointing the way it looks, kept on the edge when it is off the picture.
  const c = s.camera
  let [cx, cy] = at(c.x, c.z)
  const edge = 11
  cx = Math.min(Math.max(cx, edge), width - edge)
  cy = Math.min(Math.max(cy, edge), height - edge)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(c.heading)
  ctx.beginPath()
  ctx.moveTo(0, -8)
  ctx.lineTo(5.5, 6)
  ctx.lineTo(0, 3)
  ctx.lineTo(-5.5, 6)
  ctx.closePath()
  ctx.fillStyle = SV.white
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = SV.night
  ctx.stroke()
  ctx.restore()

  // North, in the top left corner (the opening camera sits to the north-east, where its arrow would cover it). A map keeps north up in every language.
  ctx.fillStyle = SV.sand
  ctx.font = '700 11px "IBM Plex Sans Arabic", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(s.labels.north, 14, 24)
  ctx.beginPath()
  ctx.moveTo(14, 5)
  ctx.lineTo(18, 14)
  ctx.lineTo(10, 14)
  ctx.closePath()
  ctx.fill()
}
