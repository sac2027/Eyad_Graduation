// Frame times of the 3D stadium, measured in a real browser on a production build.
// Usage: npm run build && npx vite preview --port 4173 --strictPort, then: node scripts/stadiview-frames.cjs
// FULL=1 measures a full house (every seat holding a figure).
//
// For a few seconds in the overview (with the idle turn on) and in first person, for tiers 1 and 2,
// on a desktop and a phone-sized screen, with the processor slowed four times, it records two things:
// - the time between animation frames. The test browser draws with software, which is many times
//   slower than a graphics card, so this is a worst case and says little about a real device.
// - the time the page's own code takes per frame (camera, picking, React, sending the draw
//   commands). This is the part a slow phone processor pays for, whatever its graphics chip.
const { chromium } = require('playwright')

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const CHROME = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'
const THROTTLE = Number(process.env.CPU || 4)
const SECONDS = Number(process.env.SECONDS || 5)

const SCREENS = [
  ['desktop 1440x900', 1440, 900],
  ['phone 390x844', 390, 844],
]

const round = (x) => Math.round(x * 10) / 10
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] || 0

function summary({ gaps, work }) {
  const slow = gaps.filter((d) => d > 50).length
  return { frames: gaps.length, median: round(median(gaps)), over50: gaps.length ? Math.round((slow / gaps.length) * 100) : 0, work: round(median(work)), workWorst: round(Math.max(0, ...work)) }
}

/** Wraps requestAnimationFrame before the page's code runs, so the time spent inside frame callbacks can be added up per frame. */
const TIME_FRAME_CALLBACKS = () => {
  const original = window.requestAnimationFrame.bind(window)
  window.__frameWork = new Map()
  window.requestAnimationFrame = (callback) =>
    original((stamp) => {
      const t0 = performance.now()
      try {
        callback(stamp)
      } finally {
        window.__frameWork.set(stamp, (window.__frameWork.get(stamp) || 0) + performance.now() - t0)
      }
    })
}

async function frames(page) {
  return page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const gaps = []
        let last = 0
        let start = 0
        window.__frameWork.clear()
        const tick = (t) => {
          if (!start) start = t
          if (last) gaps.push(t - last)
          last = t
          if (t - start < ms) requestAnimationFrame(tick)
          else resolve({ gaps, work: [...window.__frameWork.values()] })
        }
        requestAnimationFrame(tick)
      }),
    SECONDS * 1000,
  )
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
  const rows = []
  for (const [screen, width, height] of SCREENS) {
    for (const tier of [1, 2]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
      const cdp = await page.context().newCDPSession(page)
      await page.addInitScript(TIME_FRAME_CALLBACKS)
      // With the HUD as people use it: a graduate during the booking period, a seat in the inspector,
      // and the seat map redrawing its camera marker as the idle turn moves the view.
      await page.goto(`${BASE}/stadium?lang=en&tier=${tier}&idle=1&persona=grad-m-gold&t=2027-03-20T10:00&svdebug=1${process.env.FULL ? '&full=1' : ''}`)
      await page.waitForFunction(() => window.__stadiview && window.__stadiview.ready === true, undefined, { timeout: 60000 })
      await page.evaluate(() => window.__stadiview.inspect('P3-12-07'))
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
      await page.waitForTimeout(500)
      const overview = summary(await frames(page))
      const info = await page.evaluate(() => window.__stadiview.info())
      await page.evaluate(() => window.__stadiview.select('P3-12-07'))
      await page.waitForFunction(() => window.__stadiview.state().mode === 'pov', undefined, { timeout: 120000 })
      const seated = summary(await frames(page))
      rows.push({ screen, tier, calls: info.calls, triangles: info.triangles, overview, seated })
      console.log(JSON.stringify(rows[rows.length - 1]))
      await page.close()
    }
  }
  await browser.close()
  console.log(`\nProcessor slowed ${THROTTLE}x. "Between frames" includes software drawing; "own code" is the page's work per frame.\n`)
  console.log('| Screen | Tier | Draw calls | Triangles | Overview: between frames (median ms) | over 50 ms | own code (median / worst ms) | First person: between frames (median ms) | over 50 ms | own code (median / worst ms) |')
  console.log('|---|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    console.log(`| ${r.screen} | ${r.tier} | ${r.calls} | ${r.triangles} | ${r.overview.median} | ${r.overview.over50}% | ${r.overview.work} / ${r.overview.workWorst} | ${r.seated.median} | ${r.seated.over50}% | ${r.seated.work} / ${r.seated.workWorst} |`)
  }
})()
