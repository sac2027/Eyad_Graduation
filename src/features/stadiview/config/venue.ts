import type { CollegeId } from '@/domain/types'

/**
 * Every number about the stadium lives in this file, so the venue can be corrected (a head count,
 * a gate, a stand) without touching layout, picking or scene code.
 *
 * Units and axes:
 * - Lengths are metres. Angles are degrees here because they are easier to read and check
 *   against a plan; code converts to radians where it needs to.
 * - The origin is the centre of the pitch, on the grass. +Y is up.
 * - +X is east, -X is west, -Z is north, +Z is south.
 * - The stage is at the west end and faces east, so graduates on the pitch face west (-X).
 *
 * VENUE is plain data on purpose (no functions, not frozen): tests copy it with structuredClone,
 * change one number and rebuild the layout to prove nothing else hard-codes it.
 */

export type Vec3 = [number, number, number]
export type Gender = 'f' | 'm'
/** B is a bachelor, G is a postgraduate ("graduate studies"). */
export type Degree = 'B' | 'G'
export type CollegeCode = 'CEP' | 'CCM' | 'KBS' | 'CDBE' | 'CMM' | 'CPEG'
export type GateId = 1 | 2 | 3 | 4 | 5
export type StandId = 'VIP' | 'NW' | 'NE' | 'S' | 'E' | 'ACC'

/** The registrar's college codes mapped to the ids the rest of the site uses, so names and colours come from one place. */
export const COLLEGE_ID: Record<CollegeCode, CollegeId> = {
  CEP: 'engineering',
  CCM: 'computing',
  KBS: 'business',
  CDBE: 'design',
  CMM: 'chemicals',
  CPEG: 'petroleum',
}

/** One college-and-degree group of graduates. `count` is its head count, which is also its number of seats. */
export interface ZoneConfig {
  /** For example 'M-CEP-B' or 'F-CCM-G'. */
  id: string
  gender: Gender
  college: CollegeCode
  degree: Degree
  count: number
}

/** A stand whose rows are straight lines running east-west. */
export interface LineStandConfig {
  kind: 'line'
  id: StandId
  /** The gate its ticket holders come in by. */
  gate: GateId
  /**
   * Which side of the pitch it is on. A south stand faces north and its rows step back toward +Z;
   * a north stand faces south and steps back toward -Z. Seat 1 is at the left end as seen from the
   * pitch: the east end (xMax) of a south stand, the west end (xMin) of a north stand.
   */
  side: 'north' | 'south'
  /** The ends of every row. xMax - xMin equals seatsPerRow x seatPitch. */
  xMin: number
  xMax: number
  rows: number
  seatsPerRow: number
  /** Centre-to-centre distance between neighbouring seats. */
  seatPitch: number
  /** z of the first row's seat centres. */
  firstRowZ: number
  /** Floor height of the first row. */
  firstRowY: number
  /** Depth of one row's step, front to back. */
  tread: number
  /** Height gained from one row to the next; 0 for a flat platform. */
  riser: number
}

/** A stand whose rows are arcs about one centre, with every seat facing that centre. */
export interface ArcStandConfig {
  kind: 'arc'
  id: StandId
  gate: GateId
  /** Centre of the arcs. */
  cx: number
  cz: number
  rows: number
  /** Radius of the first row's seat centres. Each row behind adds one tread. */
  firstRowRadius: number
  firstRowY: number
  tread: number
  riser: number
  /**
   * The stretches of each row that hold seats, in seat-number order. Angles are degrees about the
   * centre, 0 pointing east (+X) and growing toward the south (+Z). A gap between two spans is an
   * opening in the stand.
   */
  spans: { fromDeg: number; toDeg: number; seats: number }[]
}

export type StandConfig = LineStandConfig | ArcStandConfig

export interface GateConfig {
  id: GateId
  /** A short handle for labels and translations. */
  name: 'main' | 'aramco' | 'conference' | 'ministry' | 'schools'
  /** Where the gate stands on the outer perimeter. */
  position: Vec3
}

export interface VenueConfig {
  /** The grass. `length` runs east-west (x), `width` north-south (z); both are centred on the origin. */
  pitch: { length: number; width: number }

  /**
   * The running track round the pitch. Its inner kerb is two straights at z = ±innerRadius for
   * |x| <= straightHalf, joined by two half circles of that radius centred at (±straightHalf, 0).
   * The outer edge is innerRadius + lanes x laneWidth (46.26 at these numbers).
   */
  track: { lanes: number; laneWidth: number; straightHalf: number; innerRadius: number }

  stage: {
    /** The platform. Its top is `height` above the grass. */
    deck: { xMin: number; xMax: number; zMin: number; zMax: number; height: number }
    /** Steps down from the middle of the deck's east face. `width` is along z; each step is `run` deep; together they climb the deck's height. */
    steps: { width: number; count: number; run: number }
    /**
     * The wall behind the stage that carries the animated bars. Its front face is at `x` and it is
     * `thickness` deep toward the west. The bars cover yBottom to yTop; for picking, the wall is
     * solid from the ground up to yTop.
     */
    backdrop: { x: number; thickness: number; zMin: number; zMax: number; yBottom: number; yTop: number }
    /** The foot of the podium, on the deck near its front (east) edge. */
    podium: Vec3
    /** The two LED screens beside the backdrop. Each is turned `turnDeg` about +Y toward the seats. */
    screens: { width: number; height: number; centres: [Vec3, Vec3]; turnDeg: number }
  }

  /** The six strips of graduate chairs on the pitch. Each runs east-west; they are stacked north to south and centred on z = 0. */
  blocks: {
    /** Who sits in each block, north to south. A row of the line-up runs across all the blocks of one gender. */
    genders: Gender[]
    /** Seats across one block. Seat 1 is the north-most. */
    seatsPerRow: number
    /** Centre-to-centre distance between neighbouring seats (z). */
    seatPitch: number
    /** Clear walkway between two neighbouring blocks. */
    aisle: number
    /** x of row 1, the row nearest the stage. Rows count up toward the east. */
    row1X: number
    /** Centre-to-centre distance between rows (x). */
    rowPitch: number
    /** A cross aisle follows every this-many rows. */
    crossAisleEvery: number
    /** Extra space a cross aisle adds on top of the row pitch. */
    crossAisle: number
    /** The gate each gender's graduates enter by. */
    gate: Record<Gender, 2 | 5>
  }

  /**
   * Wheelchair bays: two per block, in line with the block's first and last seat, `setback`
   * in front of (west of) row 1. They are extra to the zone seats.
   */
  bays: { setback: number }

  /**
   * Zones in procession order. Seats are handed out in this order with no gaps, so reordering this
   * list reorders who sits in front.
   */
  zones: ZoneConfig[]

  /** The grandstands, in the order their seats are numbered in the layout. */
  stands: StandConfig[]

  /** Rear walls of the stands: `thickness` deep, rising `rise` above the last row's floor. Side walls slope up to meet them. */
  walls: { thickness: number; rise: number }

  /**
   * The roof slab over one stand, on `columns` columns of `columnWidth`. The rear wall of the stand
   * named in `over` rises all the way to the slab's underside.
   */
  canopy: { over: StandId; xMin: number; xMax: number; zMin: number; zMax: number; yBottom: number; yTop: number; columns: number; columnWidth: number }

  /**
   * A word spelled in lighter seats in one stand. Letters are `letterWidth` seats wide with
   * `letterGap` seats between them, centred along the row, and firstRow to lastRow tall.
   */
  lettering: { stand: StandId; text: string; firstRow: number; lastRow: number; letterWidth: number; letterGap: number }

  /** Positions are assumptions until a site plan is supplied. */
  gates: GateConfig[]

  /**
   * How the graduates walk in. They come through the gap in the east curve at `entrance`, split
   * onto the two loops of the track, file into the blocks from the east, and leave by `exit`.
   */
  procession: { entrance: Vec3; loop: Record<Gender, 'north' | 'south'>; exit: Record<Gender, Vec3> }

  /** Mast feet, mast height, and the point the lamp banks are aimed at. */
  floodlights: { masts: Vec3[]; height: number; aim: Vec3 }

  camera: {
    /** The opening overview: where the camera sits, what it looks at, and its vertical field of view in degrees on a landscape screen. */
    home: { position: Vec3; target: Vec3; fov: number }
    /** What a pitch seat looks at by default: the speaker at the podium. */
    pitchLook: Vec3
    /** What a stand seat looks at by default: the middle of the graduates. */
    standLook: Vec3
  }
}

const zone = (gender: Gender, college: CollegeCode, degree: Degree, count: number): ZoneConfig => ({
  id: `${gender.toUpperCase()}-${college}-${degree}`,
  gender,
  college,
  degree,
  count,
})

// Batch 56 head counts. The three lists are kept apart so the procession order can be changed where
// they are joined, in `zones` below.

const FEMALE_BACHELOR: ZoneConfig[] = [
  zone('f', 'CCM', 'B', 101),
  zone('f', 'CEP', 'B', 71),
  zone('f', 'CMM', 'B', 58),
  zone('f', 'KBS', 'B', 27),
  zone('f', 'CPEG', 'B', 25),
  zone('f', 'CDBE', 'B', 3),
]

const FEMALE_POSTGRAD: ZoneConfig[] = [
  zone('f', 'CCM', 'G', 102),
  zone('f', 'CMM', 'G', 70),
  zone('f', 'CDBE', 'G', 68),
  zone('f', 'KBS', 'G', 49),
  zone('f', 'CEP', 'G', 39),
  zone('f', 'CPEG', 'G', 16),
]

/** College by college, bachelors in front of postgraduates inside each. */
const MALE: ZoneConfig[] = [
  zone('m', 'CEP', 'B', 342),
  zone('m', 'CEP', 'G', 272),
  zone('m', 'CCM', 'B', 430),
  zone('m', 'CCM', 'G', 176),
  zone('m', 'KBS', 'B', 141),
  zone('m', 'KBS', 'G', 207),
  zone('m', 'CDBE', 'B', 32),
  zone('m', 'CDBE', 'G', 305),
  zone('m', 'CMM', 'B', 146),
  zone('m', 'CMM', 'G', 121),
  zone('m', 'CPEG', 'B', 96),
  zone('m', 'CPEG', 'G', 89),
]

export const VENUE: VenueConfig = {
  pitch: { length: 105, width: 68 },

  // A standard 400 m track: eight 1.22 m lanes.
  track: { lanes: 8, laneWidth: 1.22, straightHalf: 42.195, innerRadius: 36.5 },

  stage: {
    deck: { xMin: -52, xMax: -40, zMin: -20, zMax: 20, height: 1.6 },
    // Eight steps of 0.2 m end at x = -37.6, well short of the bays at -31.5.
    steps: { width: 8, count: 8, run: 0.3 },
    backdrop: { x: -52, thickness: 0.4, zMin: -22, zMax: 22, yBottom: 1.6, yTop: 12.6 },
    podium: [-42, 1.6, 0],
    // 16:9 screens.
    screens: { width: 12, height: 6.75, centres: [[-50, 8, -29], [-50, 8, 29]], turnDeg: 20 },
  },

  blocks: {
    // Block 1 (north-most) is the women's; blocks 2 to 6 are the men's.
    genders: ['f', 'm', 'm', 'm', 'm', 'm'],
    seatsPerRow: 14,
    seatPitch: 0.6,
    aisle: 2.4,
    row1X: -30,
    rowPitch: 1.0,
    crossAisleEvery: 15,
    crossAisle: 2.0,
    // Gate 5 (Schools) for the women, gate 2 (next to the Aramco gate) for the men.
    gate: { f: 5, m: 2 },
  },

  bays: { setback: 1.5 },

  // Student Affairs may ask for the female postgraduates in front: swap the first two lists.
  zones: [...FEMALE_BACHELOR, ...FEMALE_POSTGRAD, ...MALE],

  stands: [
    // The VIP box, raised in the middle of the north side under its canopy. Gate 4 is confirmed for VIP guests.
    { kind: 'line', id: 'VIP', gate: 4, side: 'north', xMin: -15, xMax: 15, rows: 6, seatsPerRow: 50, seatPitch: 0.6, firstRowZ: -52, firstRowY: 3.0, tread: 1.1, riser: 0.45 },
    // The two flanks either side of the VIP box.
    { kind: 'line', id: 'NW', gate: 2, side: 'north', xMin: -35, xMax: -17, rows: 15, seatsPerRow: 30, seatPitch: 0.6, firstRowZ: -52, firstRowY: 1.2, tread: 0.85, riser: 0.42 },
    { kind: 'line', id: 'NE', gate: 2, side: 'north', xMin: 17, xMax: 35, rows: 15, seatsPerRow: 30, seatPitch: 0.6, firstRowZ: -52, firstRowY: 1.2, tread: 0.85, riser: 0.42 },
    // The main family stand.
    { kind: 'line', id: 'S', gate: 1, side: 'south', xMin: -36, xMax: 36, rows: 20, seatsPerRow: 120, seatPitch: 0.6, firstRowZ: 53, firstRowY: 1.2, tread: 0.85, riser: 0.42 },
    // The east curve wraps round the track's east bend. The 8 degree gap between its two halves is
    // the procession entrance: it must stay open so the graduates walk in through a tunnel, not a wall of seats.
    {
      kind: 'arc', id: 'E', gate: 1, cx: 42.195, cz: 0, rows: 12, firstRowRadius: 52, firstRowY: 1.2, tread: 0.85, riser: 0.42,
      spans: [{ fromDeg: -34, toDeg: -4, seats: 50 }, { fromDeg: 4, toDeg: 34, seats: 50 }],
    },
    // The accessibility platform: flat and step-free, in front of the south stand's west half, reached from gate 3.
    { kind: 'line', id: 'ACC', gate: 3, side: 'south', xMin: -35, xMax: 0, rows: 4, seatsPerRow: 50, seatPitch: 0.7, firstRowZ: 47.3, firstRowY: 0.3, tread: 1.1, riser: 0 },
  ],

  walls: { thickness: 0.3, rise: 1.1 },

  canopy: { over: 'VIP', xMin: -17, xMax: 17, zMin: -60, zMax: -50, yBottom: 9.5, yTop: 9.8, columns: 4, columnWidth: 0.4 },

  lettering: { stand: 'S', text: 'KFUPM', firstRow: 4, lastRow: 16, letterWidth: 16, letterGap: 6 },

  gates: [
    { id: 1, name: 'main', position: [0, 0, 78] },          // south centre: families and guests
    { id: 2, name: 'aramco', position: [62, 0, 62] },       // south-east: individual guests and male graduates
    { id: 3, name: 'conference', position: [-50, 0, 70] },  // south-west: guests with disabilities
    { id: 4, name: 'ministry', position: [0, 0, -76] },     // north centre: staff, faculty and VIP guests
    { id: 5, name: 'schools', position: [62, 0, -62] },     // north-east: female graduates
  ],

  procession: {
    entrance: [97, 0, 0],
    loop: { f: 'north', m: 'south' },
    exit: { m: [-60, 0, 50], f: [60, 0, 50] },
  },

  floodlights: {
    masts: [[-75, 0, -62], [75, 0, -62], [-75, 0, 62], [75, 0, 62]],
    height: 42,
    aim: [0, 0, 0],
  },

  camera: {
    // North-east of the stadium, looking south-west. From the north side the south stand's letters
    // read left to right and the right way up; from the south they would be seen from behind.
    home: { position: [72, 64, -88], target: [-8, 0, 0], fov: 42 },
    // Head height of someone standing at the podium.
    pitchLook: [-42, 3.2, 0],
    standLook: [-20, 1.5, 0],
  },
}
