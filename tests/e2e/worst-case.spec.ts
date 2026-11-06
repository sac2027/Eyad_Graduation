import { expect, test } from '@playwright/test'

const ROUTES = [
  '/?t=2027-03-14T09:00',
  '/?t=2027-04-07T20:20',
  '/?t=2027-04-09T10:00',
  '/guide',
  '/me?t=2027-03-20T10:00',
  '/me/attire?t=2027-03-20T10:00',
  '/me/tickets?t=2027-03-20T10:00',
  '/honors',
  '/admin?persona=admin',
]

for (const width of [320, 390]) {
  test.describe(`worst-case data at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } })
    for (const lang of ['ar', 'en']) {
      test(`nothing scrolls sideways (${lang})`, async ({ page }) => {
        for (const r of ROUTES) {
          await page.goto(`${r}${r.includes('?') ? '&' : '?'}worst=1&lang=${lang}${r.startsWith('/admin') ? '' : '&persona=grad-m-gold'}`)
          await page.waitForTimeout(500)
          const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
          expect(over, `${r} (${lang}, ${width}px)`).toBeLessThanOrEqual(1)
        }
      })
    }
  })
}

test('the worst-case flag swaps in the long name everywhere', async ({ page }) => {
  await page.goto('/me?worst=1&persona=grad-f-silver&t=2027-03-20T10:00')
  await expect(page.locator('[data-me-name]')).toContainText('عبدالرحمن بن محمد')
})

test('a seat limit message uses the right Arabic plural for two seats', async ({ page }) => {
  await page.goto('/me/tickets?t=2027-03-20T10:00&persona=grad-m-gold')
  await page.getByRole('button', { name: 'سأحضر الحفل' }).click()
  await page.getByRole('button', { name: 'اطلب التذكرة الثانية' }).click()
  await page.locator('[data-section="G01"]').click()
  for (const id of ['G01-1-1', 'G01-1-2']) {
    await page.locator(`[data-seat="${id}"]`).click()
    await page.getByRole('button', { name: 'احتفظ بالمقعد 10 دقائق' }).click()
  }
  await page.locator('[data-seat="G01-1-3"]').click()
  await expect(page.getByText('استخدمت كل مقاعدك (مقعدان).')).toBeVisible()
})
