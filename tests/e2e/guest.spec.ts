import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

test('all guide content is reachable without signing in', async ({ page }) => {
  await page.goto('/guide?persona=guest&lang=en')
  for (const id of ['gates', 'map', 'access', 'schedule', 'dress', 'faq']) await expect(page.locator(`#${id}`)).toBeAttached()
  await expect(page.getByText(/sign in|password/i)).toHaveCount(0)
  await expect(page.locator('[data-gate-map]').first()).toBeVisible()
})

test('the access question routes a wheelchair party to Gate 3 by keyboard', async ({ page }) => {
  await page.goto('/guide?persona=guest&lang=en#access')
  await page.getByLabel('Wheelchair').focus()
  await page.keyboard.press('Space')
  await page.getByRole('button', { name: 'Show my route' }).click()
  const r = page.locator('[data-access-result]')
  await expect(r).toHaveAttribute('data-gate', 'gate-3')
  await expect(r).toContainText('Gate 3')
  await expect(r).toContainText('Easy-access seats')
})

test('the gate chips switch the gate note, in both languages', async ({ page }) => {
  await page.goto('/guide?persona=guest&lang=en')
  await page.locator('[data-gate-chip="3"]').first().click()
  await expect(page.locator('[data-gate-note]').first()).toContainText('older guests')
  await page.goto('/guide?persona=guest')
  await page.locator('[data-gate-chip="3"]').first().click()
  await expect(page.locator('[data-gate-note]').first()).toContainText('كبار السن')
})

test('a graduate can apply easy-access seating from the route result', async ({ page }) => {
  await page.goto('/guide?lang=en#access')
  await page.getByLabel('Walks slowly').check()
  await page.getByRole('button', { name: 'Show my route' }).click()
  await page.getByRole('button', { name: 'Use easy-access seating in my booking' }).click()
  await expect(page.getByRole('button', { name: /Done\. Easy-access seats/ })).toBeVisible()
})

test('the landing "Gates and parking" button lands on the gates section', async ({ page }) => {
  await page.goto('/?lang=en')
  await page.getByRole('link', { name: 'Gates and parking' }).click()
  await expect(page).toHaveURL(/\/guide#gates/)
})
