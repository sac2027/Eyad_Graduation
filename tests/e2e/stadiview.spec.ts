import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** Software WebGL is slow, so stadium tests run the lightest 3D tier unless they are about tiers. */
const STADIUM = '/stadium?lang=en&tier=1'

interface Hook {
  ready: boolean
  tier: number
  info(): { calls: number; triangles: number }
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
