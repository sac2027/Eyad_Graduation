import { expect, test } from '@playwright/test'

test('choosing a preset sets the URL, reload restores it, and real time clears it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.locator('[data-preset="ceremony-live"]').click()
  await expect.poll(() => decodeURIComponent(page.url())).toContain('t=2027-04-07T20:20')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-phase', 'ceremony-day')
  await page.getByRole('button', { name: 'Demo', exact: true }).or(page.getByRole('button', { name: 'Hide demo' })).first().click()
  await page.getByRole('button', { name: 'Use real time' }).click()
  await expect.poll(() => page.url()).not.toContain('t=')
})

test('time lapse advances the simulated clock', async ({ page }) => {
  await page.goto('/?t=2027-03-14T09:00')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByRole('button', { name: '1 day / sec' }).click()
  await page.waitForTimeout(2200)
  await page.getByRole('button', { name: 'Pause' }).click()
  const text = await page.getByTestId('sim-now').innerText()
  expect(text).toMatch(/March 1[5-9]|March 2\d/)
})
