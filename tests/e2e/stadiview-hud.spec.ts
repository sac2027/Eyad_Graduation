import { expect, test } from '@playwright/test'
import { call, open, project, stadiumUrl } from './support/stadium'

test.describe('roles and seat states', () => {
  test('a graduate persona opens in graduate mode, with their name by the switch', async ({ page }) => {
    await open(page, stadiumUrl())
    await expect(page.locator('[data-sv-role]')).toHaveAttribute('data-sv-role', 'graduate')
    await expect(page.locator('[data-sv-role-option="graduate"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-sv-role-option="guest"]')).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('[data-sv-viewer-name]')).toHaveText('Khaled Alotaibi')
    expect((await call(page, (h) => h.hud())).role).toBe('graduate')
  })

  test('a guest opens in guest mode, and choosing Graduate signs in', async ({ page }) => {
    await open(page, stadiumUrl({ persona: 'guest' }))
    await expect(page.locator('[data-sv-role]')).toHaveAttribute('data-sv-role', 'guest')
    await expect(page.locator('[data-sv-viewer-name]')).toHaveCount(0)
    await page.locator('[data-sv-role-option="graduate"]').click()
    await expect(page.locator('[data-sv-role]')).toHaveAttribute('data-sv-role', 'graduate')
    await expect(page.locator('[data-sv-viewer-name]')).toHaveText('Khaled Alotaibi')
    // And back to looking only.
    await page.locator('[data-sv-role-option="guest"]').click()
    await expect(page.locator('[data-sv-role]')).toHaveAttribute('data-sv-role', 'guest')
  })

  test('in the middle of the booking window some seats are taken, and the tooltip says so', async ({ page }) => {
    await open(page, stadiumUrl())
    const taken = (await call(page, (h) => h.takenSeat('P3-12-07')))!
    expect(await call(page, (h, id) => h.status(id), taken)).toBe('taken')
    const free = (await call(page, (h) => h.freeSeat('P3-12-07')))!
    expect(await call(page, (h, id) => h.status(id), free)).toBe('available')
    const p = await project(page, taken)
    await page.mouse.move(p.x - 20, p.y - 14)
    await page.mouse.move(p.x, p.y, { steps: 3 })
    await expect.poll(async () => (await call(page, (h) => h.state())).hover).toBe(taken)
    await expect(page.locator('[data-seat-tooltip]')).toContainText('Taken')
  })

  test('before the window opens every seat is free', async ({ page }) => {
    await open(page, stadiumUrl({ t: '2027-03-01T10:00' }))
    expect(await call(page, (h) => h.takenSeat('P3-12-07'))).toBeNull()
  })

  test('inspecting a seat marks it without moving the camera', async ({ page }) => {
    await open(page, stadiumUrl())
    const before = (await call(page, (h) => h.camera())).position
    await call(page, (h) => h.inspect('P3-12-07'))
    expect((await call(page, (h) => h.hud())).inspected).toBe('P3-12-07')
    await page.waitForTimeout(300)
    expect((await call(page, (h) => h.state())).mode).toBe('orbit')
    expect((await call(page, (h) => h.camera())).position).toEqual(before)
  })

  test('a click on a seat in 3D inspects it and flies in', async ({ page }) => {
    await open(page, stadiumUrl())
    const p = await project(page, 'S-10-060')
    await page.mouse.move(p.x, p.y, { steps: 3 })
    await page.mouse.click(p.x, p.y)
    await expect.poll(async () => (await call(page, (h) => h.hud())).inspected).toBe('S-10-060')
    expect((await call(page, (h) => h.state())).selected).toBe('S-10-060')
  })

  test('changing persona changes the viewer and drops the inspected seat (Review Focus 5)', async ({ page }) => {
    await open(page, stadiumUrl())
    await call(page, (h) => h.inspect('P3-12-07'))
    await page.getByRole('button', { name: 'Demo', exact: true }).click()
    await page.getByLabel('Persona').selectOption('grad-f-gold')
    await expect(page.locator('[data-sv-viewer-name]')).toHaveText('Reem Aldosari')
    expect((await call(page, (h) => h.hud())).inspected).toBeNull()
    await page.getByLabel('Persona').selectOption('guest')
    await expect(page.locator('[data-sv-role]')).toHaveAttribute('data-sv-role', 'guest')
  })
})

test.describe('the role switch on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  for (const lang of ['ar', 'en'] as const) {
    test(`fits the screen (${lang})`, async ({ page }) => {
      await open(page, stadiumUrl({ lang }))
      for (const sel of ['[data-sv-role-option="graduate"]', '[data-sv-role-option="guest"]', '[data-sv-language]', '[data-sv-home]']) {
        const box = (await page.locator(sel).boundingBox())!
        expect(box.x, sel).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width, sel).toBeLessThanOrEqual(390)
        expect(box.height, sel).toBeGreaterThanOrEqual(44)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      // The demo button and the role switch do not sit on each other.
      const demo = (await page.locator('[data-demo-console] > button').boundingBox())!
      const role = (await page.locator('[data-sv-role-option="guest"]').boundingBox())!
      const apart = demo.x + demo.width <= role.x || role.x + role.width <= demo.x || demo.y + demo.height <= role.y || role.y + role.height <= demo.y
      expect(apart).toBe(true)
    })
  }
})
