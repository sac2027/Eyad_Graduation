# StadiView Phase 2 Implementation Plan: scene, seats and camera

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `/stadium` route showing the procedural KFUPM stadium at night with all 7,998 seats as hoverable, clickable instances, and a camera that orbits, flies into a seat and looks around in first person.

**Architecture:**
- A pure layout generator builds the whole venue (typed arrays) from one config file.
- Pure maths modules do the picking and the camera paths.
- A React Three Fiber scene draws the stadium and two instanced seat meshes from the layout.
- A zustand store holds mode, hover and selection.

**Tech Stack:** React 19, TypeScript 6, three 0.187, @react-three/fiber 9, drei 10, GSAP 3, zustand 5, Tailwind 4, Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-11-10-stadiview-design.md`

**Out of scope here** (Phase 3 and 4 get their own plans): the HUD panels, the 2D matrix, booking and guest services, avatars, the sightline arc, the walking route, bloom.

## Global Constraints

- All code is original. Nothing is copied from any third-party stadium or seat-viewer project.
- No new runtime dependencies.
- Units are metres; +X east, −X west, −Z north, +Z south, +Y up; origin at the pitch centre.
- Counts: pitch seats 2,986; accessible bays 12; stand seats 5,000; total 7,998.
- Every number about the venue comes from `src/features/stadiview/config/venue.ts`. No layout, engine or scene file hard-codes a dimension, count or gate.
- `VENUE` is plain, mutable data typed as `VenueConfig` (no functions, no `as const`): tests clone it with `structuredClone` and edit the clone.
- Palette, scoped under `[data-theme='stadiview']`: night #061A17, deep #005A50, green #009C5A, gold #E7A614, sand #E8DEC3, white #FFFFFF.
- Domain time comes from `src/time/clockStore.ts`. Render loops use animation-frame timestamps or the frame delta only.
- three, R3F and drei must not enter the landing chunk; the route is lazy-loaded.
- Reduced motion (`useReducedMotion()`) or the low-end flag: no idle rotation, no inertia, and flights become a 0.4 s cut.
- Arabic is the default language; English is the alternative. New strings go in both `src/i18n/ar.ts` and `src/i18n/en.ts`. Arabic strings contain no Latin letters except the names the parity test allows (KFUPM, QR, VIP).
- Browser tests run under software WebGL, which is slow. Stadium URLs in tests carry `?tier=1` unless the test is about tiers, and each test should finish in about 15 s.

## Review Focus

1. **A pointer over an aisle, the track or the sky.** No seat is highlighted and no tooltip shows. Pinned in Task 3 (picking returns −1) and Task 7 (e2e hover on an aisle).
2. **Picking a second seat while the camera is mid-flight.** The camera retargets from where it is and ends at the second seat, with no jump. Pinned in Task 8.
3. **No WebGL, or the WebGL context is lost.** The page shows a clear fallback message with a way back, not a blank canvas. Pinned in Task 6.
4. **A window resize or phone rotation in first person.** The view keeps its seat and aspect ratio; the camera does not reset to the overview. Pinned in Task 8.
5. **A changed venue config** (for example a zone's head count). The totals, ids and picking still agree, because nothing else hard-codes them. Pinned in Task 2.

## Revisions made before coding (10 Nov 2026)

These refine the approved plan without changing its scope.

1. **Picking is exact.** The grid arithmetic finds the few candidate seats; the seat picked is the one whose chair box the ray enters first. A flat-plane pick alone would highlight the wrong chair at the opening camera's shallow angle. Solid structures (stage backdrop, VIP canopy, stand rear and side walls) block picking, so seats cannot be picked through a wall.
2. **The flight curve uses our own proportions:** approach from 12 m behind and 7 m above the seat, cresting 18 m above the higher end.
3. **Camera tests are deterministic.** The debug hook can select a seat directly and reports where each flight started, so the mid-flight test does not depend on frame rate.
4. **Portrait screens widen the overview's field of view** so a phone still shows the blocks and the stage.
5. **`SectionInfo.start` is not a contiguous range for the male blocks,** because their seats are interleaved in line-up order.

---

### Task 1: Venue config and the pitch layout

**Files:**
- Create: `src/features/stadiview/config/venue.ts`
- Create: `src/features/stadiview/layout/types.ts`
- Create: `src/features/stadiview/layout/pitchLayout.ts`
- Test: `tests/unit/stadiview/pitchLayout.test.ts`

**Interfaces:**
- Produces:
  - `interface VenueConfig` and `VENUE: VenueConfig`: pitch, track, stage, blocks, bays, zones, stands, gates, occluder heights, with the values of the spec's sections 2 and 3.
  - `type CollegeCode = 'CEP' | 'CCM' | 'KBS' | 'CDBE' | 'CMM' | 'CPEG'` and `COLLEGE_ID: Record<CollegeCode, CollegeId>` mapping to the existing ids in `src/domain/types.ts` (CEP engineering, CCM computing, KBS business, CDBE design, CMM chemicals, CPEG petroleum), so names and colours are reused.
  - `VENUE.zones`: the ordered list of 24 `{ id, gender, college, degree, count }`. It is assembled from three named lists so the order can be changed in one line: `zones: [...FEMALE_BACHELOR, ...FEMALE_POSTGRAD, ...MALE]`.
  - Types from the spec's section 4: `SeatKind`, `SeatState`, `SectionInfo`, `ZoneInfo`, `StandRow`, `VenueLayout`.
  - `rowX(row: number, cfg?: VenueConfig): number`: x of a pitch row (row 1 at −30, pitch 1.0, a 2.0 cross aisle after every 15th row).
  - `blockZ(block: number, seat: number, cfg?: VenueConfig): number`: z of the centre of seat 1..14 in block 1..6 (seat 1 north-most; block 1 starts at z = −31.2; seat pitch 0.6; block period 10.8).
  - `buildPitch(cfg?: VenueConfig): PitchSeats` where `PitchSeats = { count: number; rows: number; position: Float32Array; block: Uint8Array; row: Uint16Array; number: Uint16Array; zone: Uint8Array; lineup: Uint16Array; zones: ZoneInfo[]; bays: { position: Float32Array; block: Uint8Array } }`. `rows` is the largest row number in any block (45 at the baseline).

- [ ] **Step 1: Write the failing tests**

```ts
const p = buildPitch()
it('has exactly 2,986 pitch seats and 12 bays', () => {
  expect(p.count).toBe(2986)
  expect(p.rows).toBe(45)
  expect(p.bays.block.length).toBe(12)
  expect(p.bays.position[0]).toBe(-31.5)
})
it('gives every zone exactly its head count, in line-up order', () => {
  expect(p.zones).toHaveLength(24)
  expect(p.zones.map((z) => z.count)).toEqual(VENUE.zones.map((z) => z.count))
  expect(p.zones.filter((z) => z.gender === 'f').reduce((a, z) => a + z.count, 0)).toBe(629)
  expect(p.zones.filter((z) => z.gender === 'm').reduce((a, z) => a + z.count, 0)).toBe(2357)
  p.zones.forEach((z, i) => { for (let k = z.start; k < z.start + z.count; k++) expect(p.zone[k]).toBe(i) })
})
it('puts bachelors in front of postgraduates in block 1 and inside every male college', () => {
  expect(p.zones.slice(0, 6).every((z) => z.gender === 'f' && z.degree === 'B')).toBe(true)
  expect(p.zones.slice(6, 12).every((z) => z.gender === 'f' && z.degree === 'G')).toBe(true)
  expect(p.zones.slice(12).map((z) => `${z.college}-${z.degree}`)).toEqual(['CEP-B', 'CEP-G', 'CCM-B', 'CCM-G', 'KBS-B', 'KBS-G', 'CDBE-B', 'CDBE-G', 'CMM-B', 'CMM-G', 'CPEG-B', 'CPEG-G'])
})
it('puts females in block 1 and males in blocks 2 to 6', () => {
  for (let i = 0; i < p.count; i++) expect(p.block[i] === 1).toBe(p.zones[p.zone[i]].gender === 'f')
})
it('lays block 1 out in 45 rows with 13 seats in the last, and the male rows in 34 with 47 in the last', () => {
  const rows = (pred: (i: number) => boolean) => { const m = new Map<number, number>(); for (let i = 0; i < p.count; i++) if (pred(i)) m.set(p.row[i], (m.get(p.row[i]) ?? 0) + 1); return m }
  const f = rows((i) => p.block[i] === 1); expect(f.size).toBe(45); expect(f.get(45)).toBe(13)
  const m = rows((i) => p.block[i] !== 1); expect(m.size).toBe(34); expect(m.get(34)).toBe(47)
})
it('keeps every seat inside the pitch, row 1 at x = -30', () => {
  for (let i = 0; i < p.count; i++) {
    const x = p.position[i * 3], z = p.position[i * 3 + 2]
    expect(Math.abs(x)).toBeLessThanOrEqual(52.5); expect(Math.abs(z)).toBeLessThanOrEqual(34)
  }
  expect(rowX(1)).toBe(-30); expect(rowX(16)).toBe(-13); expect(rowX(45)).toBe(18)
  expect(blockZ(1, 1)).toBeCloseTo(-30.9, 6); expect(blockZ(6, 14)).toBeCloseTo(30.9, 6)
})
it('numbers the line-up from 1 inside each zone', () => {
  for (const z of p.zones) { expect(p.lineup[z.start]).toBe(1); expect(p.lineup[z.start + z.count - 1]).toBe(z.count) }
})
it('lets the female order be flipped by reordering the zone list', () => {
  const cfg = structuredClone(VENUE)
  cfg.zones = [...cfg.zones.slice(6, 12), ...cfg.zones.slice(0, 6), ...cfg.zones.slice(12)]
  const q = buildPitch(cfg)
  expect(q.count).toBe(2986); expect(q.zones[0].degree).toBe('G'); expect(q.block[0]).toBe(1)
})
```

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/stadiview/pitchLayout.test.ts` should fail on the missing module.

- [ ] **Step 3: Implement the config, the types and `buildPitch`**

- Fill order: Block 1 row by row (seat 1 to 14), then male rows across blocks 2 to 6 (block 2 seat 1 … block 6 seat 14), front to back. Zones consume that order in `VENUE.zones` order.
- A seat's `position` is the centre of its footprint on its floor.
- `blockZ(b, s)` is `z0 + (b − 1) × (blockWidth + aisle) + (s − 0.5) × seatPitch`, where `z0 = −(6 × blockWidth + 5 × aisle) / 2` = −31.2.
- Bays sit at x = −31.5 at each block's seat 1 and seat 14, in block order.
- `SectionInfo.start` for a pitch block is the index of its first seat; the male blocks' seats are interleaved in line-up order, so consumers enumerate a block through the `section` array, not `start` and `count`.

- [ ] **Step 4: Run the tests and confirm they pass.**

- [ ] **Step 5: Commit** (`feat(stadiview): venue config and pitch layout`)

### Task 2: Stands and the assembled venue

**Files:**
- Create: `src/features/stadiview/layout/standsLayout.ts`
- Create: `src/features/stadiview/layout/venueLayout.ts`
- Test: `tests/unit/stadiview/venueLayout.test.ts`

**Interfaces:**
- Consumes: `buildPitch`, `VENUE`, `VenueConfig`, the types.
- Produces:
  - `type StandRow` (in `layout/types.ts`):
    - `{ kind: 'line'; section: number; row: number; y: number; start: number; count: number; z: number; x0: number; dx: number; yaw: number }` — seat n (1-based) is at `x0 + (n − 1) × dx`
    - `{ kind: 'arc'; section: number; row: number; y: number; start: number; count: number; cx: number; cz: number; radius: number; spans: { from: number; step: number; count: number }[] }` — seat k (0-based) of a span is at angle `from + (k + 0.5) × step` (radians, measured from +X toward +Z)
  - `buildStands(cfg?: VenueConfig): StandSeats` with the stand seats' arrays and `rows: StandRow[]` (72 rows at the baseline: 6 + 15 + 15 + 20 + 12 + 4).
  - `buildVenue(cfg?: VenueConfig): VenueLayout` (memoised for the default config) and `getVenue(): VenueLayout`. The layout carries `pitchRows`, `pitchCell` and `standRows`.
  - `southLetterMask(row: number, seat: number): boolean`: true where a south-stand seat is part of the "KFUPM" lettering (rows 4–16).

- [ ] **Step 1: Write the failing tests**

```ts
const v = buildVenue()
const pos = (id: string) => { const i = v.indexOf(id); return [v.position[i * 3], v.position[i * 3 + 1], v.position[i * 3 + 2], v.yaw[i]] }
it('has 7,998 seats in the documented ranges', () => {
  expect(v.count).toBe(7998)
  expect(v.ranges).toEqual({ pitch: [0, 2986], bays: [2986, 2998], stands: [2998, 7998] })
  expect(v.standRows).toHaveLength(72)
})
it('sizes each stand section as specified', () => {
  const n = Object.fromEntries(v.sections.map((s) => [s.id, s.count]))
  expect(n).toMatchObject({ P1: 629, VIP: 300, NW: 450, NE: 450, S: 2400, E: 1200, ACC: 200 })
  expect(v.sections.map((s) => s.id)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'VIP', 'NW', 'NE', 'S', 'E', 'ACC'])
})
it('assigns the gates', () => {
  const g = Object.fromEntries(v.sections.map((s) => [s.id, s.gate]))
  expect(g).toMatchObject({ P1: 5, P2: 2, P6: 2, S: 1, E: 1, NW: 2, NE: 2, ACC: 3, VIP: 4 })
})
it('gives every seat a unique id that round-trips', () => {
  const seen = new Set<string>()
  for (let i = 0; i < v.count; i++) { const id = v.idOf(i); expect(seen.has(id)).toBe(false); seen.add(id); expect(v.indexOf(id)).toBe(i) }
  expect(v.idOf(v.indexOf('P3-12-07'))).toBe('P3-12-07')
  expect(v.idOf(2986)).toBe('P1-A1'); expect(v.idOf(2997)).toBe('P6-A2')
  expect(v.indexOf('P9-01-01')).toBe(-1); expect(v.indexOf('P6-34-01')).toBe(-1); expect(v.indexOf('')).toBe(-1)
})
it('puts seat 1 at the left end of each stand as seen from the pitch', () => {
  expect(pos('S-01-001')[0]).toBeCloseTo(35.7, 4); expect(pos('S-01-001')[2]).toBeCloseTo(53, 4); expect(pos('S-01-001')[1]).toBeCloseTo(1.2, 4)
  expect(pos('S-20-120')[0]).toBeCloseTo(-35.7, 4); expect(pos('S-20-120')[2]).toBeCloseTo(69.15, 4); expect(pos('S-20-120')[1]).toBeCloseTo(9.18, 4)
  expect(pos('NW-01-001')[0]).toBeCloseTo(-34.7, 4); expect(pos('NE-01-001')[0]).toBeCloseTo(17.3, 4)
  expect(pos('VIP-01-001')[0]).toBeCloseTo(-14.7, 4); expect(pos('VIP-01-001')[1]).toBeCloseTo(3.0, 4); expect(pos('VIP-06-050')[2]).toBeCloseTo(-57.5, 4)
  expect(pos('ACC-01-001')[0]).toBeCloseTo(-0.35, 4); expect(pos('ACC-04-050')[2]).toBeCloseTo(50.6, 4); expect(pos('ACC-01-001')[1]).toBeCloseTo(0.3, 4)
  expect(pos('E-01-001')[2]).toBeLessThan(0); expect(pos('E-01-100')[2]).toBeGreaterThan(0)
  expect(pos('E-01-001')[0]).toBeCloseTo(42.195 + 52 * Math.cos((33.7 * Math.PI) / 180), 3)
})
it('faces every stand seat at the pitch and every pitch seat west', () => {
  const facing = (i: number) => [-Math.sin(v.yaw[i]), -Math.cos(v.yaw[i])]   // x, z
  for (let i = 0; i < 2998; i++) { expect(facing(i)[0]).toBeCloseTo(-1, 5); expect(facing(i)[1]).toBeCloseTo(0, 5) }
  expect(facing(v.indexOf('S-05-010'))[1]).toBeCloseTo(-1, 5)     // south stand faces north
  expect(facing(v.indexOf('NW-05-010'))[1]).toBeCloseTo(1, 5)     // north stands face south
  for (const id of ['E-01-001', 'E-06-050', 'E-12-100']) {
    const i = v.indexOf(id); const dx = 42.195 - v.position[i * 3], dz = -v.position[i * 3 + 2]; const l = Math.hypot(dx, dz)
    expect(facing(i)[0]).toBeCloseTo(dx / l, 4); expect(facing(i)[1]).toBeCloseTo(dz / l, 4)
  }
})
it('leaves the procession entrance open: no east-curve seat within 4 degrees of due east', () => {
  const [a, b] = v.sections.filter((s) => s.id === 'E').map((s) => [s.start, s.start + s.count])[0]
  for (let i = a; i < b; i++) expect(Math.abs(Math.atan2(v.position[i * 3 + 2], v.position[i * 3] - 42.195))).toBeGreaterThan((4 * Math.PI) / 180 - 1e-6)
})
it('keeps every pair of seats in the same row at least 0.5 m apart, and rows at least 0.8 m apart', () => { /* neighbours within a row; first seats of consecutive rows in a section */ })
it('raises stand rows as they go back', () => { expect(pos('S-20-060')[1]).toBeGreaterThan(pos('S-01-060')[1]); expect(pos('E-12-010')[1]).toBeCloseTo(1.2 + 11 * 0.42, 4) })
it('follows the config: changing one zone count changes the totals and nothing else breaks', () => {
  const cfg = structuredClone(VENUE); cfg.zones[0].count += 5
  const w = buildVenue(cfg)
  expect(w.ranges.pitch[1]).toBe(2991); expect(w.count).toBe(8003); expect(w.pitchRows).toBe(46)
  expect(w.pitchCell.length).toBe(6 * 46 * 14)
  expect(w.indexOf(w.idOf(w.count - 1))).toBe(w.count - 1)
  expect(getVenue()).toBe(getVenue()); expect(getVenue().count).toBe(7998)
})
it('maps every pitch seat through pitchCell and nothing else', () => {
  let filled = 0
  for (let c = 0; c < v.pitchCell.length; c++) if (v.pitchCell[c] >= 0) filled++
  expect(filled).toBe(2986)
  const i = v.indexOf('P3-12-07'); expect(v.pitchCell[((3 - 1) * v.pitchRows + (12 - 1)) * 14 + (7 - 1)]).toBe(i)
})
it('spells KFUPM only inside rows 4 to 16 of the south stand', () => {
  expect(southLetterMask(2, 60)).toBe(false); expect(southLetterMask(17, 60)).toBe(false)
  let lit = 0; for (let r = 4; r <= 16; r++) for (let s = 1; s <= 120; s++) if (southLetterMask(r, s)) lit++
  expect(lit).toBeGreaterThan(300)
})
```

- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
  - Index order: pitch seats, then the 12 bays, then stands in the order VIP, NW, NE, S, E, ACC.
  - Seat centres (n is the seat number, r the row):
    - **S:** x = 36 − (n − 0.5) × 0.6; z = 53 + (r − 1) × 0.85; y = 1.2 + (r − 1) × 0.42; yaw 0 (faces −Z).
    - **ACC:** x = −(n − 0.5) × 0.7; z = 47.3 + (r − 1) × 1.1; y = 0.3; yaw 0.
    - **NW:** x = −35 + (n − 0.5) × 0.6; z = −52 − (r − 1) × 0.85; y = 1.2 + (r − 1) × 0.42; yaw π (faces +Z).
    - **VIP:** x = −15 + (n − 0.5) × 0.6; z = −52 − (r − 1) × 1.1; y = 3.0 + (r − 1) × 0.45; yaw π.
    - **NE:** x = 17 + (n − 0.5) × 0.6; z and y as NW; yaw π.
    - **E:** radius R = 52 + (r − 1) × 0.85 about (42.195, 0); angle φ from +X toward +Z; seats 1–50 at φ = −34° + (n − 0.5) × 0.6°, seats 51–100 at φ = 4° + (n − 50.5) × 0.6°; x = 42.195 + R cos φ; z = R sin φ; y = 1.2 + (r − 1) × 0.42; yaw = 90° − φ (faces the centre).
  - Bays: kind `AccessBay`, ids `P{block}-A1` (north) and `P{block}-A2` (south), `zone` 255, `row` 0, yaw +90°.
  - Ids follow the spec's section 4.
  - The lettering: five letters, each 16 seats wide with 6-seat gaps (104 seats, centred on the 120), 13 rows tall (rows 4–16, the top of each letter at row 16). K starts at seat 1's end, so the word reads left to right from the pitch. Print the mask as text once and check it reads clearly.
  - `ranges`, `pitchRows` and `pitchCell` are computed from the config, never literal.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadiview): stands and the assembled venue layout`)

### Task 3: Picking maths

**Files:**
- Create: `src/features/stadiview/engine/seatFrame.ts`
- Create: `src/features/stadiview/engine/occluders.ts`
- Create: `src/features/stadiview/engine/picking.ts`
- Test: `tests/unit/stadiview/picking.test.ts`

**Interfaces:**
- Consumes: `VenueLayout`, `VenueConfig`, `VENUE`.
- Produces:
  - In `seatFrame.ts`:
    - `type Vec3 = [number, number, number]`
    - `seatFacing(i: number, v: VenueLayout): Vec3`: the unit vector the seat faces, `(−sin yaw, 0, −cos yaw)`
    - `seatBack(i: number, v: VenueLayout): Vec3`: its opposite
    - `CHAIR_BOX = { halfW: 0.25, height: 0.95, halfD: 0.25 }`: the pick box of one seat, centred on the seat position and turned by the seat's yaw
    - `seatAim(i: number, v: VenueLayout): Vec3`: a point on the upper seat back, `position + 0.22 × back + (0, 0.8, 0)`. Tests and the debug hook aim at it.
  - In `occluders.ts`:
    - `type Occluder = { kind: 'box'; min: Vec3; max: Vec3 } | { kind: 'side'; x: number; z0: number; z1: number; y0: number; y1: number } | { kind: 'arc'; cx: number; cz: number; radius: number; from: number; to: number; y0: number; y1: number }`
    - `buildOccluders(cfg?: VenueConfig): Occluder[]` and `getOccluders(): Occluder[]` (the default config's list, cached)
    - `occluderDistance(ray: Ray, occ: Occluder[]): number`: the distance to the nearest occluder the ray hits, `Infinity` when none
  - In `picking.ts`:
    - `interface Ray { ox: number; oy: number; oz: number; dx: number; dy: number; dz: number }` (the direction is a unit vector)
    - `pickHit(ray: Ray, v: VenueLayout, occ?: Occluder[]): { index: number; t: number }`: the first chair box the ray enters and its distance; `{ index: -1, t: Infinity }` when it enters none or an occluder is nearer. `occ` defaults to `getOccluders()`; pass `[]` to ignore occluders.
    - `pickSeat(ray: Ray, v: VenueLayout, occ?: Occluder[]): number`: `pickHit(...).index`
    - `pickPitch`, `pickStands`, `pickBays` `(ray: Ray, v: VenueLayout): { index: number; t: number }`: the three partial pickers, without occluders

**Occluders (all derived from the config):**

| Occluder | Shape |
|---|---|
| Stage backdrop | box x −52.4 to −52, z −22 to 22, y 0 to 12.6 |
| VIP canopy | box x −17 to 17, z −60 to −50, y 9.5 to 9.8 |
| Rear walls of S, NW, NE | box 0.3 thick directly behind the last row's tread, across the stand's width, from the ground to the last row's floor + 1.1 |
| Rear wall of VIP | the same, rising to the canopy (9.5) |
| Side walls of S, NW, NE, VIP (both ends) | `side` at the stand's end x, from the front of the first tread (z0) to the rear wall (z1); its top edge rises in a straight line from the first row's floor height at z0 to the rear wall's top at z1; solid below that edge down to the ground |
| East curve rear wall | two `arc`s about (42.195, 0), radius = last row's radius + half a tread, −34° to −4° and 4° to 34°, from the ground to the last row's floor + 1.1 |

"Half a tread" is 0.425 for S, NW, NE and E, and 0.55 for VIP.

- [ ] **Step 1: Write the failing tests**

```ts
const v = buildVenue()
const down = (x: number, z: number): Ray => ({ ox: x, oy: 50, oz: z, dx: 0, dy: -1, dz: 0 })
const toward = (o: Vec3, t: Vec3): Ray => { const d = [t[0] - o[0], t[1] - o[1], t[2] - o[2]]; const l = Math.hypot(d[0], d[1], d[2]); return { ox: o[0], oy: o[1], oz: o[2], dx: d[0] / l, dy: d[1] / l, dz: d[2] / l } }
const HOME: Vec3 = [72, 64, -88]

it('picks every 37th seat when the ray comes straight down on it', () => {
  for (let i = 0; i < v.count; i += 37) expect(pickHit(down(v.position[i * 3], v.position[i * 3 + 2]), v, []).index).toBe(i)
})
it('picks the seat whose back the opening camera is aimed at', () => {
  for (const id of ['P3-12-07', 'P1-01-01', 'P1-45-13', 'P6-33-14', 'P2-A1', 'S-10-060', 'S-01-001', 'S-20-120', 'NW-08-015', 'NE-08-015', 'E-06-025', 'E-06-075', 'ACC-02-020']) {
    expect(v.idOf(pickSeat(toward(HOME, seatAim(v.indexOf(id), v)), v))).toBe(id)
  }
})
it('returns nothing in an aisle, a cross aisle, on the track, into the sky, or past the last partial row', () => {
  expect(pickSeat(down(-20, -21.6), v)).toBe(-1)          // aisle between blocks 1 and 2
  expect(pickSeat(down(-14.5, -27), v)).toBe(-1)          // cross aisle after row 15
  expect(pickSeat(down(0, 40), v)).toBe(-1)               // track
  expect(pickSeat(down(97, 0), v)).toBe(-1)               // the procession entrance gap
  expect(pickSeat({ ox: 0, oy: 5, oz: 0, dx: 0, dy: 1, dz: 0 }, v)).toBe(-1)
  expect(pickSeat(down(rowX(34), blockZ(6, 7)), v)).toBe(-1)
})
it('does not pick through the VIP canopy, a stand rear wall or the stage backdrop', () => {
  const vip = v.indexOf('VIP-03-025')
  expect(pickHit(down(v.position[vip * 3], v.position[vip * 3 + 2]), v, []).index).toBe(vip)   // geometry alone
  expect(pickSeat(down(v.position[vip * 3], v.position[vip * 3 + 2]), v)).toBe(-1)             // the canopy is in the way
  expect(pickSeat(toward([0, 3, 110], seatAim(v.indexOf('S-10-060'), v)), v)).toBe(-1)         // from behind and below the south stand
  expect(pickSeat(toward([-90, 4, -5], seatAim(v.indexOf('P3-01-07'), v)), v)).toBe(-1)        // from behind the stage backdrop
})
it('agrees with a brute-force test of every chair box', () => {
  // An oracle written here from the definition (seat position, yaw, CHAIR_BOX): test the ray against all 7,998 boxes and keep the nearest.
  // Compare it with pickHit(ray, v, []) for 400 deterministic pseudo-random rays: 250 from orbit-shell positions
  // (radius 60–220, polar 18°–80°, around (-8, 0, 0)) toward random points of the bowl, 100 first-person rays from
  // random seat eye points (pitch −35° to +50°), and 50 near-horizontal rays at heights 0.2, 0.5 and 0.94.
  // The picked index must match whenever the two distances differ by more than 1e-6.
})
```

- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
  - A chair-box test turns the ray into the seat's frame by its yaw and does a slab test against `CHAIR_BOX`.
  - **Pitch (grid arithmetic):** clip the ray to the slab y from 0 to `CHAIR_BOX.height`. Walk that segment in steps of 0.25 m (at most 600 steps). At each step convert (x, z) to block, row and column by division, inverting `rowX` and `blockZ`. Test the chair boxes of that cell and its 8 neighbours, skipping cells already tested, and keep the nearest hit. Stop once the walk has passed the best hit by 0.5 m.
  - **Stands:** for each `standRows` entry, clip the ray to the row's slab (y from `row.y` to `row.y + CHAIR_BOX.height`). Skip the row when that segment misses the row's footprint. Otherwise find the seat numbers the segment passes (by division along x for line rows, by angle for arc rows), test those boxes plus one neighbour on each side, and keep the nearest hit.
  - **Bays:** test the 12 boxes directly.
  - `pickHit` takes the nearest of the three and returns no hit when `occluderDistance` is smaller.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadiview): exact grid-accelerated seat picking with occluders`)

### Task 4: Camera maths

**Files:**
- Create: `src/features/stadiview/engine/cameraMath.ts`
- Test: `tests/unit/stadiview/cameraMath.test.ts`

**Interfaces:**
- Consumes: `VenueLayout`, `VENUE`, and from `seatFrame.ts`: `Vec3`, `seatBack`.
- Produces:
  - `EYE_HEIGHT = 1.15`, `ORBIT_HOME = { position: [72, 64, -88], target: [-8, 0, 0], fov: 42 }`, `POV_FOV = 62`
  - `seatEye(i: number, v: VenueLayout): Vec3`: the seat position raised by `EYE_HEIGHT`
  - `seatLook(i: number, v: VenueLayout): Vec3`: the podium `[-42, 3.2, 0]` for pitch seats and bays; `[-20, 1.5, 0]` for stand seats
  - `flightPath(from: Vec3, eye: Vec3, back: Vec3): Vec3[]`: four control points `[from, crest, approach, eye]`, where `approach = eye + 12 × back + (0, 7, 0)` and `crest` is the point 40% of the way from `from` to `approach` with its height replaced by `max(from.y, approach.y) + 18`
  - `returnPath(from: Vec3, to: Vec3): Vec3[]`: three control points (from; the midpoint with its height replaced by `max(from.y, to.y) + 20`; to), for flying back to an orbit pose
  - `clampOrbit(o: { theta: number; phi: number; radius: number }): { theta: number; phi: number; radius: number }`: phi 18°–80°, radius 60–220
  - `orbitPosition(o: { theta: number; phi: number; radius: number }, target: Vec3): Vec3`: `target + radius × (sin φ sin θ, cos φ, sin φ cos θ)`, and its inverse `orbitFromPosition(position: Vec3, target: Vec3)`
  - `clampLook(yaw: number, pitch: number): { yaw: number; pitch: number }`: pitch −35° to +50°, yaw wrapped to (−π, π]
  - `lookAngles(eye: Vec3, target: Vec3): { yaw: number; pitch: number }`: yaw 0 looks toward −Z and grows toward −X (the same convention as a seat's yaw); pitch is positive looking up. A three.js camera with rotation order `YXZ`, `rotation.y = yaw` and `rotation.x = pitch` looks along this direction.
  - `overviewFov(aspect: number): number`: the overview's vertical field of view in degrees, `clamp(2 × atan(tan(26.5°) / aspect), 42, 72)`. It is 42 on landscape screens and widens on portrait ones.

- [ ] **Step 1: Write the failing tests**

```ts
it('puts the eye 1.15 above the seat floor', () => {
  const i = v.indexOf('S-20-060'); const e = seatEye(i, v)
  expect(e[1]).toBeCloseTo(v.position[i * 3 + 1] + 1.15, 5)
  expect(e[0]).toBeCloseTo(v.position[i * 3], 5); expect(e[2]).toBeCloseTo(v.position[i * 3 + 2], 5)
})
it('looks at the podium from the pitch and toward the pitch from the stands', () => {
  expect(seatLook(v.indexOf('P1-01-01'), v)).toEqual([-42, 3.2, 0])
  expect(seatLook(v.indexOf('P4-A2'), v)).toEqual([-42, 3.2, 0])
  expect(seatLook(v.indexOf('E-01-050'), v)).toEqual([-20, 1.5, 0])
})
it('builds a flight that starts at the camera, crests, approaches from behind the seat, and ends at the eye', () => {
  const p = flightPath([72, 64, -88], [-10, 1.15, 5], [1, 0, 0])
  expect(p).toHaveLength(4); expect(p[0]).toEqual([72, 64, -88]); expect(p[3]).toEqual([-10, 1.15, 5])
  expect(p[2][0]).toBeCloseTo(2, 6); expect(p[2][1]).toBeCloseTo(8.15, 6); expect(p[2][2]).toBeCloseTo(5, 6)
  expect(p[1][0]).toBeCloseTo(44, 6); expect(p[1][1]).toBeCloseTo(82, 6); expect(p[1][2]).toBeCloseTo(-50.8, 6)
  const r = returnPath([-10, 1.15, 5], [72, 64, -88]); expect(r).toHaveLength(3); expect(r[1]).toEqual([31, 84, -41.5])
})
it('converts between orbit angles and positions', () => {
  const o = orbitFromPosition(ORBIT_HOME.position, ORBIT_HOME.target)
  expect(o.radius).toBeCloseTo(Math.hypot(80, 64, 88), 6)
  const p = orbitPosition(o, ORBIT_HOME.target)
  expect(p[0]).toBeCloseTo(72, 6); expect(p[1]).toBeCloseTo(64, 6); expect(p[2]).toBeCloseTo(-88, 6)
  expect(clampOrbit(o)).toEqual(o)   // the opening pose is inside the limits
})
it('clamps the orbit and the look', () => {
  expect(clampOrbit({ theta: 1, phi: 0, radius: 500 })).toEqual({ theta: 1, phi: (18 * Math.PI) / 180, radius: 220 })
  expect(clampOrbit({ theta: 1, phi: 3, radius: 1 })).toEqual({ theta: 1, phi: (80 * Math.PI) / 180, radius: 60 })
  expect(clampLook(0, 2).pitch).toBeCloseTo((50 * Math.PI) / 180, 6)
  expect(clampLook(0, -2).pitch).toBeCloseTo((-35 * Math.PI) / 180, 6)
  expect(clampLook(4, 0).yaw).toBeCloseTo(4 - 2 * Math.PI, 6)
})
it('uses the seat-yaw convention for look angles', () => {
  const west = lookAngles([0, 1.15, 0], [-42, 1.15, 0]); expect(west.yaw).toBeCloseTo(Math.PI / 2, 6); expect(west.pitch).toBeCloseTo(0, 6)
  const north = lookAngles([0, 0, 0], [0, 0, -10]); expect(north.yaw).toBeCloseTo(0, 6)
  const up = lookAngles([0, 0, 0], [0, 10, -10]); expect(up.pitch).toBeCloseTo(Math.PI / 4, 6)
})
it('widens the overview on portrait screens', () => {
  expect(overviewFov(1.6)).toBe(42); expect(overviewFov(3)).toBe(42)
  expect(overviewFov(1)).toBeCloseTo(53, 0); expect(overviewFov(0.46)).toBe(72)
})
```

- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadiview): camera maths`)

### Task 5: Store and device tiers

**Files:**
- Create: `src/features/stadiview/state/stadiumStore.ts`
- Create: `src/features/stadiview/engine/tiers.ts`
- Test: `tests/unit/stadiview/stadiumStore.test.ts`, `tests/unit/stadiview/tiers.test.ts`

**Interfaces:**
- Consumes: `CapabilityEnv` and `SLOW_BENCH_MS` from `src/features/honors/capability.ts`.
- Produces:
  - `type CameraMode = 'orbit' | 'fly' | 'pov'`
  - `useStadium` (zustand): `{ mode: CameraMode; hover: number; selected: number; setHover(i: number): void; select(i: number): void; back(): void; setMode(m: CameraMode): void }`
    - `select(i)` with a valid index sets `selected` to i and `mode` to `'fly'`, from any mode. `select` with a negative index does nothing.
    - `back()` in `'pov'` or `'fly'` sets `mode` to `'fly'` and `selected` to −1. In `'orbit'` it does nothing.
    - `setHover` is ignored (hover stays −1) while `mode !== 'orbit'`; entering `'fly'` clears hover.
    - `mode === 'fly'` with `selected >= 0` means flying in; with `selected === -1` it means flying back. The camera rig calls `setMode('pov')` or `setMode('orbit')` when a flight ends.
  - `type Tier = 0 | 1 | 2 | 3`
  - `detectTier(env: CapabilityEnv & { coarsePointer: boolean }): Tier`: 0 without WebGL; 1 with the low-end flag, device memory ≤ 2, cores ≤ 2 or a benchmark slower than `SLOW_BENCH_MS`; 3 for a fine pointer with cores ≥ 8 and device memory ≥ 8 (or unknown memory); otherwise 2.
  - `tierFromSearch(search: string): Tier | null`: reads `?tier=0..3`; anything else is null.
  - `resolveTier(env, search): Tier`: the URL override when present, except that no WebGL is always tier 0.
  - `TIER_SETTINGS: Record<Tier, { maxDpr: number; antialias: boolean; spotLights: boolean; bloom: boolean; crowd: number; livePreview: boolean }>`:

    | Tier | maxDpr | antialias | spotLights | bloom | crowd | livePreview |
    |---|---|---|---|---|---|---|
    | 0 | 1 | false | false | false | 0 | false |
    | 1 | 1 | false | false | false | 150 | false |
    | 2 | 1.5 | true | true | false | 400 | false |
    | 3 | 2 | true | true | true | 900 | true |

- [ ] **Step 1: Write the failing tests** for each rule above: one assertion per store rule (including hover ignored in `pov` and `fly`, `back()` from each mode, `select(-1)`); `detectTier` for the four tiers and their boundary values (2 and 3 cores, 7 and 8 cores, device memory 2 and 8, a benchmark of exactly `SLOW_BENCH_MS` and just above); `tierFromSearch` for `?tier=1`, `?tier=9`, `?tier=x` and no parameter; `resolveTier` keeping tier 0 without WebGL even with `?tier=3`; the settings table.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadiview): stadium store and device tiers`)

### Task 6: The route and the static stadium

**Files:**
- Create: `src/features/stadiview/StadiViewPage.tsx` (default export, lazy route)
- Create: `src/features/stadiview/useTier.ts`
- Create: `src/features/stadiview/debugHook.ts`
- Create: `src/features/stadiview/scene/StadiumCanvas.tsx`
- Create: `src/features/stadiview/scene/Sky.tsx` (sky dome, stars, distant campus silhouettes)
- Create: `src/features/stadiview/scene/Ground.tsx` (surroundings, pitch, seat-block floors and aisles, track)
- Create: `src/features/stadiview/scene/Stands.tsx` (tiers, walls, VIP box and canopy, accessibility platform)
- Create: `src/features/stadiview/scene/Stage.tsx` (deck, steps, podium, backdrop with the FAST Matrix shader, LED screens)
- Create: `src/features/stadiview/scene/Floodlights.tsx` (masts, lamp banks, glow sprites, light cones)
- Create: `src/features/stadiview/scene/matrixShader.ts`
- Create: `src/features/stadiview/stadiview.css` (the scoped palette tokens and HUD base classes)
- Modify: `src/app/routes.tsx`
- Modify: `src/i18n/ar.ts`, `src/i18n/en.ts` (`nav.stadium`, `sv.title`, `sv.home`, `sv.canvas.label`, `sv.fallback.title`, `sv.fallback.body`, `sv.fallback.home`, `sv.loading`)
- Test: `tests/e2e/stadiview.spec.ts`

**Interfaces:**
- Consumes: `VENUE`, `getVenue`, `getOccluders`, `resolveTier`, `TIER_SETTINGS`, `ORBIT_HOME`, `overviewFov`, `probeEnv` (from `src/features/honors/capability.ts`), `useReducedMotion`, `useDemoFlags`.
- Produces:
  - `useTier(): Tier`
  - The page root: `<main data-stadiview data-theme="stadiview" data-tier={tier}>`
  - The canvas wrapper: `[data-stadium-canvas]`
  - The fallback: `[data-stadium-fallback]` (tier 0, or after `webglcontextlost` without a restore within 2 s)
  - `window.__stadiview`, created by `debugHook.ts` only in development, under automation (`navigator.webdriver`) or with `?svdebug=1`. In this task it has `ready: boolean` (true once the first frame has rendered), `tier: Tier` and `info(): { calls: number; triangles: number }` (from the renderer). Later tasks add to it through `extendDebugHook(partial)`.
  - `matrixBarsMaterial(colors: [string, string], skewDeg: number): ShaderMaterial` with a `uTime` uniform

- [ ] **Step 1: Write failing end-to-end tests**
  - `/stadium?lang=en&tier=1`: `[data-stadiview]` has `data-theme="stadiview"` and `data-tier="1"`; `[data-stadium-canvas] canvas` is visible and fills the viewport; `window.__stadiview.ready` becomes true; the page does not scroll (`document.documentElement.scrollHeight <= innerHeight`).
  - On `/`, the site header shows a "Stadium" link that goes to `/stadium`; on `/stadium` a KFUPM logo link returns to `/`.
  - With WebGL unavailable (`page.addInitScript` replaces `HTMLCanvasElement.prototype.getContext` so that it returns null for `webgl`, `webgl2` and `experimental-webgl`): `[data-stadium-fallback]` is visible, it has a link to `/`, and no canvas is attached. The same holds with `?tier=3` in the URL.
  - Context loss: after the scene is ready, calling `loseContext()` on the canvas's `WEBGL_lose_context` extension shows `[data-stadium-fallback]` within 4 s.
  - `/` does not request any URL containing `stadiview` or `three` (case-insensitive), as the honors spec checks for its own chunk.
  - No horizontal scroll at 390 px, in Arabic and in English.
  - `info()` reports at most 80 draw calls and at most 450,000 triangles in the overview.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
  - **Route.** `/stadium` is an immersive route outside the header `Layout`, inside a small shell that still mounts `RootPhase`, `DemoConsole`, `CertificateMomentHost`, `Fireworks` and `Toaster`. The site header gets a "Stadium" link. The header must not import anything from `src/features/stadiview`.
  - **Page shell.** Full viewport (`100dvh`), page scroll locked while mounted, a slim top bar (white KFUPM logo linking to `/`, the title, the language button) in the HUD style. The canvas has `touch-action: none`, `role="img"` and the `sv.canvas.label` text as its accessible name.
  - **Canvas.** `dpr={[1, settings.maxDpr]}`, `gl={{ antialias: settings.antialias, powerPreference: 'high-performance' }}`, ACES filmic tone mapping, background #061A17, fog toward the same colour. Camera at `ORBIT_HOME` with `overviewFov(aspect)`.
  - **Frame loop.** `frameloop="always"` while motion is allowed; `"demand"` under reduced motion or the low-end flag, with `invalidate()` on every change.
  - **Lighting.** A hemisphere light and one directional "moon" on every tier; four spot lights from the masts when `settings.spotLights`. No shadow maps.
  - **Geometry** comes from `VENUE`, `getVenue().standRows` and `getOccluders()` only:
    - sky dome with a soft horizon glow, sparse stars, and a ring of dark campus blocks with green-lit bands beyond the stadium
    - surroundings and apron
    - the pitch with mowing stripes
    - a sand-toned floor under each seat block, with the aisles and cross aisles reading as runners
    - the 8-lane track with lane lines
    - the stands as stepped tiers (one merged geometry per stand), their rear and side walls drawn from the occluder list
    - the VIP box raised under its canopy with a warm strip of light
    - the accessibility platform
    - the stage: deck with a gold edge, steps, podium, the backdrop, two LED screens with a simple ceremony title texture
    - four floodlight masts with lamp banks, an additive glow sprite each, and a faint light cone toward the pitch
  - **Materials** are cheap: Lambert or unlit for large surfaces; the backdrop uses `matrixBarsMaterial(['#005A50', '#E7A614'], 5)`, whose `uTime` advances only when motion is allowed.
  - **Disposal.** Geometries, materials and textures created by hand are disposed on unmount.
- [ ] **Step 4: Run the tests and confirm they pass,** then look at screenshots at 1440×900 and 390×844 (default tier and tier 1) and fix what looks wrong.
- [ ] **Step 5: Commit** (`feat(stadiview): the stadium route and static scene`)

### Task 7: Instanced seats, hover and selection

**Files:**
- Create: `src/features/stadiview/scene/Seats.tsx`
- Create: `src/features/stadiview/scene/seatGeometry.ts`
- Create: `src/features/stadiview/scene/seatColors.ts`
- Create: `src/features/stadiview/scene/usePointerPicking.ts`
- Create: `src/features/stadiview/hud/SeatTooltip.tsx`
- Modify: `src/features/stadiview/scene/StadiumCanvas.tsx`, `src/features/stadiview/StadiViewPage.tsx`, `src/features/stadiview/stadiview.css`
- Modify: `src/i18n/ar.ts`, `src/i18n/en.ts` (`sv.tip.block`, `sv.tip.row`, `sv.tip.seat`, `sv.tip.bay`, `sv.status.available`, `sv.section.<id>` for VIP, NW, NE, S, E and ACC, `sv.degree.B`, `sv.degree.G`)
- Test: `tests/unit/stadiview/seatColors.test.ts`, `tests/unit/stadiview/seatGeometry.test.ts`, `tests/e2e/stadiview.spec.ts`

**Interfaces:**
- Consumes: `getVenue`, `pickSeat`, `seatAim`, `useStadium`, `southLetterMask`, `COLLEGE_ID`, `COLLEGE_NAMES`, `extendDebugHook`.
- Produces:
  - `chairGeometry(): BufferGeometry` (seat pan and back, 24 triangles, origin on the floor, facing −Z, fitting inside `CHAIR_BOX`)
  - `baseColor(i: number, v: VenueLayout): string`: green #009C5A for pitch seats and bays; deep #005A50 for stand seats; sand #E8DEC3 where `southLetterMask` is true
  - `colorFor(i: number, v: VenueLayout, s: { hover: number; selected: number }): string`: gold #E7A614 for the hovered or selected seat, else `baseColor`
  - Debug hook additions:
    - `project(seatId: string): { x: number; y: number } | null`: the screen position, in CSS pixels, of `seatAim` for that seat, or null when it is off screen or behind the camera
    - `projectPoint(p: [number, number, number]): { x: number; y: number } | null`
    - `state(): { mode: CameraMode; hover: string | null; selected: string | null }`
    - `select(seatId: string): void` and `back(): void` (they call the store)
  - The tooltip: `[data-seat-tooltip]` with the block, college and degree, row, seat and status for pitch seats; the section, row and seat for stand seats

- [ ] **Step 1: Write failing tests**
  - Unit: `baseColor` for a pitch seat, a bay, a south-stand letter seat and a plain stand seat; `colorFor` returns gold for hover and for selection.
  - Unit: `chairGeometry()` has 24 triangles and its bounding box fits inside `CHAIR_BOX` with its floor at y = 0.
  - e2e: hovering at `project('P3-12-07')` shows a tooltip containing "Block 3", "Row 12", "Seat 7" and "Available", and `state().hover` is `'P3-12-07'`.
  - e2e: hovering at `projectPoint([-26, 0, -21.6])` (the aisle between blocks 1 and 2) hides the tooltip and `state().hover` is null.
  - e2e: hovering at `project('S-10-060')` shows a tooltip naming the south stand, row 10 and seat 60.
  - e2e: clicking at `project('S-10-060')` sets `state().selected` to `'S-10-060'`.
  - e2e: pressing, dragging 40 px and releasing over a seat does not select it.
  - e2e (`lang=ar`): the tooltip reads in Arabic and stays inside the viewport when the hovered seat is near the right edge and near the bottom edge.
  - e2e: `info()` still reports at most 80 draw calls and 450,000 triangles with the seats in.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
  - Two `InstancedMesh` objects (pitch seats and bays; stand seats) sharing `chairGeometry()`, with `instanceColor`. Matrices are set once from the layout. A cheap material (Lambert).
  - Pointer handling on the canvas element: build the ray from the camera and call `pickSeat`, at most one pick per frame. Hover is live only in `orbit`; a click selects in `orbit` and `fly`; nothing is picked in `pov`. A press that moves more than 5 px before release is a drag, not a click.
  - Colour updates are imperative (a store subscription), rewriting only the instances whose colour changed. Hover must not re-render React components other than the tooltip.
  - The tooltip is a DOM element moved with a transform on pointer move (no React state per move). It sits 12 px from the pointer, flips to stay inside the viewport, uses logical properties for RTL, is `aria-hidden`, fades in over 125 ms on first appearance and swaps content instantly between seats.
  - Before writing the tooltip, read and apply `emil-design-eng`, `animate` and the `impeccable` craft floor (paths in the task prompt). The look is the brief's dark glass: `--sv-night` at 72% with a backdrop blur, sharp corners with one cut corner, a 1 px gold or green border at 35%.
- [ ] **Step 4: Run the tests and confirm they pass,** then look at screenshots (overview, a hover, Arabic) and fix what looks wrong.
- [ ] **Step 5: Commit** (`feat(stadiview): 7,998 instanced seats with hover and selection`)

### Task 8: The camera rig

**Files:**
- Create: `src/features/stadiview/scene/CameraRig.tsx`
- Create: `src/features/stadiview/hud/BackButton.tsx`
- Create: `src/features/stadiview/hud/PovHint.tsx`
- Modify: `src/features/stadiview/StadiViewPage.tsx`, `src/features/stadiview/scene/StadiumCanvas.tsx`, `src/features/stadiview/stadiview.css`
- Modify: `src/i18n/ar.ts`, `src/i18n/en.ts` (`sv.back`, `sv.pov.hint`)
- Test: `tests/e2e/stadiview-camera.spec.ts`

**Interfaces:**
- Consumes: `useStadium`, `seatEye`, `seatLook`, `seatBack`, `flightPath`, `returnPath`, `clampOrbit`, `orbitPosition`, `orbitFromPosition`, `clampLook`, `lookAngles`, `overviewFov`, `ORBIT_HOME`, `POV_FOV`, `useReducedMotion`, `useDemoFlags`, `extendDebugHook`.
- Produces:
  - Debug hook additions: `camera(): { position: Vec3; fov: number }` and `lastFlightStart(): Vec3 | null` (the camera position at the moment the most recent flight began)
  - The back button: `[data-sv-back]`, bottom-centre, shown only in `pov`, with the text of `sv.back` ("Back to stadium overview")

- [ ] **Step 1: Write failing end-to-end tests**
  - Clicking `P3-12-07` changes `state().mode` to `'fly'` and then `'pov'` within 6 s; the camera ends within 0.05 of `seatEye` for that seat and its field of view is 62.
  - Record `camera().position` before selecting. In `pov`, `[data-sv-back]` is visible; clicking it returns `mode` to `'orbit'` and the camera to within 0.5 of the recorded position (the last orbit pose). Pressing Escape does the same.
  - Idle rotation: without `?idle=1` the camera position is unchanged after 1 s; with `?idle=1` it changes, and stops changing after a pointer press.
  - Dragging in `orbit` moves the camera and keeps it between 60 and 220 from the target.
  - Dragging in `pov` changes the view direction but not the camera position.
  - Retargeting mid-flight: `select('P1-01-01')`, wait 600 ms, then in one `page.evaluate` read `camera().position`, call `select('S-10-060')` and read `lastFlightStart()`. The two positions are within 0.01, and the flight ends in `pov` at the eye of `S-10-060`.
  - With `reduced=1`: the flight finishes within 900 ms.
  - Resizing the viewport from 1280×800 to 800×1100 in `pov` leaves `mode` as `'pov'` and the camera position unchanged.
  - At 390×844 in the overview, `project('P1-01-01')`, `project('P6-33-14')` and `projectPoint([-46, 1.6, 0])` (the stage) are all on screen.
  - Keyboard: with the canvas focused, the arrow keys move the orbit; in `pov` they turn the view; Escape goes back.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
  - **Orbit.** Pointer drag changes theta and phi; wheel and pinch change the radius; limits through `clampOrbit`. An idle rotation of 2° per second runs until the first pointer press, wheel or key, and is skipped under `navigator.webdriver` unless the URL has `?idle=1`. The field of view is `overviewFov(aspect)`; on portrait screens the opening radius grows (up to the 220 limit) until the six blocks and the stage fit.
  - **Fly.** A GSAP tween of one progress value read with the curve's arc-length lookup (`getPointAt`) along a Catmull-Rom curve through `flightPath` (in) or `returnPath` (out): 2.6 s in, 1.8 s out, with the project's strong ease-in-out `cubic-bezier(0.77, 0, 0.175, 1)` through GSAP's `CustomEase`. The look target and field of view blend along the way. A new selection kills the tween and starts from the current pose. Back returns to the orbit pose saved when the first flight began.
  - **Reduced motion or the low-end flag.** A 0.4 s cut: the canvas fades out, the camera is placed, the canvas fades in.
  - **POV.** Yaw and pitch from drag through `clampLook`, with inertia that decays with frame time (none under reduced motion); wheel and pinch change the field of view between 40° and 75°. The opening direction comes from `lookAngles(seatEye, seatLook)`.
  - **Keyboard.** The canvas wrapper is focusable with a visible focus ring. Arrows, plus, minus and Escape.
  - **Back button and hint.** Read and apply `emil-design-eng`, `animate` and the `impeccable` craft floor first. The button is at least 44 px tall, in the HUD glass style, with an arrow icon that flips in RTL; it enters with opacity and a short rise, and scales to 0.97 on press. A hint (`sv.pov.hint`) shows for 4 s on entering `pov`.
- [ ] **Step 4: Run the tests and confirm they pass,** then look at first-person screenshots from a pitch seat and a south-stand seat, and the phone overview, and fix what looks wrong.
- [ ] **Step 5: Commit** (`feat(stadiview): orbit, fly-to and first-person camera`)

### Task 9: Checks, screenshots and notes

**Files:**
- Create: `scripts/stadiview-stills.cjs`
- Modify: `vite.config.ts` only if needed to keep three, R3F and drei in a chunk shared by the honor page and StadiView
- Modify: `README.md` (a StadiView section: what works after Phase 2, controls, the config file)
- Modify: `docs/superpowers/plans/2026-11-10-stadiview-phase2.md` (implementation notes)

- [ ] **Step 1: Type check and lint.** `npx tsc --noEmit && npm run lint` should be clean.
- [ ] **Step 2: Unit tests.** `npx vitest run` should all pass.
- [ ] **Step 3: Browser tests.** `npx playwright test` should all pass.
- [ ] **Step 4: Build.** `npm run build` should succeed; the landing chunk must not grow by more than 2 KB gzipped; three, R3F and drei sit in a chunk shared with the honor page; the StadiView code outside that chunk must be at most 120 KB gzipped.
- [ ] **Step 5: Frame-time measurement** on the production build at 1440×900 and at 390×844 with the CPU slowed 4×: record the median and the share of frames over 50 ms in the overview and in first person, for tiers 1 and 2. Report the numbers; software rendering in the test browser understates a real GPU, so also note that a check on a real phone is still needed.
- [ ] **Step 6: Screenshots** for the requester in `docs/review/stadiview/`: overview, a hover with the tooltip, first person from a pitch seat, first person from the south stand, and the phone overview.
- [ ] **Step 7: Commit and push** (`chore(stadiview): Phase 2 checks, screenshots and notes`)
