import { expect, test, type Page } from '@playwright/test'
import { call, open, project, stadiumUrl, waitForMode } from './support/stadium'

const figures = (page: Page) => call(page, (h) => h.avatars())
const reserved = async (page: Page) => (await call(page, (h) => h.occupancy())).reserved

async function freeInMyZone(page: Page): Promise<string> {
  const zone = (await call(page, (h) => h.myZone()))!
  return (await call(page, (h, z) => h.freeSeat(z), zone))!
}

test.describe('figures on reserved seats', () => {
  test('before booking opens nobody is seated', async ({ page }) => {
    await open(page, stadiumUrl({ t: '2027-03-01T10:00' }))
    expect(await reserved(page)).toBe(0)
    expect((await figures(page)).drawn).toBe(0)
  })

  test('in the middle of the window every reserved seat, and only those, holds a figure', async ({ page }) => {
    await open(page, stadiumUrl())
    const o = await call(page, (h) => h.occupancy())
    expect(o.reserved).toBeGreaterThan(2000)
    const f = await figures(page)
    expect(f.drawn).toBe(o.reserved)
    // The tier's crowd number of figures are detailed; the rest are silhouettes.
    expect(f.near).toBe(150)
    expect(f.near + f.far).toBe(o.reserved)
    // Women graduates are in Block 1 only, so there are fewer of them than men.
    expect(o.byKind['grad-f']).toBeGreaterThan(0)
    expect(o.byKind['grad-m']).toBeGreaterThan(o.byKind['grad-f'])
  })

  test('booking a seat seats the graduate (and their family); releasing it stands them up', async ({ page }) => {
    await open(page, stadiumUrl())
    const before = await reserved(page)
    const seat = await freeInMyZone(page)
    await call(page, (h, id) => h.inspect(id), seat)
    await page.locator('[data-sv-book]').click()
    await page.locator('[data-sv-card-close]').click()
    await expect.poll(async () => (await figures(page)).drawn).toBeGreaterThan(before)
    expect((await figures(page)).drawn).toBe(await reserved(page))
    // The viewer's own seat is marked in gold in the overview.
    expect((await figures(page)).highlight).toContain(seat)
    await page.locator('[data-sv-my-seat-toggle]').click()
    await page.locator('[data-sv-mine-release]').click()
    await expect.poll(async () => (await figures(page)).drawn).toBe(before)
  })

  test('sitting in your seat, it and the figures round your eyes are empty; flying back fills them again', async ({ page }) => {
    await open(page, stadiumUrl({ extra: 'reduced=1' }))
    const seat = await freeInMyZone(page)
    await call(page, (h, id) => h.inspect(id), seat)
    await page.locator('[data-sv-book]').click()
    await page.locator('[data-sv-card-close]').click()
    await call(page, (h, id) => h.select(id), seat)
    await waitForMode(page, 'pov')
    const seated = await figures(page)
    expect(seated.hiddenNear).toContain(seat)
    expect(seated.drawn).toBe((await reserved(page)) - seated.hiddenNear.length)
    // The clear circle is 1.5 m: the seat itself, its neighbours and the row in front, a handful in all.
    expect(seated.hiddenNear.length).toBeLessThanOrEqual(12)
    await call(page, (h) => h.back())
    await waitForMode(page, 'orbit')
    expect((await figures(page)).hiddenNear).toEqual([])
  })

  test('a guest sitting in their ticket seat finds it empty', async ({ page }) => {
    await open(page, stadiumUrl({ persona: 'guest', extra: 'reduced=1' }))
    await page.locator('[data-sv-guest-toggle]').click()
    await page.locator('[data-sv-ticket-input]').fill('TICKET-G1-204')
    await page.locator('[data-sv-ticket-find]').click()
    await page.locator('[data-sv-ticket-view]').click()
    await waitForMode(page, 'pov')
    expect((await figures(page)).hiddenNear).toContain('S-02-084')
  })

  test('a hovered seat with someone in it is highlighted in gold over the figure', async ({ page }) => {
    await open(page, stadiumUrl())
    const taken = (await call(page, (h) => h.takenSeat('P3-12-07')))!
    const p = await project(page, taken)
    await page.mouse.move(p.x - 20, p.y - 14)
    await page.mouse.move(p.x, p.y, { steps: 3 })
    await expect.poll(async () => (await call(page, (h) => h.state())).hover).toBe(taken)
    await expect.poll(async () => (await figures(page)).highlight).toContain(taken)
  })

  test('tier 1 stays within the drawing budget in the middle of the window', async ({ page }) => {
    await open(page, stadiumUrl())
    const info = await call(page, (h) => h.info())
    expect(info.triangles).toBeLessThanOrEqual(450_000)
    expect(info.calls).toBeLessThanOrEqual(55)
  })
})

