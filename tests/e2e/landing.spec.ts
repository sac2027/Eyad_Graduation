import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

test('the three practical buttons are visible without scrolling and there is no login prompt', async ({ page }) => {
  await page.goto('/')
  for (const name of ['البوابات والمواقف', 'مقعدي', 'الخريطة']) {
    const btn = page.getByRole('link', { name })
    await expect(btn).toBeVisible()
    const box = await btn.boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
  }
  await expect(page.getByText(/كلمة المرور|password/i)).toHaveCount(0)
})

test('the phase attributes follow the simulated time', async ({ page }) => {
  await page.goto('/?t=2027-04-07T20:00')
  await expect(page.locator('html')).toHaveAttribute('data-phase', 'ceremony-day')
  await expect(page.locator('html')).toHaveAttribute('data-slot', 'ceremony')
  await page.goto('/?t=2027-04-09T10:00')
  await expect(page.locator('html')).toHaveAttribute('data-phase', 'afterglow')
})

test('English switches direction and the hero copy changes with the phase', async ({ page }) => {
  await page.goto('/?lang=en&t=2027-04-07T09:00')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Today')
})

test('the countdown switches to hours on the day', async ({ page }) => {
  await page.goto('/?t=2027-04-07T09:00')
  await expect(page.locator('[data-countdown="day"]')).toBeVisible()
  await page.goto('/?t=2027-03-14T09:00')
  await expect(page.locator('[data-countdown="days"]')).toBeVisible()
})
