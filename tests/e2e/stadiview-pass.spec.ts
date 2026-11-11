import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { call, open, stadiumUrl } from './support/stadium'

type Free = { __stadiview: { freeSeat(z: string, s: number): string | null } }

/** Books a free seat in the signed-in graduate's zone through the inspector, and returns its id. */
async function book(page: Page, skip = 0): Promise<string> {
  const zone = (await call(page, (h) => h.myZone()))!
  const seat = await page.evaluate(([z, s]) => (window as unknown as Free).__stadiview.freeSeat(z as string, s as number), [zone, skip] as const)
  expect(seat).not.toBeNull()
  await call(page, (h, id) => h.inspect(id), seat!)
  await page.locator('[data-sv-book]').click()
  return seat!
}

const dialog = (page: Page) => page.locator('[data-sv-card-dialog]')
const card = (page: Page) => page.locator('[data-sv-seat-card]')
const panel = (page: Page) => page.locator('[data-sv-my-seat]')
const status = (page: Page, id: string) => call(page, (h, seat) => h.status(seat), id)

test.describe('the digital seat card', () => {
  test('booking opens the card with the name, the seat, the gate and a QR code', async ({ page }) => {
    await open(page, stadiumUrl())
    const seat = await book(page)
    await expect(dialog(page)).toContainText('Your seat is booked')
    await expect(card(page)).toHaveAttribute('data-seat', seat)
    await expect(card(page).locator('[data-sv-pass-name]')).toHaveText('Khaled Alotaibi')
    for (const word of ['Block', 'Row', 'Seat', 'Gate 2', 'Engineering & Physics', 'Line-up position', 'Mock pass for the demo']) await expect(card(page)).toContainText(word)
    await expect(card(page).getByRole('img', { name: `QR code for seat ${seat}` })).toBeVisible()
    // The procession note is the brief's sentence, word for word.
    await expect(dialog(page)).toContainText('Your booked Row & Seat automatically assigns your exact position in your College’s Procession Lineup — Confirmed with Student Affairs.')
  })

  test('a woman graduate enters by Gate 5', async ({ page }) => {
    await open(page, stadiumUrl({ persona: 'grad-f-gold' }))
    await book(page)
    await expect(card(page)).toContainText('Gate 5')
    await expect(card(page).locator('[data-sv-pass-name]')).toHaveText('Reem Aldosari')
  })

  test('the card closes, and opens again from the inspector', async ({ page }) => {
    await open(page, stadiumUrl())
    await book(page)
    await page.locator('[data-sv-card-close]').click()
    await expect(dialog(page)).toHaveCount(0)
    await page.locator('[data-sv-show-card]').click()
    await expect(dialog(page)).toContainText('Your seat card')
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
  })

  for (const lang of ['ar', 'en'] as const) {
    test(`the longest name wraps inside the card on a phone (${lang})`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await open(page, stadiumUrl({ persona: 'grad-long-name', lang, extra: 'worst=1' }))
      await book(page)
      await expect(card(page)).toBeVisible()
      const fit = await page.evaluate(() => {
        const name = document.querySelector<HTMLElement>('[data-sv-pass-name]')!
        const box = document.querySelector<HTMLElement>('[data-sv-seat-card]')!.getBoundingClientRect()
        const n = name.getBoundingClientRect()
        return { inside: n.left >= box.left - 0.5 && n.right <= box.right + 0.5, cut: name.scrollWidth > name.clientWidth + 1, lines: Math.round(n.height / parseFloat(getComputedStyle(name).lineHeight)), left: box.left, right: box.right, page: document.documentElement.scrollWidth }
      })
      expect(fit.inside).toBe(true)
      expect(fit.cut).toBe(false)
      expect(fit.lines).toBeGreaterThan(1)
      expect(fit.left).toBeGreaterThanOrEqual(0)
      expect(fit.right).toBeLessThanOrEqual(390)
      expect(fit.page).toBeLessThanOrEqual(390)
    })
  }

  test('printing shows only the card', async ({ page }) => {
    await open(page, stadiumUrl())
    await book(page)
    await expect(card(page)).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    await expect(card(page)).toBeVisible()
    await expect(card(page).locator('[data-sv-pass-name]')).toBeVisible()
    for (const hidden of ['.sv-top', '[data-stadium-canvas] canvas', '[data-seat-matrix]', '[data-sv-inspector]', '[data-sv-download]', '.sv-dialog__title', '[data-demo-console]']) {
      await expect(page.locator(hidden).first(), hidden).toBeHidden()
    }
  })

  test('"Download the pass" saves a PNG named after the seat', async ({ page }, info) => {
    await open(page, stadiumUrl())
    const seat = await book(page)
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-sv-download]').click()])
    expect(download.suggestedFilename()).toBe(`kfupm-seat-pass-${seat}.png`)
    const path = info.outputPath('pass.png')
    await download.saveAs(path)
    const fs = await import('node:fs')
    const bytes = fs.readFileSync(path)
    // A PNG, 1080 by 1500: the size is in the header.
    expect(bytes.subarray(1, 4).toString()).toBe('PNG')
    expect(bytes.readUInt32BE(16)).toBe(1080)
    expect(bytes.readUInt32BE(20)).toBe(1500)
    expect(bytes.length).toBeGreaterThan(20_000)
  })

  test('the dialog passes the accessibility checks in both languages', async ({ page }) => {
    for (const lang of ['en', 'ar'] as const) {
      await open(page, stadiumUrl({ lang }))
      await book(page)
      await expect(card(page)).toBeVisible()
      const results = await new AxeBuilder({ page }).include('[data-sv-card-dialog]').analyze()
      expect(results.violations, `${lang}: ${results.violations.map((v) => `${v.id} ${v.nodes[0]?.html}`).join(', ')}`).toEqual([])
    }
  })
})

test.describe('My seat', () => {
  test('without a seat it says so, and "Choose a seat" shows the zone on the map', async ({ page }) => {
    await open(page, stadiumUrl())
    const toggle = page.locator('[data-sv-my-seat-toggle]')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(panel(page)).toContainText('No seat yet')
    await expect(panel(page)).toContainText('Khaled Alotaibi')
    await expect(panel(page)).toContainText('Engineering & Physics')
    const before = Number(await page.locator('[data-seat-matrix]').getAttribute('data-scale'))
    await page.locator('[data-sv-mine-change]').click()
    await expect(panel(page)).toHaveCount(0)
    await expect.poll(async () => Number(await page.locator('[data-seat-matrix]').getAttribute('data-scale'))).toBeGreaterThan(before)
  })

  test('with a seat it names it, opens the card, and "Show my seat" flies there', async ({ page }) => {
    await open(page, stadiumUrl())
    const seat = await book(page)
    await page.locator('[data-sv-card-close]').click()
    await page.locator('[data-sv-my-seat-toggle]').click()
    await expect(page.locator('[data-sv-my-seat-toggle]')).toHaveAttribute('data-booked', '')
    await expect(panel(page)).toHaveAttribute('data-seat', seat)
    await expect(page.locator('[data-sv-my-seat-place]')).toContainText(seat)
    await page.locator('[data-sv-mine-card]').click()
    await expect(dialog(page)).toContainText('Your seat card')
    await page.keyboard.press('Escape')
    await page.locator('[data-sv-mine-show]').click()
    expect((await call(page, (h) => h.state())).selected).toBe(seat)
    expect((await call(page, (h) => h.hud())).inspected).toBe(seat)
    // The inspector takes the panel's place.
    await expect(panel(page)).toHaveCount(0)
    await expect(page.locator('[data-sv-inspector]')).toHaveAttribute('data-seat', seat)
  })

  test('"Release" frees the seat', async ({ page }) => {
    await open(page, stadiumUrl())
    const seat = await book(page)
    await page.locator('[data-sv-card-close]').click()
    await page.locator('[data-sv-my-seat-toggle]').click()
    await page.locator('[data-sv-mine-release]').click()
    await expect(panel(page)).toContainText('No seat yet')
    expect(await status(page, seat)).toBe('available')
    expect(await call(page, (h) => h.mySeat())).toBeNull()
  })

  test('the Family Share Code can be copied', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await open(page, stadiumUrl())
    await page.locator('[data-sv-my-seat-toggle]').click()
    const code = (await page.locator('[data-sv-share-code]').innerText()).trim()
    expect(code).toMatch(/^KF-[A-Z2-9]{4}-[A-Z2-9]{2}$/)
    await page.locator('[data-sv-copy-code]').click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code)
  })

  test('the family locator is on at first, and switching it off is remembered', async ({ page }) => {
    await open(page, stadiumUrl())
    await page.locator('[data-sv-my-seat-toggle]').click()
    const locator = page.locator('[data-sv-locator]')
    await expect(panel(page)).toContainText('Allow Family Seat Locator (Privacy Opt-In)')
    await expect(locator).toBeChecked()
    await locator.uncheck()
    await expect(panel(page)).toContainText('only people with your share code')
    await page.locator('[data-sv-my-seat-close]').click()
    await expect(panel(page)).toHaveCount(0)
    await page.locator('[data-sv-my-seat-toggle]').click()
    await expect(page.locator('[data-sv-locator]')).not.toBeChecked()
  })

  test('"I use a wheelchair" opens the bays of the graduate\'s blocks to booking', async ({ page }) => {
    await open(page, stadiumUrl())
    // A free bay in a men's block (Khaled's blocks are 2 to 6).
    let bay = ''
    for (const id of ['P3-A1', 'P3-A2', 'P4-A1', 'P4-A2', 'P2-A1', 'P2-A2']) {
      if ((await status(page, id)) === 'available') {
        bay = id
        break
      }
    }
    expect(bay).not.toBe('')
    await call(page, (h, id) => h.inspect(id), bay)
    await expect(page.locator('[data-sv-inspector]')).toContainText('Turn on "I use a wheelchair"')
    await expect(page.locator('[data-sv-book]')).toHaveCount(0)
    await page.locator('[data-sv-my-seat-toggle]').click()
    await page.locator('[data-sv-wheelchair]').check()
    await page.locator('[data-sv-my-seat-close]').click()
    await page.locator('[data-sv-book]').click()
    expect(await status(page, bay)).toBe('mine')
    await expect(card(page)).toContainText('Wheelchair bay')
    await expect(card(page)).not.toContainText('Line-up position')
  })

  test('a bay in the other group\'s block cannot be booked', async ({ page }) => {
    await open(page, stadiumUrl())
    await page.locator('[data-sv-my-seat-toggle]').click()
    await page.locator('[data-sv-wheelchair]').check()
    await call(page, (h) => h.inspect('P1-A1'))
    await expect(page.locator('[data-sv-inspector]')).toContainText('other group of graduates')
    await expect(page.locator('[data-sv-book]')).toHaveCount(0)
  })

  test('after another person signs in, the panel is theirs', async ({ page }) => {
    await open(page, stadiumUrl())
    await page.locator('[data-sv-my-seat-toggle]').click()
    await expect(panel(page)).toContainText('Khaled Alotaibi')
    await page.getByRole('button', { name: 'Demo', exact: true }).click()
    await page.locator('[data-demo-console] select').first().selectOption('grad-f-gold')
    // The change of person closes what was open, so nobody reads the previous person's details.
    await expect(panel(page)).toHaveCount(0)
    await page.locator('[data-sv-my-seat-toggle]').click()
    await expect(panel(page)).toContainText('Reem Aldosari')
    await expect(panel(page)).not.toContainText('Khaled')
  })

  test('a guest has no "My seat"', async ({ page }) => {
    await open(page, stadiumUrl({ persona: 'guest' }))
    await expect(page.locator('[data-sv-my-seat-toggle]')).toHaveCount(0)
  })

  test('the panel passes the accessibility checks in both languages', async ({ page }) => {
    for (const lang of ['en', 'ar'] as const) {
      await open(page, stadiumUrl({ lang }))
      await page.locator('[data-sv-my-seat-toggle]').click()
      await expect(panel(page)).toBeVisible()
      const results = await new AxeBuilder({ page }).include('[data-sv-my-seat]').analyze()
      expect(results.violations, `${lang}: ${results.violations.map((v) => `${v.id} ${v.nodes[0]?.html}`).join(', ')}`).toEqual([])
    }
  })
})
