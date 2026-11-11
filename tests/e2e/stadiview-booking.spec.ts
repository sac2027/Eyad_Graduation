import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { call, open, stadiumUrl } from './support/stadium'

/** A free seat in the signed-in graduate's own zone; `skip` passes over that many first. */
async function freeInMyZone(page: Page, skip = 0): Promise<string> {
  const zone = (await call(page, (h) => h.myZone()))!
  const id = await (await page.evaluateHandle(() => window as unknown as { __stadiview: { freeSeat(z: string, s: number): string | null } })).evaluate(
    (w, [z, s]) => w.__stadiview.freeSeat(z as string, s as number),
    [zone, skip] as const,
  )
  expect(id, 'a free seat in my zone').not.toBeNull()
  return id!
}

const inspector = (page: Page) => page.locator('[data-sv-inspector]')
const inspect = (page: Page, id: string) => call(page, (h, seat) => h.inspect(seat), id)
const status = (page: Page, id: string) => call(page, (h, seat) => h.status(seat), id)

test.describe('booking a seat', () => {
  test('a graduate books a free seat in their own zone', async ({ page }) => {
    await open(page, stadiumUrl())
    const seat = await freeInMyZone(page)
    await inspect(page, seat)
    await expect(inspector(page)).toHaveAttribute('data-seat', seat)
    await expect(inspector(page)).toHaveAttribute('data-status', 'available')
    await expect(inspector(page)).toContainText('Your booked Row & Seat automatically assigns your exact position in your College’s Procession Lineup — Confirmed with Student Affairs.')
    const book = page.locator('[data-sv-book]')
    await expect(book).toHaveText('Confirm & book my seat')
    await book.click()
    expect(await status(page, seat)).toBe('mine')
    expect(await call(page, (h) => h.mySeat())).toBe(seat)
    await expect(inspector(page)).toHaveAttribute('data-status', 'mine')
    await expect(page.locator('[data-sv-yours]')).toBeVisible()
    await expect(page.locator('[data-sv-book]')).toHaveCount(0)
  })

  test('a seat in another zone says whose it is, and offers no booking', async ({ page }) => {
    await open(page, stadiumUrl())
    // Khaled is in Engineering; P3-12-07 is a Computing seat.
    await inspect(page, 'P3-12-07')
    await expect(page.locator('[data-sv-wrong-zone]')).toContainText('Computing & Mathematics')
    await expect(page.locator('[data-sv-wrong-zone]')).toContainText('Engineering & Physics')
    await expect(page.locator('[data-sv-book]')).toHaveCount(0)
  })

  test('moving to another seat frees the first', async ({ page }) => {
    await open(page, stadiumUrl())
    const first = await freeInMyZone(page)
    await inspect(page, first)
    await page.locator('[data-sv-book]').click()
    // Booking shows the seat card; it is put away before going on.
    await page.locator('[data-sv-card-close]').click()
    const second = await freeInMyZone(page, 3)
    await inspect(page, second)
    const move = page.locator('[data-sv-book]')
    await expect(move).toHaveText('Move to this seat')
    await move.click()
    expect(await status(page, second)).toBe('mine')
    expect(await status(page, first)).toBe('available')
  })

  test('when someone else takes the seat first, the booking fails and the earlier seat is kept', async ({ page }) => {
    await open(page, stadiumUrl())
    const first = await freeInMyZone(page)
    await inspect(page, first)
    await page.locator('[data-sv-book]').click()
    await page.locator('[data-sv-card-close]').click()
    const second = await freeInMyZone(page, 3)
    await inspect(page, second)
    // Another student gets there between looking and confirming.
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-sv-book]')!
      document.querySelector<HTMLButtonElement>('[data-sv-rival]')!.click()
      button.click()
    })
    await expect(page.locator('[data-sv-book-error="taken"]')).toHaveText('Someone took this seat a moment ago. Choose another.')
    expect(await status(page, second)).toBe('taken')
    expect(await status(page, first)).toBe('mine')
  })

  test('the demo rival control marks the seat taken', async ({ page }) => {
    await open(page, stadiumUrl())
    const seat = await freeInMyZone(page)
    await inspect(page, seat)
    await page.locator('[data-sv-rival]').click()
    await expect(inspector(page)).toHaveAttribute('data-status', 'taken')
    await expect(page.locator('[data-sv-book]')).toHaveCount(0)
  })

  test('before booking opens the inspector says when, and the demo jump reveals the booking button', async ({ page }) => {
    await open(page, stadiumUrl({ t: '2027-03-01T10:00' }))
    const seat = await freeInMyZone(page)
    await inspect(page, seat)
    await expect(page.locator('[data-sv-window="before"]')).toContainText('14 March 2027')
    await expect(page.locator('[data-sv-book]')).toHaveCount(0)
    await page.locator('[data-sv-jump]').click()
    // The seat looked at may have been taken in the days jumped over; a free one can be booked.
    const free = await freeInMyZone(page)
    await inspect(page, free)
    await expect(page.locator('[data-sv-book]')).toBeVisible()
  })

  test('after booking closes nothing can be booked', async ({ page }) => {
    await open(page, stadiumUrl({ t: '2027-04-03T10:00' }))
    const seat = await freeInMyZone(page)
    await inspect(page, seat)
    await expect(page.locator('[data-sv-window="closed"]')).toContainText('1 April 2027')
    await expect(page.locator('[data-sv-book]')).toHaveCount(0)
  })

  test('a guest only looks', async ({ page }) => {
    await open(page, stadiumUrl({ persona: 'guest' }))
    await inspect(page, 'P3-12-07')
    await expect(page.locator('[data-sv-view-only]')).toContainText('View-only mode')
    await expect(page.locator('[data-sv-book]')).toHaveCount(0)
    await expect(page.locator('[data-sv-rival]')).toHaveCount(0)
  })

  test('a stand seat shows its ticket number', async ({ page }) => {
    await open(page, stadiumUrl())
    await inspect(page, 'S-02-084')
    await expect(page.locator('[data-sv-ticket]')).toContainText('TICKET-G1-204')
    await expect(page.locator('[data-sv-book]')).toHaveCount(0)
  })

  test('the inspector shows the view from the seat', async ({ page }) => {
    await open(page, stadiumUrl())
    await inspect(page, 'P3-12-07')
    const figure = page.locator('[data-preview-seat="P3-12-07"][data-ready]')
    await expect(figure).toBeVisible({ timeout: 15_000 })
    // The picture is of the venue, not a blank canvas: it has many different colours.
    const colours = await figure.locator('canvas').evaluate((c: HTMLCanvasElement) => {
      const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
      const seen = new Set<number>()
      for (let k = 0; k < data.length; k += 4 * 37) seen.add((data[k] << 16) | (data[k + 1] << 8) | data[k + 2])
      return seen.size
    })
    expect(colours).toBeGreaterThan(40)
  })

  test('"View from this seat" flies in, and the close button puts the inspector away', async ({ page }) => {
    await open(page, stadiumUrl())
    await inspect(page, 'P3-12-07')
    await page.locator('[data-sv-view-from]').click()
    expect((await call(page, (h) => h.state())).selected).toBe('P3-12-07')
    await page.locator('[data-sv-inspector-close]').click()
    await expect(inspector(page)).toHaveCount(0)
  })

  test('the inspector passes the accessibility checks in both languages', async ({ page }) => {
    for (const lang of ['en', 'ar'] as const) {
      await open(page, stadiumUrl({ lang }))
      const seat = await freeInMyZone(page)
      await inspect(page, seat)
      await expect(inspector(page)).toBeVisible()
      const results = await new AxeBuilder({ page }).include('[data-sv-inspector]').analyze()
      expect(results.violations, `${lang}: ${results.violations.map((v) => v.id).join(', ')}`).toEqual([])
    }
  })
})
