import { expect, test } from '@playwright/test'

test('the marker sits at the attire stage on 14 March', async ({ page }) => {
  await page.goto('/?t=2027-03-14T09:00')
  const bar = page.locator('[data-journey-bar="story"]').first()
  await expect(bar).toHaveAttribute('data-stage', 'attire')
  const p = Number(await bar.getAttribute('data-progress'))
  expect(p).toBeGreaterThan(2 / 7)
  expect(p).toBeLessThan(3 / 7)
})

test('scrolling to the bottom of the story shows the reveal', async ({ page }) => {
  await page.goto('/?t=2027-03-14T09:00')
  const reveal = page.locator('[data-reveal]')
  await expect(reveal).toHaveAttribute('data-reveal', 'off')
  await page.evaluate(() => {
    const el = document.getElementById('journey')!
    window.scrollTo(0, el.offsetTop + el.offsetHeight)
  })
  await expect(reveal).toHaveAttribute('data-reveal', 'on')
  await page.evaluate(() => window.scrollTo(0, document.getElementById('journey')!.offsetTop + 200))
  await expect(reveal).toHaveAttribute('data-reveal', 'off')
})

test('the story changes stage as you scroll', async ({ page }) => {
  await page.goto('/?t=2027-03-14T09:00')
  await page.evaluate(() => {
    const el = document.getElementById('journey')!
    window.scrollTo(0, el.offsetTop + (el.offsetHeight - window.innerHeight) * 0.5)
  })
  await expect(page.locator('[data-story-stage]')).not.toHaveAttribute('data-story-stage', 'candidacy')
})

test('Arabic keeps the Matrix and path unflipped', async ({ page }) => {
  await page.goto('/?t=2027-03-14T09:00')
  await page.waitForSelector('[data-matrix], video')
  const flipped = await page.evaluate(() =>
    [...document.querySelectorAll('svg[data-matrix] g, [data-story-scene] g[transform]')].some((g) => /scale\(-|scaleX\(-/.test(g.getAttribute('transform') ?? '')),
  )
  expect(flipped).toBe(false)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})

test('reduced motion shows the static journey with the same stages and no console errors', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://localhost:5173/?t=2027-03-14T09:00')
  await expect(page.locator('[data-journey-mode="static"]')).toBeVisible()
  await expect(page.locator('[data-journey-mode="static"] li')).toHaveCount(8)
  expect(errors).toEqual([])
  await ctx.close()
})

test('with the date TBC the marker rests at the start', async ({ page }) => {
  await page.goto('/?t=2027-03-14T09:00')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByRole('button', { name: 'Date TBC' }).click()
  await expect(page.locator('[data-journey-bar]').first()).toHaveAttribute('data-progress', '0.0000')
})
