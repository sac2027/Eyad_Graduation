import { getOccluders, occluderDistance } from '@/features/stadiview/engine/occluders'
import type { Occluder } from '@/features/stadiview/engine/occluders'
import { CHAIR_BOX } from '@/features/stadiview/engine/seatFrame'
import type { VenueLayout } from '@/features/stadiview/layout/types'

/**
 * Finds the seat under the pointer without testing all the chairs.
 *
 * Every seat has a pick box (CHAIR_BOX) standing on its position and turned to its facing. The seat
 * picked is the one whose box the ray enters first, which is exact: it is the chair the eye sees,
 * even at a shallow angle where the ray passes through one chair on its way to the grass under
 * another. The regular layout is used only to choose which few boxes are worth testing:
 *
 * - Pitch: the ray can only meet a chair between the grass and the top of the chairs. That short
 *   stretch is walked in half-chair steps; each point is turned into a row and a column by
 *   division, and the chairs of that cell and its neighbours are tested.
 * - Stands: a ray crosses the height of one row over a short stretch. If that stretch is over the
 *   row, the seat numbers under it come from division along the row (from the angle, on a curve).
 * - Bays: a dozen boxes, tested directly.
 *
 * Everything is read from the layout handed in, never from the default config, so a venue built
 * from a changed config picks just as exactly.
 *
 * A pick runs on every frame the pointer moves, so the search itself allocates nothing (see `work`
 * below for how). What is left per pick is the one result object of the functions that return
 * `{ index, t }`, and a boxed number or two from the occluder check.
 */

/** A half-line: it starts at (ox, oy, oz) and runs along the unit vector (dx, dy, dz). */
export interface Ray {
  ox: number
  oy: number
  oz: number
  dx: number
  dy: number
  dz: number
}

const HALF_W = CHAIR_BOX.halfW
const HALF_D = CHAIR_BOX.halfD
const HEIGHT = CHAIR_BOX.height

/** Distance between the points sampled along a ray through the pitch chairs: half a chair. */
const STEP = 0.25
/**
 * A limit on the walk, so that a ray with a broken direction cannot keep it going. It allows 150 m,
 * and the stretch walked is already cut to the box of pitch chairs, about 80 m corner to corner.
 */
const MAX_STEPS = 600
/** How far the walk carries on past a hit before stopping, in case a nearer chair is found late. */
const PAST_HIT = 0.5
/** Size of one cell of the tables that turn an x into a row and a z into a column. */
const CELL = 0.125
/**
 * Slack added to the regions a ray is clipped to. Seat positions are stored as 32-bit floats, so a
 * chair can be a few millionths of a metre off the row line it was placed on.
 */
const SLACK = 1e-3
const FULL_TURN = 2 * Math.PI

/** A box square to the axes. */
interface Bounds {
  x0: number
  x1: number
  y0: number
  y1: number
  z0: number
  z1: number
}

/**
 * The pitch chairs seen as a grid of rows (along x) by columns (along z, counted across all the
 * blocks). Its bounds are the box that holds every pitch chair.
 */
interface PitchGrid extends Bounds {
  rows: number
  cols: number
  /** Seats across one block's row, which is the stride of a row in `pitchCell`. */
  perRow: number
  /** For each CELL of x from `rowOrigin`, the nearest row (0-based). */
  rowAt: Uint16Array
  rowOrigin: number
  /** For each CELL of z from `colOrigin`, the nearest column (0-based, across all the blocks). */
  colAt: Uint16Array
  colOrigin: number
  /** Where each column's seats start in the layout's `pitchCell`; add row x perRow. */
  cellBase: Int32Array
}

/** A straight stand row, reduced to what a pick needs. Its bounds are the box that holds every chair of the row. */
interface LineRow extends Bounds {
  /** Index of seat 1. */
  first: number
  count: number
  /** x of seat 1, and seats per metre of x (negative when the numbers run toward -X). */
  seatX: number
  perMetre: number
}

/** One run of seats along a curved row. */
interface ArcSpan {
  /** Index of the span's first seat. */
  first: number
  count: number
  /** The angle at the middle of the span, and half the angle the span covers. */
  mid: number
  half: number
  /** Seats per radian (negative when the numbers run against the angle). */
  perRadian: number
}

/**
 * A curved stand row. Its chairs all lie in the ring between two circles about (cx, cz); its
 * bounds are the square box round that ring.
 */
interface ArcRow extends Bounds {
  cx: number
  cz: number
  /** The squares of the ring's inner and outer radius. */
  inner2: number
  outer2: number
  spans: ArcSpan[]
}

interface PickTables {
  /** cos and sin of each seat's yaw, so testing a chair needs no trigonometry. */
  cos: Float64Array
  sin: Float64Array
  pitch: PitchGrid | null
  lines: LineRow[]
  arcs: ArcRow[]
}

/**
 * For any coordinate between lo and hi, the nearest of `centres`, found with one division and one
 * array read. The table starts one cell before lo and ends one cell after hi, so a point that
 * rounding puts just outside still reads a real entry.
 */
function nearestTable(centres: Float64Array, lo: number, hi: number): Uint16Array {
  const table = new Uint16Array(Math.floor((hi - lo) / CELL) + 3)
  for (let k = 0; k < table.length; k++) {
    const middle = lo + (k - 0.5) * CELL
    let nearest = 0
    let gap = Infinity
    for (let c = 0; c < centres.length; c++) {
      // A row or column with no seat has no position (NaN) and is never the nearest.
      const g = Math.abs(centres[c] - middle)
      if (g < gap) {
        gap = g
        nearest = c
      }
    }
    table[k] = nearest
  }
  return table
}

function buildPitchGrid(v: VenueLayout, cos: Float64Array, sin: Float64Array): PitchGrid | null {
  const start = v.ranges.pitch[0]
  const end = v.ranges.pitch[1]
  const rows = v.pitchRows
  const blocks = v.sections.filter((s) => s.kind === 'pitch').length
  if (end <= start || rows === 0 || blocks === 0) return null
  const perRow = v.pitchCell.length / (blocks * rows)
  const cols = blocks * perRow

  // The row and column positions are read off the seats themselves, so they are right for
  // whatever spacing, aisles and cross aisles the layout was built with.
  const rowX = new Float64Array(rows).fill(NaN)
  const colZ = new Float64Array(cols).fill(NaN)
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  let z0 = Infinity
  let z1 = -Infinity
  for (let i = start; i < end; i++) {
    const x = v.position[i * 3]
    const y = v.position[i * 3 + 1]
    const z = v.position[i * 3 + 2]
    rowX[v.row[i] - 1] = x
    // Pitch blocks are the first sections, so a pitch seat's section is its block, counted from 0.
    colZ[v.section[i] * perRow + v.number[i] - 1] = z
    // How far the turned box reaches along x and along z.
    const reachX = HALF_W * Math.abs(cos[i]) + HALF_D * Math.abs(sin[i])
    const reachZ = HALF_W * Math.abs(sin[i]) + HALF_D * Math.abs(cos[i])
    x0 = Math.min(x0, x - reachX)
    x1 = Math.max(x1, x + reachX)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y + HEIGHT)
    z0 = Math.min(z0, z - reachZ)
    z1 = Math.max(z1, z + reachZ)
  }
  x0 -= SLACK
  x1 += SLACK
  y0 -= SLACK
  y1 += SLACK
  z0 -= SLACK
  z1 += SLACK

  const cellBase = new Int32Array(cols)
  for (let c = 0; c < cols; c++) cellBase[c] = Math.floor(c / perRow) * rows * perRow + (c % perRow)

  return {
    x0, x1, y0, y1, z0, z1, rows, cols, perRow,
    rowAt: nearestTable(rowX, x0, x1),
    rowOrigin: x0 - CELL,
    colAt: nearestTable(colZ, z0, z1),
    colOrigin: z0 - CELL,
    cellBase,
  }
}

function buildTables(v: VenueLayout): PickTables {
  const cos = new Float64Array(v.count)
  const sin = new Float64Array(v.count)
  for (let i = 0; i < v.count; i++) {
    cos[i] = Math.cos(v.yaw[i])
    sin[i] = Math.sin(v.yaw[i])
  }

  const lines: LineRow[] = []
  const arcs: ArcRow[] = []
  for (const row of v.standRows) {
    const y0 = row.y - SLACK
    const y1 = row.y + HEIGHT + SLACK
    if (row.kind === 'line') {
      const c = Math.abs(Math.cos(row.yaw))
      const s = Math.abs(Math.sin(row.yaw))
      const reachX = HALF_W * c + HALF_D * s + SLACK
      const reachZ = HALF_W * s + HALF_D * c + SLACK
      const lastX = row.x0 + (row.count - 1) * row.dx
      lines.push({
        x0: Math.min(row.x0, lastX) - reachX,
        x1: Math.max(row.x0, lastX) + reachX,
        y0,
        y1,
        z0: row.z - reachZ,
        z1: row.z + reachZ,
        first: row.start,
        count: row.count,
        seatX: row.x0,
        perMetre: 1 / row.dx,
      })
    } else {
      // A chair faces the centre, so its box reaches half a depth inward and, at its two rear
      // corners, a little more than half a depth outward.
      const inner = Math.max(0, row.radius - HALF_D - SLACK)
      const outer = Math.hypot(row.radius + HALF_D, HALF_W) + SLACK
      let first = row.start
      const spans = row.spans.map((span): ArcSpan => {
        const half = (span.count * span.step) / 2
        const entry = { first, count: span.count, mid: span.from + half, half, perRadian: 1 / span.step }
        first += span.count
        return entry
      })
      arcs.push({
        x0: row.cx - outer,
        x1: row.cx + outer,
        y0,
        y1,
        z0: row.cz - outer,
        z1: row.cz + outer,
        cx: row.cx,
        cz: row.cz,
        inner2: inner * inner,
        outer2: outer * outer,
        spans,
      })
    }
  }

  return { cos, sin, pitch: buildPitchGrid(v, cos, sin), lines, arcs }
}

// The tables depend only on the layout, which never changes, so they are built on the first pick
// of each layout and dropped with it.
const tablesByLayout = new WeakMap<VenueLayout, PickTables>()

function tablesFor(v: VenueLayout): PickTables {
  let tables = tablesByLayout.get(v)
  if (!tables) {
    tables = buildTables(v)
    tablesByLayout.set(v, tables)
  }
  return tables
}

/**
 * Working numbers of the pick in progress: the stretch of the ray being considered, from ENTER to
 * LEAVE as distances along it, and the distance to the nearest chair found so far, BEST.
 *
 * They are kept in a typed array, and the functions below pass each other only objects and whole
 * numbers, because of how JavaScript engines store fractions. A fraction held in a variable
 * outside a function, or handed to or returned from a function the engine has not inlined, is put
 * in a newly allocated box. Measured, that was several kilobytes of garbage per pick; even a tiny
 * helper is left un-inlined where it is rarely reached. In a typed array a fraction is stored in
 * place, so a pick leaves nothing behind.
 *
 * A pick never waits for anything, so two can never be in progress at once.
 */
const work = new Float64Array(3)
const ENTER = 0
const LEAVE = 1
const BEST = 2
/** The nearest chair found so far, -1 for none. */
let hitIndex = -1

/**
 * Sets the stretch to the part of the ray that is inside the box and no further than the best hit
 * so far. False when there is none.
 */
function clipToBounds(ray: Ray, b: Bounds): boolean {
  // The ray is inside the box while it is between all three pairs of faces at once: from its
  // latest entry to its earliest exit. Height first: a row of chairs is a thin layer, so most
  // rays are turned away at once.
  let enter = 0
  let leave = work[BEST]
  if (ray.dy !== 0) {
    const a = (b.y0 - ray.oy) / ray.dy
    const c = (b.y1 - ray.oy) / ray.dy
    if (a < c) {
      if (a > enter) enter = a
      if (c < leave) leave = c
    } else {
      if (c > enter) enter = c
      if (a < leave) leave = a
    }
    if (enter > leave) return false
  } else if (ray.oy < b.y0 || ray.oy > b.y1) {
    // Level with this pair of faces and not between them: it never will be.
    return false
  }
  if (ray.dz !== 0) {
    const a = (b.z0 - ray.oz) / ray.dz
    const c = (b.z1 - ray.oz) / ray.dz
    if (a < c) {
      if (a > enter) enter = a
      if (c < leave) leave = c
    } else {
      if (c > enter) enter = c
      if (a < leave) leave = a
    }
    if (enter > leave) return false
  } else if (ray.oz < b.z0 || ray.oz > b.z1) {
    return false
  }
  if (ray.dx !== 0) {
    const a = (b.x0 - ray.ox) / ray.dx
    const c = (b.x1 - ray.ox) / ray.dx
    if (a < c) {
      if (a > enter) enter = a
      if (c < leave) leave = c
    } else {
      if (c > enter) enter = c
      if (a < leave) leave = a
    }
    if (enter > leave) return false
  } else if (ray.ox < b.x0 || ray.ox > b.x1) {
    return false
  }
  work[ENTER] = enter
  work[LEAVE] = leave
  return true
}

/**
 * Whether the ray enters seat i's pick box. When it does, work[ENTER] is the distance to where it
 * enters, or 0 when the ray starts inside the box.
 */
function entersChair(ray: Ray, v: VenueLayout, tables: PickTables, i: number): boolean {
  const cos = tables.cos[i]
  const sin = tables.sin[i]
  const rx = ray.ox - v.position[i * 3]
  const ry = ray.oy - v.position[i * 3 + 1]
  const rz = ray.oz - v.position[i * 3 + 2]
  let enter = 0
  let leave = Infinity

  // Seen from the seat its box is square to the axes, so the same three steps apply. First side
  // to side: the seat's sideways direction is (cos, 0, -sin).
  let o = rx * cos - rz * sin
  let d = ray.dx * cos - ray.dz * sin
  if (d !== 0) {
    const a = (-HALF_W - o) / d
    const c = (HALF_W - o) / d
    if (a < c) {
      if (a > enter) enter = a
      if (c < leave) leave = c
    } else {
      if (c > enter) enter = c
      if (a < leave) leave = a
    }
    if (enter > leave) return false
  } else if (o < -HALF_W || o > HALF_W) {
    return false
  }
  // Floor to top.
  if (ray.dy !== 0) {
    const a = -ry / ray.dy
    const c = (HEIGHT - ry) / ray.dy
    if (a < c) {
      if (a > enter) enter = a
      if (c < leave) leave = c
    } else {
      if (c > enter) enter = c
      if (a < leave) leave = a
    }
    if (enter > leave) return false
  } else if (ry < 0 || ry > HEIGHT) {
    return false
  }
  // Front to back: the seat faces along (-sin, 0, -cos).
  o = -rx * sin - rz * cos
  d = -ray.dx * sin - ray.dz * cos
  if (d !== 0) {
    const a = (-HALF_D - o) / d
    const c = (HALF_D - o) / d
    if (a < c) {
      if (a > enter) enter = a
      if (c < leave) leave = c
    } else {
      if (c > enter) enter = c
      if (a < leave) leave = a
    }
    if (enter > leave) return false
  } else if (o < -HALF_D || o > HALF_D) {
    return false
  }
  work[ENTER] = enter
  return true
}

/** Tests one chair and keeps it if it is nearer than the best so far. */
function consider(ray: Ray, v: VenueLayout, tables: PickTables, i: number): void {
  if (entersChair(ray, v, tables, i) && work[ENTER] < work[BEST]) {
    work[BEST] = work[ENTER]
    hitIndex = i
  }
}

function scanPitch(ray: Ray, v: VenueLayout, tables: PickTables): void {
  const g = tables.pitch
  if (!g || !clipToBounds(ray, g)) return
  const start = work[ENTER]
  const end = Math.min(work[LEAVE], start + MAX_STEPS * STEP)
  const steps = Math.ceil((end - start) / STEP)

  // Why this finds every chair the ray enters: the ray enters a box at some point, and a sampled
  // point lies within half a step of it. That sample is at most three eighths of a metre from the
  // chair's centre line each way, so the chair is in the sample's cell or one next to it, as long
  // as rows and columns are no closer together than chairs can be.
  const cellsPerMetre = 1 / CELL
  let lastRow = -9
  let lastCol = -9
  for (let k = 0; k <= steps; k++) {
    // The last sample is the far end itself, so the end of the stretch is covered as well as the rest.
    const t = k < steps ? start + k * STEP : end
    // A chair entered before the best hit would have been met by a sample no later than this.
    if (t > work[BEST] + PAST_HIT) break
    const row = g.rowAt[Math.floor((ray.ox + ray.dx * t - g.rowOrigin) * cellsPerMetre)]
    const col = g.colAt[Math.floor((ray.oz + ray.dz * t - g.colOrigin) * cellsPerMetre)]
    if (row === lastRow && col === lastCol) continue
    const rowFrom = row > 0 ? row - 1 : 0
    const rowTo = row < g.rows - 1 ? row + 1 : row
    const colFrom = col > 0 ? col - 1 : 0
    const colTo = col < g.cols - 1 ? col + 1 : col
    for (let r = rowFrom; r <= rowTo; r++) {
      const rowSeenBefore = r >= lastRow - 1 && r <= lastRow + 1
      for (let c = colFrom; c <= colTo; c++) {
        // The previous sample already tested its own cell and neighbours.
        if (rowSeenBefore && c >= lastCol - 1 && c <= lastCol + 1) continue
        const i = v.pitchCell[g.cellBase[c] + r * g.perRow]
        if (i >= 0) consider(ray, v, tables, i)
      }
    }
    lastRow = row
    lastCol = col
  }
}

/** Tests the seats of a curved row that lie under the current stretch of the ray. */
function scanArc(ray: Ray, v: VenueLayout, tables: PickTables, row: ArcRow): void {
  const ta = work[ENTER]
  const tb = work[LEAVE]
  const angleA = Math.atan2(ray.oz + ray.dz * ta - row.cz, ray.ox + ray.dx * ta - row.cx)
  const angleB = tb === ta ? angleA : Math.atan2(ray.oz + ray.dz * tb - row.cz, ray.ox + ray.dx * tb - row.cx)
  for (let k = 0; k < row.spans.length; k++) {
    const span = row.spans[k]
    // Measure both angles from the middle of the span, within half a turn either way.
    let a = angleA - span.mid
    a -= FULL_TURN * Math.round(a / FULL_TURN)
    let b = angleB - span.mid
    b -= FULL_TURN * Math.round(b / FULL_TURN)
    if (a > b) {
      const swap = a
      a = b
      b = swap
    }
    // A straight line turns less than half a turn about the centre. If the two angles are further
    // apart than that, the line went round the far side, opposite the middle of the span, and
    // what it passed over is the two outer parts rather than the part between.
    const parts = b - a <= Math.PI ? 1 : 2
    for (let part = 0; part < parts; part++) {
      const from = parts === 1 ? a : part === 0 ? -Math.PI : b
      const to = parts === 1 ? b : part === 0 ? a : Math.PI
      // The seat numbers under the two ends, by division along the curve, and one more at each end.
      const ka = (from + span.half) * span.perRadian
      const kb = (to + span.half) * span.perRadian
      let lo = Math.floor(ka < kb ? ka : kb) - 1
      let hi = Math.floor(ka < kb ? kb : ka) + 1
      if (lo < 0) lo = 0
      if (hi > span.count - 1) hi = span.count - 1
      for (let n = lo; n <= hi; n++) consider(ray, v, tables, span.first + n)
    }
  }
}

function scanStands(ray: Ray, v: VenueLayout, tables: PickTables): void {
  for (let k = 0; k < tables.lines.length; k++) {
    const row = tables.lines[k]
    if (!clipToBounds(ray, row)) continue
    // The seat numbers under the two ends of the stretch, by division along the row, and one more at each end.
    const a = (ray.ox + ray.dx * work[ENTER] - row.seatX) * row.perMetre
    const b = (ray.ox + ray.dx * work[LEAVE] - row.seatX) * row.perMetre
    let lo = Math.round(a < b ? a : b) - 1
    let hi = Math.round(a < b ? b : a) + 1
    if (lo < 0) lo = 0
    if (hi > row.count - 1) hi = row.count - 1
    for (let n = lo; n <= hi; n++) consider(ray, v, tables, row.first + n)
  }

  // Seen from above, a curved row is a ring and the ray a straight line.
  const level = ray.dx * ray.dx + ray.dz * ray.dz
  for (let k = 0; k < tables.arcs.length; k++) {
    const row = tables.arcs[k]
    if (!clipToBounds(ray, row)) continue
    const from = work[ENTER]
    const to = work[LEAVE]
    const px = ray.ox - row.cx
    const pz = ray.oz - row.cz
    const centreDistance2 = px * px + pz * pz
    if (level === 0) {
      // Straight up or down: the ray stays over one point, which is either in the ring or not.
      if (centreDistance2 >= row.inner2 && centreDistance2 <= row.outer2) {
        work[LEAVE] = from
        scanArc(ray, v, tables, row)
      }
      continue
    }
    // Where the line crosses the outer circle.
    const half = px * ray.dx + pz * ray.dz
    const outerDisc = half * half - level * (centreDistance2 - row.outer2)
    if (outerDisc < 0) continue
    const outerRoot = Math.sqrt(outerDisc)
    const inAt = Math.max(from, (-half - outerRoot) / level)
    const outAt = Math.min(to, (-half + outerRoot) / level)
    if (inAt > outAt) continue
    const innerDisc = half * half - level * (centreDistance2 - row.inner2)
    if (innerDisc <= 0) {
      work[ENTER] = inAt
      work[LEAVE] = outAt
      scanArc(ray, v, tables, row)
      continue
    }
    // The line also cuts across the open middle of the ring, so it is over the row twice: on its
    // way in and on its way out.
    const innerRoot = Math.sqrt(innerDisc)
    const leavesRing = (-half - innerRoot) / level
    const backInRing = (-half + innerRoot) / level
    if (inAt <= leavesRing) {
      work[ENTER] = inAt
      work[LEAVE] = Math.min(outAt, leavesRing)
      scanArc(ray, v, tables, row)
    }
    if (backInRing <= outAt) {
      work[ENTER] = Math.max(inAt, backInRing)
      work[LEAVE] = outAt
      scanArc(ray, v, tables, row)
    }
  }
}

function scanBays(ray: Ray, v: VenueLayout, tables: PickTables): void {
  const end = v.ranges.bays[1]
  for (let i = v.ranges.bays[0]; i < end; i++) consider(ray, v, tables, i)
}

function startScan(): void {
  hitIndex = -1
  work[BEST] = Infinity
}

/** The whole pick: the nearest chair of all, unless an occluder is nearer still. */
function scanAll(ray: Ray, v: VenueLayout, occ: Occluder[]): void {
  const tables = tablesFor(v)
  startScan()
  scanPitch(ray, v, tables)
  scanStands(ray, v, tables)
  scanBays(ray, v, tables)
  if (hitIndex >= 0 && occluderDistance(ray, occ) < work[BEST]) startScan()
}

/** The first pitch chair the ray enters, ignoring bays, stands and occluders. */
export function pickPitch(ray: Ray, v: VenueLayout): { index: number; t: number } {
  startScan()
  scanPitch(ray, v, tablesFor(v))
  return { index: hitIndex, t: work[BEST] }
}

/** The first stand seat the ray enters, ignoring the pitch, the bays and occluders. */
export function pickStands(ray: Ray, v: VenueLayout): { index: number; t: number } {
  startScan()
  scanStands(ray, v, tablesFor(v))
  return { index: hitIndex, t: work[BEST] }
}

/** The first accessible bay the ray enters, ignoring every other seat and occluders. */
export function pickBays(ray: Ray, v: VenueLayout): { index: number; t: number } {
  startScan()
  scanBays(ray, v, tablesFor(v))
  return { index: hitIndex, t: work[BEST] }
}

/**
 * The first chair box the ray enters and the distance to it, or `{ index: -1, t: Infinity }` when it
 * enters none or something solid is in the way. `occ` defaults to the default venue's occluders;
 * pass `[]` to ignore occluders, or another venue's own list.
 */
export function pickHit(ray: Ray, v: VenueLayout, occ: Occluder[] = getOccluders()): { index: number; t: number } {
  scanAll(ray, v, occ)
  return { index: hitIndex, t: work[BEST] }
}

/** The index of the seat under the ray, or -1. The same as `pickHit(...).index`, without making a result object. */
export function pickSeat(ray: Ray, v: VenueLayout, occ: Occluder[] = getOccluders()): number {
  scanAll(ray, v, occ)
  return hitIndex
}
