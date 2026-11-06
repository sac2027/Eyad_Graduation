import { expect, test } from '@playwright/test'

const cases: [string, string, string[]][] = [
  ['2027-04-07T09:00', 'morning', []],
  ['2027-04-07T16:00', 'arrival', ['morning']],
  ['2027-04-07T19:00', 'seated', ['morning', 'arrival']],
  ['2027-04-07T20:20', 'ceremony', ['morning', 'arrival', 'seated']],
  ['2027-04-07T21:10', 'photos', ['morning', 'arrival', 'seated', 'ceremony']],
]

for (const [t, slot, done] of cases) {
  test(`ceremony day ${slot}: hourly steps light up as time passes`, async ({ page }) => {
    await page.goto(`/?t=${t}`)
    const ascent = page.locator('[data-day-ascent]')
    await expect(ascent).toHaveAttribute('data-slot', slot)
    await expect(page.locator(`[data-day-ascent] [data-step="${slot}"]`)).toHaveAttribute('data-state', 'current')
    for (const d of done) await expect(page.locator(`[data-day-ascent] [data-step="${d}"]`)).toHaveAttribute('data-state', 'done')
    await expect(page.locator('[data-journey-so-far]').first()).toBeVisible()
    await expect(page.locator('[data-phase-banner="ceremony-day"]')).toBeVisible()
  })
}

test('floodlights are flat bands, never gradients', async ({ page }) => {
  await page.goto('/?t=2027-04-07T20:20')
  const bg = await page.evaluate(() => [...document.querySelectorAll('[data-floodlights] div')].map((e) => getComputedStyle(e).backgroundImage))
  expect(bg.length).toBeGreaterThan(0)
  for (const b of bg) expect(b).toBe('none')
})

test('the ceremony slot shows the live pill and the matrix loop plays faster later in the day', async ({ page }) => {
  await page.goto('/?t=2027-04-07T20:20')
  await expect(page.locator('[data-live]')).toBeVisible()
  const late = await page.evaluate(() => (document.querySelector('[data-matrix-loop="ascent"]') as HTMLVideoElement).playbackRate)
  await page.goto('/?t=2027-04-07T03:00')
  const early = await page.evaluate(() => (document.querySelector('[data-matrix-loop="ascent"]') as HTMLVideoElement).playbackRate)
  expect(late).toBeGreaterThan(early)
})

test('scrubbing back to the day before removes the Ascent and restores the story', async ({ page }) => {
  await page.goto('/?t=2027-04-07T20:20')
  await expect(page.locator('[data-day-ascent]')).toBeVisible()
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.locator('[data-preset="honors-day"]').click()
  await expect(page.locator('[data-day-ascent]')).toHaveCount(0)
  await expect(page.locator('[data-journey-mode="story"]')).toBeVisible()
  await expect(page.locator('[data-phase-banner="honors-day"]')).toBeVisible()
})

test('final week and afterglow have their own banners', async ({ page }) => {
  await page.goto('/?t=2027-04-02T10:00')
  await expect(page.locator('[data-phase-banner="final-week"]')).toBeVisible()
  await page.goto('/?t=2027-04-09T10:00')
  await expect(page.locator('[data-phase-banner="afterglow"]')).toBeVisible()
})
