# StadiView Phase 3 Implementation Plan: interface, seat matrix, booking and guest lookup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 3D stadium into a working seat system: a 2D seat matrix synced with the 3D scene, a graduate who books a seat in their own zone and gets a seat card with a QR code, and a guest who finds a stand seat by ticket number and a graduate by name, ID or share code.

**Architecture:**
- Three mock services hold the data: a directory of 2,986 generated graduates, a pitch-seat service whose occupancy follows the simulated clock, and a ticket service for the 5,000 stand seats. They are plain TypeScript with no React and no three.js.
- One HUD store holds the role, the inspected seat and the filters. The 3D scene, the 2D matrix and the panels all read it, which is what keeps them in step.
- The matrix is a 2D canvas drawn from the same seat layout as the 3D scene, so one seat index means the same seat everywhere.

**Tech Stack:** React 19, TypeScript 6, zustand 5, three 0.187, @react-three/fiber 9, GSAP 3, Tailwind 4, qrcode 1.5, @base-ui/react 1.9 (dialog), Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-11-10-stadiview-design.md` (sections 9 and 11). Phase 2's results and conventions: `docs/superpowers/plans/2026-11-10-stadiview-phase2.md`, "Implementation notes".

**Out of scope here (Phase 4):** avatars, the gold sightline arc, the animated gate-to-seat route, bloom, the "fill the stadium" switch. Phase 3 gives the gate, the distance and the bearing as text; Phase 4 draws them.

## Decisions in this plan that need the requester's approval

Each has a default the plan is written to. Say which to change.

| # | Question | Default in this plan |
|---|---|---|
| A | What does a click on a seat in the 2D matrix do? | It **inspects** the seat: the seat is marked in 3D, the inspector opens with a picture of the view, and "View from this seat" flies in. The design said every matrix click flies; browsing seats would then mean a 2.6 s flight per tap. A click on a seat in 3D still flies in, as approved. |
| B | When can a graduate book? | During the ticket window of the simulated clock (14 March to 1 April 2027). Outside it the page is view-only and says when booking opens or that it has closed. A labelled demo button jumps the clock into the window. |
| C | Where do the other 2,985 graduates' seats come from? | From the simulated clock: nobody has booked when the window opens and about 96% have by its end. Scrubbing time back empties seats again. A labelled demo button lets "another student" take the seat you are looking at, to show the conflict message. |
| D | The existing "choose seats for your family" page | It stays as it is. The gate wording across the site is updated to the Batch 56 allocation so the two do not contradict each other, and the pages link to each other. Merging the two seat models is left for later. |
| E | Ticket numbers | `TICKET-G{gate}-{serial}`: the serial counts the stand seats served by that gate, so `TICKET-G1-204` is south stand, row 2, seat 84. |
| F | What a guest sees when searching by name | Name, college and degree, with the ID partly hidden (`2019••••40`). The seat is shown only when that graduate's locator is on; otherwise the page asks for the Family Share Code, which always works. Mock graduates start with the locator on. |
| G | The persona "grad-m-none" belongs to General Studies, which has no seating zone | Move that persona to the Business School, so every graduate persona can book. |
| H | Does a booking survive a page reload? | No. Like every other mock service on the site it lives in memory; the demo console's reset clears it. |

## Global Constraints

- All code is original. No new runtime dependencies.
- Every number about the venue comes from `src/features/stadiview/config/venue.ts`. Every number about the mock data (how many are booked by when, share-code length, tickets per gate) is a named constant in the service that owns it.
- A seat is always its **index** in `getVenue()` (0 to 7,997). Ids such as `P3-12-07` are for people and for tests; `idOf` and `indexOf` convert.
- Domain time comes from `src/time/clockStore.ts` (`getNow`, `useNow`). No `Date.now()`, no `new Date()` without an argument.
- Services return `Result<T, E>` from `src/domain/types.ts` for anything that can be refused, with the error as a short code the UI translates.
- Palette and HUD shapes are Phase 2's: plates and cards under `[data-theme='stadiview']`, text on gold or green fills in `--sv-night`.
- Seat state colours, in 3D and in the matrix alike: available `#009C5A`; taken by someone else `#1F3F38`; the viewer's own seat `#E7A614`; hovered or inspected `#E7A614`; stand seats `#005A50`; the lettering `#E8DEC3`. In graduate mode, pitch seats outside the graduate's zone are drawn at 45% strength.
- The exact HUD note: "Your booked Row & Seat automatically assigns your exact position in your College's Procession Lineup — Confirmed with Student Affairs."
- The exact button labels from the brief: "Confirm & book my seat" and "Back to stadium overview" (shown in capitals in English by the existing `sv-button--cta` class).
- Gates: male graduates Gate 2, female graduates Gate 5, families Gate 1, individual guests Gate 2, guests with disabilities Gate 3, staff, faculty and VIP guests Gate 4.
- Everything a panel can do must be possible without the 3D canvas: by keyboard, by screen reader, and on a device without WebGL.
- Arabic is the default language. New strings go in `src/features/stadiview/i18n/ar.ts` and `en.ts` (Task 1). Arabic strings contain no Latin letters except KFUPM, QR, VIP, PDF and `{params}`. No letter-spacing on Arabic text.
- Phone (390 px): one panel open at a time, as a sheet from the bottom; touch targets at least 44 px; nothing scrolls sideways.
- Everything simulated is labelled as simulated where the user meets it.
- The landing page's download must not grow by more than 2 KB gzipped over the whole of StadiView (it stands at +1.15 KB). StadiView's own code stays under 120 KB gzipped.
- Browser tests use `?tier=1` and the debug hook. Booking tests use `&t=2027-03-20T10:00` (inside the window) and `&persona=…`.

## Review Focus

1. **Two things happen at once.** The seat a graduate is confirming is taken by someone else a moment before. They get a clear message, the seat turns "taken", their old seat (if any) is still theirs, and they can pick again. Pinned in Tasks 3 and 7.
2. **Time is scrubbed backwards or forwards after booking.** The graduate keeps their seat; no simulated student ever sits in it; the counts stay consistent. Pinned in Task 3.
3. **A search finds nothing, one person, or forty people with the same family name.** The guest sees "no match", the one result, or the first eight with a count of the rest, and can never see a seat for someone whose locator is off. Pinned in Tasks 2, 4 and 9.
4. **A mistyped or malformed ticket or seat id** (`ticket-g1-204`, `TICKET-G1-99999`, `TICKET-G9-1`, Arabic digits, spaces). The lookup accepts what is unambiguous and explains what is wrong with the rest. Pinned in Task 4.
5. **The persona changes while a seat is inspected or a dialog is open.** The panels follow the new persona; nothing shows the previous person's seat as "mine". Pinned in Tasks 5 and 8.

---

### Task 1: The stadium's words load with the stadium

Phase 3 adds about 150 strings. In the site's main dictionaries they would be downloaded by the landing page.

**Files:**
- Modify: `src/i18n/index.ts`
- Create: `src/features/stadiview/i18n/en.ts`, `src/features/stadiview/i18n/ar.ts`, `src/features/stadiview/i18n/index.ts`
- Modify: `src/i18n/en.ts`, `src/i18n/ar.ts` (remove every `sv.*` key; `nav.stadium` stays)
- Modify: `src/features/stadiview/StadiViewPage.tsx` (import the stadium dictionary)
- Modify: `tests/unit/i18nParity.test.ts`
- Test: `tests/unit/i18nRegister.test.ts`

**Interfaces:**
- Produces: `registerMessages(messages: Record<Locale, Record<string, string>>): void` in `src/i18n/index.ts`. It adds keys to both dictionaries; a key that already exists with a different value throws in development. `src/features/stadiview/i18n/index.ts` calls it once on import.

- [ ] **Step 1: Write failing tests.**
  - `registerMessages` makes a new key translatable in both languages; registering the same messages twice is harmless; a conflicting value throws.
  - The parity test's three rules (same keys, masculine and feminine pairs, no Latin letters in Arabic) also run over the stadium dictionaries.
  - No key in the site dictionaries starts with `sv.`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement,** moving the existing `sv.*` keys unchanged.
- [ ] **Step 4: Run** `npx vitest run`, `npx playwright test tests/e2e/stadiview.spec.ts`, then `npm run build && node scripts/landing-weight.cjs`. The landing download must be smaller than before this task.
- [ ] **Step 5: Commit** (`refactor(stadiview): load the stadium's strings with the stadium`)

### Task 2: The graduate directory

**Files:**
- Create: `src/features/stadiview/data/names.ts` (first names by gender and family names, Arabic and English, mock only)
- Create: `src/features/stadiview/data/graduateDirectory.ts`
- Create: `src/features/stadiview/data/textSearch.ts`
- Modify: `src/data/fixtures/graduates.ts` (decision G: `grad-m-none` moves to `business`)
- Test: `tests/unit/stadiview/graduateDirectory.test.ts`, `tests/unit/stadiview/textSearch.test.ts`

**Interfaces:**
- Consumes: `getVenue().zones`, `VENUE`, `PERSONAS`, `COLLEGE_ID`.
- Produces:
  - `interface Graduate { index: number; studentId: string; name: { ar: string; en: string }; gender: 'f' | 'm'; zone: number; lineup: number; shareCode: string; personaId: string | null }`. `zone` is an index into `getVenue().zones`.
  - `getDirectory(): { count: number; all: Graduate[]; byPersona(id: string): Graduate | null; byStudentId(id: string): Graduate | null; byShareCode(code: string): Graduate | null; inZone(zone: number): Graduate[] }`, built once.
  - `searchGraduates(query: string, limit?: number): { matches: Graduate[]; total: number }`: by student ID (digits, 3 or more) or by name in either language. Default limit 8.
  - `maskStudentId(id: string): string` ("201912340" gives "2019•••40").
  - `normalise(text: string): string` in `textSearch.ts`: lower case; Arabic diacritics and tatweel removed; أ إ آ to ا; ى to ي; ة to ه; Arabic-Indic digits to Latin; runs of spaces to one.

Rules:
- Exactly as many graduates per zone as the zone's head count: 2,986 in all, 629 women and 2,357 men.
- Generated from a fixed seed, so every visit sees the same people.
- Student IDs are nine digits, unique, starting with an entry year from 2019 to 2023. Share codes are `KF-XXXX-XX` from letters and digits that cannot be confused (no 0, O, 1, I), unique.
- Every graduate persona takes the first place of its own zone (its college, its gender, bachelor), keeping the persona's name.

- [ ] **Step 1: Write failing tests.**
  - Counts: 2,986; per zone equal to `getVenue().zones[z].count`; per gender 629 and 2,357.
  - IDs and share codes are unique and match their patterns; two builds are identical.
  - Each of the ten graduate personas is found by `byPersona`, in a zone of its own college and gender, with its own name.
  - `normalise('أَحْمَد')` equals `normalise('احمد')`; `normalise('  Al-Otaibi ')` equals `'al-otaibi'`; `normalise('٢٠١٩')` is `'2019'`.
  - Search: a full ID gives exactly that graduate; a family name gives several, capped at the limit, with the true total; Arabic and English spellings of one persona both find it; an empty query, one letter, or two digits give none.
  - Review Focus 3: a query matching more than 8 returns 8 and the right `total`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadiview): a directory of 2,986 mock graduates with search`)

### Task 3: The pitch-seat service

**Files:**
- Create: `src/features/stadiview/data/pitchSeatService.ts`
- Create: `src/features/stadiview/data/bookingWindow.ts`
- Modify: `src/features/demo-console/resetData.ts` (a registry, so the console can reset services it does not import)
- Test: `tests/unit/stadiview/pitchSeatService.test.ts`, `tests/unit/stadiview/bookingWindow.test.ts`

**Interfaces:**
- Consumes: `getDirectory`, `getVenue`, `SeatKind`, `NO_ZONE`, `SCHEDULE`, `Result`.
- Produces:
  - `bookingWindow(schedule?): { opens: number; closes: number }` (the `tickets` stage) and `bookingPhase(now: number): 'before' | 'open' | 'closed'`.
  - `type SeatStatus = 'available' | 'taken' | 'mine'`
  - `createPitchSeatService(opts?: { seed?: number }): PitchSeatService` and the shared `pitchSeatService`.
  - `PitchSeatService`:
    - `statusOf(seat: number, viewer: Graduate | null, now: number): SeatStatus`
    - `occupantOf(seat: number, now: number): Graduate | null`
    - `seatOf(graduate: Graduate, now: number): number` (−1 for none)
    - `canBook(seat: number, graduate: Graduate, now: number): Result<true, BookError>`
    - `book(seat: number, graduate: Graduate, now: number): Result<{ seat: number; released: number }, BookError>` (`released` is the seat given up, or −1)
    - `release(graduate: Graduate, now: number): Result<number, 'none' | 'closed'>`
    - `setNeedsBay(graduate: Graduate, value: boolean): void` and `needsBay(graduate: Graduate): boolean`
    - `rivalTakes(seat: number, now: number): boolean` (demo: another student takes this free seat now)
    - `counts(now: number): { booked: number; total: number; byZone: number[] }`
    - `reset(): void`, `version(): number`, `subscribe(fn: () => void): () => void`
  - `type BookError = 'before' | 'closed' | 'taken' | 'wrong-zone' | 'not-a-pitch-seat' | 'bay-not-needed' | 'wrong-block' | 'same-seat'`
  - `usePitchSeats(): number` (a hook that re-renders on every change and returns the version)
  - `registerReset(fn: () => void): void` exported from `resetData.ts`; `resetDemoData()` calls every registered function.

How occupancy works (decision C). It is a pure function of the clock and of what real users did:
- Each simulated graduate has a fixed **booking moment** spread over the window (seeded; early-heavy, about 96% by the close) and a fixed **preferred seat** (a seeded shuffle of their zone's seats, one seat each).
- At time `now`, the seats of users who booked through `book` are placed first. Then each simulated graduate whose moment has passed takes their preferred seat, or, if a user holds it, the first seat of their zone that nobody prefers.
- A graduate persona who has not booked has no seat, whatever the time.
- `rivalTakes` moves one simulated graduate's moment to `now`.
- Results are cached per (version, minute of `now`).

Rules of `book`: only in the window; only a pitch seat of the graduate's own zone, or a wheelchair bay of a block of their gender when `needsBay` is on; not a taken seat; booking a second seat releases the first in the same step.

- [ ] **Step 1: Write failing tests.**
  - Before the window nobody is seated; at the close between 94% and 98% are; the share never falls as time advances.
  - At any time no seat has two occupants and nobody has two seats (checked at 20 moments across the window).
  - Every simulated graduate sits in their own zone, at every one of those moments.
  - `book` succeeds for a free seat in the persona's zone; `statusOf` is then `'mine'` for them and `'taken'` for anyone else; `seatOf` returns it.
  - Each refusal: `'before'`, `'closed'`, `'taken'`, `'wrong-zone'`, `'not-a-pitch-seat'` (a stand seat), `'bay-not-needed'`, `'wrong-block'` (a woman on a men's block bay), `'same-seat'`.
  - Booking a second seat returns the first in `released`, and the first is free again.
  - **Review Focus 1:** `rivalTakes(seat)` then `book(seat)` gives `'taken'`, and the persona's earlier seat is unchanged.
  - **Review Focus 2:** after a persona books seat X early in the window, at every later moment X is theirs, and the simulated graduate who preferred X sits elsewhere in the zone; moving the clock back before the booking still shows X as theirs (a booking is not undone by time).
  - Two personas of the same zone cannot hold the same seat.
  - `reset()` clears user bookings, rival moves and bay needs; `registerReset` hooks it to `resetDemoData`.
  - `subscribe` fires once per change and not for a refused booking.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests,** then time `statusOf` for all 7,998 seats at a fresh minute: under 5 ms.
- [ ] **Step 5: Commit** (`feat(stadiview): pitch seat booking service on the simulated clock`)

### Task 4: Tickets, the locator, and bearings

**Files:**
- Create: `src/features/stadiview/data/ticketCodec.ts`
- Create: `src/features/stadiview/data/guestTicketService.ts`
- Create: `src/features/stadiview/data/locatorService.ts`
- Create: `src/features/stadiview/engine/bearing.ts`
- Test: `tests/unit/stadiview/ticketCodec.test.ts`, `tests/unit/stadiview/guestTicketService.test.ts`, `tests/unit/stadiview/locatorService.test.ts`, `tests/unit/stadiview/bearing.test.ts`

**Interfaces:**
- Produces:
  - `ticketFor(seat: number): string | null` and `parseTicket(text: string): Result<number, 'format' | 'gate' | 'range'>`. Serial numbers count the stand seats of one gate in layout order (decision E). Parsing ignores case, spaces and the kind of dash, and accepts Arabic-Indic digits.
  - `interface GuestTicket { ticket: string; seat: number; gate: GateId; parking: 'P1' | 'P2' | 'P3' | 'P4'; arriveBy: number; graduate: Graduate | null }`
  - `guestTicketService.lookup(text: string): Result<GuestTicket, 'format' | 'gate' | 'range'>`, `.forSeat(seat: number): GuestTicket | null`, `.ticketsOf(graduate: Graduate): GuestTicket[]`, `.demoTickets(): string[]` (one per stand)
  - `locatorService.setAllowed(graduate: Graduate, allowed: boolean): void`, `.isAllowed(graduate): boolean`, `.reset()`
  - `locatorService.locate(by: { graduate: Graduate } | { shareCode: string }, now: number): Result<{ graduate: Graduate; seat: number }, 'locator-off' | 'no-seat-yet' | 'unknown-code'>`
  - `bearingBetween(from: Vec3, to: Vec3): { distance: number; degrees: number; point: CompassPoint }` (degrees clockwise from north; north is −Z, east is +X; `CompassPoint` is one of 16 names such as `'NNE'`)
  - `relativeToStage(eye: Vec3, target: Vec3, stage: Vec3): { side: 'left' | 'right' | 'ahead'; degrees: number; tilt: 'up' | 'down' | 'level' }`

Rules:
- Family tickets: every graduate has two tickets in the stands of gates 1 and 2 (5,972 would not fit 4,500 seats, so tickets are dealt in line-up order until those stands are full; the rest have none, and `ticketsOf` returns what exists). VIP and accessibility tickets have no graduate.
- Parking follows the gate. `arriveBy` is the arrival stage's close in `SCHEDULE`.
- A share code always locates. A name or ID locates only when the locator is on (decision F). A graduate with no seat gives `'no-seat-yet'`.

- [ ] **Step 1: Write failing tests.**
  - `ticketFor` and `parseTicket` round-trip for all 5,000 stand seats; pitch seats give null; tickets are unique.
  - `TICKET-G1-204` is `S-02-084`.
  - **Review Focus 4:** `ticket-g1-204`, ` TICKET G1 204 `, `TICKET–G1–204` and `TICKET-G١-٢٠٤` all parse; `TICKET-G1-99999` is `'range'`; `TICKET-G9-1` and `TICKET-G5-1` (no stand uses gate 5) are `'gate'`; `G1-204`, `TICKET-G1-`, `TICKET-G1-0` and an empty string are `'format'`.
  - Every stand seat has exactly one ticket; the gate on it is the gate of its stand in `VENUE`.
  - Linked graduates: at most two tickets each; no VIP or accessibility ticket has one.
  - **Review Focus 3:** with the locator off, locating by graduate is `'locator-off'` and by share code succeeds; an unknown code is `'unknown-code'`; a graduate with no seat is `'no-seat-yet'` either way.
  - Bearings: due north, east, south and west give 0, 90, 180, 270 and `N`, `E`, `S`, `W`; distance is the straight line; from the middle of the south stand, a seat left of the stage reports `'left'` with the right angle to within a degree.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadiview): guest tickets, the family locator and bearings`)

### Task 5: Roles, seat states in 3D, and the inspected seat

**Files:**
- Create: `src/features/stadiview/state/hudStore.ts`
- Create: `src/features/stadiview/state/useViewer.ts`
- Create: `src/features/stadiview/hud/RoleSwitch.tsx`
- Create: `src/features/stadiview/scene/SeatMarker.tsx`
- Modify: `src/features/stadiview/scene/seatColors.ts`, `src/features/stadiview/scene/Seats.tsx`, `src/features/stadiview/scene/usePointerPicking.ts`, `src/features/stadiview/scene/StadiumCanvas.tsx`
- Modify: `src/features/stadiview/StadiViewPage.tsx`, `src/features/stadiview/stadiview.css`, `src/features/stadiview/debugHook.ts`, `src/features/stadiview/hud/SeatTooltip.tsx`
- Test: `tests/unit/stadiview/hudStore.test.ts`, `tests/unit/stadiview/seatColors.test.ts`, `tests/e2e/stadiview-hud.spec.ts`

**Interfaces:**
- Produces:
  - `useHud`: `{ role: 'graduate' | 'guest'; inspected: number; panel: 'none' | 'matrix' | 'inspector' | 'mine' | 'guest'; filters: { college: CollegeCode | null; degree: Degree | null; availableOnly: boolean; accessibleOnly: boolean }; setRole; inspect(seat: number); setPanel; setFilters(partial); reset() }`
  - `useViewer(): { role: 'graduate' | 'guest'; graduate: Graduate | null; now: number }`: the signed-in persona's directory entry when the role is graduate, else null.
  - `colorFor(i, v, s: { hover: number; selected: number; inspected: number; status: SeatStatus; dimmed: boolean }): string` and `SEAT_COLORS.taken = '#1F3F38'`, `SEAT_COLORS.mine = '#E7A614'`.
  - `<SeatMarker />`: a thin gold beam and a ground ring on the inspected seat while the camera is in the overview.
  - Debug hook additions: `inspect(seatId)`, `hud(): { role; inspected: string | null; panel }`, `status(seatId): SeatStatus`.

Behaviour:
- The role follows the persona: a graduate persona opens in graduate mode, anyone else in guest mode. The switch in the top row changes it; choosing "Graduate" as a guest signs in the default graduate persona, as the site header's "Sign in" does.
- A click on a seat in 3D sets `inspected` and flies in, as now. `inspect(-1)` and "Back" clear it.
- Seats repaint when the service version, the minute, the role, the persona or the filters change.
- The tooltip's status reads "Available", "Taken" or "Your seat".
- **Review Focus 5:** changing persona clears `inspected` if it was the previous person's seat marked "mine", and repaints.

- [ ] **Step 1: Write failing tests.**
  - Unit: the store's defaults and each action; `reset()`.
  - Unit: `colorFor` for each status, with and without dimming; gold wins for hover and inspection.
  - e2e (`&t=2027-03-20T10:00&persona=grad-m-gold`): the role switch shows "Graduate" selected; `status()` of a seat taken at that time is `'taken'`; hovering it shows "Taken" in the tooltip.
  - e2e: with `persona=guest` the page opens in guest mode; switching to "Graduate" signs in.
  - e2e: `inspect('P3-12-07')` leaves the mode `'orbit'` and `hud().inspected` is that seat.
  - e2e: switching persona in the demo console changes the role chip's name and clears a "mine" inspection.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** Read the `impeccable` craft floor first for the role switch (two plates, the selected one filled gold).
- [ ] **Step 4: Run the tests,** then look at a screenshot at mid-window: the pitch should read as a mix of taken and free seats, with the persona's zone at full strength.
- [ ] **Step 5: Commit** (`feat(stadiview): roles, seat states and the inspected seat`)

### Task 6: The 2D seat matrix

**Files:**
- Create: `src/features/stadiview/engine/planIndex.ts` (which seat is at a point of the plan)
- Create: `src/features/stadiview/engine/planView.ts` (pan, zoom and fit, as arithmetic)
- Create: `src/features/stadiview/hud/SeatMatrix.tsx`, `src/features/stadiview/hud/matrixDraw.ts`, `src/features/stadiview/hud/MatrixFilters.tsx`
- Modify: `src/features/stadiview/scene/CameraRig.tsx` (publish the camera's ground position and heading), `src/features/stadiview/StadiViewPage.tsx`, `src/features/stadiview/stadiview.css`
- Test: `tests/unit/stadiview/planIndex.test.ts`, `tests/unit/stadiview/planView.test.ts`, `tests/e2e/stadiview-matrix.spec.ts`

**Interfaces:**
- Produces:
  - `seatAtPlan(x: number, z: number, v: VenueLayout, reach?: number): number`: the seat whose centre is nearest the point, within `reach` metres (default 0.35), else −1. Built on a one-metre grid, made once per layout.
  - `interface PlanView { cx: number; cz: number; scale: number }` (metres at the centre, pixels per metre)
  - `fitView(bounds: { x0; z0; x1; z1 }, width: number, height: number, pad?: number): PlanView`, `zoomAt(view, factor, px, py, width, height): PlanView` (clamped to 1.5 to 40 pixels per metre), `panBy(view, dx, dy): PlanView`, `toPlan(view, px, py, width, height): [number, number]`, `toScreen(view, x, z, width, height): [number, number]`
  - `planBounds(v, what: 'all' | 'pitch' | { zone: number } | { section: number }): { x0; z0; x1; z1 }`
  - `cameraOnPlan` channel: `{ x: number; z: number; heading: number; mode: CameraMode }`, published by the rig at most ten times a second.
  - The card: `[data-seat-matrix]` with `data-inspected`, `data-hover` and `data-scale` attributes for tests; the canvas inside is `role="img"` with a text summary.

Behaviour:
- A card at the bottom inline-start corner, 360 by 300 px on desktop, with a header (title, counts "1,204 of 2,986 booked", collapse button) and the strip of Matrix bars.
- North is up, the stage on the left. It is a map, so it is not mirrored in Arabic.
- Every seat is a square in its state colour. Below 3 pixels per metre, pitch blocks and stands are drawn as filled shapes with the lettering instead of 7,998 squares.
- Drag pans, wheel and pinch zoom about the pointer, buttons zoom and fit ("Whole stadium", "Pitch", "My zone").
- Hovering a seat sets the shared hover, so the 3D seat turns gold and the tooltip shows by the pointer; hovering in 3D rings the seat in the matrix.
- A click inspects (decision A). A double click, or Enter, flies in.
- A small arrow shows where the 3D camera is and which way it looks; in first person it sits on the seat.
- Filters: college, degree, "available only", "wheelchair bays". Seats that do not match are drawn at 25%. The same filters dim the 3D seats.
- A search box takes a seat id (`P3-12-07`, or `3 12 7`) and inspects it, or says it does not exist.
- Redraws happen at most once per animation frame and only when something changed.

- [ ] **Step 1: Write failing tests.**
  - Unit: `seatAtPlan` agrees with a brute-force nearest-seat search on 5,000 seeded points across the venue, including aisles (−1) and the gap between two blocks.
  - Unit: `toPlan` and `toScreen` are inverses; `zoomAt` keeps the point under the pointer fixed; the scale never leaves 1.5 to 40; `fitView` contains its bounds with the padding.
  - e2e: the matrix shows; its counts match `pitchSeatService.counts` at that time.
  - e2e: clicking the matrix at the plan position of `P3-12-07` (through a `matrixPoint(seatId)` debug helper) sets `hud().inspected`, leaves the mode `'orbit'`, and the 3D marker's seat is the same.
  - e2e: hovering there sets `state().hover` to that seat; hovering the seat in 3D sets `data-hover` on the matrix.
  - e2e: a double click flies in (`mode` becomes `'pov'`).
  - e2e: the wheel changes `data-scale` and the seat under the pointer stays the same seat.
  - e2e: "available only" reduces the bright seats; "My zone" fits the persona's zone.
  - e2e: searching `P3-12-07` inspects it; `P9-01-01` shows the "no such seat" line.
  - e2e (`lang=ar`): the card is at the right-hand bottom corner and the map is not mirrored (the stage is still on the left).
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** Read `emil-design-eng` and the `impeccable` craft floor first.
- [ ] **Step 4: Run the tests,** then look at screenshots at three zoom levels and in Arabic.
- [ ] **Step 5: Commit** (`feat(stadiview): the 2D seat matrix, in step with the 3D scene`)

### Task 7: The inspector and the booking flow

**Files:**
- Create: `src/features/stadiview/hud/Inspector.tsx`, `src/features/stadiview/hud/seatFacts.ts`, `src/features/stadiview/hud/SeatPreview.tsx`
- Create: `src/features/stadiview/scene/PreviewCamera.tsx`
- Modify: `src/features/stadiview/scene/StadiumCanvas.tsx`, `src/features/stadiview/StadiViewPage.tsx`, `src/features/stadiview/stadiview.css`
- Test: `tests/unit/stadiview/seatFacts.test.ts`, `tests/e2e/stadiview-booking.spec.ts`

**Interfaces:**
- Consumes: `pitchSeatService`, `useViewer`, `useHud`, `seatWords`, `guestTicketService`, `bearingBetween`.
- Produces:
  - `seatFacts(seat: number, v, cfg): { toStage: number; stageAngle: number; gate: GateId; toAisle: number; clearView: boolean }`: metres to the podium, degrees off the stage's centre line, the entry gate, metres to the nearest aisle, and whether the line to the podium is clear of the backdrop and screens.
  - `requestPreview(seat: number, look?: Look): void` and `onPreview(fn: (image: ImageBitmap | ImageData, seat: number) => void)`: the scene renders the view from a seat into a 320 by 200 target and hands the picture over.
  - The card: `[data-sv-inspector]`; the primary button `[data-sv-book]`.

Behaviour:
- The inspector opens at the inline-end side whenever a seat is inspected, in the overview and in first person.
- It shows: the seat's place; the college (with its colour) and degree; the state; the picture of the view; the three facts ("32 m to the stage, 8° right of centre", "Enter by Gate 2", "3 m to the aisle").
- The picture is drawn once when the seat changes. Dragging on it turns the view and redraws: live on tier 3, on release on tiers 1 and 2. On tier 0 an illustrated card with the facts takes its place.
- "View from this seat" flies in; in first person it is "Back to stadium overview".
- Graduate mode, by state of `canBook`:
  - bookable: **Confirm & book my seat**, and under it the procession note from Global Constraints
  - their own seat: "This is your seat" with "Show my seat card" and "Release this seat"
  - taken: "Taken" and "Pick a free seat in your zone"
  - another zone: "This seat belongs to {college} · {degree}. Yours is {college} · {degree}." with "Show my zone"
  - before or after the window: when booking opens or that it closed, and the labelled demo button that jumps the clock into the window (decision B)
  - a stand seat: its ticket number and gate, and "Graduates sit on the pitch"
- Guest mode: a "View-only mode" line in place of the button.
- When a graduate already has a seat and books another, the button reads "Move to this seat" and a line says which seat will be released.
- **Review Focus 1:** if the seat is taken between opening the inspector and pressing the button, the button's result is the message "Someone took this seat a moment ago. Choose another." and the card updates to "Taken". A labelled demo control, "Let another student take it", triggers this.

- [ ] **Step 1: Write failing tests.**
  - Unit: `seatFacts` for a front-centre seat (short distance, small angle, clear view), a corner seat of block 1 (larger angle), a seat of each gender (gates 5 and 2), and the aisle distance of a middle seat (half a block) against an end seat (half an aisle).
  - e2e (graduate, in the window): inspect a free seat of the persona's zone, press Confirm; `status()` is `'mine'`; the inspector says "This is your seat"; a toast confirms.
  - e2e: a seat of another zone shows the zone message and no Confirm button.
  - e2e: with a seat already booked, another free seat offers "Move to this seat"; after pressing, the first is `'available'`.
  - e2e: the demo "another student" control, then Confirm: the taken message; the earlier seat is still `'mine'`.
  - e2e: at `t=2027-03-01T10:00` the inspector says when booking opens; the demo button jumps into the window and the Confirm button appears.
  - e2e: guest mode shows "View-only mode" and no Confirm button.
  - e2e: the preview has a picture (its canvas is not blank) and `data-preview-seat` names the seat.
  - e2e: axe finds nothing serious with the inspector open.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** Read `emil-design-eng`, `animate` and the `impeccable` craft floor first.
- [ ] **Step 4: Run the tests,** then look at screenshots of each state, in both languages.
- [ ] **Step 5: Commit** (`feat(stadiview): the seat inspector and booking`)

### Task 8: The seat card, the pass, and "My seat"

**Files:**
- Create: `src/features/stadiview/hud/SeatCardDialog.tsx`, `src/features/stadiview/hud/SeatCard.tsx`, `src/features/stadiview/hud/passImage.ts`, `src/features/stadiview/hud/MySeatPanel.tsx`
- Create: `src/features/stadiview/data/passCode.ts`
- Modify: `src/features/stadiview/StadiViewPage.tsx`, `src/features/stadiview/stadiview.css` (including a print sheet)
- Test: `tests/unit/stadiview/passCode.test.ts`, `tests/e2e/stadiview-pass.spec.ts`

**Interfaces:**
- Produces:
  - `passCode(graduate: Graduate, seat: number): string` (`KFUPM57|SEAT|P3-12-07|201912340|K7`, the last part a check value) and `readPassCode(text): Result<{ seatId: string; studentId: string }, 'format' | 'check'>`
  - `drawPass(words, qrModules): HTMLCanvasElement` and `downloadPass(canvas, fileName): void` (a PNG, 1080 by 1500)
  - `[data-sv-seat-card]`, `[data-sv-my-seat]`

Behaviour:
- Booking opens a dialog: "Your seat is booked", the Digital Seat Card, and confetti through the existing `celebrate('task', …)`.
- The card, on a white ground for scanning at the gate: the graduate's name; block, row and seat; college and degree; the gate (2 or 5) and "Arrive by"; the place in the procession ("Line-up position 127 of 342 in your college group"); the QR code; "Mock pass for the demo".
- "Print or save as PDF" prints only the card, on one page. "Download the pass" saves the PNG, which then works without a connection.
- "My seat" (graduate mode, a plate under the top row that opens a card): name, zone, the booked seat or "No seat yet", then:
  - "Show my seat" (fly in), "Seat card", "Change seat" (fits the matrix to the zone), "Release"
  - the procession note
  - the **Family Share Code** badge with a copy button
  - the switch **Allow Family Seat Locator (Privacy Opt-In)**, with one line saying what it does
  - the switch "I use a wheelchair", which opens the bays to booking
- **Review Focus 5:** switching persona with the dialog open closes it; the panel shows the new person.

- [ ] **Step 1: Write failing tests.**
  - Unit: `passCode` and `readPassCode` round-trip; a changed character fails with `'check'`; nonsense fails with `'format'`.
  - e2e: after a booking the dialog shows the persona's name, "Block", "Row", "Seat", "Gate 2" (male persona) or "Gate 5" (female), and a QR code whose `aria-label` names the seat.
  - e2e: with `worst=1` the long name wraps inside the card at 390 px and nothing scrolls sideways.
  - e2e: under `page.emulateMedia({ media: 'print' })` only the card is visible.
  - e2e: "Download the pass" starts a download named `kfupm-seat-pass-<seat id>.png`.
  - e2e: the share code matches `KF-…`; copying puts it on the clipboard; turning the locator off is remembered when the panel is reopened.
  - e2e: "Release" frees the seat and the panel says "No seat yet".
  - e2e: with "I use a wheelchair" on, a bay of the persona's block can be booked; with it off the inspector explains why not.
  - e2e: axe on the dialog and on the panel.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement,** on the site's existing `Dialog` and `QrSvg`.
- [ ] **Step 4: Run the tests,** then look at the card on a phone and at the downloaded PNG.
- [ ] **Step 5: Commit** (`feat(stadiview): the digital seat card, the pass and My seat`)

### Task 9: The guest tools

**Files:**
- Create: `src/features/stadiview/hud/GuestPanel.tsx`, `src/features/stadiview/hud/TicketLookup.tsx`, `src/features/stadiview/hud/GraduateSearch.tsx`, `src/features/stadiview/hud/SightlineReadout.tsx`
- Modify: `src/features/stadiview/StadiViewPage.tsx`, `src/features/stadiview/hud/Inspector.tsx`, `src/features/stadiview/stadiview.css`
- Test: `tests/e2e/stadiview-guest.spec.ts`

**Interfaces:**
- Consumes: `guestTicketService`, `searchGraduates`, `locatorService`, `bearingBetween`, `relativeToStage`, `useHud`.
- Produces: `[data-sv-guest]`, `[data-sv-ticket-input]`, `[data-sv-graduate-search]`, `[data-sv-sightline]`; `useHud` gains `guest: { ticketSeat: number; graduate: number }` and their setters.

Behaviour:
- Guest mode shows the panel in place of "My seat", with two parts.
- **My ticket.** A box for the ticket number with the hint "For example TICKET-G1-204", and chips of demo tickets. A valid ticket inspects the seat, shows gate, parking and arrival time, and offers "View from my seat". A wrong one says which part is wrong (Review Focus 4). If the ticket is linked to a graduate, "Find my graduate" fills the second part.
- **Locate my graduate.** One box for a name or a student ID, a college picker, and a link "I have a Family Share Code". Results list name, college, degree and the masked ID; more than eight shows "and 32 more: add a second name or the ID".
- Choosing a result: the graduate's seat is inspected and marked, with "Fly to their seat"; or "{name} has not booked a seat yet. Their group sits in Block 3, rows 9 to 15." with the zone highlighted; or "{name} has not turned on the family locator. Ask them for their Family Share Code." with the code box.
- With both a ticket seat and a located graduate: the readout "{name} is 96 m from your seat, to the south-west. From your seat, look 24° left of the stage, slightly down." and "View from my seat, facing them" (first person from the ticket seat, turned to the graduate). The gold arc itself is Phase 4.
- Nothing in guest mode can book, release or change anything.

- [ ] **Step 1: Write failing tests.**
  - e2e: typing `TICKET-G1-204` inspects `S-02-084` and shows "Gate 1"; "View from my seat" reaches first person at that seat's eye point.
  - e2e: `ticket-g1-204` works; `TICKET-G1-99999` says the number is too high for that gate; `TICKET-G9-1` says there is no such gate; `hello` shows the format.
  - e2e: a demo chip fills the box and looks it up.
  - e2e: searching a persona's English name, then its Arabic name, lists that person with a masked ID; choosing them at a time when they have booked marks their seat.
  - e2e: a family name with many matches shows eight and the "more" line.
  - e2e: no match shows the "no graduate found" line.
  - e2e: with that graduate's locator off, the result asks for the share code; the right code shows the seat; a wrong one says so.
  - e2e: a graduate without a seat shows the zone message, and the matrix is fitted to that zone.
  - e2e: with a ticket and a graduate, the readout has a distance in metres and a compass word; "facing them" ends in first person with the view direction within 2° of the graduate's seat.
  - e2e (`lang=ar`): the same flow reads in Arabic, with Latin digits.
  - e2e: axe on the panel.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** Read the `impeccable` craft floor first.
- [ ] **Step 4: Run the tests,** then look at screenshots of each outcome.
- [ ] **Step 5: Commit** (`feat(stadiview): ticket lookup and Locate my graduate`)

### Task 10: Without the canvas, on a phone, and without WebGL

**Files:**
- Create: `src/features/stadiview/hud/SeatFinder.tsx`, `src/features/stadiview/hud/Sheet.tsx`, `src/features/stadiview/hud/Dock.tsx`
- Modify: `src/features/stadiview/hud/SeatMatrix.tsx`, `src/features/stadiview/hud/Inspector.tsx`, `src/features/stadiview/StadiViewPage.tsx`, `src/features/stadiview/stadiview.css`
- Test: `tests/e2e/stadiview-access.spec.ts`

**Interfaces:**
- Produces: `[data-sv-finder]`; `<Sheet>` (a bottom sheet for phones: a card that slides up, with a close button and focus kept inside while open); `[data-sv-dock]` (the phone's row of buttons: Seats, My seat or Guest, and the inspector when a seat is inspected).

Behaviour:
- **Seat finder.** A second tab in the matrix card, "List". Three selects (block or stand, row, seat) inspect a seat. In graduate mode, under them, the free seats of the graduate's zone as a list by row, each a button that inspects; arrow keys move along it. A live region announces the inspected seat and its state.
- **Keyboard.** Tab order: top row, matrix card, inspector, My seat or guest panel, then the canvas. Every flow in Tasks 7 to 9 can be finished without a pointer.
- **Phone.** At 640 px and below the cards become sheets and the dock appears at the bottom; one sheet is open at a time; the back button sits above the dock in first person. The matrix sheet is 60% of the screen's height.
- **No WebGL (tier 0), or after a lost context.** The matrix takes the whole screen with the panels beside or over it, and every flow works. "View from this seat" is replaced by the illustrated facts card. The lost-context message keeps its "Reload the 3D view" button.

- [ ] **Step 1: Write failing tests.**
  - e2e, keyboard only (graduate, in the window): open the list tab, pick a free seat from the zone list, press Confirm, reach the seat card. No mouse call in the test.
  - e2e, keyboard only (guest): type a ticket, then search a graduate and choose a result.
  - e2e: the live region's text changes to name the inspected seat.
  - e2e at 390 by 844, Arabic and English: the dock shows; opening "Seats" then "My seat" leaves one sheet open; nothing scrolls sideways; every button in the dock and the sheets is at least 44 px tall.
  - e2e at 390 by 844: a full booking, from the dock to the seat card.
  - e2e with WebGL switched off: the matrix fills the screen; a full booking and a ticket lookup both work; no canvas other than the matrix is attached.
  - e2e: axe on the list tab, on an open sheet, and on the no-WebGL page.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** Read `design-taste-frontend`'s phone rules (app-screens section 12) and the `impeccable` craft floor first.
- [ ] **Step 4: Run the tests,** then run the `break-ui` worst cases by hand (longest name, one-letter name, a full zone with no free seats, zero results, a 320 px screen) and fix what breaks.
- [ ] **Step 5: Commit** (`feat(stadiview): seat finder, phone sheets and the no-WebGL path`)

### Task 11: One gate story, checks, screenshots and notes

**Files:**
- Modify: `src/i18n/en.ts`, `src/i18n/ar.ts` (gate notes and the two sentences that name gates, to the allocation in Global Constraints)
- Modify: `src/features/graduate/Dashboard.tsx`, `src/features/graduate/Tickets.tsx`, `src/features/guest/Guide.tsx` (a link to the stadium: "Book your seat on the pitch", "See the stadium in 3D")
- Modify: `scripts/stadiview-stills.cjs`, `README.md`, this plan (implementation notes), `docs/superpowers/specs/2026-11-10-stadiview-design.md` (where this phase refined it)
- Test: `tests/e2e/stadiview-links.spec.ts`; existing specs that quote the old gate notes

- [ ] **Step 1: Write failing tests:** the guide's gate list reads Gate 2 "Individual guests and male graduates", Gate 4 "Staff, faculty and VIP guests", Gate 5 "Female graduates"; the dashboard and the tickets page each have a link that opens `/stadium` with the persona and time kept.
- [ ] **Step 2: Implement,** and update the existing tests that quoted the old wording.
- [ ] **Step 3: Type check and lint.** `npx tsc --noEmit && npm run lint` clean.
- [ ] **Step 4: All tests.** `npx vitest run` and `npx playwright test` pass.
- [ ] **Step 5: Build and budgets.** `npm run build && node scripts/landing-weight.cjs`: the landing download within +2 KB of its pre-StadiView size; StadiView's own code under 120 KB gzipped.
- [ ] **Step 6: Frame times** with the HUD open (`scripts/stadiview-frames.cjs`): the page's own work per frame stays under 6 ms at 4x slowdown, including a matrix redraw.
- [ ] **Step 7: Screenshots** in `docs/review/stadiview/`: the graduate view mid-window, the matrix zoomed in, the inspector on a bookable seat, the seat card, the guest panel with a located graduate, the phone with a sheet open, the no-WebGL page, each in the language that shows it best plus one Arabic and one English overview.
- [ ] **Step 8: Commit and push** (`chore(stadiview): Phase 3 checks, screenshots and notes`)

---

## Coverage of the design

| Design item (sections 9 and 11) | Task |
|---|---|
| Top row: role and profile switch | 5 |
| 2D seat matrix: pan, zoom, search, filters, two-way sync, camera marker | 6 |
| Inspector: place, college, view picture, three checks, primary button, view-only mode | 7 |
| Procession note, Family Share Code, locator switch, accessibility switch | 8 |
| After booking: seat card, QR, gate, printable and offline pass | 8 |
| Guest tools: ticket lookup with presets, graduate search, share code | 9 |
| Bearing, distance and the instruction relative to the stage | 4 (maths), 9 (readout) |
| Accessible path without the canvas | 10 |
| Device tier 0: the matrix fills the screen | 10 |
| `pitchSeatService`, `graduateDirectory`, `guestTicketService`, `locatorService` | 3, 2, 4, 4 |
| The demo console's reset clears these too | 3 |
| Left for Phase 4: the arc, the animated route, landmark chips in first person, avatars | — |

---

## Implementation notes (11 Nov 2026)

All eleven tasks were built in order, one commit each, without background workflows.

**Deviations from the plan**
- `Graduate` has no `lineup` field: the line-up position is read from the venue layout (`v.lineup[seat]`), so it cannot drift from the seat.
- The shared service is reached through `pitchSeats()` (created on first use, registered with the demo reset) rather than a module-level instance.
- "Back to stadium overview" keeps the inspected seat; the plan said it clears it. Keeping it lets the viewer fly back in from the inspector.
- Zone dimming is 60% (`ZONE_DIM`), not 45%: at 45% the other zones read as taken. The matrix's smallest zoom is 0.8 so the whole venue fits a 160 px-tall card. The matrix always draws squares; there is no shape level-of-detail.
- `useStadium` gained `facing` (the seat to look toward on arrival), for "View from my seat, facing them". `useHud` gained `cardOpen`/`cardFresh`, `matrixFit` and `guest.byCode`; `inspect(seat, keepPanel)` lets the guest tools mark a seat without giving their place to the inspector.
- The debug hook gained `myZone()`, `me()` and `sampleGraduate(booked, skip)` for the browser tests.
- A stand seat's inspector links to the family tickets page (`/me/tickets`), the site's existing ticket flow (decision D).
- The honors ceremony's arrival sentence was aligned to the same gates (men Gate 2, women Gate 5) along with the gate notes and the arrival step.
- Choosing "Guest" in the role switch opens the guest tools straight away.
- On short screens (760 px tall or less) the matrix hides its colour legend to make room for the Map/List tabs.

**Results**
- Type check and lint clean. 677 unit tests; the whole site's browser suite (298 tests) passes; the stadium's own browser tests grew from 64 to 148 (`stadiview-booking`, `-pass`, `-guest`, `-access`, `-links` are new).
- Landing download 178,446 B gzipped (+171 B on its pre-StadiView size; budget +2 KB). StadiView's own code about 70 KB gzipped (page 38.6 KB, scene 25.2 KB, styles 6.7 KB; budget 120 KB). three.js and react-three-fiber load only on `/stadium` and only with WebGL.
- Frame times (production build, `scripts/stadiview-frames.cjs`, processor slowed 4 times, now with a graduate signed in, a seat in the inspector and the seat map redrawing as the view turns):

  | Screen | Tier | Own work per frame, overview (median / worst) | Own work, first person (median / worst) |
  |---|---|---|---|
  | Desktop 1440×900 | 1 | 7.5 ms / 43.7 ms | 3.5 ms / 13.8 ms |
  | Desktop 1440×900 | 2 | 12.4 ms / 579 ms | 4.7 ms / 11.1 ms |
  | Phone 390×844 | 1 | 3.7 ms / 12 ms | 2.2 ms / 5.7 ms |
  | Phone 390×844 | 2 | 6.7 ms / 35.2 ms | 2.7 ms / 7.7 ms |

  The 6 ms target is met on phones and in first person, **not on the desktop overview** in this container. A CPU profile of that case puts almost all of it in three.js sending the draw commands, which here waits on software rendering (frames arrive 300 to 800 ms apart, so a 5-second sample is only 6 to 15 frames and the medians are noisy). The HUD's own share is small: the seat map now keeps its still layer (ground, stage, 8,000 seats, gates) as an image and redraws only the camera marker and rings when the view turns. The worst frames (44 to 579 ms) are the one-off capture of the inspector's view picture. All of this needs measuring once on a real device with a graphics chip.
- Review screenshots 10 to 17 in `docs/review/stadiview/`; 09 now shows the no-WebGL seat map.

**Left for Phase 4**: avatars, the gold sightline arc, the animated gate-to-seat route (also in the booking dialog), bloom, the "fill the stadium" switch, landmark chips in first person.
