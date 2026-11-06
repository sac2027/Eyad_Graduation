// Screenshots of the landing scene for the requester's review.
// Usage: start the dev server on 5173 (npm run dev), then: node scripts/scene-stills.cjs
const { chromium } = require('playwright')

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const CHROME = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'
const OUT = process.env.OUT || 'docs/review/scene'
const SHOTS = [
  ['mid-journey-desktop-ar', '/?t=2027-03-16T10:00', 1440, 900],
  ['mid-journey-desktop-en', '/?t=2027-03-16T10:00&lang=en', 1440, 900],
  ['mid-journey-phone-ar', '/?t=2027-03-16T10:00', 390, 844],
  ['mid-journey-phone-en', '/?t=2027-03-16T10:00&lang=en', 390, 844],
  ['ceremony-night-desktop-ar', '/?t=2027-04-07T20:20', 1440, 900],
  ['ceremony-night-phone-ar', '/?t=2027-04-07T20:20', 390, 844],
  ['after-ceremony-desktop-ar', '/?t=2027-04-09T10:00', 1440, 900],
  ['before-launch-desktop-ar', '/?t=2026-11-06T10:00', 1440, 900],
  ['certificate-moment-desktop-ar', '/?t=2027-04-07T21:29', 1440, 900, 'moment'],
  ['steps-desktop-ar', '/?t=2027-03-16T10:00', 1440, 900, 'steps'],
  ['welcome-desktop-ar', '/?t=2027-03-16T10:00&welcome=1', 1440, 900, 'welcome'],
  ['honor-gold-desktop-en', '/honors?persona=grad-m-gold&lang=en', 1440, 900, 'honor'],
]

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
  for (const [name, url, w, h, mode] of SHOTS) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
    await page.goto(BASE + url)
    if (mode === 'honor') {
      await page.locator('[data-honor-hero]').waitFor()
      await page.waitForTimeout(13500)
    } else {
      await page.locator('[data-scene]').waitFor()
      await page.waitForTimeout(mode === 'welcome' ? 1400 : 800)
    }
    if (mode === 'moment') {
      await page.getByRole('button', { name: /Demo/ }).first().click()
      await page.getByLabel('Jump to date and time').fill('2027-04-07T21:31')
      await page.getByRole('button', { name: 'Hide demo' }).click()
      await page.waitForTimeout(1600)
    }
    if (mode === 'steps') {
      await page.evaluate(() => document.getElementById('step-attire').scrollIntoView({ block: 'start' }))
      await page.waitForTimeout(600)
    }
    await page.screenshot({ path: `${OUT}/${name}.png` })
    await page.close()
    console.log('wrote', name)
  }
  await browser.close()
})()
