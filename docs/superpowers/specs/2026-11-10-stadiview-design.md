# KFUPM StadiView: design

Date: 2026-11-10. Status: draft for approval (Phase 1 output). Reviewed once by an independent builder check; its corrections are included.

## Intent and the why

Add a flagship, full-screen 3D "Book & View Your Graduation Seat" experience to the existing KFUPM graduation demo. It will be presented to the Steering Committee and students as the visual showcase of the site. It is inspired by the mechanics of the StadiView concept (`thebuggeddev/football-stadium`): a procedural stadium, every seat an instance, a camera that flies into the seat you pick, and a first-person look-around. It is re-made for the KFUPM stadium on graduation night.

All code is original. The reference is licensed PolyForm Noncommercial; nothing is copied from it.

## Goals

1. A full-viewport 3D stadium at night is the hero of a new `/stadium` route. HUD panels float over it.
2. All 2,986 graduate seats on the pitch and 5,000 grandstand seats are individual, hoverable and clickable instances.
3. Clicking a seat flies the camera into it at eye level for a 360° first-person view; a button returns to the overview.
4. A scrollable, zoomable, filterable 2D seat matrix card (bottom-left) covers every seat and stays in sync with the 3D scene in both directions.
5. Two roles, switchable in the top bar:
   - **Graduate (signed in):** books any free seat in their own college-and-degree zone; one seat per student; changing seat releases the old one; gets a seat card with a QR.
   - **Family / guest (no sign-in, view-only):** looks up a grandstand seat by ticket number or by clicking a section; locates a graduate by ID or name; sees a gold sightline arc and a gate-to-seat walking route.
6. Faceless, stylised avatars in first-person view: graduates on the pitch and families in the stands, in the correct dress.
7. Arabic (default, RTL) and English.

## Non-goals

- No backend. Bookings, tickets, the graduate directory and concurrency are simulated on the simulated clock, and labelled as simulated.
- No imported 3D models; the stadium is procedural.
- No sound.
- No survey-accurate stadium. Dimensions follow standard pitch and track sizes and the brief; gate positions are assumptions held in config until a site plan arrives.

## Anti-goals

- The 3D drops well below a smooth frame rate on the committee's laptop, or is unusable on a current mid-range phone.
- A user cannot complete a booking or a lookup without the canvas (keyboard and screen-reader users, no-WebGL devices).
- Any avatar shows a face or skin, or the female block is presented differently in a way that draws attention.
- The feature's numbers or gates cannot be changed without editing scene code.

## Decisions made by the requester (10 Nov 2026)

| Topic | Decision |
|---|---|
| Priority | 3D-first. The canvas is the hero; the 2D matrix is a floating HUD card |
| Seat choice | Free choice inside the student's college-and-degree zone. A HUD note reads: "Your booked Row & Seat automatically assigns your exact position in your College's Procession Lineup — Confirmed with Student Affairs." |
| Finding a graduate | Direct search by student ID or name, plus a "Family Share Code" badge and an "Allow Family Seat Locator (Privacy Opt-In)" toggle in the student dashboard |
| Colours | The "Prestige Graduation Night" palette for both the 3D scene and the HUD |
| Sightline and route | Both: the gold 3D arc and a toggleable animated gate-to-seat route |
| Picking | Arithmetic grid picking (no per-instance raycast, no GPU readback) |
| Avatars | Faceless and stylised; first-person view enabled for all blocks including Block 1 |
| Source | 100% original code |
| Data | Batch 56 gate allocation and the 2,986 distribution are the baseline, held in config constants |
| Engine | three.js, React Three Fiber, drei, GSAP, Motion (already in the project). `pick-ui-library` skipped |

## Constraints

- **Stack:** Vite 8, React 19, TypeScript 6, Tailwind 4, zustand 5, three 0.187, @react-three/fiber 9, drei 10, GSAP 3, Motion 14, Vitest 5, Playwright 1.64 (headless Chromium, software WebGL), axe.
- **No new runtime dependencies** in Phase 2. Bloom uses three's bundled `EffectComposer` and `UnrealBloomPass`, lazy-loaded on the high tier only.
- **The one-clock rule stays.** Domain time comes from `src/time/clockStore.ts`; render loops use animation-frame timestamps.
- **Scoped theme.** The StadiView palette lives under `[data-theme='stadiview']` on the route's root. The rest of the site keeps brand v1.2.
- **Bundle.** three stays out of the landing chunk. StadiView's own code (excluding three, R3F and drei) is at most 120 KB gzipped.

## Palette and type

| Token | Hex | Use |
|---|---|---|
| `--sv-night` | #061A17 | Sky, page ground, panel base |
| `--sv-deep` | #005A50 | Stand seats, panel fills, matrix ground |
| `--sv-green` | #009C5A | Available seats, active highlights |
| `--sv-gold` | #E7A614 | Selected seat, hover, sightline, honours accents, borders |
| `--sv-sand` | #E8DEC3 | Secondary text, badges, the KFUPM letters in the south stand |
| `--sv-white` | #FFFFFF | Primary text |

- Text on gold or green fills is `--sv-night` (white on #009C5A is 3.6:1, below the 4.5:1 minimum for small text).
- Fonts are unchanged: KFUPM Display and IBM Plex Sans Arabic.
- HUD panels: `--sv-night` at 72% opacity with a backdrop blur, sharp corners with one 5° cut corner (the brand's skew), 1 px borders in gold or green at 35% opacity.
- FAST Matrix bars in two pairings: "Prestige & Honor" (#005A50 + #E7A614) and "Stadium & Journey" (#005A50 + #009C5A). They are used on the stage backdrop (animated shader) and as thin headers on HUD cards.

## Approaches considered

### Rendering all seats
- **A. Two instanced meshes, per-instance colour (chosen).** One mesh for pitch seats and bays (2,998), one for stand seats (5,000). About 8,000 instances of a 24-triangle chair is under 200,000 triangles and two draw calls.
- B. One mesh per section. More draw calls for no gain.
- C. Representative 3D with fewer seats plus the full 2D grid. Not needed at this scale; kept only as the lowest tier.

### Finding the seat under the pointer
- **A. Arithmetic picking with an exact finish (chosen).** The seat grid's arithmetic turns the pointer ray into a handful of candidate seats; the seat picked is the one whose chair box the ray enters first. No per-instance raycast and no GPU readback. A flat-plane pick alone would choose the wrong chair at shallow camera angles.
- B. three's built-in instanced raycast. Tests every instance on every pointer move.
- C. GPU colour-ID readback (what the reference does). A synchronous read stalls the pipeline on phones.

### Pitch zone assignment
- **A. Continuous line-up fill (chosen).** Seats are numbered in procession order, row by row across the blocks, and each college-and-degree zone is a contiguous run of that order. The blocks stay solid rectangles and the line-up position is the seat index, which is what the HUD note promises.
- B. Each zone starts on a fresh row. Leaves ragged rows (one zone would end on a row with a single seat).
- C. One college per block. Six colleges do not fit five male blocks evenly.

The fill order and zone list are data (`VENUE.zones`), so B or C is a config change.

### Camera
- **A. A custom rig (chosen):** spherical orbit for the overview, a GSAP-driven flight along a curve, and a yaw/pitch look-around in first person. One state machine, interruptible at any point.
- B. drei `OrbitControls` plus a separate first-person control. Two controllers fighting over the camera during hand-over.

## 1. Coordinate system

- Units are metres. Right-handed, +Y up.
- Origin at the centre of the pitch, on the grass.
- **+X is east, −X is west, −Z is north, +Z is south.**
- The stage is at the west end and faces east. Graduates face west (−X).
- A seat's `yaw` is the rotation about +Y of its facing direction; yaw 0 faces −Z (north). Pitch seats have yaw +90° (facing −X).

## 2. Stadium geometry

All values live in `src/features/stadiview/config/venue.ts`.

| Element | Geometry |
|---|---|
| Grass pitch | 105 × 68: x from −52.5 to 52.5, z from −34 to 34 |
| Track (8 lanes, 1.22 each) | Inner kerb: straights at z = ±36.5 for \|x\| ≤ 42.195; bends centred at (±42.195, 0), radius 36.5. Outer radius 46.26 |
| Main stage | Deck x −52 to −40 (12 deep), z −20 to 20 (40 wide), height 1.6. Steps on the east face at centre |
| Stage backdrop | Wall at x = −52, z −22 to 22, y 1.6 to 12.6. Animated FAST Matrix shader |
| Podium | (−42, 1.6, 0) |
| LED screens | Two 12 × 6.75 screens centred at (−50, 8, ±29), each turned 20° toward the seats |
| North VIP box | x −15 to 15. 6 rows × 50 seats at 0.6. First row z = −52, floor y = 3.0; tread 1.1, riser 0.45. Canopy slab at y = 9.5 over x ±17, z −50 to −60, on four columns |
| North flanks (2) | West flank x −35 to −17; east flank x 17 to 35. 15 rows × 30 seats at 0.6. First row z = −52, y = 1.2; tread 0.85, riser 0.42 |
| South stand | x −36 to 36. 20 rows × 120 seats at 0.6. First row z = 53, y = 1.2; tread 0.85, riser 0.42. "KFUPM" spelled in sand-coloured seats across rows 4–16 |
| East curve | Centre (42.195, 0). Two halves either side of the procession entrance: −34° to −4° and +4° to +34° (0° is +X). Each half has 12 rows at radius 52 + 0.85k with 50 seats per row; y = 1.2 + 0.42k; seats face the centre |
| Accessibility zone | Flat platform at y = 0.3 in front of the south stand: 4 rows × 50 seats at 0.7; x −35 to 0; rows at z = 47.3, 48.4, 49.5, 50.6 |
| Floodlight masts (4) | At (±75, 0, ±62), 42 high, lamp banks aimed at the pitch centre |
| East procession entrance | An 8° gap in the east curve at track level (about 7 m wide at the front row), centred on (97, 0, 0) |

**Grandstand capacity:** 2,400 (south) + 1,200 (east) + 900 (north flanks) + 300 (VIP) + 200 (accessibility) = **5,000**.

**Gates** (positions are assumptions until a site plan is supplied):

| Gate | Who | Assumed position |
|---|---|---|
| 1, Main | Families and guests | (0, 0, 78), south centre |
| 2, next to the Aramco gate | Individual guests and male graduates | (62, 0, 62), south-east |
| 3, Conference | Guests with disabilities | (−50, 0, 70), south-west |
| 4, post-Ministry of Industry | University staff and faculty | (0, 0, −76), north centre |
| 5, Schools | Female graduates | (62, 0, −62), north-east |

**Procession:** graduates enter the track at the east entrance and split. Females take the north loop, males the south loop, then both file into the blocks from the east. Exits: male at the south-west corner (−60, 0, 50), female at the south-east corner (60, 0, 50).

## 3. Pitch seating

- Six parallel blocks, each a strip running east-west, stacked north to south.
- 14 seats per block row, seat pitch 0.6 (block width 8.4). Five aisles of 2.4 between blocks.
- Block z ranges, north to south:

  | Block | z from | z to | Who |
  |---|---|---|---|
  | 1 | −31.2 | −22.8 | Female graduates |
  | 2 | −20.4 | −12.0 | Male |
  | 3 | −9.6 | −1.2 | Male |
  | 4 | 1.2 | 9.6 | Male |
  | 5 | 12.0 | 20.4 | Male |
  | 6 | 22.8 | 31.2 | Male |

- Row 1 is nearest the stage at x = −30. Row pitch 1.0, with a 2.0 cross aisle after every 15th row (after rows 15 and 30 at the baseline numbers). Row x = −30 + (r − 1) + 2·⌊(r − 1) / 15⌋.
- Seat 1 of a block row is the north-most seat.
- In every stand, seat 1 is at the left end of the row as seen from the pitch looking at that stand. The south stand's "KFUPM" therefore starts at its east end and reads correctly from the pitch, the VIP box and the opening camera.
- **Block 1 (female, 629):** 45 rows; the last row has 13 seats. Back row at x = 18.
- **Blocks 2–6 (male, 2,357):** a male row is 70 seats across the five blocks. 34 rows; the last row has 47 seats (blocks 2–4 full, 5 seats in block 5). Back row at x = 7.
- **Accessible bays:** 12 extra positions, two per block, at x = −31.5 in front of row 1 at the block's two outer seats. They are outside the 2,986 count. A graduate with the accessibility toggle on may book a bay in their gender's blocks in place of a zone seat.

### Zones and line-up order

A zone is one college-and-degree group. Zones fill seats in line-up order with no gaps: row by row, north to south within a row, front to back. Bachelors come before postgraduates. Each zone's first seat is marked by a flag in the adjacent aisle (college flag for bachelors, graduate flag for postgraduates).

**Block 1 (female), in order.** Assumption: bachelors in front, as for the men.

| # | Zone | Seats |
|---|---|---|
| 1–6 | Bachelor: CCM 101, CEP 71, CMM 58, KBS 27, CPEG 25, CDBE 3 | 285 |
| 7–12 | Postgraduate: CCM 102, CMM 70, CDBE 68, KBS 49, CEP 39, CPEG 16 | 344 |

**Blocks 2–6 (male), in order:**

| # | Zone | Seats |
|---|---|---|
| 13, 14 | CEP bachelor 342, CEP postgraduate 272 | 614 |
| 15, 16 | CCM bachelor 430, CCM postgraduate 176 | 606 |
| 17, 18 | KBS bachelor 141, KBS postgraduate 207 | 348 |
| 19, 20 | CDBE bachelor 32, CDBE postgraduate 305 | 337 |
| 21, 22 | CMM bachelor 146, CMM postgraduate 121 | 267 |
| 23, 24 | CPEG bachelor 96, CPEG postgraduate 89 | 185 |

Every zone's seat count equals its head count, so the pitch has exactly 2,986 seats.

## 4. Seat data structure

One pure function builds the whole venue once: `buildVenue(config) → VenueLayout`. The 3D scene, the 2D matrix, the picking code and the services all read it.

```ts
export const SeatKind = { Pitch: 0, AccessBay: 1, Stand: 2 } as const
export const SeatState = { Available: 0, Held: 1, Booked: 2, Blocked: 3 } as const

export interface SectionInfo {
  id: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'VIP' | 'NW' | 'NE' | 'S' | 'E' | 'ACC'
  kind: 'pitch' | 'stand'
  rows: number
  start: number   // first seat index; the male pitch blocks are interleaved in line-up order, so enumerate a block through the `section` array
  count: number
  gate: 1 | 2 | 3 | 4 | 5
}

export interface ZoneInfo {
  id: string            // e.g. 'M-CEP-B', 'F-CCM-G'
  gender: 'm' | 'f'
  college: 'CEP' | 'CCM' | 'KBS' | 'CDBE' | 'CMM' | 'CPEG'
  degree: 'B' | 'G'
  start: number         // first seat index
  count: number
  gate: 2 | 5
}

export interface VenueLayout {
  count: number             // 7,998
  position: Float32Array    // count × 3: the seat's origin on its floor
  yaw: Float32Array         // count: facing direction, radians about +Y
  kind: Uint8Array          // SeatKind
  section: Uint8Array       // index into sections
  zone: Uint8Array          // index into zones; 255 for none
  row: Uint16Array          // 1-based within the section
  number: Uint16Array       // 1-based within the row
  lineup: Uint16Array       // 1-based position in the zone's procession order; 0 off the pitch
  sections: SectionInfo[]
  zones: ZoneInfo[]
  ranges: { pitch: [number, number]; bays: [number, number]; stands: [number, number] }   // [0, 2986], [2986, 2998], [2998, 7998] at the baseline
  /** Pitch grid lookup for picking: block × row × column → seat index, −1 where there is no seat. */
  pitchCell: Int32Array     // 6 × pitchRows × 14
  pitchRows: number         // 45 at the baseline numbers
  /** One entry per stand row (72 at the baseline), for picking and for drawing the tiers. */
  standRows: StandRow[]
  idOf(index: number): string
  indexOf(id: string): number   // −1 when unknown
}
```

- **Index order:** pitch seats 0–2,985 in line-up order (Block 1 first), then the 12 bays, then stands in the order VIP, NW, NE, S, E, ACC.
- **Seat ids:** pitch `P3-12-07` (block, row, seat); bay `P3-A1`; stands `S-07-112`, `E-03-045`, `NW-10-021`, `VIP-02-030`, `ACC-01-018`.
- **Guest tickets:** `TICKET-G{gate}-{number}`, for example `TICKET-G1-204`. A mock table maps tickets to stand seats: G1 to S, E and the flanks; G2 to the flanks; G3 to ACC.
- **State** is not in the layout. `seatState: Uint8Array(count)` and an owner map live in the services, so the layout stays immutable and shareable.

**Rendering.** Two `InstancedMesh` objects share one 24-triangle chair geometry: pitch seats and bays (2,998), and stand seats (5,000). The instance matrix comes from `position` and `yaw`. `instanceColor` carries state: available green, booked dimmed, outside the student's zone darkened, hover and selection gold. Only changed instances are rewritten.

**Picking.**
- Every seat has a pick box: 0.5 wide, 0.95 high and 0.5 deep, centred on the seat and turned to its facing direction.
- **Pitch:** the ray is clipped to the slab between the floor and the top of the chairs. Walking that short segment, each point converts to block, row and column by division (inverting the row and block formulas); the boxes of that cell and its neighbours are tested, and the nearest hit wins. A ray over an aisle, a cross aisle or past a partial last row hits nothing.
- **Stands:** for each of the 72 stand rows, the ray is clipped to that row's slab; the seat numbers it passes come from division along the row (or from the angle, on the east curve), and those boxes are tested.
- **Bays:** tested as 12 boxes.
- **Occluders:** solid structures block picking, so a seat cannot be picked through a wall. They are the stage backdrop, the VIP canopy, and the rear and side walls of the stands (the east curve's rear wall is an arc). The scene draws its walls from the same list, so what blocks the pointer is what blocks the eye.

## 5. Camera

One rig with three modes: `orbit`, `fly`, `pov`.

| Mode | Behaviour |
|---|---|
| Orbit (default) | Camera at (72, 64, −88), north-east of the stadium, looking at (−8, 0, 0), field of view 42° on landscape screens. On portrait screens the field of view widens (up to 72°) and the opening distance grows (up to the 220 limit) so the six blocks and the stage still fit. From here the stage, the six blocks and the south stand's KFUPM letters all read the right way up. Drag orbits, wheel or pinch zooms. Polar angle 18°–80°, radius 60–220. A slow idle rotation runs until the first pointer press, wheel or key; automated browsers skip it unless the URL has `?idle=1` |
| Fly | A curve from the current pose, up and over, arriving from 12 m behind and 7 m above the seat, travelled at an eased, arc-length-even speed; 2.6 s, the project's strong ease-in-out curve; the look target blends from the current view to the seat's default target; field of view eases to 62° |
| POV | Eye at seat origin + (0, 1.15, 0). Drag looks around: yaw 360°, pitch −35° to +50°, with inertia. Wheel or pinch changes field of view 40°–75° |

- **Default look target:** pitch seats look at the podium (−42, 3.2, 0); stand seats look at (−20, 1.5, 0).
- **Interruptible:** picking another seat mid-flight starts a new flight from the current pose. Escape or the bottom-centre "Back to stadium overview" button flies back to the last orbit pose in 1.8 s.
- **Landmark chips in POV** (Stage, LED screens, VIP box, Family stands) turn the camera to that landmark in 0.6 s.
- **Reduced motion:** flights become a 0.4 s cross-fade cut; no idle rotation; no inertia.
- **Keyboard:** arrows look around in POV and orbit in overview; +/− zoom; Escape goes back.

## 6. What the first-person view shows

- **Stage:** deck, steps, podium, the backdrop wall with the animated FAST Matrix (a shader of vertical bars on the 5° skew, "Prestige & Honor" colours), and two LED screens showing a slow loop of the ceremony title.
- **Floodlights:** four masts with lamp banks. On the high tier a bloom pass makes them glow; on other tiers each lamp bank has an additive glow sprite.
- **Sky:** `--sv-night` with a faint horizon glow in deep green, and sparse stars.
- **VIP box:** the elevated box under its canopy with warm light spilling from inside.
- **Stands:** concrete tiers with instanced seats; the south stand's KFUPM letters read from the pitch.
- **Crowd:** avatars at occupied seats near the viewer (section 7). Further away, occupied seats are shown by seat colour only.

## 7. Avatars

Faceless, low-poly, head-and-shoulders-and-torso figures seated in chairs. No facial features, no skin: the head is a plain shape fully covered by headwear seen from behind and the side.

| Group | Where | Dress |
|---|---|---|
| Male graduate | Pitch blocks 2–6 | White thobe, black bisht with gold zari trim at the collar and front edges, KFUPM graduation shawl, white ghutra, black iqal |
| Female graduate | Pitch block 1 | Graduation abaya/gown, shayla, graduation shawl |
| Family man | Stands | White thobe, white ghutra or red-and-white shemagh, black iqal |
| Family woman | Stands | Black abaya, black shayla |

- Each group is one merged geometry with vertex colours (trim, shawl, iqal), drawn as one `InstancedMesh`: four draw calls for the whole crowd.
- Avatars are built only in POV mode, for occupied seats within a radius of the viewer that depends on the tier (150, 400 or 900 figures). The viewer's own seat is empty.
- A subtle idle sway in the vertex shader with a per-instance phase; off under reduced motion.
- A demo switch, "Fill the stadium (ceremony night)", seats an avatar at every seat for the full-house view.

## 8. Sightline arc and walking route

**Sightline arc** (guest mode, after locating a graduate and having a ticket seat):
- From the family seat's eye point A to the graduate's head point G.
- A quadratic curve whose apex is max(8, 0.18 × distance) above the midpoint, drawn as a tube with a shader: a gold (#E7A614) core, a soft additive halo, and dashes flowing from A to G.
- It draws on over 0.9 s. A gold ring pulses on the graduate's seat and a thin 12-metre light beam stands above it, so the seat can be found from the stand.
- Readouts in the HUD:
  - straight-line distance in metres
  - compass bearing from A to G, as degrees and a 16-point name (in Arabic or English)
  - a plain instruction relative to the stage, for example "Look 24° left of the stage, slightly down"
- In POV from the family seat, the camera turns to face the graduate.

**Walking route** (toggle; both roles):
- A path from the assigned gate to the seat over a small waypoint graph: gate, concourse, track entry or stand stair, aisle, row, seat.
- Drawn as a flat ribbon just above the ground with chevrons moving toward the seat, and a marker that travels the route once.
- Readouts: length in metres and a walking time at 1.2 m/s. Routes from Gate 3 use the step-free waypoints.

## 9. HUD (built in Phase 3)

**Page shell.** `/stadium` is an immersive route outside the site's normal header layout. It fills the viewport, locks page scroll (so the wheel zooms the camera), and has its own top bar. It still mounts the demo console, the toasts and the fireworks layer. The site header on other pages links to it.

- **Top bar:** KFUPM logo, the title, role and profile switcher, language switcher.
- **Bottom-left: 2D seat matrix.** A canvas-drawn top view of every seat with pan, zoom, search and filters (college, degree, available only, accessible). Hover and selection are mirrored in the 3D scene, and a marker shows what the 3D camera is looking at. Clicking a seat flies the camera to it.
- **Right: inspector.** Block, college flag, row, seat, a POV preview, three checks (sightline to the stage, entry gate, distance to the procession aisle), and the primary button. In guest mode the button is replaced by a "View-only mode" indicator.
- **Bottom-centre:** "Back to stadium overview" while in POV.
- **Graduate extras:** the procession note from the decisions table; the Family Share Code badge; the "Allow Family Seat Locator" toggle; the accessibility toggle.
- **Guest tools:** ticket lookup with demo presets; graduate search by ID or name; the sightline and route toggles.
- **After booking:** a celebratory dialog with the seat card, QR, gate, the animated route, and a printable/offline pass.
- **Accessible path without the canvas:** a seat finder (block, row, seat selects) and a keyboard-navigable list of free seats in the student's zone, so a booking or lookup never needs the 3D view.

**Locator rules.** A graduate with the locator on can be found by name or ID. With it off, a name or ID search says the graduate has not enabled the locator and asks for their Family Share Code, which always works. Mock graduates start with the locator on so the demo flows. A real system would default it to off; the demo console notes this.

## 10. Device tiers

| Tier | When | What changes |
|---|---|---|
| 0 | No WebGL | The 2D matrix fills the screen; an illustrated view card replaces POV |
| 1 | Low-end flag or failed benchmark | Pixel ratio 1, no bloom, crowd up to 150, still POV preview |
| 2 | Default (phones and laptops) | Pixel ratio up to 1.5, glow sprites, crowd up to 400, still POV preview |
| 3 | Desktop GPU | Pixel ratio up to 2, bloom, crowd up to 900, live POV preview at 15 fps |

3D is the default on every tier above 0. The pixel ratio also adapts down when the measured frame rate stays low.

## 11. Services (mock, built in Phase 3)

- `pitchSeatService`: book, release, one active seat per student, zone rule, accessibility bays, a simulated rival, all on the simulated clock.
- `graduateDirectory`: 2,986 generated graduates (Arabic and English names, IDs, zone), a share code each, a locator flag, and a seat for most.
- `guestTicketService`: ticket to stand seat, gate and arrival notes.
- `locatorService`: search by ID, name or share code, respecting the locator flag.
- The existing demo console's "Reset demo data" resets these too.

## Testing

- **Unit (most of the assertions):**
  - picking compared with a brute-force test of all 7,998 chair boxes for hundreds of random rays
  - layout counts (2,986; 12; 5,000; 7,998) and every zone's count
  - unique ids, and no two seats closer than 0.5 m
  - all pitch seats inside the pitch
  - picking round-trips (seat → ray → same seat) and aisle hits returning nothing
  - camera eye and target maths
  - services and locator rules
  - bearing and distance maths
- **End-to-end:** in development and under automation the scene exposes a debug hook (`window.__stadiview`): it projects a seat (a point on its upper back) or any world point to screen coordinates, reports the mode, hover, selection and camera, and can select a seat directly. Playwright uses it to hover and click real seats under software WebGL. No frame-rate assertions in CI; stadium URLs in tests use `?tier=1`.
- **Accessibility:** axe on the HUD; the canvas-free path is tested by keyboard.
- **Performance:** measured by a script on the production build, as for the landing page, and by hand on a reference phone.

## Left to the builder

- Exact chair, mast and canopy modelling; shader details; easing constants within the `animate` skill's tables.
- The mock name lists and ticket table.
- The waypoint graph's intermediate points.

## Open points for the requester

1. Does the existing "choose seats for your family" flow stay, or do pre-assigned guest tickets replace it?
2. Female Block 1 order: bachelors in front (assumed), or postgraduates in front as listed in the brief?
3. A site plan or satellite reference for gate positions and the accessibility zone.
4. Artwork for the Student Affairs and Graduation Ceremony badges.
5. Which gate VIP guests use (the baseline allocation does not say; the config assumes Gate 4).
