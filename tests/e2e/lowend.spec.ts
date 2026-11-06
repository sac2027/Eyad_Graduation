import { expect, test } from '@playwright/test'

async function throttled(page: import('@playwright/test').Page, rate: number) {
  await page.goto('about:blank')
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
}

test('at 6x CPU throttle the honor page falls back to the 2D version and keeps all its content', async ({ page }) => {
  await throttled(page, 6)
  await page.goto('/honors?persona=grad-m-gold&lang=en&bench=1')
  await expect(page.locator('[data-honor-page]')).toHaveAttribute('data-capability', 'fallback')
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect(page.locator('[data-honor-cta="on"]')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('[data-honor-name]')).toHaveText('Khaled Alotaibi')
  await expect(page.locator('[data-honor-tier]')).toHaveText('First Honors')
  await expect(page.locator('[data-honor-details]')).toBeAttached()
})
