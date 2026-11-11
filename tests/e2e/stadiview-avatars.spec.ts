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

test.describe('Fill the stadium (ceremony night)', () => {
  test('the demo switch fills every seat, and only the picture changes', async ({ page }) => {
    await open(page, stadiumUrl())
    const real = await reserved(page)
    const counted = await page.locator('[data-sv-count]').innerText()
    await page.getByRole('button', { name: 'Demo', exact: true }).click()
    const chip = page.locator('[data-sv-full]')
    await expect(chip).toHaveAttribute('aria-pressed', 'false')
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(async () => (await figures(page)).drawn).toBe(7998)
    // The URL keeps it, like the other demo switches.
    await expect(page).toHaveURL(/full=1/)
    // Bookings, the seat map's count and the tooltips keep the real data.
    await expect(page.locator('[data-sv-count]')).toHaveText(counted)
    const free = (await call(page, (h) => h.freeSeat('P3-12-07')))!
    expect(await call(page, (h, id) => h.status(id), free)).toBe('available')
    await call(page, (h, id) => h.inspect(id), free)
    await expect(page.locator('[data-sv-filled-note]')).toContainText('Ceremony-night preview')
    await chip.click()
    await expect.poll(async () => (await figures(page)).drawn).toBe(real)
    await expect(page.locator('[data-sv-filled-note]')).toHaveCount(0)
  })

  test('?full=1 opens on a full house, and first person still clears round the eyes', async ({ page }) => {
    await open(page, stadiumUrl({ extra: 'full=1&reduced=1' }))
    expect((await figures(page)).drawn).toBe(7998)
    await call(page, (h) => h.select('P3-12-07'))
    await waitForMode(page, 'pov')
    const f = await figures(page)
    expect(f.hiddenNear).toContain('P3-12-07')
    expect(f.drawn).toBe(7998 - f.hiddenNear.length)
  })

  test('on ceremony night the house is full by itself, and the switch says why', async ({ page }) => {
    await open(page, stadiumUrl({ t: '2027-04-07T19:30' }))
    expect((await figures(page)).drawn).toBe(7998)
    await page.getByRole('button', { name: 'Demo', exact: true }).click()
    await expect(page.locator('[data-sv-full]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-sv-full]')).toBeDisabled()
    await expect(page.locator('[data-sv-full-note]')).toContainText('ceremony night')
  })

  test('a full house on tier 1 stays within the drawing budget', async ({ page }) => {
    await open(page, stadiumUrl({ extra: 'full=1' }))
    const info = await call(page, (h) => h.info())
    expect(info.triangles).toBeLessThanOrEqual(450_000)
    expect(info.calls).toBeLessThanOrEqual(55)
  })

  test('the switch is offered only on the stadium page', async ({ page }) => {
    await page.goto('/?t=2027-03-20T10:00&lang=en')
    await page.getByRole('button', { name: 'Demo', exact: true }).click()
    await expect(page.locator('[data-sv-full]')).toHaveCount(0)
  })
})
