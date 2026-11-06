# KFUPM Graduation 2027 (Class 57): front-end demo

A bilingual (Arabic default, English) front-end demo of the graduation experience, built on mock data.
It is a showcase of the final vision, not the real system. Every mocked item is labelled in the UI.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run e2e        # browser tests (Playwright, needs Chromium)
npm run build      # type-check and production build
```

## The demo console (time travel)

Click **Demo** (bottom corner). It lets you:

- jump to any date and time (datetime box, a scrubber with deadline ticks, or one-click presets such as *Sizes due*, *Honors day*, *Ceremony live*, *After*);
- run a time lapse (1 day per second, or 1 hour per second on 6 and 7 April);
- switch persona (male or female graduate with gold, silver, bronze or no honor; a guest; an admin) and drag the GPA to change the tier;
- toggle English, reduced motion, low-end device, "Date TBC" and worst-case data (very long Arabic names).

Every state is a link, for example `/?t=2027-04-07T20:20&persona=grad-f-gold&lang=en`. Times are Riyadh time.
Also in the console: **Reset demo data** (scrubbing time backwards cannot undo earlier actions).

## The landing journey

- **The scene** (`src/features/stadium/`): a night stadium modelled on the ceremony photos. The aisle runs to the stage, with nine checkpoints (the client's nine steps), the countdown on the stage's two screens, and the certificate on the podium. The graduate (a faceless silhouette from behind, in a bisht or an abaya) is placed **by time only**. He keeps walking slowly with a breathing aura even when his position doesn't change.
- **Time states**:
  - before launch: dark stadium, waiting at the gate
  - during the journey: lamps light up as steps are reached
  - final week: stage lights warm up, flags
  - honors day: gold accents
  - ceremony day: crowd, beams, filled chairs
  - from 8 pm: he is on stage
  - at **9:30 pm on 7 April**: the countdown ends, he takes the certificate and the certificate moment plays with full fireworks
  - after the ceremony: he holds it high, and the screens say "Congratulations, Class 57"
- **The rail** (`src/features/rail/`): the page's scrollbar on the right, drawn as the same aisle with the same graduate. He walks down as you scroll through the nine step sections and takes the certificate at the last one. You can drag it, click a post, or use the keyboard; on phones a tap opens the step list.
- **Step sections** (`src/features/steps/`): one per step, with an emotional title (masculine or feminine wording by persona), then the plain facts and, for a graduate, their own status (done, waiting, or late) and the action.
- **Celebrations** (`src/features/celebrate/`):
  - one fireworks and confetti canvas in brand colours
  - the welcome moment on the first visit of a session (lights on, fireworks, a welcome line on the screens; tap to skip)
  - confetti when a task is completed
  - fireworks in the tier colours on the honor page
  - nothing is drawn under reduced motion or on a low-end device
  - automated browsers skip the welcome moment unless the URL has `?welcome=1`

## What is in it

| Area | Where |
|---|---|
| Simulated clock, stage and phase engines | `src/time/` |
| Stadium scene, graduate silhouette, certificate, stage screens | `src/features/stadium/` |
| Scroll rail, step sections, celebrations, certificate moment | `src/features/rail/`, `src/features/steps/`, `src/features/celebrate/`, `src/features/moment/` |
| Honor award (3D tower in gold, silver, bronze; 2D fallback) and its lighting script | `src/features/honors/` |
| Guest guide, gate map, accessibility routing | `src/features/guest/` |
| Graduate dashboard, attire, tickets, seat map, QR tickets | `src/features/graduate/` |
| Admin (capacity and exceptional cases) | `src/features/admin/` |
| Mock services and personas | `src/data/` |
| Brand tokens, Matrix, loops | `src/brand/`, `public/matrix/` |

Design: `docs/phase2/architecture.md` and `docs/superpowers/specs/2026-11-06-journey-redesign-design.md`. Plans: `docs/superpowers/plans/`.
Review screenshots: `docs/review/` (regenerate with `node scripts/scene-stills.cjs` while the dev server runs).

## Deploying (Cloudflare Pages)

Build command `npm run build`, output directory `dist`. `public/_redirects` sends every path to the app so links such as `/me/tickets` open directly.

## Brand notes

- Colours, fonts and the Matrix follow the KFUPM Brand Guidelines v1.2 (June 2026).
- **KFUPM Display** is cleared for this demo by the client. Its files live in `public/fonts/kfupm/` and are git-ignored, so a deploy built from the repository falls back to IBM Plex Sans Arabic unless the files are added.
- The Matrix loops in `public/matrix/` were exported from the FAST Matrix Generator, recoloured to the exact brand values and encoded to 1080px VP9. Only approved colour pairings are used (`src/brand/matrix/pairs.ts`).
- The header uses the official KFUPM logo (mark and wordmark, colour and white versions, in `src/brand/logo/`), taken from the supplied files with the "Student Affairs" descriptor removed at the client's request. A ceremony-specific logo may replace it later.

## Not real yet

Sign-in (university single sign-on), ticketing vendor, seat locking on a server, offline QR, the stadium map, the honors ceremony details and the exception rules are all mock and labelled as such.
