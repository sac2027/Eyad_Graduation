import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** Software WebGL is slow, so stadium tests run the lightest 3D tier unless they are about tiers. */
const STADIUM = '/stadium?lang=en&tier=1'

interface Point {
  x: number
  y: number
}

interface Hook {
  ready: boolean
  tier: number
  info(): { calls: number; triangles: number }
  project(seatId: string): Point | null
  projectPoint(p: [number, number, number]): Point | null
  state(): { mode: string; hover: string | null; selected: string | null }
  select(seatId: string): void
  back(): void
}

const hook = (page: Page) => page.evaluateHandle(() => (window as unknown as { __stadiview: Hook }).__stadiview)

async function project(page: Page, seatId: string): Promise<Point> {
  const p = await (await hook(page)).evaluate((h, id) => h.project(id), seatId)
  expect(p, `${seatId} should be on screen`).not.toBeNull()
  return p!
}

async function state(page: Page) {
  return (await hook(page)).evaluate((h) => h.state())
}

/** Moves the mouse onto a point the way a hand does: from nearby, in a few steps. */
async function hoverAt(page: Page, p: Point) {
  await page.mouse.move(p.x - 24, p.y - 18)
  await page.mouse.move(p.x, p.y, { steps: 3 })
}

async function ready(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __stadiview?: Hook }).__stadiview?.ready === true, undefined, { timeout: 30_000 })
}

/** Makes every canvas refuse a WebGL context, as on a device without it. */
async function withoutWebGL(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest)
    } as typeof HTMLCanvasElement.prototype.getContext
  })
}

test.describe('the stadium route', () => {
  test('opens on the 3D stadium, full screen, with the scoped theme and tier', async ({ page }) => {
    await page.goto(STADIUM)
    const root = page.locator('[data-stadiview]')
    await expect(root).toHaveAttribute('data-theme', 'stadiview')
    await expect(root).toHaveAttribute('data-tier', '1')
    const canvas = page.locator('[data-stadium-canvas] canvas')
    await expect(canvas).toBeVisible()
    await ready(page)

    const viewport = page.viewportSize()!
    const box = (await canvas.boundingBox())!
    expect(box.x).toBeCloseTo(0, 0)
    expect(box.y).toBeCloseTo(0, 0)
    expect(box.width).toBeCloseTo(viewport.width, 0)
    expect(box.height).toBeCloseTo(viewport.height, 0)

    // The page is one screen: the wheel belongs to the camera, not to the document.
    const overflow = await page.evaluate(() => ({
      tall: document.documentElement.scrollHeight - window.innerHeight,
      wide: document.documentElement.scrollWidth - window.innerWidth,
    }))
    expect(overflow.tall).toBeLessThanOrEqual(0)
    expect(overflow.wide).toBeLessThanOrEqual(0)

    expect(await page.evaluate(() => (window as unknown as { __stadiview: Hook }).__stadiview.tier)).toBe(1)
  })

  test('the canvas is described for people who cannot see it', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    const picture = page.locator('[data-stadium-canvas] [role="img"]')
    await expect(picture).toHaveAttribute('aria-label', /stadium/i)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/StadiView/)
  })

  test('the site header links to the stadium, and the stadium links back home', async ({ page }) => {
    await page.goto('/?lang=en')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Stadium' }).click()
    await expect(page).toHaveURL(/\/stadium/)
    await expect(page.locator('[data-stadiview]')).toBeVisible()
    await page.locator('[data-sv-home]').click()
    await expect(page).toHaveURL(/\/(\?.*)?$/)
    await expect(page.locator('[data-stadiview]')).toHaveCount(0)
    // Leaving the stadium gives the page its scroll back.
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden')
  })

  test('the language button switches the top bar between English and Arabic', async ({ page }) => {
    await page.goto(STADIUM)
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await page.locator('[data-sv-language]').click()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('[data-sv-language]')).toHaveText('English')
  })

  for (const query of ['tier=1', 'tier=3']) {
    test(`without WebGL the page explains itself and offers a way back (${query})`, async ({ page }) => {
      await withoutWebGL(page)
      await page.goto(`/stadium?lang=en&${query}`)
      await expect(page.locator('[data-stadiview]')).toHaveAttribute('data-tier', '0')
      const fallback = page.locator('[data-stadium-fallback]')
      await expect(fallback).toBeVisible()
      await expect(fallback.getByRole('link')).toHaveAttribute('href', '/')
      await expect(page.locator('[data-stadium-canvas] canvas')).toHaveCount(0)
      await expect(page.locator('canvas:not([data-fx])')).toHaveCount(0)
    })
  }

  test('without WebGL the 3D code is never downloaded', async ({ page }) => {
    await withoutWebGL(page)
    const urls: string[] = []
    page.on('request', (r) => urls.push(r.url()))
    await page.goto('/stadium?lang=en')
    await expect(page.locator('[data-stadium-fallback]')).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(urls.filter((u) => /StadiumCanvas|three/i.test(u))).toEqual([])
  })

  test('a lost WebGL context shows the fallback instead of a frozen picture', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-stadium-canvas] canvas')!
      const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext
      gl.getExtension('WEBGL_lose_context')!.loseContext()
    })
    const fallback = page.locator('[data-stadium-fallback]')
    await expect(fallback).toBeVisible({ timeout: 4000 })
    await expect(fallback.getByRole('link')).toHaveAttribute('href', '/')
    // Trying again builds a fresh scene.
    await fallback.getByRole('button').click()
    await expect(page.locator('[data-stadium-canvas] canvas')).toBeVisible()
    await expect(fallback).toHaveCount(0)
  })

  test('the landing page does not download the stadium or three.js', async ({ page }) => {
    const urls: string[] = []
    page.on('request', (r) => urls.push(r.url()))
    await page.goto('/?lang=en')
    await page.waitForLoadState('networkidle')
    expect(urls.filter((u) => /stadiview|three/i.test(u))).toEqual([])
  })

  test('the overview stays inside the drawing budget', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    const info = await page.evaluate(() => (window as unknown as { __stadiview: Hook }).__stadiview.info())
    expect(info.calls).toBeGreaterThan(0)
    expect(info.calls).toBeLessThanOrEqual(80)
    expect(info.triangles).toBeGreaterThan(1000)
    expect(info.triangles).toBeLessThanOrEqual(450_000)
  })

  test('first person has no serious accessibility problems either', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    await (await hook(page)).evaluate((h) => h.select('P3-12-07'))
    await page.waitForFunction(() => (window as unknown as { __stadiview: Hook }).__stadiview.state().mode === 'pov', undefined, { timeout: 12_000 })
    await expect(page.locator('[data-sv-back]')).toBeVisible()
    const results = await new AxeBuilder({ page }).exclude('[data-demo-console]').exclude('canvas').analyze()
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
  })

  test('the top bar has no serious accessibility problems', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    const results = await new AxeBuilder({ page }).exclude('[data-demo-console]').exclude('canvas').analyze()
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
  })
})

test.describe('the stadium on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  for (const lang of ['ar', 'en']) {
    test(`nothing scrolls sideways at 390 px (${lang})`, async ({ page }) => {
      await page.goto(`/stadium?lang=${lang}&tier=1`)
      await ready(page)
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(over).toBeLessThanOrEqual(0)
      // The top bar's controls stay on the screen.
      for (const sel of ['[data-sv-home]', '[data-sv-language]']) {
        const box = (await page.locator(sel).boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(390)
      }
    })
  }
})

test.describe('seats under the pointer', () => {
  const tooltip = '[data-seat-tooltip]'

  test('hovering a pitch seat turns it on in the store and names it in the tooltip', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    await hoverAt(page, await project(page, 'P3-12-07'))
    await expect.poll(async () => (await state(page)).hover).toBe('P3-12-07')
    const tip = page.locator(tooltip)
    await expect(tip).toHaveAttribute('data-open', '')
    await expect(tip).toContainText('Block 3')
    await expect(tip).toContainText('Row 12')
    await expect(tip).toContainText('Seat 7')
    await expect(tip).toContainText('Computing & Mathematics')
    await expect(tip).toContainText('Bachelor')
    await expect(tip).toContainText('Available')
    // The tooltip is for the eye; assistive technology gets the same facts elsewhere.
    await expect(tip).toHaveAttribute('aria-hidden', 'true')
  })

  test('a pointer over an aisle highlights nothing and hides the tooltip', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    await hoverAt(page, await project(page, 'P3-12-07'))
    await expect(page.locator(tooltip)).toHaveAttribute('data-open', '')
    // The aisle between blocks 1 and 2, on the ground.
    const aisle = await (await hook(page)).evaluate((h) => h.projectPoint([-26, 0, -21.6]))
    expect(aisle).not.toBeNull()
    await page.mouse.move(aisle!.x, aisle!.y, { steps: 3 })
    await expect.poll(async () => (await state(page)).hover).toBeNull()
    await expect(page.locator(tooltip)).not.toHaveAttribute('data-open', '')
    // The sky has no seats either.
    await page.mouse.move(700, 120, { steps: 3 })
    await expect.poll(async () => (await state(page)).hover).toBeNull()
  })

  test('hovering a stand seat names its stand, row and seat, without a booking status', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    await hoverAt(page, await project(page, 'S-10-060'))
    await expect.poll(async () => (await state(page)).hover).toBe('S-10-060')
    const tip = page.locator(tooltip)
    await expect(tip).toContainText('South stand')
    await expect(tip).toContainText('Row 10')
    await expect(tip).toContainText('Seat 60')
    await expect(tip).not.toContainText('Available')
  })

  test('a wheelchair bay is named as one', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    await hoverAt(page, await project(page, 'P2-A1'))
    await expect.poll(async () => (await state(page)).hover).toBe('P2-A1')
    await expect(page.locator(tooltip)).toContainText('Block 2')
    await expect(page.locator(tooltip)).toContainText('Wheelchair bay 1')
  })

  test('clicking a seat selects it', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    const p = await project(page, 'S-10-060')
    await hoverAt(page, p)
    await page.mouse.click(p.x, p.y)
    await expect.poll(async () => (await state(page)).selected).toBe('S-10-060')
  })

  test('pressing, dragging 40 px and releasing over a seat does not select it', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    const p = await project(page, 'P3-12-07')
    await page.mouse.move(p.x - 40, p.y)
    await page.mouse.down()
    await page.mouse.move(p.x, p.y, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(150)
    expect((await state(page)).selected).toBeNull()
  })

  test('the hover follows the pointer from seat to seat without closing in between', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    await hoverAt(page, await project(page, 'P3-12-07'))
    await expect.poll(async () => (await state(page)).hover).toBe('P3-12-07')
    const next = await project(page, 'P4-12-07')
    await page.mouse.move(next.x, next.y, { steps: 2 })
    await expect.poll(async () => (await state(page)).hover).toBe('P4-12-07')
    await expect(page.locator(tooltip)).toContainText('Block 4')
    await expect(page.locator(tooltip)).toHaveAttribute('data-open', '')
  })

  test('leaving the canvas clears the hover', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    await hoverAt(page, await project(page, 'P3-12-07'))
    await expect.poll(async () => (await state(page)).hover).toBe('P3-12-07')
    // The language button is outside the canvas.
    await page.locator('[data-sv-language]').hover()
    await expect.poll(async () => (await state(page)).hover).toBeNull()
  })

  test('the seats fit the drawing budget: two draw calls for 7,998 chairs', async ({ page }) => {
    await page.goto(STADIUM)
    await ready(page)
    const info = await (await hook(page)).evaluate((h) => h.info())
    expect(info.calls).toBeLessThanOrEqual(80)
    expect(info.triangles).toBeGreaterThan(7998 * 12)
    expect(info.triangles).toBeLessThanOrEqual(450_000)
  })

  for (const lang of ['ar', 'en']) {
    test(`the tooltip stays on screen and off the pointer at every edge (${lang})`, async ({ page }) => {
      await page.goto(`/stadium?lang=${lang}&tier=1`)
      await ready(page)
      const viewport = page.viewportSize()!
      // Seats spread over the picture; keep the ones nearest each edge of the screen.
      const edges = await (await hook(page)).evaluate((h) => {
        const ids: string[] = []
        for (let r = 1; r <= 20; r += 3) for (let n = 1; n <= 120; n += 17) ids.push(`S-${String(r).padStart(2, '0')}-${String(n).padStart(3, '0')}`)
        for (let b = 1; b <= 6; b++) for (let r = 1; r <= 33; r += 8) for (const n of [1, 14]) ids.push(`P${b}-${String(r).padStart(2, '0')}-${String(n).padStart(2, '0')}`)
        for (let r = 1; r <= 12; r += 3) for (let n = 1; n <= 100; n += 11) ids.push(`E-${String(r).padStart(2, '0')}-${String(n).padStart(3, '0')}`)
        for (let r = 1; r <= 15; r += 4) for (let n = 1; n <= 30; n += 7) ids.push(`NE-${String(r).padStart(2, '0')}-${String(n).padStart(3, '0')}`, `NW-${String(r).padStart(2, '0')}-${String(n).padStart(3, '0')}`)
        const seen = ids.map((id) => ({ id, p: h.project(id) })).filter((s): s is { id: string; p: { x: number; y: number } } => s.p !== null)
        const by = (f: (p: { x: number; y: number }) => number) => [...seen].sort((a, b) => f(a.p) - f(b.p))
        return { left: by((p) => p.x).slice(0, 6), right: by((p) => -p.x).slice(0, 6), top: by((p) => p.y).slice(0, 6), bottom: by((p) => -p.y).slice(0, 6) }
      })
      let checked = 0
      for (const [edge, candidates] of Object.entries(edges)) {
        // Some candidates are hidden behind a wall or the title; use the first one the pointer really reaches.
        for (const c of candidates) {
          await page.mouse.move(c.p.x, c.p.y, { steps: 2 })
          await page.waitForTimeout(120)
          if ((await state(page)).hover === null) continue
          const tip = page.locator(tooltip)
          await expect(tip).toHaveAttribute('data-open', '')
          await expect(tip).toContainText(lang === 'ar' ? /الصف/ : /Row/)
          const box = (await tip.boundingBox())!
          expect(box.x, `${edge}: left edge`).toBeGreaterThanOrEqual(0)
          expect(box.y, `${edge}: top edge`).toBeGreaterThanOrEqual(0)
          expect(box.x + box.width, `${edge}: right edge`).toBeLessThanOrEqual(viewport.width)
          expect(box.y + box.height, `${edge}: bottom edge`).toBeLessThanOrEqual(viewport.height)
          const covers = c.p.x >= box.x && c.p.x <= box.x + box.width && c.p.y >= box.y && c.p.y <= box.y + box.height
          expect(covers, `${edge}: the tooltip must not sit on the pointer`).toBe(false)
          checked++
          break
        }
      }
      expect(checked).toBeGreaterThanOrEqual(3)
    })
  }
})
