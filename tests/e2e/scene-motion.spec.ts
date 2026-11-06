import { expect, test } from '@playwright/test'

const fig = '[data-scene] [data-graduate]'

test('the graduate keeps walking slowly even while time is frozen', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en')
  const seen = new Set<string>()
  for (let i = 0; i < 12; i++) {
    seen.add((await page.locator(fig).getAttribute('data-frame')) ?? '')
    await page.waitForTimeout(170)
  }
  expect(seen.size).toBeGreaterThanOrEqual(3)
  await expect(page.locator('[data-scene]')).toHaveAttribute('data-progress', /^0\.2/)
})

test('with reduced motion he stands still with a calm aura', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en&reduced=1')
  await expect(page.locator(fig)).toHaveAttribute('data-mode', 'still')
  await page.waitForTimeout(600)
  await expect(page.locator(fig)).toHaveAttribute('data-frame', '0')
})

test('on a low-end device he stands still too', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en&lowend=1')
  await expect(page.locator(fig)).toHaveAttribute('data-mode', 'still')
})

test('moving time forward moves him along the path', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en')
  const before = Number(await page.locator('[data-scene]').getAttribute('data-progress'))
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByLabel('Jump to date and time').fill('2027-03-24T10:00')
  await expect.poll(async () => Number(await page.locator('[data-scene]').getAttribute('data-progress'))).toBeGreaterThan(before)
  // the drawn figure follows smoothly and settles at the new place
  await expect.poll(async () => page.locator('[data-figure-layer]').getAttribute('data-settled'), { timeout: 4000 }).toBe('true')
})
