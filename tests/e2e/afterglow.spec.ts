import { expect, test } from '@playwright/test'

async function jumpTo(page: import('@playwright/test').Page, value: string) {
  const input = page.getByLabel('Jump to date and time')
  await input.fill(value)
}

test('crossing the end of the ceremony plays the completion once, then shows the afterglow', async ({ page }) => {
  await page.goto('/?t=2027-04-07T21:00')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await expect(page.locator('[data-completion]')).toHaveCount(0)
  await jumpTo(page, '2027-04-07T21:31')
  await expect(page.locator('[data-completion]')).toBeVisible()
  await page.getByRole('button', { name: 'تخطي' }).click()
  await expect(page.locator('[data-completion]')).toHaveCount(0)
  await expect(page.locator('[data-afterglow]')).toBeVisible()
  await jumpTo(page, '2027-04-07T22:30')
  await page.waitForTimeout(500)
  await expect(page.locator('[data-completion]')).toHaveCount(0)
})

test('the completion plays itself out within about six seconds', async ({ page }) => {
  await page.goto('/?t=2027-04-07T21:00')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await jumpTo(page, '2027-04-07T21:31')
  await expect(page.locator('[data-completion]')).toBeVisible()
  await expect(page.locator('[data-completion]')).toHaveCount(0, { timeout: 9000 })
})

test('loading straight into the afterglow shows it without the sequence', async ({ page }) => {
  await page.goto('/?t=2027-04-09T10:00')
  await page.waitForTimeout(800)
  await expect(page.locator('[data-completion]')).toHaveCount(0)
  await expect(page.locator('[data-afterglow]')).toBeVisible()
  await expect(page.locator('[data-days-since]')).toHaveAttribute('data-days-since', '2')
  await expect(page.locator('[data-after-step="certificate"]')).toBeVisible()
  await expect(page.locator('[data-after-step="honors"]')).toBeVisible() // gold persona
})

test('moving time backwards returns to the story and never replays', async ({ page }) => {
  await page.goto('/?t=2027-04-09T10:00')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await jumpTo(page, '2027-04-07T21:00')
  await expect(page.locator('[data-completion]')).toHaveCount(0)
  await expect(page.locator('[data-day-ascent]')).toBeVisible()
})

test('reduced motion skips the sequence and still shows the afterglow', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/?t=2027-04-07T21:00')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await jumpTo(page, '2027-04-07T21:31')
  await page.waitForTimeout(600)
  await expect(page.locator('[data-completion]')).toHaveCount(0)
  await expect(page.locator('[data-afterglow]')).toBeVisible()
  await ctx.close()
})

test('a guest sees a family message, not a personal one', async ({ page }) => {
  await page.goto('/?t=2027-04-09T10:00&persona=guest')
  await expect(page.locator('[data-afterglow-title]')).toContainText('لكل أسرة خريج')
  await expect(page.locator('[data-after-step="gown"]')).toHaveCount(0)
})
