import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { call, open, stadiumUrl } from './support/stadium'

async function bookOne(page: Page): Promise<string> {
  const zone = (await call(page, (h) => h.myZone()))!
  const seat = (await call(page, (h, z) => h.freeSeat(z), zone))!
  await call(page, (h, id) => h.inspect(id), seat)
  await page.locator('[data-sv-book]').click()
  return seat
}

test.describe('walking routes', () => {
  test('from the seat card: the route shows, the card goes, and My seat can hide it again', async ({ page }) => {
    await open(page, stadiumUrl())
    const seat = await bookOne(page)
    const card = page.locator('[data-sv-route-toggle="card"]')
    await expect(card).toContainText('Show my route')
    await expect(card.locator('[data-sv-route-words]')).toContainText(/About \d+ m from Gate 2, about (a minute|\d+ minutes) on foot\./)
    await card.locator('[data-sv-route-button]').click()
    await expect(page.locator('[data-sv-card-dialog]')).toHaveCount(0)
    const route = (await call(page, (h) => h.route()))!
    expect(route.seat).toBe(seat)
    expect(route.gate).toBe(2)
    expect(route.length).toBeGreaterThan(100)
    // One route at a time: My seat shows the same one as showing, and hides it.
    await page.locator('[data-sv-my-seat-toggle]').click()
    const mine = page.locator('[data-sv-route-toggle="mine"] [data-sv-route-button]')
    await expect(mine).toHaveText('Hide my route')
    await expect(mine).toHaveAttribute('aria-pressed', 'true')
    await mine.click()
    expect(await call(page, (h) => h.route())).toBeNull()
    await expect(mine).toHaveText('Show my route')
  })

  test('a woman graduate\'s route starts at Gate 5', async ({ page }) => {
    await open(page, stadiumUrl({ persona: 'grad-f-gold' }))
    await bookOne(page)
    await page.locator('[data-sv-route-toggle="card"] [data-sv-route-button]').click()
    expect((await call(page, (h) => h.route()))!.gate).toBe(5)
  })

  test('a guest\'s ticket shows the route from Gate 1 in words, in both languages', async ({ page }) => {
    for (const lang of ['en', 'ar'] as const) {
      await open(page, stadiumUrl({ persona: 'guest', lang }))
      await page.locator('[data-sv-guest-toggle]').click()
      await page.locator('[data-sv-ticket-input]').fill('TICKET-G1-204')
      await page.locator('[data-sv-ticket-find]').click()
      const toggle = page.locator('[data-sv-route-toggle="ticket"]')
      await toggle.locator('[data-sv-route-button]').click()
      expect((await call(page, (h) => h.route()))!.seat).toBe('S-02-084')
      await expect(toggle.locator('[data-sv-route-words]')).toContainText(lang === 'en' ? 'from Gate 1' : 'من البوابة 1')
      expect(await toggle.innerText()).not.toMatch(/[٠-٩]/)
    }
  })

  test('works by keyboard alone', async ({ page }) => {
    await open(page, stadiumUrl({ persona: 'guest' }))
    await page.locator('[data-sv-guest-toggle]').click()
    await page.locator('[data-sv-ticket-input]').fill('TICKET-G1-204')
    await page.keyboard.press('Enter')
    const button = page.locator('[data-sv-route-toggle="ticket"] [data-sv-route-button]')
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(await call(page, (h) => h.route())).not.toBeNull()
  })

  test('without WebGL the route is still offered, in words and on the map', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null
        return (original as (...args: unknown[]) => unknown).call(this, type, ...rest)
      } as typeof HTMLCanvasElement.prototype.getContext
    })
    await page.goto(stadiumUrl({ persona: 'guest' }))
    await page.locator('[data-sv-guest-toggle]').click()
    await page.locator('[data-sv-ticket-input]').fill('TICKET-G1-204')
    await page.locator('[data-sv-ticket-find]').click()
    const toggle = page.locator('[data-sv-route-toggle="ticket"]')
    await expect(toggle.locator('[data-sv-route-words]')).toContainText('from Gate 1')
    // The map draws the route: its picture changes when the route is shown.
    const before = await page.locator('[data-seat-matrix] canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL())
    await toggle.locator('[data-sv-route-button]').click()
    await expect.poll(async () => page.locator('[data-seat-matrix] canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL())).not.toBe(before)
  })

  test('the toggles pass the accessibility checks', async ({ page }) => {
    await open(page, stadiumUrl({ persona: 'guest' }))
    await page.locator('[data-sv-guest-toggle]').click()
    await page.locator('[data-sv-ticket-input]').fill('TICKET-G1-204')
    await page.locator('[data-sv-ticket-find]').click()
    await page.locator('[data-sv-route-toggle="ticket"] [data-sv-route-button]').click()
    const results = await new AxeBuilder({ page }).include('[data-sv-route-toggle]').analyze()
    expect(results.violations.map((v) => v.id)).toEqual([])
  })
})
