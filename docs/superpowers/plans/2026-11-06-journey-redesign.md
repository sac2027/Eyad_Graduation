# Journey Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the landing page around a time-driven night-stadium journey to the certificate. It needs a scroll rail that mirrors the journey, nine emotional step sections, celebrations, a KFUPM-only logo and cinematic honor lighting.

**Architecture:**
- **Pure functions** in `src/time/` and `src/features/stadium/` turn the simulated clock into the path position, checkpoint states and scene lighting.
- **React components** draw a layered 2D SVG scene from those values; GSAP animates it.
- **The rail** reads scroll position for the figure and the clock for the checkpoint states.
- **A single canvas engine** draws fireworks and confetti, behind a once-per-session gate.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind 4 tokens, zustand 5, GSAP 3 + ScrollTrigger, three/R3F (honor page only), Vitest 5, Playwright 1.64 with @axe-core.

**Spec:** `docs/superpowers/specs/2026-11-06-journey-redesign-design.md`

**Phase A** (Tasks 1–6) ends at a hard stop: the requester approves screenshots of the still scene. **Phase B** (Tasks 7–15) starts only after that approval.

## Global Constraints

- Only these colours: Turquoise #115F66, Green #009767, Beige #ECE0C7, Sand #AA8C6D, Yellow #F0BA4F, Blue #71B8D4, Gray #ADACAD, plus the existing `--color-ink` #0b2f33 and black or white for text.
  - Celebrations use Yellow, Beige, Green, Blue and Sand only.
  - No gradients on the logo or the Matrix. The Matrix keeps its 5° skew and is never flipped.
- Fonts: KFUPM Display and IBM Plex Sans Arabic.
- Arabic is the default (RTL); English is the alternative. The rail is on the right in both languages.
- The only clock reader is `src/time/clockStore.ts`; the ESLint rule enforces it. Every time-based value comes from `useNow`/`getNow`.
- The countdown target and the certificate moment are `SCHEDULE.afterglowStart`: 7 Apr 2027 21:30 Riyadh time.
- The graduate figure is a solid near-black silhouette seen from behind: no face, no skin colour. It plays a slow walk cycle of about 1.6 s per stride, and its aura "breathes" on a 4 s cycle.
- Reduced motion (`useReducedMotion()`) or the low-end flag (`useDemoFlags().lowEnd`) means:
  - no walk cycle, no fireworks, no beam sweeps
  - a still pose and a static aura
- Celebrations:
  - no sound
  - each trigger at most once per session
  - the full certificate fireworks only when time moves forward across 21:30, per `shouldPlayCompletion`
- Emotional lines sit next to plain facts. Names appear only for graduate personas. Arabic has masculine and feminine forms through `genderForm`.
- No page may scroll sideways at 320 px.
- Touch targets are at least 44 px.

## Review Focus

1. **Arabic RTL.** The rail stays at the right edge, post labels sit on the correct side, and the scene's left-right layout still reads correctly. Pinned in Task 6 (screenshot test in `ar`) and Task 11 (rail position test in `ar`).
2. **Date TBC flag.** The stage screens say the date is to be confirmed, not a countdown, and the figure rests at the gate. Pinned in Task 8.
3. **Scrubbing backwards across 21:30, or loading straight into the afterglow.** No fireworks replay, and the figure simply holds the certificate. Pinned in Task 9.
4. **A 320 px phone with the worst-case long name.** The opening line wraps, the families strip stays in the first screen, and nothing scrolls sideways. Pinned in Task 6.
5. **Keyboard-only use of the rail.** Tab reaches it; arrow keys, Home and End move the page; focus is visible. Pinned in Task 11.

---

## Phase A: still artwork (hard stop at the end)

### Task 1: Arrival step and path engine

**Files:**
- Modify: `src/time/schedule.ts` (StageId, STAGE_ORDER, stages, milestones)
- Create: `src/time/pathEngine.ts`
- Modify: `src/features/journey/useJourney.ts`
- Modify: `src/i18n/en.ts`, `src/i18n/ar.ts`
  - `stage.arrival` and `stage.arrival.note`
  - `stage.ceremony` becomes "March and ceremony" / «المسيرة والحفل»
- Test: `tests/unit/pathEngine.test.ts`
- Test: update `tests/unit/stageEngine.test.ts`, `tests/unit/useJourney.test.ts`, `tests/unit/phaseEngine.test.ts` (8 → 9 milestones, `/7` → `/8`)

**Interfaces:**
- Produces:
  - `StageId` gains `'arrival'`, placed between `'rehearsal'` and `'ceremony'`
  - `stages.arrival = { opens: 7 Apr 15:00, closes: 7 Apr 18:45 }`
  - `stages.ceremony.opens` becomes 7 Apr 18:45
  - milestones: arrival 7 Apr 15:00; ceremony 7 Apr 20:00; celebration 21:00 and certificate 21:30, both unchanged
  - `export type CheckpointState = 'passed' | 'current' | 'next' | 'future' | 'late'`
  - `export function pathProgress(now: number, s?: Schedule): number`: 0..1, the same as `getJourneyProgress` (milestone *i* at `i/8`, linear between, 0 when TBC)
  - `export function checkpointStates(now: number, opts?: { late?: Partial<Record<StageId, boolean>>; s?: Schedule }): Record<StageId, CheckpointState>`
  - `export function currentCheckpoint(now: number, s?: Schedule): StageId`

- [ ] **Step 1: Write the failing tests in `tests/unit/pathEngine.test.ts`**

```ts
const at = (iso: string) => Date.parse(`${iso}+03:00`)
it('places checkpoint i at i/8', () => {
  SCHEDULE.milestones.forEach((m, i) => expect(pathProgress(m.at)).toBeCloseTo(i / 8, 6))
})
it('is 0 before launch and 1 from 21:30 on ceremony night', () => {
  expect(pathProgress(at('2026-11-06T09:00:00'))).toBe(0)
  expect(pathProgress(at('2027-04-07T21:30:00'))).toBe(1)
})
it('has nine checkpoints with arrival between rehearsal and ceremony', () => {
  expect(STAGE_ORDER).toEqual(['candidacy', 'information', 'attire', 'tickets', 'rehearsal', 'arrival', 'ceremony', 'celebration', 'certificate'])
})
it('marks passed, current, next and future', () => {
  const s = checkpointStates(at('2027-03-16T10:00:00'))
  expect([s.candidacy, s.information, s.attire, s.tickets, s.rehearsal]).toEqual(['passed', 'passed', 'current', 'next', 'future'])
})
it('marks a step late only when the caller says so and it is not current', () => {
  expect(checkpointStates(at('2027-03-16T10:00:00'), { late: { candidacy: true } }).candidacy).toBe('late')
})
it('rests at the gate while the date is TBC', () => {
  expect(pathProgress(at('2027-03-16T10:00:00'), { ...SCHEDULE, ceremonyDateStatus: 'tbc' })).toBe(0)
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run tests/unit/pathEngine.test.ts`
Expected: FAIL, because `pathEngine` does not exist yet.

- [ ] **Step 3: Implement the schedule changes and `pathEngine.ts`**

- `pathProgress` delegates to `getJourneyProgress`.
- The current checkpoint is the last milestone whose `at <= now`. Before launch, candidacy is `next`.
- `useJourney` keeps its shape. `stageId` now comes from `currentCheckpoint`.

- [ ] **Step 4: Update the existing tests for nine milestones and run the whole unit suite**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit** (`feat(time): add arrival step and path engine`)

### Task 2: KFUPM-only logo

**Files:**
- Modify: `src/brand/logo/horizontal.svg`, `horizontal-negative.svg`, `stacked.svg`, `stacked-negative.svg`
- Modify: `src/brand/logo/Logo.tsx` (ratios)
- Test: `tests/unit/logo.test.ts`

**Interfaces:**
- Produces: the same `Logo` props as now. The SVGs contain only the `KFUPM_Wordmark` and `KFUPM_Iconmark` groups.

- [ ] **Step 1: Write a failing test**

The test reads each SVG with `fs` and checks:
- it does not contain the third, ungrouped `<g>` (assert the count of `<g` is 3)
- its viewBox width is less than the original width (450.11 and 227.69)

- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/unit/logo.test.ts`

- [ ] **Step 3: Delete the descriptor group and crop the viewBox to the remaining paths**

Measure the bounds in Chromium with `getBBox()` and add 1 unit of padding. Update the `ratio` values in `Logo.tsx` to match.

- [ ] **Step 4: Run it and confirm it passes.** Then screenshot the header at 390 px (light and ceremony night) and check it by eye.

- [ ] **Step 5: Commit** (`feat(brand): KFUPM-only logo`)

### Task 3: Graduate silhouette

**Files:**
- Create: `src/features/stadium/figure/frames.ts`
  - 12 SVG path strings per outfit, back view
  - `bisht`: thobe, ghutra and agal, bisht drape
  - `abaya`: abaya, sash, headscarf
- Create: `src/features/stadium/figure/Graduate.tsx`
- Test: `tests/unit/graduateFrames.test.ts`

**Interfaces:**
- Produces:
  - `export type Outfit = 'bisht' | 'abaya'`
  - `export const WALK_FRAMES: Record<Outfit, string[]>` (length 12; viewBox `0 0 100 240`)
  - `export const STRIDE_MS = 1600`
  - `export function Graduate(props: { outfit: Outfit; height: number; mode: 'walk' | 'still' | 'hold-certificate'; aura?: 'soft' | 'bright'; className?: string }): JSX.Element`
  - `mode: 'still'` renders frame 0. Phase A ships `'still'` and `'hold-certificate'` only; the walk animation lands in Task 7.

- [ ] **Step 1: Write failing tests**

- `WALK_FRAMES.bisht.length === 12` and `WALK_FRAMES.abaya.length === 12`
- every frame is a non-empty `d` string that parses: render it into jsdom inside an `<svg><path d>` and call `getTotalLength` where available, otherwise only check it matches `/^M/`
- `STRIDE_MS === 1600`

- [ ] **Step 2: Run them and confirm they fail.**

- [ ] **Step 3: Draw the frames and build `Graduate`**

- **Proportions**: about 7.5 heads tall. The head is covered (ghutra or headscarf), so there is no face from behind.
- **Motion across frames**: shoulders sway ±2°; the bisht hem swings, lagging one frame behind the legs; the heel lifts at frames 3 and 9.
- **Fill**: `--color-ink`.
- **Aura**: a blurred ellipse behind the body in Yellow at 35% opacity (`soft`) or 60% (`bright`), plus a 1.5 px rim stroke in Beige at 40%.
- **`hold-certificate`**: arms raised, holding a small `Certificate` (from Task 4).
- **Review**: render both outfits at 240 px into a Playwright screenshot so they can be checked by eye.

- [ ] **Step 4: Run the tests and confirm they pass.** `npx vitest run tests/unit/graduateFrames.test.ts`

- [ ] **Step 5: Commit** (`feat(stadium): graduate silhouette artwork`)

### Task 4: Certificate artwork

**Files:**
- Create: `src/features/stadium/Certificate.tsx`
- Test: `tests/unit/certificate.test.tsx`

**Interfaces:**
- Produces: `export function Certificate(props: { size: number; labelled?: boolean; className?: string }): JSX.Element`
  - Beige paper with a Sand border.
  - The KFUPM iconmark, from the colour logo's `KFUPM_Iconmark` path, in Turquoise.
  - Three Ink text lines, a Green round seal, and a Yellow ribbon tail.
  - When `labelled`, a caption «شهادتك» / "Your certificate" from `t('cert.label')`.
  - `role="img"` with `aria-label` set to that caption.

- [ ] **Step 1: Write a failing test.** It renders `<Certificate size={120} labelled />` and expects `getByRole('img', { name: /certificate|شهادتك/ })`.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement it and add the `cert.label` key in both languages.**
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Commit** (`feat(stadium): certificate artwork`)

### Task 5: Stadium scene and scene state

**Files:**
- Create: `src/features/stadium/sceneState.ts`
- Create: `src/features/stadium/StadiumScene.tsx`
- Create: `src/features/stadium/layers/` with `Sky.tsx`, `Stands.tsx`, `ChairBlocks.tsx`, `Aisle.tsx`, `Checkpoints.tsx`, `Stage.tsx`
- Create: `src/features/stadium/geometry.ts`
- Test: `tests/unit/sceneState.test.ts`
- Test: `tests/unit/stadiumGeometry.test.ts`

**Interfaces:**
- Consumes: `pathProgress`, `checkpointStates`, `getPhase`, `getSlotProgress`, `Graduate`, `Certificate`.
- Produces:
  - `export interface SceneState { lampsLit: number /*0..9 checkpoints lit*/; stageGlow: 0|1|2|3; beams: boolean; crowd: 0|1|2; chairsFilled: boolean; flags: boolean; goldAccents: boolean; figure: 'gate' | 'path' | 'stage' | 'holding' }`
  - `export function sceneState(now: number, s?: Schedule): SceneState`
  - `export interface SceneGeom { w: number; h: number; aisle: { x: number; y: number; scale: number }[] /*9 posts*/; stage: { x: number; y: number; w: number }; screens: [Rect, Rect]; podium: { x: number; y: number } }`
  - `export function geometryFor(orientation: 'wide' | 'tall'): SceneGeom`
  - `export function figureAt(progress: number, g: SceneGeom): { x: number; y: number; scale: number }`: linear between posts
  - `export function StadiumScene(props: { now: number; outfit: Outfit; mode: 'still' | 'live'; onCheckpoint?: (id: StageId) => void }): JSX.Element`

- [ ] **Step 1: Write failing tests**

```ts
expect(sceneState(at('2026-11-06T09:00:00'))).toMatchObject({ figure: 'gate', lampsLit: 0, beams: false })
expect(sceneState(at('2027-03-16T10:00:00'))).toMatchObject({ figure: 'path', lampsLit: 3 })
expect(sceneState(at('2027-04-02T10:00:00')).flags).toBe(true)          // final week
expect(sceneState(at('2027-04-06T19:30:00')).goldAccents).toBe(true)    // honors day
expect(sceneState(at('2027-04-07T16:00:00'))).toMatchObject({ crowd: 1, beams: true })
expect(sceneState(at('2027-04-07T19:00:00')).chairsFilled).toBe(true)
expect(sceneState(at('2027-04-07T20:20:00')).figure).toBe('stage')
expect(sceneState(at('2027-04-07T21:30:00'))).toMatchObject({ figure: 'holding', stageGlow: 3 })
// geometry
const g = geometryFor('tall')
expect(g.aisle).toHaveLength(9)
g.aisle.slice(1).forEach((p, i) => expect(p.scale).toBeLessThan(g.aisle[i].scale)) // smaller toward the stage
expect(figureAt(0, g)).toMatchObject({ x: g.aisle[0].x, y: g.aisle[0].y })
```

- [ ] **Step 2: Run them and confirm they fail.**

- [ ] **Step 3: Implement**

- **`sceneState`**: a lookup on `getPhase` and `getSlotProgress`. `lampsLit` is the number of passed checkpoints.
- **`geometryFor`**:
  - `wide` (16:9): the aisle is a perspective trapezoid from the bottom centre to the stage at about 18% height. Posts sit evenly along the centre line, with scale going from 1 down to 0.35.
  - `tall` (9:16): the same layout, narrower.
- **Layers**, drawn as SVG in a `viewBox` taken from the geometry, using brand colours with flat translucent shapes:
  - stands as stepped Turquoise polygons
  - floodlight towers (Beige at 70% opacity)
  - the campus skyline (Ink)
  - chair blocks as Sand dot grids
  - the aisle as a red-carpet strip (Sand at 80% opacity over Ink)
  - posts as pylons with a lamp head, coloured by `CheckpointState`:
    - passed: Green with ✓
    - current: Yellow, with a "You are here" chip and the deadline
    - next: Beige outline
    - future: Gray at 40% opacity
    - late: drawn with `--color-error`, which already exists in the tokens
  - the stage with two LED screen rectangles; Phase A shows static text for the screens
  - the podium with `<Certificate labelled />`
  - `<Graduate>` at `figureAt`
- **Labels** are HTML, absolutely positioned at the post coordinates converted to percentages. They alternate start and end, logical sides that flip in RTL. On `tall` they show the number and name only, and are 44 px buttons that call `onCheckpoint`.
- **Choosing a geometry**: a small `useWideAspect(): boolean` hook in `src/features/stadium/useWideAspect.ts` (matchMedia `(min-aspect-ratio: 1/1)` with a change listener) picks `wide` or `tall`.

- [ ] **Step 4: Run the tests and confirm they pass.**

- [ ] **Step 5: Commit** (`feat(stadium): night-stadium scene with checkpoints, stage and certificate`)

### Task 6: Landing page with the still scene, then the hard stop

**Files:**
- Modify: `src/features/guest/GuestHome.tsx`. The first screen becomes `StadiumScene` (mode `'still'`) with:
  - the opening line
  - the ways in ("I'm graduating" / "I'm a guest")
  - the families strip (Gates, Parking, My seat, Accessibility)
  - the scroll cue
  - `JourneySection` and the role chooser are removed
- Modify: `src/app/routes.tsx`. The header gains a "Sign in" button that switches to the default graduate and goes to `/me` when the persona isn't a graduate.
- Modify: `src/i18n/en.ts`, `ar.ts`
  - `landing.line.named` with `{name}` and m/f forms
  - `landing.line.anon`
  - `landing.ways.grad`, `landing.ways.guest`
  - `families.gates`, `families.parking`, `families.seat`, `families.access`
  - `nav.signin`
- Create: `scripts/scene-stills.cjs`. It runs Playwright and writes PNGs to `docs/review/scene/`:
  - mid-journey 2027-03-16 10:00 at `wide` 1440×900 and `tall` 390×844, in `ar` and `en`
  - ceremony night 2027-04-07 20:20, wide and tall, `ar`
- Test: `tests/e2e/landing.spec.ts` (rewritten)

**Interfaces:**
- Consumes: `StadiumScene`, `useSession`, `genderForm`.
- Produces: `data-scene`, `data-families`, `data-checkpoint={id}` and `data-checkpoint-state={state}` attributes, used by later tests.

- [ ] **Step 1: Rewrite `tests/e2e/landing.spec.ts` with failing tests**
  - `/?t=2027-03-16T10:00&lang=en`:
    - nine `[data-checkpoint]` elements
    - `[data-checkpoint="attire"]` has state `current`
    - `[data-families]` is inside the first viewport at 390×844 (`boundingBox().y + height <= 844`)
  - At 320 px with `worst=1`: `document.documentElement.scrollWidth <= 320`.
  - At `lang=ar`: the certificate is reachable by `getByRole('img', { name: 'شهادتك' })`.
  - The header "Sign in" button leads to `/me` when the persona is a guest.

- [ ] **Step 2: Run them and confirm they fail.** `npx playwright test tests/e2e/landing.spec.ts`

- [ ] **Step 3: Implement the landing page changes and remove the old journey section**

The old components are deleted in Task 15. Update `tests/e2e/journey.spec.ts` and `ascent.spec.ts` by skipping them with a `test.fixme` that points to Task 15.

- [ ] **Step 4: Run the landing, smoke, a11y and worst-case specs and confirm they pass.** `npx playwright test tests/e2e/landing.spec.ts tests/e2e/smoke.spec.ts tests/e2e/a11y.spec.ts tests/e2e/worst-case.spec.ts`

- [ ] **Step 5: Generate the stills.** `node scripts/scene-stills.cjs` should write the six PNGs.

- [ ] **Step 6: Commit and push** (`feat(landing): still journey scene for review`)

- [ ] **Step 7: HARD STOP.** Send the six stills to the requester and wait for approval or changes. Apply any changes to Tasks 3–6 before starting Phase B.

---

## Phase B: motion, rail, sections and celebrations (after approval)

### Task 7: Walk cycle, aura and movement along the path

**Files:**
- Modify: `src/features/stadium/figure/Graduate.tsx` (`mode: 'walk'`)
- Modify: `src/features/stadium/StadiumScene.tsx` (`mode: 'live'`)
- Test: `tests/e2e/scene-motion.spec.ts`

**Interfaces:**
- Produces: `Graduate` adds `data-frame={n}` while walking. The scene figure adds `data-progress` (3 decimals).

- [ ] **Step 1: Write failing tests**
  - At `?t=2027-03-16T10:00`, `data-frame` takes at least 3 different values within 2 s, even though the time is frozen.
  - With `reduced=1`, `data-frame` stays at `0`.
  - After setting the time with the demo console's "Jump to date and time" field to `2027-03-20T10:00`, `data-progress` increases.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement the animation**
  - The frame index advances on `requestAnimationFrame` at `STRIDE_MS / 12` per frame, with eased timing.
  - It pauses when `document.hidden` and when the scene is offscreen (IntersectionObserver).
  - The aura breathes through a CSS keyframe of 4 s (scale 0.96 to 1.04).
  - Position changes are tweened over 1.2 s with GSAP when `now` jumps.
  - Reduced motion and low-end get a still frame with a static aura.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadium): walking silhouette with breathing aura`)

### Task 8: Countdown on the stage screens, and the date-TBC case

**Files:**
- Create: `src/features/stadium/StageScreens.tsx`
- Modify: `src/features/guest/Countdown.tsx` (extract `countdownParts`)
- Test: `tests/unit/countdownParts.test.ts`
- Test: `tests/e2e/scene-motion.spec.ts`

**Interfaces:**
- Produces:
  - `export function countdownParts(now: number, target: number): { days: number; h: number; m: number; s: number; done: boolean }`
  - `StageScreens` props: `{ now: number; dateStatus: 'confirmed' | 'tbc'; welcome: boolean }`
  - It renders `data-screen="left"` (days) and `data-screen="right"` (hh:mm:ss), with the label `t('screens.until')` («حتى تحمل شهادتك بين يديك» / "until your certificate is in your hands").

- [ ] **Step 1: Write failing tests**
  - `countdownParts(target - 90_061_000, target)` returns `{ days: 1, h: 1, m: 1, s: 1, done: false }`.
  - At or after the target, `done` is `true`.
  - e2e: at `?t=2027-03-16T10:00` the left screen contains "22" (days to 7 Apr 21:30 Riyadh).
  - e2e: with `tbc=1` the screens show `t('count.tbc')` and the figure's `data-progress` is `0.000`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement it.** Numbers use `NumberFlow`. From 21:30 the screens read `t('screens.congrats')` ("Congratulations, Class 57") plus `daysSinceLabel`.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(stadium): countdown on the stage screens`)

### Task 9: Time states in motion and the certificate moment

**Files:**
- Modify: `src/features/stadium/StadiumScene.tsx` and its layers:
  - lamps light in sequence as `lampsLit` grows
  - beams sweep (GSAP rotation, 6 s yoyo) when `beams`
  - the crowd twinkles in the stands
  - flags appear
  - gold accents appear
- Create: `src/features/stadium/CertificateMoment.tsx`. It plays when `shouldPlayCompletion(prev, now)` is true. Steps:
  1. the figure climbs to the podium
  2. lifts the certificate
  3. the aura brightens
  4. calls `celebrate('certificate')` (Task 12; before Task 12 lands, it's a no-op import stub)
- Delete: `src/features/journey/CompletionHost.tsx`, `Completion.tsx`, `Afterglow.tsx`, `DayAscent.tsx`. Their behaviour now lives in the scene.
- Modify: `src/app/routes.tsx` (remove `CompletionHost`)
- Test: `tests/e2e/afterglow.spec.ts` and `tests/e2e/ascent.spec.ts`, rewritten as `tests/e2e/ceremony-night.spec.ts`

**Interfaces:**
- Consumes: `sceneState`, `shouldPlayCompletion`, `celebrate` (Task 12).
- Produces: the scene root carries `data-figure={SceneState['figure']}` and `data-beams`.

- [ ] **Step 1: Write failing tests**
  - Starting at `?t=2027-04-07T21:29`, press "1 hour / sec" in the demo console. Within 3 s, `data-figure="holding"` and `[data-certificate-moment]` was visible.
  - Loading directly at `?t=2027-04-09T10:00`: `data-figure="holding"` and `[data-certificate-moment]` has count 0 (no replay).
  - Scrubbing from 21:40 back to 21:00: `data-figure="stage"` and no moment.
  - At 16:00 on 7 Apr, `data-beams="true"`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement it.** Keep the previous `now` in a ref, the same way `CompletionHost` did.
- [ ] **Step 4: Run the tests and the presets spec and confirm they pass.** `npx playwright test tests/e2e/ceremony-night.spec.ts tests/e2e/presets.spec.ts`
- [ ] **Step 5: Commit** (`feat(stadium): ceremony-day lighting and the certificate moment`)

### Task 10: The nine step sections and the families block

**Files:**
- Create: `src/features/steps/steps.ts`
- Create: `src/features/steps/StepSection.tsx`
- Create: `src/features/steps/FamiliesBlock.tsx`
- Modify: `src/features/guest/GuestHome.tsx` (render ①–⑨, then the families block, then the footer)
- Modify: i18n. For each id in `step.<id>.title`, `step.<id>.sub`, `step.<id>.do`, `step.<id>.need`:
  - titles and subtitles have m/f forms in Arabic (`step.<id>.title.m` and `.f`), plus a nameless generic form that is the same text as the m form
  - copy is emotional, using the spec's sample lines for ①, ③ and ⑨
- Test: `tests/e2e/steps.spec.ts`

**Interfaces:**
- Consumes: `STAGE_ORDER`, `SCHEDULE.stages`, `getStageStatus`, the services used by `Dashboard.tsx` (gown, seat, `useConfirmed`) for personal status.
- Produces:
  - `export interface StepInfo { id: StageId; n: number; opens: number; due?: number; to?: string }`
  - `export const STEPS: StepInfo[]`
  - each section is `<section id="step-<id>" data-step={id}>`
  - `export function personalStatus(id: StageId, personaId: string, now: number): 'done' | 'pending' | 'late' | null` (null for non-graduates)

- [ ] **Step 1: Write failing tests**
  - Nine `[data-step]` sections in order.
  - At `?t=2027-03-16T10:00&persona=grad-m-gold`, `[data-step="attire"]` shows a pending status and a button linking to `/me/attire`.
  - With `persona=guest`, there are no status chips.
  - `[data-step="arrival"]` contains "Gate 3".
  - Clicking `[data-checkpoint="tickets"]` in the scene scrolls `#step-tickets` into view.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement it.** Sections alternate Beige and Turquoise skewed panels (the existing FAST container pattern, with an `overflow-x-clip` wrapper). Each has a brand-styled photo placeholder and a Matrix accent.
- [ ] **Step 4: Run the tests plus the a11y spec and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(steps): nine emotional step sections`)

### Task 11: The right rail

**Files:**
- Create: `src/features/rail/railMath.ts`
- Create: `src/features/rail/ScrollRail.tsx`
- Create: `src/features/rail/RailSheet.tsx` (phone list)
- Modify: `src/app/routes.tsx`. Mount the rail on `/` only. Add the class `hide-native-scrollbar` to `<html>` on `/` at `md` and wider.
- Modify: `src/brand/tokens.css` (`.hide-native-scrollbar` rule)
- Test: `tests/unit/railMath.test.ts`
- Test: `tests/e2e/rail.spec.ts`

**Interfaces:**
- Consumes: `checkpointStates`, `Graduate`, `Certificate`, the `#step-<id>` anchors.
- Produces:
  - `export function railProgress(scrollY: number, sectionTops: number[], viewportH: number): number`. It returns 0..1: 0 at the first section's top, `i/8` when section *i*'s top reaches the middle of the viewport, linear between, and 1 at the last section.
  - `export function scrollForProgress(p: number, sectionTops: number[], viewportH: number): number`, the inverse.
  - The rail root is `<div role="slider" aria-orientation="vertical" aria-valuemin=0 aria-valuemax=100 aria-valuenow aria-valuetext={step name} data-rail>`.

- [ ] **Step 1: Write failing tests**
  - Unit: `railProgress(scrollForProgress(p, tops, vh), tops, vh) ≈ p` for p in {0, 0.25, 0.5, 1}. The result is clamped to [0, 1].
  - e2e (desktop):
    - Scrolling to `#step-certificate` makes `[data-rail-figure]` `data-mode="hold-certificate"` and shows `[data-rail-burst]`. The full `[data-fireworks]` stays absent before 21:30.
    - Clicking the rail post for tickets scrolls to `#step-tickets`.
    - Dragging the rail figure down 100 px increases `scrollY`.
  - e2e (keyboard): focus the rail. `End` scrolls to the bottom section, `Home` scrolls back to the top, `ArrowDown` moves to the next section.
  - e2e (`lang=ar`): the rail's `boundingBox().x + width` is within 2 px of the viewport width.
  - e2e (390 px): the rail is 28 px wide. Tapping it opens `[data-rail-sheet]` with nine items.
  - The rail's post states match the scene's `data-checkpoint-state` for the same id.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement it**
  - Section tops are measured with ResizeObserver; the scroll listener is passive and throttled with rAF.
  - Dragging uses pointer capture and calls `scrollForProgress`.
  - The rail figure uses `Graduate` at 24 px, `mode` follows reduced motion, and it switches to `hold-certificate` at progress ≥ 0.999.
  - Native scrollbar hiding is desktop only (`scrollbar-width: none` and the `::-webkit-scrollbar` rule).
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(rail): journey scroll rail`)

### Task 12: The celebrations engine and the welcome moment

**Files:**
- Create: `src/features/celebrate/gate.ts`
- Create: `src/features/celebrate/Fireworks.tsx` (one canvas, mounted once in `Layout`)
- Create: `src/features/celebrate/celebrate.ts`
- Create: `src/features/celebrate/WelcomeMoment.tsx`
- Modify:
  - `Attire.tsx`: `celebrate('task')` after booking succeeds
  - `SeatMap.tsx`: after a seat is confirmed
  - `Dashboard.tsx`: after candidacy is confirmed
  - `StageScreens` (`welcome` prop)
- Test: `tests/unit/celebrateGate.test.ts`
- Test: `tests/e2e/celebrate.spec.ts`

**Interfaces:**
- Produces:
  - `export type CelebrationKind = 'welcome' | 'task' | 'certificate' | 'certificate-small' | 'honor-gold' | 'honor-silver' | 'honor-bronze' | 'ceremony-entry'`
  - `export function shouldCelebrate(kind: CelebrationKind, key: string, storage: Pick<Storage, 'getItem' | 'setItem'> | null): boolean`. It returns true once per `kind:key` per session, using `sessionStorage` wrapped in try/catch. `null` storage means true once per page load, tracked in a module-level Set.
  - `export function celebrate(kind: CelebrationKind, key?: string): void`. It does nothing under reduced motion or low-end; then the WelcomeMoment shows its still version instead.
  - `Fireworks` adds `data-fireworks={kind}` to its canvas while drawing. The palette is `['#F0BA4F', '#ECE0C7', '#009767', '#71B8D4', '#AA8C6D']`.
  - Honor mapping: gold uses `#F0BA4F`; silver uses `#ADACAD` and `#71B8D4`; bronze uses `#AA8C6D`.

- [ ] **Step 1: Write failing tests**
  - Unit: `shouldCelebrate('welcome', 'landing', mem)` returns true once, then false. It is true again for a different key. A storage that throws is handled.
  - e2e:
    - The first visit to `/` shows `[data-fireworks="welcome"]` and the screens show "Welcome to the journey of Class 57" within 1 s. Reloading in the same context shows no welcome. Tapping during the welcome removes it.
    - With `reduced=1`: no `[data-fireworks]`, but the welcome line still shows.
    - Booking a gown slot shows `[data-fireworks="task"]`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement it.** The particle engine:
  - bursts of 60–90 particles, gravity of 0.04 px/frame²
  - a trail made by a 0.18-alpha clear each frame
  - the canvas resized to DPR ≤ 2
  - it stops and clears when idle, and never runs a loop with no particles

  The welcome sequence lasts about 4 s:
  1. light banks switch on one after another (sceneState overrides for 1.2 s)
  2. a burst of fireworks over the stage
  3. the screens show `t('welcome.line')` for 2.5 s, then the countdown
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(celebrate): fireworks, confetti and the welcome moment`)

### Task 13: Emotional copy pass

**Files:**
- Modify: `src/i18n/ar.ts`, `src/i18n/en.ts`. Hero, steps, dashboard headings, toasts on success, and the afterglow lines get emotional versions. Plain facts stay.
- Test: `tests/unit/i18nParity.test.ts`

**Interfaces:**
- Produces: every key exists in both dictionaries, and every `.m` key has a matching `.f` key.

- [ ] **Step 1: Write a failing parity test**
  - the key sets of `ar` and `en` are equal
  - for each key ending `.m` there is a key ending `.f`
  - no Arabic value contains Latin letters except the allow-list `KFUPM` and `QR`
- [ ] **Step 2: Run it and confirm it fails** (new keys are missing their pairs).
- [ ] **Step 3: Write the copy.** Names go in only through `{name}` on the `*.named` keys.
- [ ] **Step 4: Run the test and the worst-case spec and confirm they pass.**
- [ ] **Step 5: Commit** (`content: emotional language pass, Arabic first`)

### Task 14: Honor page lighting cues

**Files:**
- Create: `src/features/honors/lightCues.ts`
- Modify: `src/features/honors/AwardScene.tsx`
  - additive cone meshes for the spotlight and 2–4 beams
  - rim lights
  - flash spikes
  - the timeline driven by `LIGHT_CUES`
- Modify: `src/features/honors/AwardFallback.tsx`. The same cues as CSS and SVG layers.
- Modify: `src/features/honors/HonorPage.tsx`. Call `celebrate('honor-<tier>', personaId)` on the `end` beat.
- Test: `tests/unit/lightCues.test.ts`
- Test: update `tests/e2e/honors.spec.ts`

**Interfaces:**
- Produces:
  - `export interface LightCue { at: number; id: 'blackout' | 'spot' | 'beams' | 'spill' | 'rim' | 'flash' | 'settle'; duration: number }`
  - `export const LIGHT_CUES: LightCue[]`, in time order:
    - `blackout` 0
    - `spot` 0.2
    - `beams` 1.8
    - `spill` 3.0
    - `rim` 4.8
    - `flash` at 8.6, 9.0 and 9.5
    - `settle` 10.4
  - `export function beamColour(tier: HonorTier): string`: gold `#F0BA4F`, silver `#71B8D4`, bronze `#AA8C6D`.

- [ ] **Step 1: Write failing tests**
  - Unit: the cues are sorted by `at`, and the first is `blackout` at 0.
  - Unit: there are exactly three `flash` cues.
  - e2e: on the honor page with WebGL, `[data-light-cue]` passes through `spot`, then `beams`, then `settle`.
  - e2e: with `reduced=1`, the cue is `settle` immediately.
  - e2e: `[data-fireworks="honor-gold"]` appears for the gold persona, and nothing appears for `grad-m-none`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement it.**
  - The cone meshes use `MeshBasicMaterial` with additive blending, opacity animated through the GSAP timeline.
  - Skip and Replay jump the cues too.
  - Dispose the cone geometries on unmount.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit** (`feat(honors): cinematic lighting cues`)

### Task 15: Clean-up, full verification and deploy fix

**Files:**
- Delete:
  - `src/features/journey/JourneyStory.tsx`, `JourneySection.tsx`, `JourneyBar.tsx`, `Walker.tsx`
  - the old tests for them (`journey.spec.ts`, `ascent.spec.ts`, `afterglow.spec.ts` if not already rewritten)
  - matching CSS and i18n keys that are now unused (`journey.*`)
- Create: `public/_redirects` with `/* /index.html 200` (Cloudflare Pages SPA deep links)
- Modify: `README.md`. Describe the new landing, the rail, celebrations, and the demo console time states.
- Modify: `src/features/graduate/Dashboard.tsx`. Use the `checkpointStates` colours in its progress strip so the dashboard and the scene agree.

- [ ] **Step 1: Check for leftovers.** `grep -rn "JourneyStory\|JourneyBar\|Walker\|CompletionHost" src tests` should print nothing.
- [ ] **Step 2: Type check and lint.** `npx tsc --noEmit && npm run lint` should be clean.
- [ ] **Step 3: Unit tests.** `npx vitest run` should all pass.
- [ ] **Step 4: Browser tests.** `npx playwright test` should all pass.
- [ ] **Step 5: Build.** `npm run build` should succeed. The landing chunk must stay under 200 KB gzipped, with three.js still only in the honor chunk.
- [ ] **Step 6: Performance check on a phone profile.** Use Playwright with CPU throttling at 4× and a 390×844 viewport. Record 5 s of `requestAnimationFrame` deltas on `/` at mid-journey: the median should be ≤ 20 ms, and no more than 5% of frames should be over 50 ms.
- [ ] **Step 7: Screenshots for the requester.** Take mid-journey, ceremony night 20:20, the certificate moment at 21:30, and the afterglow, in `ar` at 390 and 1440 px. Save them in `docs/review/final/`.
- [ ] **Step 8: Commit and push** (`chore: remove old journey, deploy redirects, final checks`)

---

## Implementation notes (deviations)

- **Countdown target** is 21:30 on 7 April (`SCHEDULE.afterglowStart`), as agreed in the spec.
- **Scene layers** are in one file, `src/features/stadium/layers.tsx`, not a `layers/` folder. The stage screens are their own component (`StageScreens.tsx`).
- **Checkpoint labels**:
  - On phones only the current step shows its name, as a pill that grows away from the aisle.
  - Checkpoint ⑨ is labelled "Your certificate" above the podium.
  - The visible certificate caption was dropped to avoid collisions; the certificate keeps an accessible name.
- **Rail posts** are plain marks, not buttons, because a slider cannot contain buttons; the slider handles keyboard input. Clicking a post on desktop jumps to its section, and on phones the whole rail opens the step list.
- **Ways in on phones**: "I'm graduating / I'm a guest" sits under the families buttons on portrait screens, and the header has a Sign in button.
- **Welcome moment**: automated browsers skip it unless the URL has `?welcome=1`, so the tests see the page itself, the same approach as the CPU benchmark.
- **Dashboard**: shows a nine-step trail (`ProgressTrail`) in the scene's colours instead of the old Journey Bar.
- **Removed**: the old story, ascent, completion and afterglow components. The after-ceremony "photos" and "survey" cards went with the afterglow screen; certificate collection and gown return live in step ⑨.
- **Performance** (production build, 390×844, CPU ×4, headless): median frame 16.7 ms and 0% of frames over 50 ms, both mid-journey and on ceremony night. Landing bundle 137 KB gzipped.
