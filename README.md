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

## What is in it

| Area | Where |
|---|---|
| Simulated clock, stage and phase engines | `src/time/` |
| Journey Bar, scroll story, ceremony-day **Ascent**, **Completion** and **Afterglow** | `src/features/journey/` |
| Honor award (3D tower in gold, silver, bronze; 2D fallback) | `src/features/honors/` |
| Guest guide, gate map, accessibility routing | `src/features/guest/` |
| Graduate dashboard, attire, tickets, seat map, QR tickets | `src/features/graduate/` |
| Admin (capacity and exceptional cases) | `src/features/admin/` |
| Mock services and personas | `src/data/` |
| Brand tokens, Matrix, loops | `src/brand/`, `public/matrix/` |

Design: `docs/phase2/architecture.md`. Plan: `docs/superpowers/plans/2026-11-05-kfupm-graduation-demo.md`.

## Brand notes

- Colours, fonts and the Matrix follow the KFUPM Brand Guidelines v1.2 (June 2026).
- **KFUPM Display is exclusive.** Its files live in `public/fonts/kfupm/` and are git-ignored. Without them the app falls back to IBM Plex Sans Arabic. Keep the demo private until the university clears the font.
- The Matrix loops in `public/matrix/` were exported from the FAST Matrix Generator, recoloured to the exact brand values and encoded to 1080px VP9. Only approved colour pairings are used (`src/brand/matrix/pairs.ts`).
- The header uses the official KFUPM Student Affairs logo (colour and white versions, unmodified, in `src/brand/logo/`). A ceremony-specific logo may replace it later. KFUPM Display use is cleared by the client.

## Not real yet

Sign-in (university single sign-on), ticketing vendor, seat locking on a server, offline QR, the stadium map, the honors ceremony details and the exception rules are all mock and labelled as such.
