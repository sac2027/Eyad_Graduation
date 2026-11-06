# KFUPM Graduation Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual (Arabic default, English) front-end demo of the KFUPM Class 57 graduation experience, with a simulated clock that lets the viewer travel to any date and time.

**Architecture:** One simulated clock feeds pure stage and phase engines. Mock services sit behind repository interfaces. Features (journey, guest, graduate, honors, admin) read engines and services only. 3D is isolated in a lazy-loaded honor route.

**Tech Stack:** Vite 8.3.6, React 19.3.1, TypeScript 7.0.2, react-router-dom 7.18.5, Tailwind 4.3.4, cva 0.7.1, clsx 2.1.1, zustand 5.0.16, motion 14.9.1, gsap 3.15.1 (+ScrollTrigger), @number-flow/react 0.6.2, @base-ui-components/react 1.0.0-rc.0, sonner 2.0.8, three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, a small QR library (`qrcode`), Vitest 5.1.0, Playwright 1.64.1.

**Spec:** `docs/phase2/architecture.md`

## Global Constraints

- Node 22. Pin exact versions above. No version ranges.
- Timezone is Asia/Riyadh (UTC+3). All schedule instants are ISO strings with `+03:00`. Time values passed between modules are epoch milliseconds (`number`).
- Nothing reads `Date.now()` or `new Date()` (no arguments) except `src/time/clockStore.ts`. Enforced by an ESLint `no-restricted-properties` / `no-restricted-syntax` rule.
- Arabic is the default language and `<html dir="rtl" lang="ar">`. English switches to `ltr`. Use logical CSS properties only (`ps-`, `pe-`, `ms-`, `me-`, `start`, `end`).
- Digits are Western (0-9) in both languages. Dates are Gregorian. Hijri is an optional secondary label.
- Palette tokens only: Turquoise `#115F66`, Green `#009767`, Beige `#ECE0C7`, Sand `#AA8C6D`, Yellow `#F0BA4F`, Blue `#71B8D4`, Gray `#ADACAD`, white, black. Feedback: success `#2AA880`, error `#DE5E5E`, warning `#F2C56C`, info `#89C4DB`. Yellow text only at large sizes.
- Brand rules: no gradients on logos or the Matrix. The Matrix is never flipped (RTL mirrors layout, not the Matrix). Skew stays 5°. Only approved Matrix colour pairings (guideline page 78).
- KFUPM Display font files stay out of git (`public/fonts/kfupm/` is git-ignored) until Student Affairs clears them. The app falls back to IBM Plex Sans Arabic when they are missing.
- Motion tokens: ease-out `cubic-bezier(0.23, 1, 0.32, 1)`, ease-in-out `cubic-bezier(0.77, 0, 0.175, 1)`. Never `ease-in`. Animate `transform` and `opacity` (plus `clip-path`). Button press scale `0.97`, 120 to 160 ms. Hover effects only under `(hover: hover) and (pointer: fine)`. Every animation has a `prefers-reduced-motion` fallback.
- Library roles: GSAP for scroll-scrubbed and cinematic timelines. Motion for UI micro-interactions, layout and exits. Three.js only in `src/features/honors/`, loaded with `React.lazy`.
- Touch targets are at least 44 px. Every control has an accessible name. Visible focus.
- Copy: sentence case, active verbs, one name per action across a flow. Every mocked item that depends on a vendor or committee shows a visible "Mock: vendor TBD" or "Mock: committee decision pending" label.
- Commit messages end with the session's required attribution lines.

## Review Focus

Spec-implied conditions that no task's happy path would exercise. Each has a test in the owning task.

1. **Scrubbing time backwards.** The Journey, deadlines, holds and phases must reverse cleanly. The completion sequence must play only on a forward crossing of the ceremony end, never on every render or each time-lapse tick. (Tasks 2, 3, 13)
2. **Seat holds under simulated time.** A hold expires when simulated time passes `heldUntil`. Moving time backwards before the hold was created must not resurrect or duplicate seats. No seat is ever confirmed twice. (Task 7)
3. **GPA edges.** 2.99, 3.00, 3.249, 3.25, 3.749, 3.75, 4.00, and also NaN, negative, above 4.00, and missing. (Task 4)
4. **Very long and very short Arabic names** on the plaque, QR card, dashboard and admin table, plus Arabic plural forms (1, 2, 3, 11, 100 seats). (Tasks 5, 15, 16, 17)
5. **WebGL absent, low-end device, or reduced motion on the honor page.** The name, tier and ceremony details are still shown. (Task 17)

## File structure

```
src/app/            App.tsx, routes.tsx, RootPhase.tsx
src/brand/          tokens.css, fonts.css, matrix/ (MatrixField, pairs.ts, manifest.ts), logos/
src/time/           schedule.ts, stageEngine.ts, phaseEngine.ts, clockStore.ts, presets.ts, urlState.ts
src/domain/         honorTier.ts, capacity.ts, types.ts
src/i18n/           ar.ts, en.ts, index.ts, format.ts
src/ui/             Button.tsx, Chip.tsx, Dialog.tsx, toast.ts, QrCard.tsx
src/data/           fixtures/, services/ (seatService, ticketService, gownService, honorService, adminService), index.ts
src/session/        sessionStore.ts
src/features/demo-console/   DemoConsole.tsx, Scrubber.tsx
src/features/journey/        useJourney.ts, JourneyBar.tsx, DayAscent.tsx, Completion.tsx, Afterglow.tsx
src/features/guest/          GuestHome.tsx, GateMap.tsx, AccessibilityFlow.tsx, Guide.tsx
src/features/graduate/       Dashboard.tsx, Attire.tsx, Tickets.tsx, SeatMap.tsx
src/features/honors/         HonorPage.tsx, AwardScene.tsx, awardGeometry.ts, tierMaterials.ts, namePlaque.ts, capability.ts, HonorDetails.tsx
src/features/admin/          AdminPage.tsx
public/matrix/      (Eyad's generator loops go here)
tests/unit/         *.test.ts   tests/e2e/ *.spec.ts
```

---

### Task 1: Scaffold, tooling and brand tokens

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore` (add `node_modules`, `dist`, `public/fonts/kfupm/`), `src/main.tsx`, `src/app/App.tsx`, `src/brand/tokens.css`, `src/brand/fonts.css`
- Create: `tests/unit/smoke.test.tsx`, `tests/e2e/smoke.spec.ts`
- Place IBM Plex Sans Arabic TTFs in `public/fonts/ibm/` (open licence, committed). Place KFUPM Display TTFs in `public/fonts/kfupm/` (not committed).

**Interfaces:**
- Produces: CSS custom properties `--color-turquoise`, `--color-green`, `--color-beige`, `--color-sand`, `--color-yellow`, `--color-blue`, `--color-gray`, `--color-success|error|warning|info`; font families `--font-display`, `--font-body`; the `npm run dev|build|test|e2e|lint` scripts.

- [ ] **Step 1: Write the failing test** in `tests/unit/smoke.test.tsx`: render `<App />` and assert `document.documentElement.dir === 'rtl'` and `lang === 'ar'`.
- [ ] **Step 2: Run it to see it fail.** Run: `npx vitest run tests/unit/smoke.test.tsx`. Expected: FAIL, App not defined.
- [ ] **Step 3: Scaffold** the Vite react-ts template at the repo root (keep `README.md` and `docs/`), install the exact pinned versions from the header, configure Tailwind 4, the `@/` alias, Vitest (jsdom) and Playwright (Chromium). Add the ESLint rule that bans `Date.now()` and `new Date()` with no arguments outside `src/time/clockStore.ts`. Set `<html dir="rtl" lang="ar">` in `index.html`.
- [ ] **Step 4: Add brand tokens** in `tokens.css` with the exact hex values from Global Constraints, and `fonts.css` with `@font-face` for IBM Plex Sans Arabic and KFUPM Display (fallback chain so a missing KFUPM file falls back to IBM Plex).
- [ ] **Step 5: Run** `npx vitest run && npm run lint && npm run build`. Expected: all PASS.
- [ ] **Step 6: Commit** `chore: scaffold app, tooling and brand tokens`.

---

### Task 2: Schedule, stage engine and phase engine

**Files:**
- Create: `src/time/schedule.ts`, `src/time/stageEngine.ts`, `src/time/phaseEngine.ts`
- Test: `tests/unit/stageEngine.test.ts`, `tests/unit/phaseEngine.test.ts`

**Interfaces:**
- Produces (types in `schedule.ts`):
  - `type StageId = 'candidacy'|'information'|'attire'|'tickets'|'rehearsal'|'ceremony'|'celebration'|'certificate'`
  - `type Phase = 'pre-launch'|'journey'|'final-week'|'honors-day'|'ceremony-day'|'afterglow'`
  - `type DaySlot = 'morning'|'arrival'|'seated'|'ceremony'|'photos'`
  - `type StageStatus = 'upcoming'|'open'|'due-soon'|'closed'`
  - `interface Schedule { launch: number; ceremonyDateStatus: 'confirmed'|'tbc'; stages: Record<StageId,{opens:number; due?:number; closes?:number}>; milestones: {id: StageId; at: number}[]; honorsCeremony: {start:number; end:number}; ceremonyDay: Record<DaySlot,{start:number; end:number}>; afterglowStart: number }`
  - `export const SCHEDULE: Schedule` built from the mock table in the spec (all instants `+03:00`).
- Produces: `getStageStatus(id: StageId, now: number, s?: Schedule): StageStatus` (`due-soon` = within 72 h before `due`), `getPhase(now: number, s?: Schedule): { phase: Phase; slot?: DaySlot }`, `getJourneyProgress(now: number, s?: Schedule): number` (0..1, piecewise linear over `milestones`, 8 milestones evenly spaced at `i/7`, clamped), `getDayProgress(now: number, s?: Schedule): number` (0..1 across the five day slots, clamped), `getNextDeadline(now, s?): { id: StageId; due: number } | null`.
- Milestones (strictly increasing): candidacy 31 Jan, information 14 Feb, attire 14 Mar, tickets 21 Mar, rehearsal 4 Apr, ceremony 7 Apr 15:00, celebration 7 Apr 21:00, certificate 7 Apr 21:30. Day slots: morning 00:00-15:00, arrival 15:00-18:45, seated 18:45-20:00, ceremony 20:00-21:00, photos 21:00-21:30. `afterglowStart` = 7 Apr 21:30.

- [ ] **Step 1: Write failing tests.** `phaseEngine.test.ts`: table of `[ISO, expectedPhase, expectedSlot]` including `2027-01-30T23:59:59+03:00 → pre-launch`, `2027-01-31T00:00:00+03:00 → journey`, `2027-03-30T23:59:59+03:00 → journey`, `2027-03-31T00:00:00+03:00 → final-week`, `2027-04-06T00:00:00+03:00 → honors-day`, `2027-04-07T00:00:00+03:00 → ceremony-day/morning`, `…T15:00 → arrival`, `…T18:45 → seated`, `…T20:00 → ceremony`, `…T21:00 → photos`, `…T21:30 → afterglow`, `2027-04-20 → afterglow`. `stageEngine.test.ts`: `getStageStatus('attire', 25 Mar due − 1 s) = 'due-soon'`, at due + 1 s = `'closed'`; `getJourneyProgress` equals `0` before 31 Jan, `2/7` at the attire milestone, `1` at the certificate milestone and after, and is non-decreasing across hourly samples from 5 Nov 2026 to 30 Apr 2027; `getDayProgress` is `0` at 00:00 and `1` at 21:30.
- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run tests/unit/stageEngine.test.ts tests/unit/phaseEngine.test.ts`. Expected: FAIL, modules missing.
- [ ] **Step 3: Implement** `schedule.ts`, `stageEngine.ts`, `phaseEngine.ts` as pure functions. When `ceremonyDateStatus` is `'tbc'`, `getJourneyProgress` returns the progress at the current stage start and does not advance past `candidacy` to later calendar-driven milestones until set to `'confirmed'`.
- [ ] **Step 4: Add a test for the TBC mode** (progress holds) and for reversal (progress at t1 < t2 implies `p(t1) <= p(t2)` and calling in reverse order gives the same values).
- [ ] **Step 5: Run** the same command. Expected: PASS.
- [ ] **Step 6: Commit** `feat(time): schedule, stage engine and phase engine`.

---

### Task 3: Clock store, URL state and presets

**Files:**
- Create: `src/time/clockStore.ts`, `src/time/urlState.ts`, `src/time/presets.ts`
- Test: `tests/unit/clockStore.test.ts`, `tests/unit/urlState.test.ts`, `tests/unit/presets.test.ts`

**Interfaces:**
- Consumes: `getPhase`, `SCHEDULE` from Task 2.
- Produces: `useClock` (zustand) with `{ mode: 'real'|'frozen'|'playing'; simulated: number; speed: number; setSimulated(ms: number): void; play(simMsPerRealSecond: number): void; pause(): void; useReal(): void }`; `getNow(): number`; `useNow(granularityMs?: number): number` (re-renders at most once per granularity, default 1000 ms); `parseTimeParam(search: string): number | null`; `formatTimeParam(ms: number): string` (ISO with `+03:00`); `interface Preset { id: string; label: { ar: string; en: string }; at: number; expectedPhase: Phase }`; `export const PRESETS: Preset[]` with at least: today, launch, details-due, lists-locked, attire-opens, sizes-due, seats-released, pickup, final-lock, rehearsal, honors-day, ceremony-morning, ceremony-arrival, ceremony-seated, ceremony-live, ceremony-photos, after.

- [ ] **Step 1: Write failing tests.** `clockStore`: with fake timers, `play(86_400_000)` advances `simulated` by one day per real second; `pause()` stops it; `useReal()` makes `getNow()` follow the real clock; `setSimulated` switches mode to `frozen`. `urlState`: `parseTimeParam('?t=2027-04-07T18:30')` returns the epoch for `2027-04-07T18:30:00+03:00`; invalid input returns `null`; `formatTimeParam` round-trips. `presets`: for every preset, `getPhase(at).phase === expectedPhase`.
- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run tests/unit/clockStore.test.ts tests/unit/urlState.test.ts tests/unit/presets.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the store (single `setInterval` at 250 ms while playing, cleared on pause), URL helpers and presets. `clockStore.ts` is the only file allowed to read the real clock.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(time): simulated clock, URL state and presets`.

---

### Task 4: Honor tiers and capacity maths

**Files:**
- Create: `src/domain/types.ts`, `src/domain/honorTier.ts`, `src/domain/capacity.ts`
- Test: `tests/unit/honorTier.test.ts`, `tests/unit/capacity.test.ts`

**Interfaces:**
- Produces: `type HonorTier = 'gold'|'silver'|'bronze'`; `honorTier(gpa: number): HonorTier | null` (gold ≥ 3.75 up to 4.00, silver ≥ 3.25 and < 3.75, bronze ≥ 3.00 and < 3.25, otherwise `null`; throws `RangeError` for `NaN`, negatives, or values above 4.00); `computeCapacity(i: { totalSeats: number; graduates: number; reserved: { vip: number; easyAccess: number; ops: number } }): { pool: number; guaranteed: number; secondPool: number; perGraduate: number; breakEvenTakeUp: number }`.

- [ ] **Step 1: Write failing tests.** `honorTier`: `3.75 → 'gold'`, `4.00 → 'gold'`, `3.749 → 'silver'`, `3.25 → 'silver'`, `3.249 → 'bronze'`, `3.00 → 'bronze'`, `2.99 → null`, `0 → null`; `NaN`, `-1`, `4.01` throw `RangeError`. `capacity`: with `5000 / 3000 / {300,300,100}` returns `pool 4300`, `guaranteed 3000`, `secondPool 1300`, `perGraduate ≈ 1.433`, `breakEvenTakeUp ≈ 0.433`; `graduates > pool` yields `guaranteed = pool` and `secondPool = 0`.
- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run tests/unit/honorTier.test.ts tests/unit/capacity.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both as pure functions. No rounding of GPA values.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(domain): honor tiers and capacity maths`.

---

### Task 5: i18n, RTL and formatters

**Files:**
- Create: `src/i18n/ar.ts`, `src/i18n/en.ts`, `src/i18n/index.ts`, `src/i18n/format.ts`
- Test: `tests/unit/format.test.ts`

**Interfaces:**
- Produces: `type Locale = 'ar'|'en'`; `useLocale(): { locale: Locale; setLocale(l: Locale): void; dir: 'rtl'|'ltr' }`; `t(key: string, params?: Record<string, string|number>): string`; `formatDate(ms: number, locale: Locale, opts?: Intl.DateTimeFormatOptions): string` (timezone `Asia/Riyadh`, Western digits via `numberingSystem: 'latn'`); `formatNumber(n: number, locale: Locale): string`; `plural(locale: Locale, n: number, forms: { zero?: string; one: string; two?: string; few?: string; many?: string; other: string }): string` (uses `Intl.PluralRules`); `genderForm(locale: Locale, gender: 'm'|'f', forms: { m: string; f: string }): string`.

- [ ] **Step 1: Write failing tests.** `formatDate(2027-04-07T20:00+03:00, 'ar')` contains `2027` and `7` with Western digits and no Arabic-Indic digits; `plural('ar', n, forms)` selects the right form for `1, 2, 3, 11, 100`; `genderForm('ar','f',…)` returns the feminine form; setting locale to `en` flips `dir` to `ltr` and updates `document.documentElement`.
- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run tests/unit/format.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the dictionaries (keys used by later tasks are added per task), the formatters and the `document` attribute sync.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(i18n): bilingual dictionary, RTL and formatters`.

---

### Task 6: UI kit (Button, Chip, Dialog, Toast)

**Files:**
- Create: `src/ui/Button.tsx`, `src/ui/Chip.tsx`, `src/ui/Dialog.tsx`, `src/ui/toast.ts`
- Test: `tests/unit/Button.test.tsx`, `tests/e2e/ui-kit.spec.ts`

**Interfaces:**
- Consumes: brand tokens (Task 1), motion tokens (Global Constraints).
- Produces: `<Button variant="primary|secondary|ghost|gold|destructive" size="md|lg" state?="loading|success" onClick>` built with cva and clsx; states idle, hover, press (`scale(0.97)`), loading, success (2 px blur crossfade to a check), disabled; hover effect is a `clip-path` Matrix-bar wipe under `(hover: hover) and (pointer: fine)`; `<Chip selected onToggle>`; `<Dialog open onOpenChange title>` on Base UI primitives; `toast.success|error|info(message)` on Sonner.

- [ ] **Step 1: Write failing tests.** `Button.test.tsx`: renders an accessible name; `loading` sets `aria-busy="true"` and ignores clicks; `disabled` ignores clicks; under reduced motion, no `scale` transform class is applied. `ui-kit.spec.ts`: keyboard focus shows a visible outline; a 390 px viewport keeps hit area at least 44 px.
- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run tests/unit/Button.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the four components. Check the final Base UI package name on npm before installing.
- [ ] **Step 4: Run** `npx vitest run tests/unit/Button.test.tsx && npx playwright test tests/e2e/ui-kit.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): button, chip, dialog and toast with motion states`.

---

### Task 7: Data layer and seat service

**Files:**
- Create: `src/data/fixtures/graduates.ts`, `src/data/fixtures/seats.ts`, `src/data/services/seatService.ts`, `src/data/services/ticketService.ts`, `src/data/services/gownService.ts`, `src/data/services/honorService.ts`, `src/data/services/adminService.ts`, `src/data/index.ts`, `src/session/sessionStore.ts`
- Test: `tests/unit/seatService.test.ts`, `tests/unit/ticketService.test.ts`, `tests/unit/gownService.test.ts`

**Interfaces:**
- Consumes: `computeCapacity`, `honorTier` (Task 4), `getNow` (Task 3).
- Produces (all in `src/domain/types.ts` or the service file):
  - `type SeatStatus = 'available'|'held'|'confirmed'|'blocked'`; `type SeatZone = 'general'|'easy-access'|'vip'|'ops'`; `interface Seat { id: string; section: string; row: number; number: number; zone: SeatZone; status: SeatStatus; heldBy?: string; heldUntil?: number; confirmedBy?: string }`.
  - `interface SeatService { listSections(): { id: string; zone: SeatZone; total: number; available: number }[]; listSeats(sectionId: string): Seat[]; hold(seatId: string, userId: string, now: number): Result<Seat, 'taken'|'limit'|'not-found'>; release(seatId: string, userId: string): void; confirm(userId: string, now: number): Result<Seat[], 'no-hold'|'expired'>; expireHolds(now: number): void; simulateRival(now: number): { seatId: string } | null }`. `type Result<T,E> = { ok: true; value: T } | { ok: false; error: E }`.
  - `type Persona = { id: string; role: 'graduate'|'guest'|'admin'; gender: 'm'|'f'; name: { ar: string; en: string }; college: CollegeId; gpa: number }`, `type CollegeId` (7 colleges from the guideline), `useSession(): { persona: Persona; setPersona(id: string): void }`.
  - `TicketService.getEntitlement(userId): { guaranteed: 1; second: 'unclaimed'|'claimed'|'released'|'waitlist' }`, `claimSecond(userId, now): Result<…>` (uses the 1,300 pool). `GownService.requestSize`, `bookPickup(slotId)`, `markPickedUp`, `markReturned`, each with statuses `none|requested|slot-booked|picked-up|returned`. `HonorService.get(userId): { tier: HonorTier | null; gpa: number }`. `AdminService.addException(id, name, reason)`, `list()`.
  - Seat fixture: 5,000 seats generated deterministically with zones `vip 300`, `easy-access 300`, `ops 100`, `general 4300`; hold TTL is 10 simulated minutes.

- [ ] **Step 1: Write failing tests.** `seatService`: 5,000 seats and zone counts `300/300/100/4300`; `hold` on an available seat succeeds, on a held seat by another user returns `{error:'taken'}`; a user cannot hold more than 2 seats (`'limit'`); a hold expires when `expireHolds(heldUntil + 1)` runs; calling `expireHolds` with an earlier time does not delete or duplicate holds; `confirm` after expiry returns `'expired'`; no seat ever has two `confirmedBy`; `simulateRival` never takes the user's held seat. `ticketService`: a second ticket claimed once only; claims beyond the 1,300 pool return `waitlist`; release at the 28 Mar milestone returns unclaimed seats to the pool. `gownService`: status transitions only move forward; pickup slots respect capacity.
- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run tests/unit/seatService.test.ts tests/unit/ticketService.test.ts tests/unit/gownService.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** fixtures, services (in-memory, zustand-backed) and the session store. Include 8 personas: male and female graduates for each of gold, silver, bronze and none; plus a guest and an admin. Include one worst-case name persona (very long Arabic name) and one single-letter English name.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(data): mock services, seat holds and personas`.

---

### Task 8: Demo console (time travel)

**Files:**
- Create: `src/features/demo-console/DemoConsole.tsx`, `src/features/demo-console/Scrubber.tsx`
- Test: `tests/unit/Scrubber.test.tsx`, `tests/e2e/demo-console.spec.ts`

**Interfaces:**
- Consumes: `useClock`, `PRESETS`, `parseTimeParam`, `formatTimeParam` (Task 3), `useSession` (Task 7), `useLocale` (Task 5), `Button`, `Chip`, `Dialog` (Task 6).
- Produces: `<DemoConsole />` (floating, bottom-start corner, neutral plain chrome): datetime input; scrubber from 5 Nov 2026 to 30 Apr 2027 with deadline ticks; preset chips; play/pause with speeds `1 day/s` and `1 hour/s`; "Use real time"; persona select; GPA slider with tier override; language, reduced motion, low-end, `ceremonyDateStatus` and worst-case data toggles. State mirrors into the URL (`?t=…&persona=…`) and reads from it on load. Exposes `useDemoFlags(): { reducedMotion: boolean; lowEnd: boolean; worstCase: boolean }`.

- [ ] **Step 1: Write failing tests.** `Scrubber.test.tsx`: dragging to a position maps to the expected epoch within the min/max; keyboard arrows move by one hour (or one day with Shift); ticks are rendered for every deadline in `SCHEDULE`. `demo-console.spec.ts`: choosing the "Ceremony live" preset sets the URL to include `t=2027-04-07T20:00`; reloading that URL restores the time; clicking "Use real time" removes `t`.
- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run tests/unit/Scrubber.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the console. It must never be inside the main layout flow and never animate content on switching.
- [ ] **Step 4: Run** `npx vitest run tests/unit/Scrubber.test.tsx && npx playwright test tests/e2e/demo-console.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(demo): time-travel console, presets, personas and URL state`.

---

### Task 9: App shell, routes, root phase, public landing

**Files:**
- Create: `src/app/routes.tsx`, `src/app/RootPhase.tsx`, `src/features/guest/GuestHome.tsx`, update `src/app/App.tsx`
- Test: `tests/e2e/landing.spec.ts`

**Interfaces:**
- Consumes: `getPhase` (Task 2), `useNow` (Task 3), `t`/`formatDate` (Task 5), `Button` (Task 6), `useSession` (Task 7).
- Produces: routes `/`, `/guide`, `/me`, `/me/attire`, `/me/tickets`, `/honors`, `/admin`; `<RootPhase />` sets `data-phase` and `data-slot` on `<html>` from `getPhase(useNow())`; the public landing first screen with the headline, countdown (NumberFlow digits, days and hours before the day, hours and minutes on the day), three large buttons "Gate and parking", "My seat", "Map", a "Begin the journey" cue, a permanent "Skip to practical info" link, and the role chooser (graduate or guest) below the first screen. Guests never see a login prompt.

- [ ] **Step 1: Write the failing e2e test.** At 390 px wide, the three practical buttons are visible without scrolling; the page has no login prompt; setting `?t=2027-04-07T20:00` sets `html[data-phase="ceremony-day"][data-slot="ceremony"]`.
- [ ] **Step 2: Run and see it fail.** Run: `npx playwright test tests/e2e/landing.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** routing, `RootPhase`, the landing and the role chooser.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): shell, routes, phase attribute and public landing`.

---

### Task 10: Matrix field and loop manifest

**Files:**
- Create: `src/brand/matrix/pairs.ts`, `src/brand/matrix/MatrixField.tsx`, `src/brand/matrix/manifest.ts`, `public/matrix/.gitkeep`
- Test: `tests/unit/matrixPairs.test.ts`, `tests/unit/MatrixField.test.tsx`

**Interfaces:**
- Produces: `type MatrixColor = 'turquoise'|'green'|'beige'|'sand'|'yellow'|'blue'|'gray'|'white'`; `ALLOWED_MATRIX_PAIRS: Record<MatrixColor, MatrixColor[]>` (background to allowed stripe colours, transcribed from guideline page 78; verify each row against the PDF); `assertAllowedPair(bg, stripe): void` (throws `Error` for any other pair); `<MatrixField background stripes seed density frequency animate />` (generated SVG placeholder following the construction rules: 5° skewed grid, Bold, Medium and Light units; seeded and deterministic); `MATRIX_LOOPS: { id: string; src: string; background: MatrixColor; stripes: MatrixColor }[]` and `<MatrixLoop id />` that plays a `.webm` from `public/matrix/` muted and looped, falling back to `<MatrixField>` when the file is missing.

- [ ] **Step 1: Write failing tests.** `matrixPairs`: `assertAllowedPair('turquoise','green')` passes; `assertAllowedPair('sand','green')` throws; a gradient prop is not accepted by the type. `MatrixField`: the same seed gives identical SVG output; the root transform never contains a negative x-scale and the skew is exactly `5deg` even when the document `dir` is `rtl`.
- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run tests/unit/matrixPairs.test.ts tests/unit/MatrixField.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the placeholder generator. Mark the component with a `// REPLACE: use FAST Matrix Generator exports` comment. When Eyad's loops arrive, add them to `MATRIX_LOOPS` only.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(brand): matrix field with approved pairings and loop slot`.

---

### Task 11: Journey bar (story and tracker)

**Files:**
- Create: `src/features/journey/useJourney.ts`, `src/features/journey/JourneyBar.tsx`
- Test: `tests/unit/useJourney.test.ts`, `tests/e2e/journey.spec.ts`

**Interfaces:**
- Consumes: Tasks 2, 3, 5, 10, 6; `useSession` (Task 7).
- Produces: `useJourney(): { phase: Phase; slot?: DaySlot; progress: number; dayProgress: number; nextDeadline: ReturnType<typeof getNextDeadline>; dateStatus: 'confirmed'|'tbc' }`; `<JourneyBar variant="story"|"tracker" />`. Story: GSAP ScrollTrigger scrubs the whole path (a Matrix staircase climbing toward the stage) with native scroll; a "You are here" marker sits at `progress`. Tracker (graduate dashboard): the nine stages from the spec as ticks, completed ones checked from services. The walker is a flat 2.5D SVG, with a male (bisht) and female (abaya and sash) variant chosen by `persona.gender`. In RTL the layout mirrors and the Matrix does not.

- [ ] **Step 1: Write failing tests.** `useJourney.test.ts`: at three simulated times the returned `progress` matches `getJourneyProgress`, and moving time backwards lowers `progress`. `journey.spec.ts`: at `?t=2027-03-14T09:00` the marker sits at the attire tick; scrolling to the bottom reaches the end state; in Arabic the Matrix element has no negative scale; with reduced motion on, scroll scrubbing is replaced by stepped states and no console error occurs.
- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run tests/unit/useJourney.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the hook and component, with the static poster fallback when `lowEnd` is true.
- [ ] **Step 4: Run** `npx vitest run tests/unit/useJourney.test.ts && npx playwright test tests/e2e/journey.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(journey): scroll story and stage tracker with you-are-here marker`.

---

### Task 12: Ceremony-day Ascent and site phase theming

**Files:**
- Create: `src/features/journey/DayAscent.tsx`, `src/brand/phases.css`
- Modify: `src/features/journey/JourneyBar.tsx` (render `<DayAscent />` when `phase === 'ceremony-day'`)
- Test: `tests/e2e/ascent.spec.ts`

**Interfaces:**
- Consumes: `useJourney` (Task 11), `MatrixField` (Task 10), NumberFlow.
- Produces: `<DayAscent />`: the bar zooms from days to hours (GSAP timeline), earlier stages collapse into one "Your journey so far" chip, five hourly steps (morning, arrival, seated, ceremony, photos) light as their time passes, the Matrix `density` and `frequency` rise with `dayProgress`, and floodlights are flat 5° bands animated with `opacity` only. `phases.css` swaps tokens under `[data-phase="ceremony-day"]` (deeper turquoise ground, yellow accents) and under `[data-phase="final-week"]` and `[data-phase="honors-day"]` (smaller shifts). The hero copy changes to "Today" and the countdown shows hours, minutes and seconds.

- [ ] **Step 1: Write the failing e2e test.** For each preset in `ceremony-morning|arrival|seated|live|photos`, the bar shows the hourly steps with the correct ones lit; no CSS `gradient` appears in computed backgrounds of floodlight elements; scrubbing back to `2027-04-06` removes the Ascent and restores the normal bar.
- [ ] **Step 2: Run and see it fail.** Run: `npx playwright test tests/e2e/ascent.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the Ascent and theming. Reduced motion shows the final lit state of the current slot without travel.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(journey): ceremony-day ascent and phase theming`.

---

### Task 13: Completion sequence and Afterglow

**Files:**
- Create: `src/features/journey/Completion.tsx`, `src/features/journey/Afterglow.tsx`
- Modify: `src/features/journey/JourneyBar.tsx`
- Test: `tests/unit/completionTrigger.test.ts`, `tests/e2e/afterglow.spec.ts`

**Interfaces:**
- Produces: `shouldPlayCompletion(prev: number, next: number, s?: Schedule): boolean` (true only when `prev < afterglowStart <= next`, i.e. a forward crossing); `<Completion onDone />` (about 6 s: the walker takes the certificate, the Matrix settles into the octagon seal, the bar fills yellow and beige); `<Afterglow />` (persistent: the walker holds the certificate on the stage, countdown becomes "Day n since", thank-you copy, next steps: photos, certificate collection from 11 Apr, gown return 11 to 15 Apr, survey, honors keepsake).

- [ ] **Step 1: Write failing tests.** `completionTrigger`: `(before, after)` straddling `afterglowStart` is true; `(after, after)` false; `(after, before)` false (backward); a time-lapse stepping over the boundary in several ticks plays once. `afterglow.spec.ts`: scrubbing to `2027-04-07T21:00` then to `21:31` plays the sequence once; loading directly at `2027-04-09` shows Afterglow without the sequence; "Day n since" shows `2` on 9 April.
- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run tests/unit/completionTrigger.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the trigger, both components and the wiring. Reduced motion shows the end frame directly.
- [ ] **Step 4: Run** `npx vitest run tests/unit/completionTrigger.test.ts && npx playwright test tests/e2e/afterglow.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(journey): completion sequence and afterglow state`.

---

### Task 14: Guest guide (gates, parking, accessibility, map, FAQ)

**Files:**
- Create: `src/features/guest/Guide.tsx`, `src/features/guest/GateMap.tsx`, `src/features/guest/AccessibilityFlow.tsx`
- Test: `tests/unit/accessibilityFlow.test.ts`, `tests/e2e/guest.spec.ts`

**Interfaces:**
- Produces: `routeForParty(answer: { mobility: 'none'|'walks-slowly'|'wheelchair'; elderly: boolean }): { gate: 'gate-1'|'gate-3'; zone: SeatZone; parking: string }`; `<AccessibilityFlow />` asks one plain question ("Does anyone in your party use a wheelchair or walk slowly?") and shows the routed gate and zone; `<GateMap />` an SVG with five numbered gates (1 family guests, 2 VIP, 3 guests with disabilities, 4 staff, 5 graduates), parking, restrooms, prayer rooms, medical point, exits; `<Guide />` with schedule, dress guide (male: white thobe, white ghutra and black agal, bisht, formal shoes; female: abaya and sash), FAQ and an embedded-video placeholder labelled "Mock: previous year's video". No login prompt anywhere.

- [ ] **Step 1: Write failing tests.** `routeForParty`: wheelchair and walks-slowly route to `gate-3` and `easy-access`; none routes to `gate-1` and `general`. `guest.spec.ts`: all guide content is reachable without sign-in at 390 px; the question form is keyboard operable; the gate map labels are readable in Arabic and English.
- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run tests/unit/accessibilityFlow.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the pages. Map data is mock and labelled "Mock: replace with official map".
- [ ] **Step 4: Run** `npx vitest run tests/unit/accessibilityFlow.test.ts && npx playwright test tests/e2e/guest.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(guest): guide, gate map and accessibility routing`.

---

### Task 15: Graduate dashboard and attire flow

**Files:**
- Create: `src/features/graduate/Dashboard.tsx`, `src/features/graduate/Attire.tsx`
- Test: `tests/e2e/graduate-attire.spec.ts`

**Interfaces:**
- Consumes: `useJourney`, `JourneyBar variant="tracker"` (Task 11), `gownService` (Task 7), `getStageStatus` (Task 2), `plural`, `genderForm` (Task 5).
- Produces: `/me` dashboard (welcome by name with gendered Arabic, current stage, nearest deadline with status chip, checklist); `/me/attire`: size entry (bisht sizes for men; abaya size plus sash for women), pickup slot booking (capacity cap), pickup QR, return flow, status `none → requested → slot-booked → picked-up → returned`. A deadline passing in simulated time disables the action and shows an overdue message with what to do next. Signing in is a persona choice labelled "Mock: university SSO".

- [ ] **Step 1: Write the failing e2e test.** At `?t=2027-03-20` a graduate can enter a size and book a slot; at `?t=2027-03-26` size entry is closed and says so; at `?t=2027-03-25T23:00` the dashboard shows a `due-soon` chip; the long-Arabic-name persona fits without clipping at 390 px.
- [ ] **Step 2: Run and see it fail.** Run: `npx playwright test tests/e2e/graduate-attire.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the dashboard and attire flow with Button success states and a QR card for pickup.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(graduate): dashboard and attire flow with deadline states`.

---

### Task 16: Tickets, seat map and QR card

**Files:**
- Create: `src/features/graduate/Tickets.tsx`, `src/features/graduate/SeatMap.tsx`, `src/ui/QrCard.tsx`
- Test: `tests/unit/QrCard.test.tsx`, `tests/e2e/seats.spec.ts`

**Interfaces:**
- Consumes: `seatService`, `ticketService` (Task 7), `AccessibilityFlow`/`routeForParty` (Task 14), `computeCapacity` (Task 4).
- Produces: `<Tickets />`: attendance confirmation first, then entitlement (1 guaranteed, plus the second-ticket pool with a live "seats remaining" NumberFlow counter), then seat selection. `<SeatMap />` has three levels: stadium overview, section picker, seat grid (arrow-key roving focus, list alternative). A hold shows a countdown on simulated time; a simulated rival can take a seat and the user sees a clear conflict message and a suggested alternative. `<QrCard ticket guestName />`: full-screen high-contrast card (name, gate, seat, QR), a "Share with guest" action, and the label "Mock: offline use needs the real build".

- [ ] **Step 1: Write failing tests.** `QrCard.test.tsx`: renders gate, seat and a QR image with an accessible label; a 60-character Arabic name wraps and does not overflow. `seats.spec.ts`: holding a seat shows a countdown that follows simulated time; scrubbing past the hold expiry releases it; a rival taking a seat during the choice shows the conflict message; after confirmation the seat cannot be selected again; the second-ticket counter never goes below 0; no more than about 400 seat nodes are in the DOM at once.
- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run tests/unit/QrCard.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the pages.
- [ ] **Step 4: Run** `npx vitest run tests/unit/QrCard.test.tsx && npx playwright test tests/e2e/seats.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(graduate): tickets, three-level seat map and QR card`.

---

### Task 17: Honor page and award scene

**Files:**
- Create: `src/features/honors/awardGeometry.ts`, `tierMaterials.ts`, `namePlaque.ts`, `capability.ts`, `AwardScene.tsx`, `HonorPage.tsx`, `HonorDetails.tsx`
- Test: `tests/unit/awardGeometry.test.ts`, `tests/unit/tierMaterials.test.ts`, `tests/unit/capability.test.ts`, `tests/e2e/honors.spec.ts`

**Interfaces:**
- Consumes: `honorService` (Task 7), `HonorTier` (Task 4), `useDemoFlags` (Task 8), `useLocale` (Task 5).
- Produces:
  - `buildAwardGeometry(): THREE.BufferGeometry`: an octagonal tapering tower (lathe profile, 8 segments) with a flared crown, an octagonal collar and 8 arched openings, on a rectangular plinth.
  - `TIER_MATERIALS: Record<HonorTier, { color: string; metalness: number; roughness: number; lightColor: string; lightIntensity: number }>` with the same `lightIntensity` for all tiers (gold `#E6B84A`, silver `#C9CED4`, bronze `#B87333`).
  - `createNamePlaqueTexture(name: string, locale: Locale): Promise<THREE.CanvasTexture>`: awaits `document.fonts.load` for KFUPM Display, draws with Canvas2D so Arabic shapes correctly, shrinks to fit long names.
  - `detectCapability(env: { hasWebGL: boolean; deviceMemory?: number; cores?: number; lowEndFlag: boolean }): 'full'|'fallback'`.
  - `<AwardScene tier name onSequenceEnd skip />` (R3F; about 13 s: case slides in, ribbon releases, lid opens, light spills, award rises on a spring, turns, name engraves, CTA appears; skippable by tap, Escape or Enter; then drag-to-rotate idle). `<HonorPage />`: for `tier !== null` shows the scene and then a "See honor ceremony details" button that scrolls to `<HonorDetails />` (date Tue 6 Apr, time, venue, schedule, arrival and gate, guest tickets, dress, photography, add to calendar, FAQ); for `tier === null` shows only `<HonorDetails />`. Case ribbon trim uses the graduate's college colour. The whole page is lazy-loaded (`React.lazy`). The fallback plays a pre-rendered video of the same sequence per tier with the name as DOM text (a placeholder clip is acceptable until frames are captured). The honor reveal is available at any simulated time for now.

- [ ] **Step 1: Write failing tests.** `awardGeometry`: the vertex positions are 8-fold symmetric around the Y axis; bounding-box height is greater than 3 times its width; `buildAwardGeometry()` returns the same vertex count on every call. `tierMaterials`: all three tiers have the same `lightIntensity`; colours match the values above. `capability`: no WebGL gives `'fallback'`; `lowEndFlag` gives `'fallback'`; a modern desktop gives `'full'`. `honors.spec.ts`: a gold persona sees the scene and the CTA; a no-honor persona sees only the details; with WebGL disabled the name, tier label and details are visible; with reduced motion on, the final pose appears within 2 s; the long-Arabic-name persona's plaque does not overflow; the Three.js chunk is not requested on `/` (check network).
- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run tests/unit/awardGeometry.test.ts tests/unit/tierMaterials.test.ts tests/unit/capability.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the geometry, materials, plaque texture, capability probe, scene and page. Use a procedural studio environment (Lightformers), device pixel ratio capped at 1.75 and `frameloop="demand"` outside the sequence.
- [ ] **Step 4: Run** `npx vitest run tests/unit && npx playwright test tests/e2e/honors.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(honors): procedural tower award, tier materials and ceremony details`.

---

### Task 18: Admin screen

**Files:**
- Create: `src/features/admin/AdminPage.tsx`
- Test: `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `adminService`, `seatService` (Task 7), `computeCapacity` (Task 4), `Dialog` (Task 6).
- Produces: `/admin`: capacity bars (reserved zones, guaranteed seats, second-ticket pool, break-even take-up), a table of exceptional attendees with an "Add exception" dialog (ID, name, reason), and a worst-case-safe list for long names. The page is labelled "Mock: committee decision pending" for the exception rules.

- [ ] **Step 1: Write the failing e2e test.** Adding an exception appears in the table; a 60-character Arabic name wraps without breaking the layout at 390 px; capacity numbers match `computeCapacity` for 5000/3000/{300,300,100}.
- [ ] **Step 2: Run and see it fail.** Run: `npx playwright test tests/e2e/admin.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the page.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): capacity view and exceptional attendees`.

---

### Task 19: Hardening, worst-case data and full-journey e2e

**Files:**
- Modify: whichever feature files the tests expose as broken.
- Create: `tests/e2e/presets.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/worst-case.spec.ts`

- [ ] **Step 1: Write the failing e2e tests.** `presets.spec.ts`: for every preset in `PRESETS` and for both languages, `/` loads with no console errors and `data-phase` equals `expectedPhase`. `worst-case.spec.ts`: with the worst-case flag, long and one-letter names, plural forms for 1, 2, 3, 11 and 100 seats, empty lists and a very large class count render without horizontal scroll at 320 px and 390 px. `a11y.spec.ts`: every page has a heading, visible focus, labelled controls and WCAG AA contrast using the approved pairings; reduced motion removes all travel animation.
- [ ] **Step 2: Run and see failures.** Run: `npx playwright test`. Expected: some FAIL.
- [ ] **Step 3: Fix** each failure in its owning feature, keeping the Global Constraints.
- [ ] **Step 4: Run with CPU throttling** (6x) for the Journey and the honor page and confirm the low-end fallback triggers without breaking content.
- [ ] **Step 5: Run** `npx vitest run && npx playwright test && npm run lint && npm run build`. Expected: all PASS.
- [ ] **Step 6: Commit** `test: full-journey, worst-case and accessibility coverage`.

---

## Self-review

- **Spec coverage:** time travel and URL state (Tasks 3, 8); ceremony-day animation (12); completion and afterglow (13); journey bar and scroll (11); award, tiers, name, fallbacks (17); seats, holds, QR, capacity (7, 16, 18); attire (15); guest and accessibility (14); Matrix rules and the loop slot (10); i18n and RTL (5); motion, brand and library roles (Global Constraints, 6); testing and worst-case data (19). The `ceremonyDateStatus` toggle lives in Tasks 2 and 8.
- **Type consistency:** times are epoch milliseconds everywhere. `Phase`, `DaySlot` and `StageId` are defined once in Task 2 and reused. `HonorTier` is defined in Task 4 and reused in Tasks 7 and 17. `Persona`, `Seat` and `SeatZone` are defined in Task 7 and reused in Tasks 14 to 18.
- **Open item:** the real Matrix loops from Eyad drop into `public/matrix/` and `MATRIX_LOOPS` (Task 10). The Base UI package name, the QR library and the guideline page 78 pairings are verified at install.


---

## Implementation notes (deviations from this plan)

Recorded after the build, so the plan matches what exists.

- **TypeScript 6.0.3, not 7.0.2.** `typescript-eslint` 8.72 supports TypeScript below 6.1, so 7.x broke linting. Revisit when `typescript-eslint` supports 7.
- **`@base-ui/react` 1.9.0 (stable)** replaced the release candidate `@base-ui-components/react`.
- **URL time format** is Riyadh local time without an offset (`?t=2027-04-07T20:20`), shorter than the ISO-with-offset form planned.
- **The clock reads `?t=` before the first render**, so loading straight into a phase is never treated as time moving forward (otherwise the completion sequence would play on load).
- **Matrix loops** are four generator exports (hero, ascent, completion, afterglow; the honors loop reuses ascent), recoloured and re-encoded because the originals were 3000px and 47 MB in total.
- **Task 6 browser tests** run against a `/kit` page added for that purpose.
- **Seat grid** is a labelled group of toggle buttons, not an ARIA grid: axe rejected `aria-pressed` on `gridcell`.
- **Colour contrast:** white on brand green (3.7:1) and turquoise on brand yellow (4.15:1) fail AA for small text, so small text on green and yellow is black. Large headings keep turquoise on yellow.
- **Capability probe** also runs a small CPU benchmark (median of three runs, 22 ms threshold). It is skipped under browser automation unless `?bench=1` is present.
- **The 2D honor version** is an animated flat SVG of the same award, not a pre-rendered video. A pre-rendered clip per tier is still an option.
- **Not done:** the award does not settle into the page corner on scroll (a small tier medallion appears instead), and there is no sound.
- **Gown return window and pickup** use the schedule's mock dates. Demo buttons simulate the desk steps.
