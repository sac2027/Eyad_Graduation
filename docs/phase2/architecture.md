# KFUPM Graduation Experience: Phase 2 architecture

Status: draft for approval. Nothing is built. Phase 3 starts only after this is approved.
Date written: 5 Nov 2026. Ceremony: Wed 7 Apr 2027 (Class 57). Honors ceremony: Tue 6 Apr 2027.

## 1. What this phase decides

1. The stack and why (section 3).
2. A single simulated clock that drives the whole site, so you can travel to any date or time (section 5).
3. The Journey Bar, including a ceremony-day animation and a post-ceremony animation (section 6).
4. How the 3D honor award is built, played, and degraded on weak devices (section 7).
5. The motion language, brand rules turned into engineering rules, performance, accessibility, testing (sections 8 to 12).

## 2. Locked inputs

| Topic | Decision |
|---|---|
| Date | Ceremony Wed 7 Apr 2027. Honors Tue 6 Apr 2027. Keep a `ceremonyDateStatus: confirmed or tbc` switch for the demo |
| Scope | Front-end demo with mocked data. A clean data layer so a real backend can replace it later |
| Venue | Stadium, 5,000 seats, graduates on the field (not counted in seats) |
| Class | About 3,000 graduates (assumed). Reserved: 300 VIP, 300 easy-access near Gate 3, 100 operations. Guest pool 4,300 |
| Tickets | 1 guaranteed seat per graduate. 1,300-seat second-ticket pool, first come first served, confirm by deadline, unclaimed seats released Sun 28 Mar |
| Honors | Cumulative GPA before the ceremony semester. Gold 3.75 to 4.00, Silver 3.25 to under 3.75, Bronze 3.00 to under 3.25. Below 3.00: no award, ceremony details only |
| Honor reveal | Available at any time for now. Real lock date later is Tue 6 Apr |
| Women's logistics | Same as men for now |
| Award | The campus-tower award from the photos. Silver and bronze are recolours of the gold one |
| Chants and songs | Out of scope. The site is silent by default |
| Digits and dates | Western digits (0-9) and Gregorian dates in Arabic text, matching KFUPM's own posters. Hijri as an optional secondary label |

## 3. Stack

### 3.1 Approaches considered

| | A. Vite + React + TS, 3D only on the honor page (recommended) | B. Next.js, same libraries | C. 2D and pre-rendered video only |
|---|---|---|---|
| Fit | A demo with no backend. Static deploy. Fastest to iterate | Better for SEO and a real backend later, heavier to demo | Cheapest, runs on any phone |
| Cost | Low | Medium (SSR and routing complexity) | Lowest, but no true 3D |
| Risk | 3D bundle on one route only | SSR hydration with WebGL and RTL adds bugs | Three tiers x languages of video variants, name overlay only |
| Verdict | Best match for the brief | Revisit if the real build chooses Next | Used as the low-end fallback inside A |

Recommendation: A. Components stay framework-agnostic so they port to Next later.

### 3.2 Libraries and roles

Versions checked on npm on 5 Nov 2026.

| Role | Library | Version | On the curated list? |
|---|---|---|---|
| App | React, React DOM | 19.3.1 | Not a pick-ui-library item |
| Build | Vite | 8.3.6 | Not a pick-ui-library item |
| Language | TypeScript | 7.0.2 | Not a pick-ui-library item |
| Routing | react-router-dom | 7.18.5 | Not a pick-ui-library item |
| Styling | Tailwind CSS | 4.3.4 | Pairs with cva and clsx |
| Variants | class-variance-authority, clsx | 0.7.1, 2.1.1 | Yes |
| State | zustand | 5.0.16 | Yes |
| UI motion (springs, layout, enter and exit, button states) | motion | 14.9.1 | Yes |
| Counters (countdown digits, seat counts) | @number-flow/react | 0.6.2 | Yes |
| Accessible primitives (dialog, popover, select, tabs) | @base-ui-components/react | 1.0.0-rc.0 | Yes (check the final package name before install) |
| Toasts (seat held, deadline alerts) | sonner | 2.0.8 | Yes |
| Icons | lucide-react (style-matched to the octagon icon set, or custom SVG) | 1.69.0 | No |
| Scroll scrub and sequence timelines | gsap + ScrollTrigger | 3.15.1 | No, my own call |
| 3D | three, @react-three/fiber, @react-three/drei | 0.187.0, 9.8.2, 10.7.9 | No, my own call |
| QR codes | a small QR library (for example `qrcode`) | pin at install | No |
| Tests | Vitest, Playwright | 5.1.0, 1.64.1 | No |

Role split to avoid overlap: GSAP owns anything scroll-scrubbed and every long cinematic timeline. Motion owns UI micro-interactions, layout transitions and exits. Three.js owns only the award. No smooth-scroll hijacking library: scroll stays native.

## 4. Architecture

```
Demo console (time, persona, language, low-end, worst-case data)
        |
   clockStore  -->  stageEngine / phaseEngine  (pure functions of "now")
        |                         |
   data layer (fixtures + services) -->  features (journey, guest, graduate, honors, admin)
                                          |
                                     ui kit + brand tokens + i18n
```

Rules:
1. **One time source.** Nothing reads `Date.now()` directly. Everything reads `useNow()` from `clockStore`. This is what makes time travel work.
2. **Pure engines.** `stageEngine(now, schedule)` and `phaseEngine(now, schedule)` return stage statuses, deadline states and the site phase. They have no side effects, so they are unit-testable.
3. **Repository pattern.** UI calls `ticketService`, `seatService`, `gownService`, `honorService`. Each is an interface with a mock implementation. A real backend later swaps the implementation.
4. **State.** zustand stores: `clock`, `session` (persona), `seats` (holds, confirmations), `gown`, `ui`. URL holds `?t=` and `?persona=` so any demo state is a shareable link. localStorage is wrapped in try/catch and optional.
5. **i18n and RTL.** Arabic default, English alternate. Logical CSS properties only (`ps-`, `me-`, `start`, `end`). Arabic plurals via `Intl.PluralRules('ar')`. Do not flip the Matrix (see section 9).

### 4.1 Mock schedule (matches the date table already shared)

| Event | When |
|---|---|
| Site launch, candidacy opens | Sun 31 Jan 2027 |
| Confirm details | by Thu 11 Feb |
| Candidate and honors lists locked | Thu 4 Mar |
| Attire and tickets open | Sun 14 Mar |
| Sizes and free seats due | Thu 25 Mar |
| Unclaimed seats released, waitlist | Sun 28 Mar |
| Gown pickup window | Sun 28 Mar to Thu 1 Apr |
| Final ticket lock | Thu 1 Apr |
| Rehearsals | Sun 4 Apr and Mon 5 Apr |
| Honors ceremony | Tue 6 Apr, evening |
| Main ceremony | Wed 7 Apr. Arrival 15:00 to 17:00, seated about 18:45, programme about 20:00 to 21:00, photos after |
| Certificate collection | from Sun 11 Apr |
| Gown return | Sun 11 to Thu 15 Apr |

All mock. They live in one `schedule.ts` file so changing a date changes the whole demo.

### 4.2 Site phases

| Phase | Range | Site feel |
|---|---|---|
| `pre-launch` | before 31 Jan | Teaser, "opens 31 Jan" |
| `journey` | 31 Jan to 30 Mar | Normal stage tracker |
| `final-week` | 31 Mar to 5 Apr | Urgent states, last-chance deadlines, density rising |
| `honors-day` | Tue 6 Apr | Honors ceremony highlight |
| `ceremony-day` | Wed 7 Apr, sub-phases: morning, arrival, seated, ceremony, photos | The ceremony-day animation (section 6.2) |
| `afterglow` | from Wed 7 Apr about 21:30 onward | The completion state (section 6.3) |

## 5. Demo console (time travel)

A small floating console, clearly separate from the design under test, neutral and plain.

- **Date and time:** a datetime input plus a scrubber from 5 Nov 2026 to 30 Apr 2027. Deadlines show as ticks on the scrubber. Time-of-day matters on 6 and 7 Apr.
- **Presets (chips):** Today, Launch, Details due, Lists locked, Attire opens, Sizes due, Seats released, Pickup, Final lock, Rehearsal, Honors day, Ceremony morning, Arrival, Ceremony, Photos, After.
- **Time lapse:** play and pause, speed 1 day per second, or 1 hour per second on 6 and 7 Apr. This is the pitch tool: watch the whole bar climb.
- **Use real time:** one click resets.
- **Persona:** male graduate, female graduate (abaya and sash avatar), guest, admin. Honor tier override (gold, silver, bronze, none) with a GPA slider.
- **Other toggles:** language, reduced motion, low-end device mode, `ceremonyDateStatus`, and a worst-case data toggle (long names, one-letter names, plural edge cases).
- **Deep links:** `?t=2027-04-07T18:30&persona=grad-m-gold`. Console state is mirrored into the URL.

## 6. Journey Bar and ceremony animations

Animation gate (per the animate skill): the Journey is a rare, first-time experience. Delight budget is allowed. Every sequence is skippable, has a reduced-motion version, and has a static fallback.

### 6.1 Normal journey

- Path: a staircase generated from the Matrix, climbing toward the stage. The walker climbs it.
- Scroll scrubs the whole journey (GSAP ScrollTrigger, native scroll). A "You are here" marker shows the real or simulated position, computed from `stageEngine`.
- Position is piecewise linear over the stage milestones (stage index plus the fraction of time elapsed within it). With `ceremonyDateStatus: tbc`, the marker rests at the current stage with a pulse.
- Practical shortcuts stay pinned. First screen: gate and parking, my seat, map, language.

### 6.2 Ceremony-day animation ("Ascent")

Triggers when `phase = ceremony-day`. This is the specific animation for the bar, and it reaches the whole site.

1. **Zoom.** The bar changes scale from days to hours. The earlier stages collapse into one chip, "Your journey so far". The remaining path becomes five hourly steps: morning, arrival, seated, ceremony, photos.
2. **Matrix intensifies.** The pattern's density and animation speed ramp up through the day, using the generator's Details and Frequency parameters as the knobs.
3. **Floodlights.** From arrival onward, light beams sweep the scene. They are drawn as flat 5° skewed bands with opacity changes, not gradients, to respect the brand rule.
4. **Final steps.** The walker climbs the last Matrix steps as time passes. Each hourly step lights up when its time passes.
5. **Ceremony moment.** At the programme start, the bar stills and the stage lights come up. At the certificate time, the walker reaches the stage.
6. **Whole site.** `data-phase="ceremony-day"` on the root swaps tokens (deeper turquoise ground, yellow accents), changes the hero copy to "Today", and swaps the countdown to hours and minutes (NumberFlow digits).

### 6.3 After the ceremony ("Afterglow")

Two pieces:
1. **Completion sequence (one-shot, about 6 seconds).** Plays when simulated time crosses the ceremony end while you are watching, or on first load into the afterglow phase. The walker takes the certificate, the Matrix bars settle into the octagon seal, the bar fills in yellow and beige.
2. **Afterglow state (persistent).** The walker stands on the stage with the certificate. The countdown becomes "Day n since". The hero thanks the graduate. The page shows next steps: photos, certificate collection from Sun 11 Apr, gown return Sun 11 to Thu 15 Apr, a feedback survey, and the honors keepsake.

Both are reduced-motion safe: a static end frame replaces the sequence.

### 6.4 Matrix generator dependency

The FAST Matrix Generator is the sanctioned source, and it supports Animate, Record (webm) and SVG export. I do not have the tool. Until I do, I build a placeholder that follows the published construction rules (5° skewed grid, Bold, Medium and Light units, approved colour pairings only). It is flagged for replacement with generator exports.

## 7. Honor award

### 7.1 Scene

- One R3F canvas on the honor route only, lazy-loaded.
- **Award model:** procedural, not a downloaded model. An octagonal, tapering tower (a lathe profile with 8 segments) with a flared crown, an octagonal collar and arched openings, on a rectangular plinth. It echoes the campus tower and the octagon seal. If you can supply a CAD or GLB file of the real award, I'll use it instead.
- **Tiers:** the same geometry, three materials. Gold, silver and bronze are physically based metals (full metalness, low roughness) with tier-specific light colour. Intensity, motion and duration are identical across tiers so bronze is never dimmer.
- **Case:** a velvet case in the brand's dark green, with a ribbon whose trim can pick up the graduate's college colour.
- **Lighting:** a procedural studio environment (no big HDR download) plus one key light.
- **Name:** drawn to a Canvas2D texture using KFUPM Display and applied to the plinth plaque. This keeps Arabic shaping correct. It is not 3D text.

### 7.2 Sequence (about 13 seconds, same for every tier)

Dark stage, case slides in, ribbon releases, lid opens, light spills, the award rises on a spring and turns, the name is engraved, one personalised line appears (DOM text), then the CTA "See honor ceremony details" appears. Then an idle turntable with drag-to-rotate (pointer capture).

Skippable at any point (tap, Escape or Enter). Never animate keyboard-triggered actions. Reduced motion: a 2-second crossfade to the final pose.

### 7.3 Below the fold

Scrolling dollies the camera while the award settles to the corner. Sections: date, time, venue, schedule, arrival and gate, guest tickets, dress, photography, add-to-calendar, FAQ. Honor ceremony details are visible to everyone. The award appears only for graduates with GPA 3.00 or above.

### 7.4 Weak devices and no WebGL

A probe runs on load (WebGL support, device memory, core count, a short frame-time test). Failure or "low-end" mode shows a pre-rendered video of the same sequence per tier, captured from the scene itself, with the name overlaid as DOM text. Devices pixel ratio is capped. `frameloop="demand"` outside the sequence.

## 8. Motion language

Tokens: ease-out `cubic-bezier(0.23, 1, 0.32, 1)`, ease-in-out `cubic-bezier(0.77, 0, 0.175, 1)`, drawer `cubic-bezier(0.32, 0.72, 0, 1)`. Never `ease-in` on UI. Animate `transform` and `opacity` only (plus `clip-path` for wipes).

| Element | Duration | Notes |
|---|---|---|
| Button press | 120 to 160 ms | scale 0.97 on `:active` |
| Hover | 150 ms | only under `(hover: hover) and (pointer: fine)` |
| Popover, tooltip | 125 to 200 ms | origin at the trigger |
| Dialog, drawer | 200 to 300 ms | |
| Page and section entrances | under 300 ms | one short stagger of 30 to 80 ms |
| Cinematic sequences (journey, unboxing, ascent, completion) | long, skippable | |

Button kit (cva variants: primary, secondary, ghost, gold, destructive). States: idle, hover, press, loading, success, disabled. The primary button's hover is a Matrix-bar wipe using `clip-path`. Loading morphs to a check with a 2px blur crossfade. Every button has a press response. Seat taps, size choices and chip toggles also animate. Frequent keyboard-driven actions have none.

Everything has a `prefers-reduced-motion` fallback that keeps meaning and drops travel.

## 9. Brand rules as engineering rules

1. Palette tokens only from guideline v1.2: Turquoise `#115F66`, Green `#009767`, Beige `#ECE0C7`, Sand `#AA8C6D`, Yellow `#F0BA4F`, Blue `#71B8D4`, Gray `#ADACAD`, plus white and black. Feedback: success `#2AA880`, error `#DE5E5E`, warning `#F2C56C`, info `#89C4DB`. Yellow text only at large sizes.
2. College colours may colour the march and graduate details.
3. Fonts: KFUPM Display for headlines. IBM Plex Sans Arabic for body (and Latin if its Latin glyphs are suitable, else IBM Plex Sans). KFUPM Display is exclusive: keep the demo private unless cleared.
4. Matrix: no gradients, never flipped (so RTL mirrors layout, not the Matrix), no changed skew, no full overlap on photos, one pattern per piece, approved colour pairings only (guide page 78).
5. Logo: no gradients or effects. Use the Student Affairs lockup as supplied.
6. Needs sign-off from Student Affairs: the Matrix as a walkable staircase, and rendered light on the award.

## 10. Performance and accessibility

Targets (to be measured in Phase 4, not promised now):
- First route small and fast on a mid-range phone.
- Three.js, the award and its fonts load only on the honor route.
- 60 fps on the Journey on a mid-range phone, and a static fallback below that.
- Seat map: never render 5,000 DOM nodes at once. Three levels: stadium overview, section picker, seat grid (hundreds). Keyboard grid navigation and a list alternative.
- WCAG AA contrast using the guide's approved pairings. Visible focus. Labels on every control.
- RTL tested at every breakpoint. Touch targets 44 px and up.

## 11. Testing

- **Vitest:** stage and phase engines across a table of dates (every deadline minus 1 second, at, and plus 1 second). Honor tiers at 2.99, 3.00, 3.249, 3.25, 3.749, 3.75, 4.00 and invalid values. Seat hold expiry under the simulated clock. Capacity maths (3,000 guaranteed + 1,300 pool = 4,300).
- **Playwright:** every console preset loads with no console errors. Arabic and English. 390 px mobile. 6x CPU throttle. WebGL disabled. Reduced motion. Screenshots at key phases.
- **Worst-case data (break-ui):** very long Arabic names, one-letter names, 1 seat vs 2 vs 11 (Arabic plural forms), missing college, empty lists, a very large class count.

## 12. Repository structure

```
src/
  app/            router, providers, root phase attribute
  brand/          tokens.css, fonts/, matrix/, logos/
  time/           clockStore.ts, schedule.ts, stageEngine.ts, phaseEngine.ts
  data/           fixtures/, repositories/, services/ (ticket, seat, gown, honor)
  i18n/           ar.ts, en.ts, formatters.ts
  ui/             Button, Chip, Dialog, Toast, QrCard, ...
  features/
    journey/      JourneyBar, DayAscent, Afterglow, StoryScroll
    guest/        guide, gates, parking, accessibility
    graduate/     dashboard, attire, tickets, seats, QR
    honors/       HonorPage, AwardScene, unboxing timeline, details
    admin/        exceptional attendees, capacity view
    demo-console/ time travel, persona, toggles
tests/            unit/ and e2e/
```

## 13. Risks and open items

| Risk | Plan |
|---|---|
| Matrix generator not available | Placeholder following the published rules, marked for replacement |
| Award fidelity | Procedural tower now. Replace with a CAD or GLB file if provided |
| KFUPM Display licence | Keep demo private until cleared |
| IBM Plex Sans (Latin) not in the zip | Check Latin coverage of Plex Sans Arabic, else use Plex Sans (open licence) |
| Weak phones and old Safari | Probe plus video fallback. Test on real devices |
| Ramadan and Eid dates move the real timeline | Dates live in one file |
| GSAP, three and the QR library are off the curated list | Disclosed. Pinned versions. Reviewed at install |
| Base UI package is at a release candidate | Confirm the stable package name before install |
| Honors GPA data and privacy | Honor reveal is private by default. Sharing is opt-in |

## 14. After approval

The next step is the implementation plan (writing-plans): a task-by-task breakdown with exact interfaces and tests, starting with the clock and stage engine, then the brand tokens and UI kit, then the Journey Bar and its day-of and afterglow states, then seats, attire and tickets, then the honor award.
