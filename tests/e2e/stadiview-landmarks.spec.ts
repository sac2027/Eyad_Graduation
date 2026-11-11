import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { call, open, stadiumUrl, waitForMode } from './support/stadium'

/** The angle in degrees between the camera's view and the direction from it to a point. */
async function offBy(page: Page, at: number[]): Promise<{ angle: number; pitchLimited: boolean }> {
  const cam = await call(page, (h) => h.camera())
  const d = [at[0] - cam.position[0], at[1] - cam.position[1], at[2] - cam.position[2]]
  const len = Math.hypot(d[0], d[1], d[2])
  const dot = (d[0] * cam.direction[0] + d[1] * cam.direction[1] + d[2] * cam.direction[2]) / len
  // The head tilts up to 50 degrees: a landmark above that is looked at as high as the head goes.
  const rise = (Math.atan2(d[1], Math.hypot(d[0], d[2])) * 180) / Math.PI
  return { angle: (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI, pitchLimited: rise > 50 || rise < -35 }
}

async function sit(page: Page, seat: string, extra = 'reduced=1', persona = 'grad-m-gold') {
  await open(page, stadiumUrl({ extra, persona }))
  await call(page, (h, id) => h.select(id), seat)
  await waitForMode(page, 'pov')
}

test.describe('landmark chips in first person', () => {
  test('appear only when seated, with the five landmarks', async ({ page }) => {
    await open(page, stadiumUrl({ extra: 'reduced=1' }))
    await expect(page.locator('[data-sv-landmarks]')).toHaveCount(0)
    await call(page, (h) => h.select('S-10-060'))
    await waitForMode(page, 'pov')
    const ids = await page.locator('[data-sv-landmark]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sv-landmark')))
    expect(ids).toEqual(['stage', 'screens', 'vip', 'family', 'gate'])
  })

  for (const seat of ['P3-12-07', 'S-10-060', 'VIP-03-025']) {
    test(`each chip turns the view at ${seat} to its landmark, without moving the camera`, async ({ page }) => {
      await sit(page, seat)
      const position = (await call(page, (h) => h.camera())).position
      for (const chip of await page.locator('[data-sv-landmark]').all()) {
        const at = (await chip.getAttribute('data-at'))!.split(',').map(Number)
        await chip.click()
        // The turn lands on the next frame.
        if (!(await offBy(page, at)).pitchLimited) await expect.poll(async () => (await offBy(page, at)).angle, { message: (await chip.getAttribute('data-sv-landmark'))! }).toBeLessThan(3)
        expect((await call(page, (h) => h.camera())).position).toEqual(position)
      }
    })
  }

  test('turns smoothly when motion is allowed, and arrow keys still turn afterwards', async ({ page }) => {
    await sit(page, 'P3-12-07', '')
    const gate = page.locator('[data-sv-landmark="gate"]')
    const at = (await gate.getAttribute('data-at'))!.split(',').map(Number)
    await gate.click()
    await expect.poll(async () => (await offBy(page, at)).angle, { timeout: 15_000 }).toBeLessThan(3)
    const before = (await call(page, (h) => h.camera())).direction
    await page.locator('[data-stadium-canvas]').focus()
    await page.keyboard.press('ArrowLeft')
    await expect.poll(async () => (await call(page, (h) => h.camera())).direction[0]).not.toBe(before[0])
  })

  test('a guest who has located a graduate gets "My graduate"', async ({ page }) => {
    await open(page, stadiumUrl({ persona: 'guest', extra: 'reduced=1' }))
    const g = (await call(page, (h) => h.sampleGraduate(true, 5)))!
    await page.locator('[data-sv-guest-toggle]').click()
    await page.locator('[data-sv-ticket-input]').fill(g.tickets[0])
    await page.locator('[data-sv-ticket-find]').click()
    await page.locator('[data-sv-ticket-graduate]').click()
    await page.locator('[data-sv-ticket-view]').click()
    await waitForMode(page, 'pov')
    const mine = page.locator('[data-sv-landmark="graduate"]')
    await expect(mine).toHaveText('My graduate')
    await mine.click()
    const at = (await mine.getAttribute('data-at'))!.split(',').map(Number)
    await expect.poll(async () => (await offBy(page, at)).angle).toBeLessThan(3)
  })

  test('on a phone the chips scroll in their own row, and the page never does', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await sit(page, 'P3-12-07')
    const row = page.locator('[data-sv-landmarks]')
    await expect(row).toBeVisible()
    const fit = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, row: document.querySelector<HTMLElement>('[data-sv-landmarks]')!.getBoundingClientRect().right }))
    expect(fit.page).toBeLessThanOrEqual(390)
    expect(fit.row).toBeLessThanOrEqual(390)
    for (const chip of await row.locator('button').all()) expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  })

  test('the chips pass the accessibility checks in Arabic', async ({ page }) => {
    await open(page, stadiumUrl({ lang: 'ar', extra: 'reduced=1' }))
    await call(page, (h) => h.select('P3-12-07'))
    await waitForMode(page, 'pov')
    await expect(page.locator('[data-sv-landmark="stage"]')).toHaveText('المنصة')
    const results = await new AxeBuilder({ page }).include('[data-sv-landmarks]').analyze()
    expect(results.violations.map((v) => v.id)).toEqual([])
  })
})
