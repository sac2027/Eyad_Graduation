import { expect, test } from '@playwright/test'

test('nine step sections follow the scene, in order', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en')
  const ids = await page.locator('[data-step]').evaluateAll((els) => els.map((e) => e.getAttribute('data-step')))
  expect(ids).toEqual(['candidacy', 'information', 'attire', 'tickets', 'rehearsal', 'arrival', 'ceremony', 'celebration', 'certificate'])
})

test('a graduate sees their own status and the action for a step', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en&persona=grad-m-gold')
  const attire = page.locator('[data-step="attire"]')
  await expect(attire.locator('[data-step-status]')).toHaveAttribute('data-step-status', 'pending')
  await expect(attire.getByRole('link', { name: 'Choose my size' })).toHaveAttribute('href', '/me/attire')
  await expect(page.locator('[data-step="candidacy"] [data-step-status]')).toHaveAttribute('data-step-status', 'late')
  await expect(attire.getByRole('heading', { level: 2 })).toHaveText("The bisht you've waited years to wear.")
})

test('a female graduate gets the abaya wording', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en&persona=grad-f-gold')
  await expect(page.locator('[data-step="attire"]').getByRole('heading', { level: 2 })).toHaveText("The abaya and sash you've waited years to wear.")
})

test('a guest sees the steps without personal status', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en&persona=guest')
  await expect(page.locator('[data-step]')).toHaveCount(9)
  await expect(page.locator('[data-step-status]')).toHaveCount(0)
})

test('the arrival step tells families about the gates, including Gate 3', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en')
  await expect(page.locator('[data-step="arrival"]')).toContainText('Gate 3')
})

test('clicking a checkpoint in the scene scrolls to its section', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?t=2027-03-16T10:00&lang=en')
  await page.locator('[data-checkpoint="tickets"]').click()
  await expect(page.locator('#step-tickets')).toBeInViewport()
})
