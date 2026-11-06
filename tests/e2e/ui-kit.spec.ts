import { expect, test } from '@playwright/test'

test('buttons have visible keyboard focus and a 44px hit area on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/kit')
  const first = page.getByRole('button', { name: 'Primary' })
  const box = await first.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
  expect(box!.width).toBeGreaterThanOrEqual(44)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)
  expect(outline).not.toBe('none')
})

test('the confirm button goes loading then success', async ({ page }) => {
  await page.goto('/kit')
  const b = page.getByRole('button', { name: 'Confirm seat' })
  await b.click()
  await expect(b).toHaveAttribute('aria-busy', 'true')
  await expect(b).toHaveAttribute('data-state', 'success')
})

test('the dialog opens and closes', async ({ page }) => {
  await page.goto('/kit?lang=en')
  await page.getByRole('button', { name: 'Open dialog' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
