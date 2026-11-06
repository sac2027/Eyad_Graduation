import { expect, test } from '@playwright/test'

const scene = '[data-scene]'

test('crossing 21:30 plays the certificate moment once and leaves him holding it', async ({ page }) => {
  await page.goto('/?t=2027-04-07T21:29&lang=en')
  await expect(page.locator(scene)).toHaveAttribute('data-figure', 'stage')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByLabel('Jump to date and time').fill('2027-04-07T21:31')
  await expect(page.locator('[data-certificate-moment]')).toBeVisible()
  await expect(page.locator('[data-certificate-moment]')).toContainText('this is your certificate')
  await expect(page.locator(scene)).toHaveAttribute('data-figure', 'holding')
  await expect(page.locator('[data-certificate-moment]')).toHaveCount(0, { timeout: 8000 })
})

test('the moment can be closed with Escape', async ({ page }) => {
  await page.goto('/?t=2027-04-07T21:29&lang=en')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByLabel('Jump to date and time').fill('2027-04-07T21:31')
  await expect(page.locator('[data-certificate-moment]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-certificate-moment]')).toHaveCount(0)
})

test('loading straight into the afterglow shows him holding it, without replaying the moment', async ({ page }) => {
  await page.goto('/?t=2027-04-09T10:00&lang=en')
  await expect(page.locator(scene)).toHaveAttribute('data-figure', 'holding')
  await page.waitForTimeout(800)
  await expect(page.locator('[data-certificate-moment]')).toHaveCount(0)
})

test('scrubbing back from after the ceremony puts him back on stage and never replays', async ({ page }) => {
  await page.goto('/?t=2027-04-07T21:40&lang=en')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByLabel('Jump to date and time').fill('2027-04-07T21:00')
  await expect(page.locator(scene)).toHaveAttribute('data-figure', 'stage')
  await expect(page.locator('[data-certificate-moment]')).toHaveCount(0)
})

test('reduced motion skips the moment but still shows him holding the certificate', async ({ page }) => {
  await page.goto('/?t=2027-04-07T21:29&lang=en&reduced=1')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByLabel('Jump to date and time').fill('2027-04-07T21:31')
  await expect(page.locator(scene)).toHaveAttribute('data-figure', 'holding')
  await page.waitForTimeout(600)
  await expect(page.locator('[data-certificate-moment]')).toHaveCount(0)
})

test('ceremony afternoon turns the beams on; the morning keeps them off', async ({ page }) => {
  await page.goto('/?t=2027-04-07T09:00&lang=en')
  await expect(page.locator(scene)).toHaveAttribute('data-beams', 'false')
  await page.goto('/?t=2027-04-07T16:00&lang=en')
  await expect(page.locator(scene)).toHaveAttribute('data-beams', 'true')
  await expect(page.locator('[data-beam]').first()).toBeAttached()
})

test('a guest gets the family version of the moment', async ({ page }) => {
  await page.goto('/?t=2027-04-07T21:29&lang=en&persona=guest')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByLabel('Jump to date and time').fill('2027-04-07T21:31')
  await expect(page.locator('[data-certificate-moment]')).toContainText('Class 57 did it')
})
