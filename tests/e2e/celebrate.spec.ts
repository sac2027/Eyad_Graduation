import { expect, test } from '@playwright/test'

test('the first visit plays the welcome moment once per session', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en&welcome=1')
  await expect(page.locator('[data-screen-welcome]')).toHaveText('Welcome to the journey of Class 57')
  await expect(page.locator('[data-fireworks="welcome"]')).toBeAttached()
  await expect(page.locator('[data-screen-welcome]')).toHaveCount(0, { timeout: 7000 })
  await page.reload()
  await page.waitForTimeout(800)
  await expect(page.locator('[data-screen-welcome]')).toHaveCount(0)
})

test('a tap skips the welcome moment', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en&welcome=1')
  await expect(page.locator('[data-screen-welcome]')).toBeVisible()
  await page.locator('[data-scene]').click({ position: { x: 20, y: 300 } })
  await expect(page.locator('[data-screen-welcome]')).toHaveCount(0)
})

test('with reduced motion the welcome line shows, without fireworks', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en&welcome=1&reduced=1')
  await expect(page.locator('[data-screen-welcome]')).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page.locator('[data-fireworks]')).toHaveCount(0)
})

test('ceremony day gets the stronger entry', async ({ page }) => {
  await page.goto('/?t=2027-04-07T16:00&lang=en&welcome=1')
  await expect(page.locator('[data-fireworks="ceremony-entry"]')).toBeAttached()
})

test('booking a gown pickup celebrates with confetti', async ({ page }) => {
  await page.goto('/me/attire?t=2027-03-20T10:00&persona=grad-m-gold&lang=en')
  await page.locator('[data-size="56"]').click()
  await page.getByRole('button', { name: 'Save size' }).click()
  await page.locator('[data-slot]').first().click()
  await page.getByRole('button', { name: 'Book slot' }).click()
  await expect(page.locator('[data-fireworks="task"]')).toBeAttached()
})

test('the crossing at 21:30 sets off the full fireworks', async ({ page }) => {
  await page.goto('/?t=2027-04-07T21:29&lang=en')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByLabel('Jump to date and time').fill('2027-04-07T21:31')
  await expect(page.locator('[data-fireworks="certificate"]')).toBeAttached()
})
