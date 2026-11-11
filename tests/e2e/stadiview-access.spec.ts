import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { call, open, stadiumUrl } from './support/stadium'

type Sample = { index: number; name: { ar: string; en: string }; studentId: string; shareCode: string; seat: string | null; tickets: string[] }

/** Makes every canvas refuse a WebGL context, as on a device without it. */
async function withoutWebGL(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null
      return (original as (...args: unknown[]) => unknown).call(this, type, ...rest)
    } as typeof HTMLCanvasElement.prototype.getContext
  })
}

/** Presses Tab until the focus is on an element matching `selector`. No pointer is used. */
async function tabTo(page: Page, selector: string, limit = 80) {
  for (let k = 0; k < limit; k++) {
    if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`Tab never reached ${selector}`)
}

const live = (page: Page) => page.locator('[data-sv-live]')
const violations = async (page: Page, scope: string) => {
  const results = await new AxeBuilder({ page }).include(scope).analyze()
  return results.violations.map((v) => `${v.id} ${v.nodes[0]?.html}`)
}

test.describe('with the keyboard alone', () => {
  test('a graduate finds a free seat in the list, books it and reaches the seat card', async ({ page }) => {
    await open(page, stadiumUrl())
    await tabTo(page, '[data-sv-tab="map"]')
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('[data-sv-tab="list"]')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-sv-finder]')).toBeVisible()

    // The list of free seats is one stop; arrow keys move within it.
    await tabTo(page, '[data-sv-finder-free] button')
    const first = await page.evaluate(() => document.activeElement!.getAttribute('data-seat'))
    await page.keyboard.press('ArrowRight')
    const second = await page.evaluate(() => document.activeElement!.getAttribute('data-seat'))
    expect(second).not.toBe(first)
    await page.keyboard.press('ArrowDown')
    const third = await page.evaluate(() => document.activeElement!.getAttribute('data-seat'))
    expect(third).not.toBe(second)
    await page.keyboard.press('Enter')
    expect((await call(page, (h) => h.hud())).inspected).toBe(third)
    await expect(live(page)).toContainText('Available')

    await tabTo(page, '[data-sv-book]')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-sv-seat-card]')).toHaveAttribute('data-seat', third!)
    expect(await call(page, (h, id) => h.status(id), third!)).toBe('mine')
    // The dialog holds the focus, and Escape leaves it.
    expect(await page.evaluate(() => document.activeElement?.closest('[data-sv-card-dialog]') !== null)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-sv-card-dialog]')).toHaveCount(0)
  })

  test('the three pickers reach any seat', async ({ page }) => {
    await open(page, stadiumUrl())
    await tabTo(page, '[data-sv-tab="map"]')
    await page.keyboard.press('ArrowRight')
    await page.locator('[data-sv-finder-section]').selectOption({ label: 'South stand' })
    await page.locator('[data-sv-finder-row]').selectOption('2')
    await page.locator('[data-sv-finder-seat]').selectOption({ label: '84' })
    await tabTo(page, '[data-sv-finder-show]')
    await page.keyboard.press('Enter')
    expect((await call(page, (h) => h.hud())).inspected).toBe('S-02-084')
    await expect(live(page)).toContainText('South stand')
    await expect(page.locator('[data-sv-ticket]')).toContainText('TICKET-G1-204')
  })

  test('a guest types a ticket, then finds a graduate and chooses them', async ({ page }) => {
    // About forty Tab stops, each waiting on a frame drawn in software here; the arc and beacon follow the choice.
    test.setTimeout(120_000)
    await open(page, stadiumUrl({ persona: 'guest' }))
    const g = (await call(page, (h) => h.sampleGraduate(true, 5))) as Sample
    await tabTo(page, '[data-sv-guest-toggle]')
    await page.keyboard.press('Enter')
    await tabTo(page, '[data-sv-ticket-input]')
    await page.keyboard.type('ticket g1 204')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-sv-ticket-result="TICKET-G1-204"]')).toBeVisible()
    await tabTo(page, '[data-sv-graduate-search]')
    await page.keyboard.type(g.studentId)
    await tabTo(page, `[data-sv-graduate-result="${g.index}"]`)
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-sv-located="found"]')).toHaveAttribute('data-seat', g.seat!)
    await expect(page.locator('[data-sv-sightline]')).toBeVisible()
    await expect(live(page)).toContainText('Block')
  })

  test('the live region names each inspected seat and its state', async ({ page }) => {
    await open(page, stadiumUrl())
    await expect(live(page)).toHaveText('')
    await call(page, (h) => h.inspect('P3-12-07'))
    await expect(live(page)).toContainText('Block 3 · Row 12 · Seat 7')
    await expect(live(page)).toContainText('Computing & Mathematics')
    const taken = (await call(page, (h) => h.takenSeat('P3-12-07')))!
    await call(page, (h, id) => h.inspect(id), taken)
    await expect(live(page)).toContainText('Taken')
    await call(page, (h) => h.inspect('S-10-060'))
    await expect(live(page)).toContainText('South stand')
  })

  test('the list tab passes the accessibility checks', async ({ page }) => {
    for (const lang of ['en', 'ar'] as const) {
      await open(page, stadiumUrl({ lang }))
      await page.locator('[data-sv-tab="list"]').click()
      await expect(page.locator('[data-sv-finder-free] button').first()).toBeVisible()
      expect(await violations(page, '[data-seat-matrix]'), lang).toEqual([])
    }
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  for (const lang of ['ar', 'en'] as const) {
    test(`the dock opens one sheet at a time, and nothing scrolls sideways (${lang})`, async ({ page }) => {
      await open(page, stadiumUrl({ lang }))
      const dock = page.locator('[data-sv-dock]')
      await expect(dock).toBeVisible()
      // No sheet is open at first: the stadium has the screen.
      await expect(page.locator('[data-seat-matrix]')).toHaveCount(0)

      await dock.locator('[data-sv-dock-button="matrix"]').click()
      await expect(page.locator('[data-seat-matrix]')).toBeVisible()
      await dock.locator('[data-sv-dock-button="mine"]').click()
      await expect(page.locator('[data-sv-my-seat]')).toBeVisible()
      await expect(page.locator('[data-seat-matrix]')).toHaveCount(0)

      const sizes = await page.evaluate(() => {
        const small: string[] = []
        for (const el of document.querySelectorAll<HTMLElement>('[data-sv-dock] button, [data-sv-my-seat] button, [data-sv-my-seat] .sv-switch')) {
          const box = el.getBoundingClientRect()
          if (box.height > 0 && box.height < 44) small.push(`${el.textContent?.trim().slice(0, 24)} ${Math.round(box.height)}`)
        }
        return { small, page: document.documentElement.scrollWidth, sheet: document.querySelector<HTMLElement>('[data-sv-my-seat]')!.scrollWidth }
      })
      expect(sizes.small).toEqual([])
      expect(sizes.page).toBeLessThanOrEqual(390)
      expect(sizes.sheet).toBeLessThanOrEqual(390)

      // The same for the seat map sheet and its list.
      await dock.locator('[data-sv-dock-button="matrix"]').click()
      await page.locator('[data-sv-tab="list"]').click()
      const list = await page.evaluate(() => {
        const small: string[] = []
        for (const el of document.querySelectorAll<HTMLElement>('[data-seat-matrix] button, [data-seat-matrix] select')) {
          const box = el.getBoundingClientRect()
          if (box.height > 0 && box.height < 44) small.push(`${el.textContent?.trim().slice(0, 24)} ${Math.round(box.height)}`)
        }
        return { small, page: document.documentElement.scrollWidth }
      })
      expect(list.small).toEqual([])
      expect(list.page).toBeLessThanOrEqual(390)
    })
  }

  test('a full booking, from the dock to the seat card', async ({ page }) => {
    await open(page, stadiumUrl())
    await page.locator('[data-sv-dock-button="matrix"]').tap()
    await page.locator('[data-sv-tab="list"]').tap()
    const seat = page.locator('[data-sv-finder-free] button').nth(2)
    const id = (await seat.getAttribute('data-seat'))!
    await seat.tap()
    // The seat's sheet takes the map's place, and the dock gains its button.
    await expect(page.locator('[data-sv-inspector]')).toHaveAttribute('data-seat', id)
    await expect(page.locator('[data-seat-matrix]')).toHaveCount(0)
    await expect(page.locator('[data-sv-dock-button="inspector"]')).toHaveAttribute('aria-pressed', 'true')
    await page.locator('[data-sv-book]').tap()
    await expect(page.locator('[data-sv-seat-card]')).toHaveAttribute('data-seat', id)
    expect(await call(page, (h, s) => h.status(s), id)).toBe('mine')
    const fit = await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>('[data-sv-card-dialog]')!.getBoundingClientRect()
      return { left: box.left, right: box.right, page: document.documentElement.scrollWidth }
    })
    expect(fit.left).toBeGreaterThanOrEqual(0)
    expect(fit.right).toBeLessThanOrEqual(390)
    expect(fit.page).toBeLessThanOrEqual(390)
  })

  test('a sheet takes the focus, keeps Tab inside, and Escape closes it', async ({ page }) => {
    await open(page, stadiumUrl())
    await page.locator('[data-sv-dock-button="mine"]').click()
    const sheet = page.locator('[data-sv-my-seat]')
    await expect(sheet).toBeVisible()
    expect(await page.evaluate(() => document.activeElement?.closest('[data-sv-my-seat]') !== null)).toBe(true)
    for (let k = 0; k < 14; k++) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement?.closest('[data-sv-my-seat]') !== null)).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    // The focus goes back to the button that opened it.
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-sv-dock-button'))).toBe('mine')
  })

  test('a guest looks up a ticket and a graduate in one sheet', async ({ page }) => {
    await open(page, stadiumUrl({ persona: 'guest' }))
    const g = (await call(page, (h) => h.sampleGraduate(true, 5))) as Sample
    await page.locator('[data-sv-dock-button="guest"]').tap()
    await page.locator('[data-sv-ticket-input]').fill(g.tickets[0])
    await page.locator('[data-sv-ticket-find]').tap()
    // The guest sheet stays in front: the ticket's details are in it.
    await expect(page.locator('[data-sv-guest]')).toBeVisible()
    await page.locator('[data-sv-ticket-graduate]').tap()
    await expect(page.locator('[data-sv-located="found"]')).toHaveAttribute('data-seat', g.seat!)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('an open sheet passes the accessibility checks', async ({ page }) => {
    await open(page, stadiumUrl({ lang: 'ar' }))
    await page.locator('[data-sv-dock-button="matrix"]').click()
    await expect(page.locator('[data-seat-matrix]')).toBeVisible()
    expect(await violations(page, '[data-seat-matrix]')).toEqual([])
    expect(await violations(page, '[data-sv-dock]')).toEqual([])
  })

  test('the smallest phone still fits everything across', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await open(page, stadiumUrl({ persona: 'grad-long-name', extra: 'worst=1' }))
    for (const key of ['matrix', 'mine'] as const) {
      await page.locator(`[data-sv-dock-button="${key}"]`).click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth), key).toBeLessThanOrEqual(320)
      const wide = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.sv-mx, .sv-insp')).map((el) => el.scrollWidth - el.clientWidth))
      for (const extra of wide) expect(extra, key).toBeLessThanOrEqual(1)
    }
  })
})

test.describe('without the 3D picture', () => {
  test('the seat map fills the page, and a booking works on it', async ({ page }) => {
    await withoutWebGL(page)
    await page.goto(stadiumUrl())
    const map = page.locator('[data-seat-matrix]')
    await expect(map).toBeVisible()
    await expect(page.locator('[data-stadiview]')).toHaveAttribute('data-flat', '')
    // The only canvas is the 2D map, and it has most of the screen.
    await expect(page.locator('[data-stadiview] canvas')).toHaveCount(1)
    const box = (await map.boundingBox())!
    expect(box.width).toBeGreaterThan(800)
    expect(box.height).toBeGreaterThan(450)
    await expect(page.locator('[data-stadium-fallback]')).toContainText('seat map')

    await page.waitForFunction(() => typeof (window as unknown as { __stadiview?: { myZone?: unknown } }).__stadiview?.myZone === 'function')
    const zone = (await call(page, (h) => h.myZone()))!
    const seat = (await call(page, (h, z) => h.freeSeat(z), zone))!
    await call(page, (h, id) => h.inspect(id), seat)
    // No 3D view to fly to: a drawing of the sightline stands in for the picture, and "View from this seat" is not offered.
    await expect(page.locator('[data-sv-sketch]')).toBeVisible()
    await expect(page.locator('[data-preview-seat]')).toHaveCount(0)
    await expect(page.locator('[data-sv-view-from]')).toHaveCount(0)
    await page.locator('[data-sv-book]').click()
    await expect(page.locator('[data-sv-seat-card]')).toHaveAttribute('data-seat', seat)
    expect(await call(page, (h, id) => h.status(id), seat)).toBe('mine')
  })

  test('clicking a seat on the full-page map inspects it', async ({ page }) => {
    await withoutWebGL(page)
    await page.goto(stadiumUrl())
    await expect(page.locator('[data-seat-matrix]')).toBeVisible()
    await page.locator('[data-sv-seat-search]').fill('P3-12-07')
    await page.locator('[data-sv-seat-search]').press('Enter')
    await expect(page.locator('[data-sv-inspector]')).toHaveAttribute('data-seat', 'P3-12-07')
    const at = (await call(page, (h) => h.matrixPoint('P3-12-08')))!
    await page.mouse.click(at.x, at.y)
    await expect(page.locator('[data-sv-inspector]')).toHaveAttribute('data-seat', 'P3-12-08')
  })

  test('a guest looks up a ticket and a graduate', async ({ page }) => {
    await withoutWebGL(page)
    await page.goto(stadiumUrl({ persona: 'guest' }))
    await page.locator('[data-sv-guest-toggle]').click()
    await page.locator('[data-sv-ticket-input]').fill('TICKET-G1-204')
    await page.locator('[data-sv-ticket-find]').click()
    await expect(page.locator('[data-sv-ticket-result="TICKET-G1-204"]')).toContainText('South stand')
    // Nothing offers a flight that cannot happen.
    await expect(page.locator('[data-sv-ticket-view]')).toHaveCount(0)
    const g = (await call(page, (h) => h.sampleGraduate(true, 5))) as Sample
    await page.locator('[data-sv-graduate-search]').fill(g.studentId)
    await page.locator(`[data-sv-graduate-result="${g.index}"]`).click()
    await expect(page.locator('[data-sv-located="found"]')).toHaveAttribute('data-seat', g.seat!)
    await expect(page.locator('[data-sv-sightline]')).toContainText(/\d+ m from your seat/)
    await expect(page.locator('[data-sv-face-them]')).toHaveCount(0)
  })

  test('on a phone the map is the page and the dock still opens the sheets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await withoutWebGL(page)
    await page.goto(stadiumUrl())
    await expect(page.locator('[data-seat-matrix]')).toBeVisible()
    await page.locator('[data-sv-dock-button="mine"]').click()
    await expect(page.locator('[data-sv-my-seat]')).toBeVisible()
    await expect(page.locator('[data-seat-matrix]')).toBeVisible()
    await page.locator('[data-sv-dock-button="matrix"]').click()
    await expect(page.locator('[data-sv-my-seat]')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('the page without 3D passes the accessibility checks', async ({ page }) => {
    await withoutWebGL(page)
    for (const lang of ['en', 'ar'] as const) {
      await page.goto(stadiumUrl({ lang }))
      await expect(page.locator('[data-seat-matrix]')).toBeVisible()
      await page.waitForFunction(() => typeof (window as unknown as { __stadiview?: { inspect?: unknown } }).__stadiview?.inspect === 'function')
      await call(page, (h) => h.inspect('P3-12-07'))
      await expect(page.locator('[data-sv-sketch]')).toBeVisible()
      expect(await violations(page, '[data-stadiview]'), lang).toEqual([])
    }
  })
})
