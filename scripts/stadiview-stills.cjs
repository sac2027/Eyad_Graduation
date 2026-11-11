// Screenshots of the 3D stadium for the requester's review.
// Usage: start the dev server on 5173 (npm run dev), then: node scripts/stadiview-stills.cjs
const { chromium } = require('playwright')

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const CHROME = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'
const OUT = process.env.OUT || 'docs/review/stadiview'
// ONLY=18 or ONLY='^2[0-7]' takes just the pictures whose names match.
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null

// A graduate in the middle of the booking window, and a few steps the pictures need.
const T = '2027-03-20T10:00'
const GRAD = `persona=grad-m-gold&t=${T}`
const INSPECT_FREE = `const h = window.__stadiview; h.inspect(h.freeSeat(h.myZone(), 5))`
const GUEST_FLOW = `(async () => {
  const h = window.__stadiview
  const g = h.sampleGraduate(true, 5)
  document.querySelector('[data-sv-guest-toggle]')?.click()
  await new Promise((r) => setTimeout(r, 200))
  const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
  set(document.querySelector('[data-sv-ticket-input]'), g.tickets[0])
  document.querySelector('[data-sv-ticket-find]').click()
  await new Promise((r) => setTimeout(r, 200))
  document.querySelector('[data-sv-ticket-graduate]').click()
})()`

const ROUTE_FLOW = `(async () => {
  document.querySelector('[data-sv-guest-toggle]')?.click()
  await new Promise((r) => setTimeout(r, 200))
  const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
  set(document.querySelector('[data-sv-ticket-input]'), 'TICKET-G1-204')
  document.querySelector('[data-sv-ticket-find]').click()
  await new Promise((r) => setTimeout(r, 200))
  document.querySelector('[data-sv-route-toggle="ticket"] [data-sv-route-button]').click()
  document.querySelector('[data-sv-guest-close]').click()
  document.querySelector('[data-sv-fit=all]').click()
})()`

// [file name, URL, width, height, what to do before the picture]
const SHOTS = [
  ['01-overview-desktop-en', '/stadium?lang=en&tier=3', 1440, 900, {}],
  ['02-hover-tooltip-desktop-en', '/stadium?lang=en&tier=3', 1440, 900, { hover: 'P3-12-07' }],
  ['03-hover-tooltip-desktop-ar', '/stadium?tier=3', 1440, 900, { hover: 'S-10-009' }],
  ['04-first-person-pitch-seat-en', '/stadium?lang=en&tier=3', 1440, 900, { sit: 'P3-12-07' }],
  ['05-first-person-south-stand-en', '/stadium?lang=en&tier=3', 1440, 900, { sit: 'S-10-060' }],
  ['06-first-person-vip-box-ar', '/stadium?tier=3', 1440, 900, { sit: 'VIP-03-025' }],
  ['07-overview-phone-ar', '/stadium?tier=2', 390, 844, {}],
  ['08-first-person-phone-ar', '/stadium?tier=2', 390, 844, { sit: 'P1-05-07' }],
  ['09-no-webgl-seat-map-en', `/stadium?lang=en&tier=0&${GRAD}`, 1440, 900, { fallback: true, js: `${INSPECT_FREE}` }],
  // Phase 3: the interface and the booking flow.
  ['10-graduate-mid-window-en', `/stadium?lang=en&tier=3&${GRAD}`, 1440, 900, {}],
  ['11-matrix-zoomed-ar', `/stadium?tier=3&${GRAD}`, 1440, 900, { js: `${INSPECT_FREE}; const zin = document.querySelectorAll('.sv-mx__zoom .sv-icon')[1]; [0, 1, 2].forEach((k) => setTimeout(() => zin.click(), 300 + k * 150))`, wait: 1500 }],
  ['12-inspector-bookable-en', `/stadium?lang=en&tier=3&${GRAD}`, 1440, 900, { js: INSPECT_FREE, wait: 2500 }],
  ['13-seat-card-ar', `/stadium?tier=3&${GRAD}`, 1440, 900, { js: `${INSPECT_FREE}; setTimeout(() => document.querySelector('[data-sv-book]').click(), 400)`, wait: 1800 }],
  ['14-guest-located-en', `/stadium?lang=en&tier=3&persona=guest&t=${T}`, 1440, 900, { js: GUEST_FLOW, wait: 1800 }],
  ['15-phone-inspector-sheet-ar', `/stadium?tier=2&${GRAD}`, 390, 844, { js: INSPECT_FREE, wait: 2500 }],
  ['16-phone-seat-list-en', `/stadium?lang=en&tier=2&${GRAD}`, 390, 844, { js: `document.querySelector('[data-sv-dock-button=matrix]').click(); setTimeout(() => document.querySelector('[data-sv-tab=list]').click(), 200)` }],
  ['17-overview-ar', `/stadium?tier=3&${GRAD}`, 1440, 900, {}],
  // Phase 4: the people, the march, the bowl and the light.
  ['18-full-house-overview-ar', `/stadium?tier=3&${GRAD}&full=1`, 1440, 900, {}],
  ['19-full-house-overview-en', `/stadium?lang=en&tier=3&${GRAD}&full=1`, 1440, 900, {}],
  ['20-figures-gallery', '/stadium?svavatars=1&tier=0&lang=en', 1600, 700, { fallback: 'gallery', js: '1', wait: 2500 }],
  ['21-figures-first-person-en', `/stadium?lang=en&tier=3&${GRAD}&full=1`, 1440, 900, { sit: 'P3-20-07' }],
  ['22-carpet-and-gate-first-person-en', `/stadium?lang=en&tier=3&${GRAD}`, 1440, 900, { sit: 'P1-30-14', js: `document.querySelector('[data-sv-landmark=gate]').click()`, wait: 1500 }],
  ['23-bowl-from-north-west-stand-en', `/stadium?lang=en&tier=3&${GRAD}`, 1440, 900, { sit: 'NW-15-001' }],
  ['24-gold-arc-from-south-stand-en', `/stadium?lang=en&tier=3&persona=guest&t=${T}`, 1440, 900, { js: GUEST_FLOW, wait: 1800 }],
  ['25-route-from-gate-1-en', `/stadium?lang=en&tier=3&persona=guest&t=${T}`, 1440, 900, { js: ROUTE_FLOW, wait: 1800 }],
  ['26-landmark-chips-phone-ar', `/stadium?tier=2&${GRAD}`, 390, 844, { sit: 'S-10-060' }],
  ['27-bloom-tier-3-en', `/stadium?lang=en&tier=3&${GRAD}&full=1&svbloom=1`, 1440, 900, { wait: 6000, js: '1' }],
]

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
  for (const [name, url, width, height, step] of SHOTS) {
    if (ONLY && !ONLY.test(name)) continue
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
    await page.goto(BASE + url)
    if (step.fallback === 'gallery') {
      await page.locator('[data-sv-gallery]').waitFor()
    } else if (step.fallback) {
      await page.locator('[data-stadium-fallback]').waitFor()
      await page.waitForFunction(() => window.__stadiview && typeof window.__stadiview.myZone === 'function')
    } else {
      await page.waitForFunction(() => window.__stadiview && window.__stadiview.ready === true, undefined, { timeout: 60000 })
      await page.waitForTimeout(600)
    }
    if (step.hover) {
      const p = await page.evaluate((id) => window.__stadiview.project(id), step.hover)
      await page.mouse.move(p.x - 20, p.y - 14)
      await page.mouse.move(p.x, p.y, { steps: 3 })
      await page.waitForTimeout(700)
    }
    if (step.sit) {
      await page.evaluate((id) => window.__stadiview.select(id), step.sit)
      await page.waitForFunction(() => window.__stadiview.state().mode === 'pov', undefined, { timeout: 60000 })
      await page.waitForTimeout(900)
    }
    if (step.js) {
      await page.evaluate(step.js)
      await page.waitForTimeout(step.wait ?? 1200)
    }
    // JPEG: the seats are fine detail, and a lossless picture of them is four times the size.
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 88 })
    console.log('saved', `${OUT}/${name}.jpg`)
    await page.close()
  }
  await browser.close()
})()
