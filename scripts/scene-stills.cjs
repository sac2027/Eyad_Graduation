// Screenshots of the landing scene for the requester's review.
// Usage: start the dev server on 5173 (npm run dev), then: node scripts/scene-stills.cjs
const { chromium } = require('playwright')

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const CHROME = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'
const SHOTS = [
  ['mid-journey-desktop-ar', '/?t=2027-03-16T10:00', 1440, 900],
  ['mid-journey-desktop-en', '/?t=2027-03-16T10:00&lang=en', 1440, 900],
  ['mid-journey-phone-ar', '/?t=2027-03-16T10:00', 390, 844],
  ['mid-journey-phone-en', '/?t=2027-03-16T10:00&lang=en', 390, 844],
  ['ceremony-night-desktop-ar', '/?t=2027-04-07T20:20', 1440, 900],
  ['ceremony-night-phone-ar', '/?t=2027-04-07T20:20', 390, 844],
  ['after-ceremony-desktop-ar', '/?t=2027-04-09T10:00', 1440, 900],
  ['before-launch-desktop-ar', '/?t=2026-11-06T10:00', 1440, 900],
]

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
  for (const [name, url, w, h] of SHOTS) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
    await page.goto(BASE + url)
    await page.locator('[data-scene]').waitFor()
    await page.waitForTimeout(800)
    await page.screenshot({ path: `docs/review/scene/${name}.png` })
    await page.close()
    console.log('wrote', name)
  }
  await browser.close()
})()
