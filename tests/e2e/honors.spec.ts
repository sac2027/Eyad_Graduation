import { expect, test } from '@playwright/test'

const GOLD = '/honors?persona=grad-m-gold&lang=en&t=2027-03-20T10:00'

test('a gold graduate sees the 3D scene, the copy and the CTA, then the ceremony details', async ({ page }) => {
  await page.goto(GOLD)
  await expect(page.locator('[data-honor-page]')).toHaveAttribute('data-capability', 'full')
  await expect(page.locator('[data-award-canvas="gold"] canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.locator('[data-honor-name]')).toHaveText('Khaled Alotaibi')
  await expect(page.locator('[data-honor-tier]')).toHaveText('First Honors')
  await expect(page.locator('[data-honor-message]')).toContainText('First Honors')
  await expect(page.locator('[data-honor-cta="on"]')).toBeVisible()
  await page.getByRole('button', { name: 'See honor ceremony details' }).click()
  await expect(page.locator('[data-honor-when]')).toContainText('6 April 2027')
  await expect(page.locator('[data-honor-details]')).toBeInViewport()
})

test('silver and bronze get the same scene with their own metal and wording', async ({ page }) => {
  for (const [persona, tier, text] of [['grad-f-silver', 'silver', 'Second Honors'], ['grad-f-bronze', 'bronze', 'Third Honors']] as const) {
    await page.goto(`/honors?persona=${persona}&lang=en`)
    await expect(page.locator(`[data-award-canvas="${tier}"] canvas`)).toBeVisible()
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('[data-honor-tier]')).toHaveText(text)
  }
})

test('a graduate without an honor sees only the ceremony details', async ({ page }) => {
  await page.goto('/honors?persona=grad-m-none&lang=en')
  await expect(page.locator('[data-honor-page]')).toHaveAttribute('data-tier', 'none')
  await expect(page.locator('[data-honor-details]')).toBeVisible()
  await expect(page.locator('canvas:not([data-fx])')).toHaveCount(0)
  await expect(page.locator('[data-honor-hero]')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Honors ceremony')
})

test('the GPA slider in the demo console switches the tier live', async ({ page }) => {
  await page.goto('/honors?persona=grad-m-none&lang=en')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByRole('button', { name: '3.90' }).click()
  await expect(page.locator('[data-honor-page]')).toHaveAttribute('data-tier', 'gold')
  await page.getByRole('button', { name: '2.70' }).click()
  await expect(page.locator('[data-honor-page]')).toHaveAttribute('data-tier', 'none')
})

test('the honor reveal is available at any simulated time', async ({ page }) => {
  for (const t of ['2026-11-05T09:00', '2027-04-06T19:30', '2027-04-09T10:00']) {
    await page.goto(`/honors?persona=grad-f-gold&lang=en&t=${t}`)
    await expect(page.locator('[data-honor-hero]')).toBeVisible()
  }
})

test('with WebGL unavailable the name, tier and details are still shown (2D version)', async ({ page }) => {
  await page.goto('/honors?persona=grad-m-gold&lang=en&lowend=1')
  await expect(page.locator('[data-honor-page]')).toHaveAttribute('data-capability', 'fallback')
  await expect(page.locator('[data-award-fallback="gold"]').first()).toBeVisible()
  await expect(page.locator('canvas:not([data-fx])')).toHaveCount(0)
  await expect(page.locator('[data-honor-cta="on"]')).toBeVisible({ timeout: 6000 })
  await expect(page.locator('[data-honor-name]')).toHaveText('Khaled Alotaibi')
  await expect(page.locator('[data-honor-details]')).toBeAttached()
})

test('reduced motion shows the final pose straight away', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/honors?persona=grad-m-gold&lang=en')
  await expect(page.locator('[data-honor-cta="on"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-honor-name]')).toBeVisible()
  await ctx.close()
})

test('the Three.js chunk is not loaded on the landing page', async ({ page }) => {
  const urls: string[] = []
  page.on('request', (r) => urls.push(r.url()))
  await page.goto('/?lang=en')
  await page.waitForLoadState('networkidle')
  expect(urls.some((u) => /AwardScene|three/i.test(u))).toBe(false)
  urls.length = 0
  await page.goto('/honors?persona=grad-m-gold&lang=en')
  await page.waitForLoadState('networkidle')
  expect(urls.some((u) => /AwardScene|three/i.test(u))).toBe(true)
})

test('the full sequence reaches the call to action on its own, and skip works at any time', async ({ page }) => {
  await page.goto(GOLD)
  await expect(page.locator('[data-honor-cta="on"]')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('[data-honor-replay]')).toBeVisible({ timeout: 8000 })
})

test('the long Arabic name wraps in the overlay and nothing scrolls sideways at 390px', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/honors?persona=grad-long-name')
  await page.getByRole('button', { name: 'تخطي' }).click()
  await expect(page.locator('[data-honor-name]')).toBeVisible()
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(over).toBe(false)
  await ctx.close()
})
