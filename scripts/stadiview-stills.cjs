// Screenshots of the 3D stadium for the requester's review.
// Usage: start the dev server on 5173 (npm run dev), then: node scripts/stadiview-stills.cjs
const { chromium } = require('playwright')

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const CHROME = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'
const OUT = process.env.OUT || 'docs/review/stadiview'

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
  ['09-no-webgl-fallback-en', '/stadium?lang=en&tier=0', 1440, 900, { fallback: true }],
]

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
  for (const [name, url, width, height, step] of SHOTS) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
    await page.goto(BASE + url)
    if (step.fallback) {
      await page.locator('[data-stadium-fallback]').waitFor()
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
    // JPEG: the seats are fine detail, and a lossless picture of them is four times the size.
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 88 })
    console.log('saved', `${OUT}/${name}.jpg`)
    await page.close()
  }
  await browser.close()
})()
