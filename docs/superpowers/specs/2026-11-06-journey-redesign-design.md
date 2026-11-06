# Journey redesign: design

Date: 2026-11-06. Status: approved by Eyad on 2026-11-06, with the welcome moment added.

## Intent and the why

The demo works, but the requester (Eyad) finds it "not stunning, not pro, very basic". The demo exists to win approval and funding from KFUPM Student Affairs and the President's committee, so it has to move people. The landing page must open on the graduate's journey itself, framed as a countdown to the moment they hold their certificate. It should feel like the real ceremony, and the reference is the requester's aerial photo of the night ceremony in the KFUPM stadium: a lit stage with two LED screens and sweeping light beams, a central aisle between blocks of chairs, green light, and stands on both sides.

## Goals

1. **The landing page opens on the journey.** It is a night-stadium scene with a path (the central aisle) running from the entrance to the stage. Nine checkpoints sit along the path, one per step, and a certificate on a podium on the stage is unmistakably a certificate.
2. **The countdown lives on the path.** It shows on the stage's two LED screens and ends at the certificate moment on ceremony night: 7 April 2027, 21:30 Riyadh time, when the existing schedule already opens the certificate stage and the afterglow begins. At zero, the graduate takes the certificate.
3. **The graduate is a realistic, faceless, colourless silhouette**, seen from behind and walking up the aisle. He is always walking slowly, with a gentle aura, even while his position stays still. **His position on the path depends on time only** (the simulated clock), never on scroll.
4. **A custom right-side scrollbar ("rail")** shows the same path, the same checkpoints and the same graduate. As the reader scrolls through the nine step sections, the rail's graduate walks down the rail. At the last section he takes the certificate.
5. **Nine step sections**, one per checkpoint, carry each step's details: dates, what to do, what is needed, and personal status for a signed-in graduate.
6. **Emotional, personal language** throughout, Arabic first. Practical facts stay plain.
7. **Celebrations**: fireworks on first entry, at the certificate moment, on ceremony day and after, and in the honor reveal; confetti when a task is completed.
8. **Logo**: the KFUPM mark and wordmark only, with "Student Affairs" removed.
9. **Honor page**: a cinematic sequence of lighting cues during the unboxing.
10. **Time travel stays**: the demo console can set any date and time, and every time-driven state can be reached through it.

## Non-goals

- No real backend. Data stays mocked.
- No 3D stadium on the landing page. The scene is 2D, layered and animated. 3D stays on the honor page only.
- No filmed footage, at the requester's choice. The walk cycle is drawn by us.
- No sound.

## Anti-goals (failure even if it "works")

- A parent on a mid-range phone cannot find the gate or parking within the first screen.
- The path can't be read: a viewer can't tell which step they are on, what is next, or what the object on the stage is.
- The figure looks like a cartoon or a game character, or shows a face or skin colour.
- The motion stutters on a mid-range phone, or ignores reduced motion.
- Celebrations become annoying (fireworks on every page load) or break brand rules (colours outside the palette, gradients on the logo or the Matrix, a flipped Matrix).
- Scrolling becomes worse than native, for example because scroll is hijacked or the rail can't be dragged or used from the keyboard.

## Constraints

- **Brand v1.2.** Turquoise #115F66, Green #009767, Beige #ECE0C7, Sand #AA8C6D, Yellow #F0BA4F, Blue #71B8D4, Gray #ADACAD. Fonts: KFUPM Display (cleared by the client) and IBM Plex Sans Arabic.
  - The Matrix keeps its 5° skew, is never flipped, and has no gradients. Only the approved colour pairs are used.
  - The logo is shown only in its supplied colour and white versions.
  - Night lighting is built from flat translucent layers in brand colours: soft-edged beams and glows are allowed in the scene, but never on the logo or the Matrix.
- **Bilingual.** Arabic (RTL, default) and English. The rail stays on the right in both languages, as the requester asked.
- **Mobile-first.** Many visitors are parents on phones.
- **Existing architecture.**
  - One simulated clock (`src/time/clockStore.ts`) with pure engines (`stageEngine`, `phaseEngine`).
  - Phases: pre-launch, journey, final-week, honors-day, ceremony-day (slots morning, arrival, seated, ceremony, photos) and afterglow.
  - zustand stores, GSAP and Motion for animation, Tailwind 4 tokens, mocked services, and the Vitest and Playwright suites.
- **Performance.**
  - The landing scene must stay smooth (about 60 fps target, never janky) on a mid-range phone.
  - The low-end flag and reduced motion each get a calm version: a still pose with a static aura, and no fireworks.

## Approaches considered

### Hero scene

- **A. Perspective aisle, seen from behind (chosen).** The aisle runs from the bottom of the screen to the stage at the top, the figure walks away from the viewer (so there is no face, naturally), and the countdown is on the stage screens. It mirrors the reference photo, has the most emotion, and fits a phone's portrait shape. Trade-off: the far checkpoints are small, so labels sit flat beside the posts instead of in perspective.
- B. Side-view winding path. Easier to label, but it reads like a board game and the figure's profile shows more of the person.
- C. 3D stadium. The most spectacular, but heavy on phones and costly to build. Ruled out.

### The figure

- A. Silhouette made from filmed footage. Most realistic; the requester declined it.
- **B. Hand-drawn walk cycle (chosen by the requester).** A 12-frame back-view walk cycle drawn as SVG silhouettes, with gait reference for real proportions: shoulder sway, bisht drape swing, heel lift. It is played slowly with eased frame timing. One figure wears a thobe, ghutra and bisht; the other wears an abaya and sash.

### Time to position

- Spacing checkpoints by date was rejected: the figure would freeze from February to mid-March and then rush through five checkpoints in the last four days.
- **Evenly spaced checkpoints with time-based interpolation between them (chosen).**

## Decisions already made

| Decision | By |
|---|---|
| Countdown target: 7 Apr 2027 21:30, the certificate moment that closes the ceremony night. At zero the graduate takes the certificate. Ceremony start (20:00) is shown in the sections and the families strip | Requester (date), Claude (exact time, chosen to keep the client's step order and match the existing schedule) |
| The figure always walks slowly with an aura, even when his position is unchanged | Requester |
| Hand-drawn walk cycle (option B) | Requester |
| Public visitors see the journey the way a graduate sees it: the current persona if it is a graduate, otherwise the default graduate persona (male, bisht). Signed-in graduates see their own gender and name | Requester ("like the graduating student page"); the fallback is Claude's call |
| Rail on the right in both languages | Requester |
| Emotional language, and celebrations (fireworks and confetti) | Requester |
| Logo: KFUPM mark and wordmark only | Requester |
| Cinematic lighting cues on the honor page | Requester |

## The design

### 1. Steps and checkpoints

The client's nine steps:

1. Candidacy
2. Information
3. Attire
4. Tickets
5. Rehearsal
6. **Arrival** (new as its own stage: 7 Apr from 15:00, when the gates open, to 18:45, when guests are seated)
7. March & Ceremony
8. Celebration & Photos
9. Shield & Certificate

`STAGE_ORDER` gains `arrival`. The stage engine and its tests are updated to match.

**Position over time (`pathProgress(now)`, a pure function):**

- Checkpoint *i* sits at `i / 8` along the path.
- Each checkpoint's *arrival time* is its existing `SCHEDULE.milestones` entry, so the path, the dashboard and the stage engine never disagree:
  - candidacy: 31 Jan
  - information: 14 Feb
  - attire: 14 Mar
  - tickets: 21 Mar
  - rehearsal: 4 Apr
  - arrival (new): 7 Apr 15:00
  - march & ceremony: 7 Apr 20:00 (moved from 15:00, now that Arrival has its own step)
  - celebration & photos: 7 Apr 21:00
  - certificate: 7 Apr 21:30
- Between two arrival times, progress is linear in time.
- Before launch the figure stands at the entrance gate. He climbs onto the stage at 20:00, stands there through the ceremony and photos, and takes the certificate at 21:30.

**Checkpoint states:**

| State | Look |
|---|---|
| Passed | Green light and ✓ |
| Current | Gold and pulsing, with a "You are here" label and the deadline |
| Next | Outlined |
| Future | Dim |

For a signed-in graduate who misses a deadline, the post turns red (still in the brand palette).

### 2. Landing page layout

- **Header**: KFUPM logo, navigation, and the language button.
- **Scene** (the first screen):
  - Stadium silhouettes with stands, light towers and the campus skyline.
  - Chair blocks on either side of the aisle.
  - The aisle itself, as a red-carpet strip.
  - Nine checkpoint posts, with flat labels alternating left and right, each showing number, name and date.
  - The stage with two LED screens: days on one, hours:minutes:seconds on the other. The label below reads "until your certificate is in your hands".
  - The podium, with the certificate under a spotlight: cream paper, the KFUPM tower emblem, a green seal, a gold ribbon, and the label "شهادتك / Your certificate".
  - The graduate silhouette at `pathProgress`, with an aura.
  - The personal opening line: the graduate's name, for example «خالد، كل خطوة تقرّبك من اللحظة التي حلمتَ بها».
  - A families strip: Gates · Parking · My seat · Accessibility.
  - A scroll cue.
- **Phone**: the same scene in portrait. Labels shorten to number and name, and tapping a post opens its details.
- **Scroll**: the scene is the first screen and scrolls away normally. It is not a pinned backdrop. The rail stays visible throughout.
- **Ways in**: a "Sign in" button in the header and two small links under the opening line ("I'm graduating" and "I'm a guest") replace the current role-chooser section, so the committee can still enter the graduate area without the demo console.
- **Behaviour**:
  - Tapping or clicking a post scrolls to its section.
  - The scene never moves with scroll. The only exception is an optional slight parallax of the background layers, which is off under reduced motion.

### 3. Time-driven scene states

| Time | Scene |
|---|---|
| Pre-launch | Stadium dark, a few lamps, the figure waiting at the gate, the screens counting down |
| Journey | Lamps along the aisle light up as checkpoints are passed |
| Final week | Stage lights warm up, flags along the aisle |
| Honors day | Gold accents, and a note pointing to the honors ceremony |
| Ceremony day | Beams sweep (as in the photo). Slots: arrival (crowd lights in the stands), seated (chairs fill), ceremony |
| 20:00–21:30 on 7 Apr | The figure is on stage during the ceremony and photos; the screens count the last minutes |
| 21:30 on 7 Apr | He takes the certificate and lifts it. Fireworks |
| Afterglow | The figure holds the certificate high, with the aura at its brightest. Screens read "Congratulations, Class 57", plus the days since |

### 4. The figure

- **Drawing**: 12-frame SVG walk cycles drawn from behind, one in a bisht and one in an abaya. Solid near-black on the night scene; there is no light scene. No face, no skin colour.
- **Speed**: a slow cycle of about 1.6 s per stride. It plays continuously whether or not his position changes.
- **Aura**: a soft gold glow that "breathes" on a 4 s cycle, plus a thin rim light from the stage.
- **Scale**: gets smaller as he nears the stage (perspective).
- **Reduced motion and low-end**: a single standing frame with a static aura.

### 5. The right rail

- **Position**: fixed on the right edge. 64 px wide on desktop, 28 px on phones.
- **Contents**: a straight vertical version of the aisle with the same nine posts, a tiny version of the same silhouette (with its aura), and the podium with the certificate at the bottom.
- **Scroll link**:
  - The figure's position follows the page's scroll through the step sections, not time. The rail is the reader's place on the page; the scene is the graduate's place in time.
  - The posts show the same time-based states as the scene (passed, current, next, future, late), so both always agree on where the graduate really is. The post of the section being read gets a ring.
  - At section ⑨ the rail's figure reaches the podium and lifts the certificate with a small burst of light only. The full fireworks are kept for the real 21:30 moment.
- **Interaction**:
  - It is a real scrollbar: drag the figure to scroll, and click a post to jump to its section.
  - Keyboard: the rail is a slider with arrow keys and Home/End.
  - Wheel and touch scrolling stay native.
  - The browser's own scrollbar is hidden on desktop only.
  - On phones, tapping the rail opens a sheet listing the steps.
- **Labels**: on hover or focus on desktop.

### 6. Step sections ①–⑨

Each section contains:

- **Heading**: a large number, an emotional title, and a one-line emotional subtitle.
- **A practical card**:
  - the dates (opens and deadline)
  - what you do
  - what you need
  - for a signed-in graduate: their status (done, pending or late, with time left) and the action button that goes to the existing page
- **A photo slot**, holding a brand-styled placeholder until real photos arrive.
- **Styling**: the brand's skewed panels, alternating light and dark, with the Matrix as an accent.

Section-specific content:

- **⑥ Arrival**: gates (including Gate 3 for guests with disabilities), parking and the accessibility route.
- **⑦ March**: the line-up summary and a link to the map.
- **⑨ Certificate**: the finale. A large certificate moment, then fireworks.

After ⑨ comes a short "For families" block (gates, parking, accessibility, FAQ), then the footer.

The existing horizontal scroll story (`JourneyStory`) and the separate `JourneyBar` are replaced by the scene and the rail. The ceremony-day bar (`DayBar`/`DayAscent`), `Completion` and `Afterglow` are folded into the scene's time states.

### 7. Language

- **Tone**: emotional and personal, Arabic first. The graduate's name appears only when the persona is a graduate; guests and admins see a nameless version of the same line. Arabic lines have masculine and feminine forms chosen by the persona's gender.
- **Plain facts**: dates, gates and deadlines are always stated plainly next to the emotional line.
- **Writing**: Claude writes the copy in both languages, and it lives in the existing i18n files.
- **Sample lines**:
  - ① «اسمك بين الخريجين... تأكّد أنه هناك» / "Your name among the graduates. Make sure it's there."
  - ③ «البشت الذي انتظرته سنوات» / "The bisht you've waited years to wear."
  - ⑨ «هذه شهادتك. هذا حلمك. وقد تحقق» / "This is your certificate. This is your dream, and it has come true."

### 8. Celebrations

A single canvas fireworks and confetti engine, using brand colours only (yellow, beige, green, blue, sand).

| Trigger | Effect |
|---|---|
| First landing-page visit in a session (requested by Eyad) | The **welcome moment**, about 4 s, tap to skip: the stadium's light banks switch on one after another, a burst of fireworks over the stage, and a one-line welcome on the stage screens («أهلًا بك في رحلة الدفعة ٥٧» / "Welcome to the journey of Class 57") before they switch to the countdown. Under reduced motion or low-end: the lights are simply on and the welcome line shows for 3 s, with no fireworks |
| Completing a step (gown booked, seat confirmed) | A short burst of confetti |
| The real certificate moment (scene at 21:30, and section ⑨ from 21:30 on) | Full fireworks |
| Reaching ⑨ in the rail or section ⑨ before 21:30 | A small burst of light only |
| Ceremony day and afterglow | Stronger bursts on entry |
| Honor reveal | Fireworks in the brand colour mapped to the tier: Yellow for gold, Gray and Blue for silver, Sand for bronze. The award's metal colours are materials, not palette colours, and stay as they are |

**Rules**:
- No sound.
- Never more than once per trigger per session.
- Off under reduced motion and on low-end devices, replaced with a still "glow" version.

### 9. Logo

New SVGs are made from the supplied files with the ungrouped "Student Affairs" descriptor group removed. Only the `KFUPM_Wordmark` and `KFUPM_Iconmark` groups are kept, and the viewBox is cropped to fit. Colour and white versions both stay.

### 10. Honor page lighting cues

These are added to the existing GSAP timeline in `AwardScene`, timed to its current beats:

1. **Blackout.** One spotlight snaps on over the closed case, with a visible cone (an additive cone mesh).
2. **The ribbon releases.** Two to four background beams sweep in the tier colour: gold warm, silver cool white-blue, bronze amber.
3. **The lid opens.** Light spills from inside: the inner light ramps up and the beams narrow toward the case.
4. **The award rises.** Rim lights trace the tower's edges, and small glints run over the windows.
5. **Engraving.** Two or three camera-flash bursts (short light spikes).
6. **Settle.** Fireworks in the tier colour behind the canvas, then a slow drifting highlight on the metal.

The 2D fallback gets the same cues, as CSS and SVG light layers.

## Testing and checks

- **Unit**:
  - `pathProgress` and the checkpoint states at every arrival time and between them
  - the new arrival stage
  - the rail's mapping from scroll to position
  - the rule that fireworks fire once per session
- **End-to-end**:
  - the scene state at every demo preset
  - countdown on the screens
  - certificate at 20:00
  - rail drag, click and keyboard
  - section ⑨ triggering the rail's certificate
  - families strip visible in the first screen on a 390 px phone
  - Arabic and English
  - reduced motion and low-end
  - no sideways scroll at 320 px
  - axe accessibility checks
- **Visual**: screenshots of the scene in each time state, for the requester's review.

## Left to the builder

- Exact SVG artwork, label placement and timing curves, as long as they follow the brand and pass the checks above.
- How the scene is layered technically (SVG and DOM layers with GSAP, or a canvas for the crowd lights and fireworks).
- Photo placeholders until real photos arrive.

## Approval checkpoints with the requester

1. This document.
2. A still image of the first screen (the scene at a mid-journey date and on ceremony night). This is a hard stop: the artwork is built and approved first, and animation work starts only after that.
