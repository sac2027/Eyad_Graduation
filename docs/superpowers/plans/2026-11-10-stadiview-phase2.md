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

- All code is original. Nothing is copied from `thebuggeddev/football-stadium`.
- No new runtime dependencies.
- Units are metres; +X east, −X west, −Z north, +Z south, +Y up; origin at the pitch centre.
- Counts: pitch seats 2,986; accessible bays 12; stand seats 5,000; total 7,998.
- Every number about the venue comes from `src/features/stadiview/config/venue.ts`. No scene file hard-codes a dimension, count or gate.
- Palette, scoped under `[data-theme='stadiview']`: night #061A17, deep #005A50, green #009C5A, gold #E7A614, sand #E8DEC3, white #FFFFFF.
- Domain time comes from `src/time/clockStore.ts`. Render loops use animation-frame timestamps only.
- three, R3F and drei must not enter the landing chunk; the route is lazy-loaded.
- Reduced motion (`useReducedMotion()`) or the low-end flag: no idle rotation, no inertia, and flights become a 0.4 s cut.
- Arabic is the default language; English is the alternative. New strings go in both `src/i18n/ar.ts` and `src/i18n/en.ts`.

## Review Focus

1. **A pointer over an aisle, the track or the sky.** No seat is highlighted and no tooltip shows. Pinned in Task 3 (picking returns −1) and Task 7 (e2e hover on an aisle).
2. **Picking a second seat while the camera is mid-flight.** The camera retargets from where it is and ends at the second seat, with no jump. Pinned in Task 8.
3. **No WebGL, or the WebGL context is lost.** The page shows a clear fallback message with the seat list link, not a blank canvas. Pinned in Task 6.
4. **A window resize or phone rotation in first person.** The view keeps its seat and aspect ratio; the camera does not reset to the overview. Pinned in Task 8.
5. **A changed venue config** (for example a zone's head count). The totals, ids and picking still agree, because nothing else hard-codes them. Pinned in Task 2.

---

### Task 1: Venue config and the pitch layout

**Files:**
- Create: `src/features/stadiview/config/venue.ts`
- Create: `src/features/stadiview/layout/types.ts`
- Create: `src/features/stadiview/layout/pitchLayout.ts`
- Test: `tests/unit/stadiview/pitchLayout.test.ts`

**Interfaces:**
- Produces:
  - `VENUE` (the config object): pitch, track, stage, blocks, zones, stands, gates, with the values of the spec's sections 2 and 3. `VENUE.zones` is the ordered list of 24 `{ id, gender, college, degree, count }`.
  - Types from the spec's section 4: `SeatKind`, `SeatState`, `SectionInfo`, `ZoneInfo`, `VenueLayout`.
  - `rowX(row: number, cfg?: typeof VENUE): number`: x of a pitch row (row 1 at −30, pitch 1.0, a 2.0 cross aisle after every 15th row).
  - `blockZ(block: number, seat: number, cfg?): number`: z of seat 1..14 in block 1..6 (seat 1 north-most; block 1 starts at z = −31.2; seat pitch 0.6; block period 10.8).
  - `buildPitch(cfg?): PitchSeats` where `PitchSeats = { count: number; position: Float32Array; block: Uint8Array; row: Uint16Array; number: Uint16Array; zone: Uint8Array; lineup: Uint16Array; zones: ZoneInfo[]; bays: { position: Float32Array; block: Uint8Array } }`

- [ ] **Step 1: Write the failing tests**

```ts
const p = buildPitch()
it('has exactly 2,986 pitch seats and 12 bays', () => {
  expect(p.count).toBe(2986)
  expect(p.bays.block.length).toBe(12)
})
it('gives every zone exactly its head count, in line-up order', () => {
  expect(p.zones).toHaveLength(24)
  expect(p.zones.map((z) => z.count)).toEqual(VENUE.zones.map((z) => z.count))
  expect(p.zones.filter((z) => z.gender === 'f').reduce((a, z) => a + z.count, 0)).toBe(629)
  expect(p.zones.filter((z) => z.gender === 'm').reduce((a, z) => a + z.count, 0)).toBe(2357)
  p.zones.forEach((z, i) => { for (let k = z.start; k < z.start + z.count; k++) expect(p.zone[k]).toBe(i) })
})
it('puts females in block 1 and males in blocks 2 to 6', () => {
  for (let i = 0; i < p.count; i++) expect(p.block[i] === 1).toBe(p.zones[p.zone[i]].gender === 'f')
})
it('lays block 1 out in 45 rows with 13 seats in the last, and the male rows in 34 with 47 in the last', () => {
  const rows = (pred: (i: number) => boolean) => { const m = new Map<number, number>(); for (let i = 0; i < p.count; i++) if (pred(i)) m.set(p.row[i], (m.get(p.row[i]) ?? 0) + 1); return m }
  const f = rows((i) => p.block[i] === 1); expect(f.size).toBe(45); expect(f.get(45)).toBe(13)
  const m = rows((i) => p.block[i] !== 1); expect(m.size).toBe(34); expect(m.get(34)).toBe(47)
})
it('faces every seat west from inside the pitch, row 1 at x = -30', () => {
  for (let i = 0; i < p.count; i++) {
    const x = p.position[i * 3], z = p.position[i * 3 + 2]
    expect(Math.abs(x)).toBeLessThanOrEqual(52.5); expect(Math.abs(z)).toBeLessThanOrEqual(34)
  }
  expect(rowX(1)).toBe(-30); expect(rowX(16)).toBe(-13); expect(rowX(45)).toBe(18)
  expect(blockZ(1, 1)).toBeCloseTo(-30.9, 6)
})
it('numbers the line-up from 1 inside each zone', () => {
  for (const z of p.zones) { expect(p.lineup[z.start]).toBe(1); expect(p.lineup[z.start + z.count - 1]).toBe(z.count) }
})
```

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/stadiview/pitchLayout.test.ts` should fail on the missing module.

- [ ] **Step 3: Implement the config, the types and `buildPitch`**

Fill order: Block 1 row by row (seat 1 to 14), then male rows across blocks 2 to 6 (block 2 seat 1 … block 6 seat 14), front to back. Zones consume that order in `VENUE.zones` order. `blockZ(b, s)` is the seat's centre: `−31.2 + (b − 1) × 10.8 + (s − 0.5) × 0.6`. Bays sit at x = −31.5 at each block's seat 1 and seat 14.

- [ ] **Step 4: Run the tests and confirm they pass.**

- [ ] **Step 5: Commit** (`feat(stadiview): venue config and pitch layout`)

### Task 2: Stands and the assembled venue

**Files:**
- Create: `src/features/stadiview/layout/standsLayout.ts`
- Create: `src/features/stadiview/layout/venueLayout.ts`
- Test: `tests/unit/stadiview/venueLayout.test.ts`

**Interfaces:**
- Consumes: `buildPitch`, `VENUE`, the types.
- Produces:
  - `buildStands(cfg?): StandSeats` with one entry per stand section (`VIP`, `NW`, `NE`, `S`, `E`, `ACC`) and per-row metadata `rows: { section: number; row: number; y: number; start: number; count: number }[]` used by picking.
  - `buildVenue(cfg?): VenueLayout` (memoised for the default config) and `getVenue(): VenueLayout`.
  - `southLetterMask(row: number, seat: number): boolean`: true where a south-stand seat is part of the "KFUPM" lettering (rows 4–16).

- [ ] **Step 1: Write the failing tests**

```ts
const v = buildVenue()
it('has 7,998 seats in the documented ranges', () => {
  expect(v.count).toBe(7998)
  expect(v.ranges).toEqual({ pitch: [0, 2986], bays: [2986, 2998], stands: [2998, 7998] })
})
it('sizes each stand section as specified', () => {
  const n = Object.fromEntries(v.sections.map((s) => [s.id, s.count]))
  expect(n).toMatchObject({ VIP: 300, NW: 450, NE: 450, S: 2400, E: 1200, ACC: 200 })
})
it('assigns the gates', () => {
  const g = Object.fromEntries(v.sections.map((s) => [s.id, s.gate]))
  expect(g).toMatchObject({ P1: 5, P2: 2, P6: 2, S: 1, E: 1, NW: 2, NE: 2, ACC: 3 })
})
it('gives every seat a unique id that round-trips', () => {
  const seen = new Set<string>()
  for (let i = 0; i < v.count; i++) { const id = v.idOf(i); expect(seen.has(id)).toBe(false); seen.add(id); expect(v.indexOf(id)).toBe(i) }
  expect(v.idOf(v.indexOf('P3-12-07'))).toBe('P3-12-07')
  expect(v.indexOf('P9-01-01')).toBe(-1)
})
it('keeps every pair of neighbouring seats at least 0.5 m apart', () => { /* sort by section,row,number; check consecutive distance */ })
it('raises stand rows as they go back and faces them at the pitch', () => { /* S row 20 y > row 1 y; yaw of S seats faces -Z; E seats face the curve centre */ })
it('follows the config: changing one zone count changes the totals and nothing else breaks', () => {
  const cfg = structuredClone(VENUE); cfg.zones[0].count += 5
  const w = buildVenue(cfg)
  expect(w.ranges.pitch[1]).toBe(2991); expect(w.count).toBe(8003); expect(w.pitchRows).toBe(46)
  expect(w.pitchCell.length).toBe(6 * 46 * 14)
  expect(w.indexOf(w.idOf(w.count - 1))).toBe(w.count - 1)
})
it('spells KFUPM only inside rows 4 to 16 of the south stand', () => {
  expect(southLetterMask(2, 60)).toBe(false)
  let lit = 0; for (let r = 4; r <= 16; r++) for (let s = 1; s <= 120; s++) if (southLetterMask(r, s)) lit++
  expect(lit).toBeGreaterThan(300)
})
```

- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** Stand geometry is the spec's section 2 table. Seat 1 of every stand row is at the left end as seen from the pitch (east end for the south stand). The east curve is two halves of 12 × 50 seats either side of the entrance gap; its rows are numbered 1–12 and seats 1–100 across both halves. Ids follow the spec's section 4. The lettering uses a 5-letter bitmap, 13 rows tall, centred on the stand's 120 columns, starting with K at seat 1's end. `ranges` and `pitchRows` are computed from the config, never literal.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadiview): stands and the assembled venue layout`)

### Task 3: Picking maths

**Files:**
- Create: `src/features/stadiview/engine/picking.ts`
- Test: `tests/unit/stadiview/picking.test.ts`

**Interfaces:**
- Consumes: `VenueLayout`, `rowX`, `blockZ`.
- Produces:
  - `interface Ray { ox: number; oy: number; oz: number; dx: number; dy: number; dz: number }`
  - `pickPitch(ray: Ray, v: VenueLayout): number`: seat index or −1
  - `pickStands(ray: Ray, v: VenueLayout): number`
  - `pickBays(ray: Ray, v: VenueLayout): number`
  - `pickSeat(ray: Ray, v: VenueLayout): number`: the nearest hit of the three along the ray, or −1
  - `SEAT_PICK_Y = 0.45`

- [ ] **Step 1: Write the failing tests**

```ts
const v = buildVenue()
const down = (x: number, z: number): Ray => ({ ox: x, oy: 50, oz: z, dx: 0, dy: -1, dz: 0 })
it('picks every 37th seat when the ray comes straight down on it', () => {
  for (let i = 0; i < v.count; i += 37) expect(pickSeat(down(v.position[i * 3], v.position[i * 3 + 2]), v)).toBe(i)
})
it('picks a seat from a slanted camera ray', () => {
  const i = v.indexOf('P3-12-07'); const [x, z] = [v.position[i * 3], v.position[i * 3 + 2]]
  const o = { x: 72, y: 64, z: -88 }; const t = { x, y: SEAT_PICK_Y, z }
  const len = Math.hypot(t.x - o.x, t.y - o.y, t.z - o.z)
  expect(pickSeat({ ox: o.x, oy: o.y, oz: o.z, dx: (t.x - o.x) / len, dy: (t.y - o.y) / len, dz: (t.z - o.z) / len }, v)).toBe(i)
})
it('returns -1 in an aisle between blocks, in a cross aisle, on the track and for a ray into the sky', () => {
  expect(pickSeat(down(-20, -21.6), v)).toBe(-1)   // aisle between blocks 1 and 2
  expect(pickSeat(down(-14.5, -27), v)).toBe(-1)   // cross aisle after row 15
  expect(pickSeat(down(0, 40), v)).toBe(-1)        // track
  expect(pickSeat({ ox: 0, oy: 5, oz: 0, dx: 0, dy: 1, dz: 0 }, v)).toBe(-1)
})
it('returns -1 past the last partial row of the male blocks', () => {
  expect(pickSeat(down(rowX(34), blockZ(6, 7)), v)).toBe(-1)
})
```

- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** Pitch: intersect with y = `SEAT_PICK_Y`, invert `rowX` (reject a hit more than 0.45 from a row line), find block and column from z (reject a hit outside the block's 8.4), read `v.pitchCell`. Stands: loop the row metadata from Task 2; the east curve converts the hit to polar about (42.195, 0).
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadiview): arithmetic seat picking`)

### Task 4: Camera maths

**Files:**
- Create: `src/features/stadiview/engine/cameraMath.ts`
- Test: `tests/unit/stadiview/cameraMath.test.ts`

**Interfaces:**
- Consumes: `VenueLayout`, `VENUE`.
- Produces:
  - `type Vec3 = [number, number, number]`
  - `EYE_HEIGHT = 1.15`, `ORBIT_HOME = { position: [72, 64, -88], target: [-8, 0, 0], fov: 42 }`
  - `seatEye(i: number, v: VenueLayout): Vec3`
  - `seatLook(i: number, v: VenueLayout): Vec3`: the podium `[-42, 3.2, 0]` for pitch seats and bays; `[-20, 1.5, 0]` for stand seats
  - `seatBack(i: number, v: VenueLayout): Vec3`: the unit vector pointing behind the seat (opposite its facing direction)
  - `flightPath(from: Vec3, eye: Vec3, back: Vec3): Vec3[]`: four control points (from; a lifted point 30% along, at max(from.y, eye.y) + 34; the point `eye + 14 × back + (0, 16, 0)`; eye)
  - `returnPath(from: Vec3, to: Vec3): Vec3[]`: three control points (from; the midpoint lifted to max(from.y, to.y) + 20; to), for flying back to an orbit pose
  - `clampOrbit(o: { theta: number; phi: number; radius: number }): { theta: number; phi: number; radius: number }`: phi 18°–80°, radius 60–220
  - `clampLook(yaw: number, pitch: number): { yaw: number; pitch: number }`: pitch −35° to +50°, yaw wrapped to (−π, π]
  - `lookAngles(eye: Vec3, target: Vec3): { yaw: number; pitch: number }`

- [ ] **Step 1: Write the failing tests**

```ts
it('puts the eye 1.15 above the seat floor', () => {
  const i = v.indexOf('S-20-060'); const e = seatEye(i, v)
  expect(e[1]).toBeCloseTo(v.position[i * 3 + 1] + 1.15, 6)
})
it('looks at the podium from the pitch and toward the pitch from the stands', () => {
  expect(seatLook(v.indexOf('P1-01-01'), v)).toEqual([-42, 3.2, 0])
  expect(seatLook(v.indexOf('E-01-050'), v)).toEqual([-20, 1.5, 0])
})
it('builds a flight that starts at the camera, rises, and ends at the eye', () => {
  const p = flightPath([72, 64, -88], [-10, 1.15, 5], [1, 0, 0])
  expect(p).toHaveLength(4); expect(p[0]).toEqual([72, 64, -88]); expect(p[3]).toEqual([-10, 1.15, 5])
  expect(p[1][1]).toBe(98); expect(p[2]).toEqual([4, 17.15, 5])
  expect(seatBack(v.indexOf('P1-01-01'), v)).toEqual([1, 0, 0])
  const r = returnPath([-10, 1.15, 5], [72, 64, -88]); expect(r).toHaveLength(3); expect(r[1][1]).toBe(84)
})
it('clamps the orbit and the look', () => {
  expect(clampOrbit({ theta: 1, phi: 0, radius: 500 })).toEqual({ theta: 1, phi: (18 * Math.PI) / 180, radius: 220 })
  expect(clampLook(0, 2).pitch).toBeCloseTo((50 * Math.PI) / 180, 6)
  expect(clampLook(4, 0).yaw).toBeCloseTo(4 - 2 * Math.PI, 6)
})
it('a pitch seat looking at the podium faces west', () => {
  const a = lookAngles([0, 1.15, 0], [-42, 1.15, 0]); expect(a.pitch).toBeCloseTo(0, 6)
})
```

- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** A pitch seat faces −X, so its back vector is (1, 0, 0).
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadiview): camera maths`)

### Task 5: Store and device tiers

**Files:**
- Create: `src/features/stadiview/state/stadiumStore.ts`
- Create: `src/features/stadiview/engine/tiers.ts`
- Test: `tests/unit/stadiview/stadiumStore.test.ts`, `tests/unit/stadiview/tiers.test.ts`

**Interfaces:**
- Consumes: `detectCapability`'s inputs from `src/features/honors/capability.ts` (`CapabilityEnv`).
- Produces:
  - `type CameraMode = 'orbit' | 'fly' | 'pov'`
  - `useStadium` (zustand): `{ mode: CameraMode; hover: number; selected: number; setHover(i: number): void; select(i: number): void; back(): void; setMode(m: CameraMode): void }`. `select(i)` with i ≥ 0 sets `selected` and `mode: 'fly'`; `back()` sets `mode: 'fly'` and `selected: -1`; hover is ignored while `mode !== 'orbit'`.
  - `type Tier = 0 | 1 | 2 | 3`
  - `detectTier(env: CapabilityEnv & { coarsePointer: boolean; maxTextureSize?: number }): Tier`: 0 without WebGL; 1 with the low-end flag, device memory ≤ 2, cores ≤ 2 or a slow benchmark; 3 for a fine pointer with cores ≥ 8 and device memory ≥ 8 (or unknown memory); otherwise 2.
  - `TIER_SETTINGS: Record<Tier, { maxDpr: number; bloom: boolean; crowd: number; livePreview: boolean }>` with the values of the spec's section 10 (`maxDpr` 1, 1, 1.5, 2).

- [ ] **Step 1: Write the failing tests** for each rule above (one assertion per rule; hover ignored in `pov`; `detectTier` for the four cases; `TIER_SETTINGS[3]` equals `{ maxDpr: 2, bloom: true, crowd: 900, livePreview: true }`).
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadiview): stadium store and device tiers`)

### Task 6: The route and the static stadium

**Files:**
- Create: `src/features/stadiview/StadiViewPage.tsx` (default export, lazy route)
- Create: `src/features/stadiview/scene/StadiumCanvas.tsx`
- Create: `src/features/stadiview/scene/Ground.tsx` (pitch, track, apron)
- Create: `src/features/stadiview/scene/Stands.tsx` (tiers, VIP box and canopy, accessibility platform)
- Create: `src/features/stadiview/scene/Stage.tsx` (deck, steps, podium, backdrop with the FAST Matrix shader, LED screens)
- Create: `src/features/stadiview/scene/Floodlights.tsx` (masts, lamp banks, glow sprites)
- Create: `src/features/stadiview/scene/matrixShader.ts`
- Create: `src/features/stadiview/stadiview.css` (the scoped palette tokens)
- Modify: `src/app/routes.tsx` (a `stadium` route outside the header `Layout`, in a minimal shell that still mounts `RootPhase`, `DemoConsole`, `Toaster`, `CertificateMomentHost` and `Fireworks`; a "Stadium" link in the site header)
- Modify: `src/i18n/ar.ts`, `src/i18n/en.ts` (`nav.stadium`, `sv.title`, `sv.fallback.title`, `sv.fallback.body`, `sv.loading`)
- Test: `tests/e2e/stadiview.spec.ts`

**Interfaces:**
- Consumes: `VENUE`, `getVenue`, `detectTier`, `TIER_SETTINGS`.
- Produces:
  - The page root: `<main data-stadiview data-theme="stadiview" data-tier={tier}>`
  - The canvas wrapper: `[data-stadium-canvas]`
  - The fallback: `[data-stadium-fallback]` (tier 0, or after `webglcontextlost` without restore within 2 s)
  - `window.__stadiview = { ready: boolean }` set once the first frame has rendered (later tasks extend it)
  - `matrixBarsMaterial(colors: [string, string], skewDeg: 5): ShaderMaterial` with a `uTime` uniform

- [ ] **Step 1: Write failing end-to-end tests**
  - `/stadium?lang=en`: `[data-stadiview]` has `data-theme="stadiview"`; `[data-stadium-canvas] canvas` is visible and fills the viewport; `window.__stadiview.ready` becomes true; the page does not scroll (`document.documentElement.scrollHeight <= innerHeight`).
  - On `/`, the site header shows a "Stadium" link that goes to `/stadium`; on `/stadium` a KFUPM logo link returns to `/`.
  - With WebGL unavailable (`page.addInitScript` replaces `HTMLCanvasElement.prototype.getContext` so that it returns null for `webgl`, `webgl2` and `experimental-webgl`): `[data-stadium-fallback]` is visible and no canvas is attached.
  - `/` does not request any chunk whose URL contains `StadiView` or `three` (reuse the honors spec's network check).
  - No horizontal scroll at 390 px.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
  - `Canvas` with `dpr={[1, settings.maxDpr]}`, `gl={{ antialias: tier >= 2, powerPreference: 'high-performance' }}`, background #061A17, fog toward the same colour.
  - Lighting: one hemisphere light, one directional "moon", four spot lights from the masts; no shadow maps.
  - Geometry from `VENUE` only. Tiers are stepped boxes per row; the track is a ring shape with lane lines drawn in a canvas texture.
  - The backdrop uses `matrixBarsMaterial(['#005A50', '#E7A614'], 5)`; `uTime` advances only when motion is allowed.
  - Render on demand: `frameloop="demand"`, with a ticker that invalidates while something animates.
- [ ] **Step 4: Run the tests and confirm they pass,** then check screenshots at 1440×900 and 390×844 by eye.
- [ ] **Step 5: Commit** (`feat(stadiview): the stadium route and static scene`)

### Task 7: Instanced seats, hover and selection

**Files:**
- Create: `src/features/stadiview/scene/Seats.tsx`
- Create: `src/features/stadiview/scene/seatGeometry.ts`
- Create: `src/features/stadiview/scene/seatColors.ts`
- Create: `src/features/stadiview/hud/SeatTooltip.tsx`
- Modify: `src/features/stadiview/scene/StadiumCanvas.tsx`
- Modify: `src/i18n/ar.ts`, `src/i18n/en.ts` (`sv.tip.block`, `sv.tip.row`, `sv.tip.seat`, `sv.status.available`, `sv.status.booked`, `sv.section.<id>`, `sv.college.<id>`, `sv.degree.B`, `sv.degree.G`)
- Test: `tests/unit/stadiview/seatColors.test.ts`, `tests/e2e/stadiview.spec.ts`

**Interfaces:**
- Consumes: `getVenue`, `pickSeat`, `useStadium`, `southLetterMask`.
- Produces:
  - `chairGeometry(): BufferGeometry` (seat pan and back, 24 triangles, origin on the floor, facing −Z)
  - `baseColor(i: number, v: VenueLayout): string`: green #009C5A for pitch seats and bays; deep #005A50 for stand seats; sand #E8DEC3 where `southLetterMask` is true
  - `colorFor(i, v, s: { hover: number; selected: number }): string`: gold #E7A614 for the hovered or selected seat, else `baseColor`
  - `window.__stadiview.project(seatId: string): { x: number; y: number } | null`: the screen position, in CSS pixels, of the point `SEAT_PICK_Y` above the seat's floor origin, or null when off screen or behind the camera
  - `window.__stadiview.state(): { mode: CameraMode; hover: string | null; selected: string | null }`
  - The tooltip: `[data-seat-tooltip]` with text "Block · College · Row · Seat · Status" (for stand seats: section, row, seat)

- [ ] **Step 1: Write failing tests**
  - Unit: `baseColor` for a pitch seat, a south-stand letter seat and a plain stand seat; `colorFor` returns gold for hover and for selection.
  - e2e: hovering at `project('P3-12-07')` shows a tooltip containing "Block 3", "Row 12", "Seat 7" and "Available", and `state().hover` is `'P3-12-07'`.
  - e2e: hovering over the aisle point half-way between `project('P1-05-14')` and `project('P2-05-01')` hides the tooltip and `state().hover` is null.
  - e2e: clicking at `project('S-10-060')` sets `state().selected` to `'S-10-060'`.
  - e2e (`lang=ar`): the tooltip reads in Arabic and sits inside the viewport when the seat is near the right edge.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
  - Two `InstancedMesh` objects with `instanceColor`. Matrices are set once from the layout.
  - Pointer handling on the canvas element: build the ray from the camera and call `pickSeat`; throttle pointer moves to one pick per frame.
  - Colour updates rewrite only the instances whose colour changed.
  - The tooltip follows the pointer with a 12 px offset, flips to stay inside the viewport, and uses logical properties for RTL.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadiview): 7,998 instanced seats with hover and selection`)

### Task 8: The camera rig

**Files:**
- Create: `src/features/stadiview/scene/CameraRig.tsx`
- Create: `src/features/stadiview/hud/BackButton.tsx`
- Modify: `src/features/stadiview/StadiViewPage.tsx`
- Modify: `src/i18n/ar.ts`, `src/i18n/en.ts` (`sv.back`, `sv.pov.hint`)
- Test: `tests/e2e/stadiview-camera.spec.ts`

**Interfaces:**
- Consumes: `useStadium`, `seatEye`, `seatLook`, `flightPath`, `clampOrbit`, `clampLook`, `lookAngles`, `ORBIT_HOME`, `useReducedMotion`.
- Produces:
  - `window.__stadiview.camera(): { position: Vec3; fov: number }`
  - The back button: `[data-sv-back]`, bottom-centre, visible only in `pov`, with the text of `sv.back` ("Back to stadium overview")

- [ ] **Step 1: Write failing end-to-end tests**
  - Clicking `P3-12-07` changes `state().mode` to `'fly'` and then `'pov'` within 5 s; the camera ends within 0.05 of `seatEye` for that seat.
  - Record `camera().position` before selecting. In `pov`, `[data-sv-back]` is visible; clicking it returns `mode` to `'orbit'` and the camera to within 0.5 of the recorded position (the last orbit pose). Pressing Escape does the same.
  - Idle rotation: without `?idle=1` the camera position is unchanged after 1 s; with `?idle=1` it changes, and stops changing after a pointer press.
  - Dragging in `pov` changes the view direction but not the camera position.
  - Selecting `P1-01-01` and, 600 ms later, `S-10-060` ends in `pov` at `S-10-060`'s eye, and the sampled camera positions never jump more than 35 between consecutive samples taken every 100 ms.
  - With `reduced=1`: the flight finishes within 800 ms.
  - Resizing the viewport from 1280×800 to 800×1100 in `pov` leaves `mode` as `'pov'` and the camera position unchanged.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
  - Orbit: pointer drag changes theta and phi; wheel and pinch change radius; an idle rotation of 2° per second runs until the first pointer press, wheel or key, and is skipped under `navigator.webdriver` unless the URL has `?idle=1`.
  - Fly: a GSAP tween of one progress value, read with the curve's arc-length lookup (`getPointAt`), along a Catmull-Rom curve through `flightPath` (in) or `returnPath` (out); 2.6 s in, 1.8 s out, `power3.inOut`; a new selection kills the tween and starts from the current pose. Back returns to the orbit pose saved when the flight began.
  - POV: yaw and pitch from drag with inertia (velocity decays by 0.92 per frame); wheel and pinch change field of view between 40° and 75°.
  - Clicks are told apart from drags by a 5 px movement threshold.
  - Keyboard: arrows, plus, minus, Escape.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadiview): orbit, fly-to and first-person camera`)

### Task 9: Checks, screenshots and notes

**Files:**
- Create: `scripts/stadiview-stills.cjs`
- Modify: `README.md` (a StadiView section: what works after Phase 2, controls, the config file)
- Modify: `docs/superpowers/plans/2026-11-10-stadiview-phase2.md` (implementation notes)

- [ ] **Step 1: Type check and lint.** `npx tsc --noEmit && npm run lint` should be clean.
- [ ] **Step 2: Unit tests.** `npx vitest run` should all pass.
- [ ] **Step 3: Browser tests.** `npx playwright test` should all pass.
- [ ] **Step 4: Build.** `npm run build` should succeed; the landing chunk must not grow by more than 2 KB gzipped; the StadiView chunk (excluding three, R3F and drei) must be at most 120 KB gzipped.
- [ ] **Step 5: Frame-time measurement** on the production build at 1440×900 and at 390×844 with the CPU slowed 4×: record the median and the share of frames over 50 ms in the overview and in first person. Report the numbers; software rendering in the test browser understates a real GPU, so also note that a check on a real phone is still needed.
- [ ] **Step 6: Screenshots** for the requester in `docs/review/stadiview/`: overview, a hover with the tooltip, first person from a pitch seat, first person from the south stand, and the phone overview.
- [ ] **Step 7: Commit and push** (`chore(stadiview): Phase 2 checks, screenshots and notes`)
