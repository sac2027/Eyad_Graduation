import { expect, test } from '@playwright/test'

test('a graduate enters a size and books a pickup slot, then sees the pickup code', async ({ page }) => {
  await page.goto('/me/attire?t=2027-03-20T10:00&persona=grad-m-gold&lang=en')
  await page.locator('[data-size="56"]').click()
  await page.getByRole('button', { name: 'Save size' }).click()
  await expect(page.locator('[data-flow="requested"]')).toHaveAttribute('data-reached', 'true')
  await page.locator('[data-slot]').first().click()
  await page.getByRole('button', { name: 'Book slot' }).click()
  await expect(page.locator('[data-slot-booked]')).toBeVisible()
  await expect(page.locator('[data-qr-card] svg[role="img"]')).toBeVisible()
  await expect(page.locator('[data-flow="slot-booked"]')).toHaveAttribute('data-reached', 'true')
})

test('after the deadline the size entry is closed and says so', async ({ page }) => {
  await page.goto('/me/attire?t=2027-03-26T10:00&persona=grad-m-gold&lang=en')
  await expect(page.locator('[data-attire-msg="closed"]')).toContainText('Size entry closed')
  await expect(page.locator('[data-size]')).toHaveCount(0)
})

test('before opening it says when it opens', async ({ page }) => {
  await page.goto('/me/attire?t=2027-03-01T10:00&persona=grad-m-gold&lang=en')
  await expect(page.locator('[data-attire-msg="upcoming"]')).toContainText('opens on')
})

test('the dashboard shows a due-soon chip just before the deadline and a done state after confirming', async ({ page }) => {
  await page.goto('/me?t=2027-03-25T23:00&persona=grad-f-silver&lang=en')
  await expect(page.locator('[data-task="attire"] [data-status]')).toHaveAttribute('data-status', 'due-soon')
  await page.goto('/me?t=2027-02-05T10:00&persona=grad-f-silver&lang=en')
  await page.getByRole('button', { name: 'Confirm details' }).click()
  await expect(page.locator('[data-task="candidacy"]')).toHaveAttribute('data-done', 'true')
})

test('women choose an abaya size and see the sash note', async ({ page }) => {
  await page.goto('/me/attire?t=2027-03-20T10:00&persona=grad-f-gold&lang=en')
  await expect(page.getByRole('heading', { name: 'Abaya size' })).toBeVisible()
  await expect(page.getByText(/sash is one size/)).toBeVisible()
  await expect(page.locator('[data-size="62"]')).toHaveCount(0)
})

test.describe('worst-case names at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('the long Arabic name wraps on the dashboard and the pickup card without horizontal scroll', async ({ page }) => {
    await page.goto('/me?t=2027-03-20T10:00&persona=grad-long-name')
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflowX).toBe(false)
    await page.goto('/me/attire?t=2027-03-20T10:00&persona=grad-long-name')
    await page.locator('[data-size="56"]').click()
    await page.getByRole('button', { name: 'حفظ المقاس' }).click()
    await page.locator('[data-slot]').first().click()
    await page.getByRole('button', { name: 'احجز الموعد' }).click()
    await expect(page.locator('[data-qr-name]')).toBeVisible()
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(over).toBe(false)
  })
})
