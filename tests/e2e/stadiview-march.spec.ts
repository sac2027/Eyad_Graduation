import { expect, test } from '@playwright/test'
import { call, open, project, stadiumUrl, waitForMode } from './support/stadium'

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

test.describe('the Procession Gate, the start and the exit', () => {
  for (const [lang, names] of [
    ['en', ['Procession Gate', 'Procession Start', 'Procession Exit']],
    ['ar', ['بوابة المسيرة', 'نقطة بداية المسيرة', 'بوابة الخروج']],
  ] as const) {
    test(`are named in the overview (${lang})`, async ({ page }) => {
      await open(page, stadiumUrl({ lang }))
      const ids = ['gate', 'start', 'exit'] as const
      for (let k = 0; k < 3; k++) await expect(page.locator(`[data-sv-place="${ids[k]}"]`)).toHaveText(names[k])
      await expect(page.locator('[data-sv-place="gate"]')).toBeVisible()
      await expect(page.locator('[data-sv-place="start"]')).toBeVisible()
    })
  }

  test('the arch is see-through in the overview and solid in first person, and the labels go', async ({ page }) => {
    await open(page, stadiumUrl({ extra: 'reduced=1' }))
    expect(await call(page, (h) => h.archOpacity())).toBeLessThan(0.6)
    await call(page, (h) => h.select('P1-30-14'))
    await waitForMode(page, 'pov')
    expect(await call(page, (h) => h.archOpacity())).toBe(1)
    await expect(page.locator('[data-sv-place="gate"]')).toBeHidden()
  })
})
