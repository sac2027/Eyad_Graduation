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

test('demo state survives in-app navigation and covers gpa, date-TBC and reduced motion', async ({ page }) => {
  await page.goto('/?t=2027-03-20T10:00&lang=en&gpa=3.8&tbc=1&reduced=1')
  await page.getByRole('link', { name: 'Honors' }).first().click()
  await expect.poll(() => page.url()).toContain('/honors')
  await expect.poll(() => decodeURIComponent(page.url())).toContain('t=2027-03-20T10:00')
  const url = page.url()
  expect(url).toContain('gpa=3.8')
  expect(url).toContain('tbc=1')
  expect(url).toContain('reduced=1')
})

test('reset demo data clears a held seat', async ({ page }) => {
  await page.goto('/me/tickets?t=2027-03-20T10:00&persona=grad-m-gold&lang=en')
  await page.getByRole('button', { name: "I'll attend the ceremony" }).click()
  await page.locator('[data-section="G01"]').click()
  await page.locator('[data-seat="G01-1-6"]').click()
  await page.getByRole('button', { name: 'Hold this seat for 10 minutes' }).click()
  await expect(page.locator('[data-hold-bar]')).toBeVisible()
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByRole('button', { name: 'Reset demo data' }).click()
  await expect(page.locator('[data-hold-bar]')).toHaveCount(0)
})

test('switching persona on the attire page starts with a clean form', async ({ page }) => {
  await page.goto('/me/attire?t=2027-03-20T10:00&persona=grad-m-gold&lang=en')
  await page.locator('[data-size="56"]').click()
  await expect(page.locator('[data-size="56"]')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByLabel('Persona').selectOption('grad-m-silver')
  await expect(page.locator('[data-size="56"]')).toHaveAttribute('aria-pressed', 'false')
})

test('a past pickup slot cannot be chosen', async ({ page }) => {
  await page.goto('/me/attire?t=2027-03-20T10:00&persona=grad-m-gold&lang=en')
  await page.locator('[data-size="56"]').click()
  await page.getByRole('button', { name: 'Save size' }).click()
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByLabel('Jump to date and time').fill('2027-03-30T10:00')
  await expect(page.locator('[data-slot]').first()).toBeDisabled()
})
