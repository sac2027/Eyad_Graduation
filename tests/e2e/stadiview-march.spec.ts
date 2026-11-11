import { expect, test } from '@playwright/test'
import { call, open, project, stadiumUrl } from './support/stadium'

test.describe('the march carpet', () => {
  test('runs round the blocks with lights on both edges and moving arrows', async ({ page }) => {
    await open(page, stadiumUrl())
    const m = await call(page, (h) => h.march())
    expect(m.length).toBeGreaterThan(250)
    expect(m.lights).toBeGreaterThan(180)
    expect(m.arrowsMoving).toBe(true)
  })

  test('its arrows stand still under reduced motion', async ({ page }) => {
    await open(page, stadiumUrl({ extra: 'reduced=1' }))
    expect((await call(page, (h) => h.march())).arrowsMoving).toBe(false)
  })

  test('its corners are in sight from the opening view', async ({ page }) => {
    await open(page, stadiumUrl())
    // The four corners of the loop, on the ground.
    for (const p of [[22, 0, -33.7], [-34.7, 0, -33.7], [-34.7, 0, 33.7], [22, 0, 33.7]] as const) {
      expect(await call(page, (h, q) => h.projectPoint(JSON.parse(q)), JSON.stringify(p))).not.toBeNull()
    }
  })

  test('leaves hover and click on the seats as they were', async ({ page }) => {
    await open(page, stadiumUrl())
    for (const id of ['S-10-060', 'P3-12-07', 'P1-05-07']) {
      const p = await project(page, id)
      await page.mouse.move(p.x - 20, p.y - 14)
      await page.mouse.move(p.x, p.y, { steps: 3 })
      await expect.poll(async () => (await call(page, (h) => h.state())).hover).toBe(id)
    }
  })
})
