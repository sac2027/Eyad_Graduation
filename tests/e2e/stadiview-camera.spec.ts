import { expect, test, type Page } from '@playwright/test'

/** Software WebGL is slow, so the camera tests run the lightest 3D tier. */
const STADIUM = '/stadium?lang=en&tier=1'

type V3 = [number, number, number]

interface Point {
  x: number
  y: number
}

interface Hook {
  ready: boolean
  project(seatId: string): Point | null
  projectPoint(p: V3): Point | null
  state(): { mode: string; hover: string | null; selected: string | null }
  select(seatId: string): void
  back(): void
  camera(): { position: V3; fov: number; direction: V3 }
  lastFlightStart(): V3 | null
}

const hook = (page: Page) => page.evaluateHandle(() => (window as unknown as { __stadiview: Hook }).__stadiview)

async function ready(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __stadiview?: Hook }).__stadiview?.ready === true, undefined, { timeout: 30_000 })
}

async function open(page: Page, url = STADIUM) {
  await page.goto(url)
  await ready(page)
}

const mode = async (page: Page) => (await hook(page)).evaluate((h) => h.state().mode)
const camera = async (page: Page) => (await hook(page)).evaluate((h) => h.camera())
const select = async (page: Page, id: string) => (await hook(page)).evaluate((h, seat) => h.select(seat), id)

async function waitForMode(page: Page, wanted: string, timeout = 12_000) {
  await page.waitForFunction((m) => (window as unknown as { __stadiview: Hook }).__stadiview.state().mode === m, wanted, { timeout })
}

/** Flies into a seat through the debug hook and waits until the viewer is seated. */
async function sitIn(page: Page, id: string) {
  await select(page, id)
  await waitForMode(page, 'pov')
}

const distance = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
/** The overview circles this point (the config's camera target). */
const TARGET: V3 = [-8, 0, 0]
/** Where the eyes of someone in P3-12-07 and S-10-060 are: the seat's position plus 1.15 m. */
const EYE_P3_12_07: V3 = [-19, 1.15, -5.7]
const EYE_S_10_060: V3 = [0.3, 6.13, 60.65]

test.describe('flying into a seat', () => {
  test('clicking a seat flies the camera to its eye point and opens first person at 62 degrees', async ({ page }) => {
    await open(page)
    const p = (await (await hook(page)).evaluate((h) => h.project('P3-12-07')))!
    await page.mouse.move(p.x, p.y, { steps: 3 })
    await page.mouse.click(p.x, p.y)
    await expect.poll(() => mode(page)).toBe('fly')
    await waitForMode(page, 'pov', 6000)
    const c = await camera(page)
    expect(distance(c.position, EYE_P3_12_07)).toBeLessThan(0.05)
    expect(c.fov).toBeCloseTo(62, 3)
    // A graduate faces the stage: west, and slightly up toward the speaker.
    expect(c.direction[0]).toBeLessThan(-0.9)
  })

  test('the back button appears in first person and returns to the overview pose', async ({ page }) => {
    await open(page)
    const before = (await camera(page)).position
    const back = page.locator('[data-sv-back]')
    // In the overview the button is switched off: transparent and out of reach of pointer and keyboard.
    expect(await back.evaluate((el) => el.closest('[inert]') !== null)).toBe(true)
    expect(await back.evaluate((el) => getComputedStyle(el).opacity)).toBe('0')

    await sitIn(page, 'P3-12-07')
    await expect(back).toBeVisible()
    await expect(back).toHaveText(/Back to stadium overview/i)
    expect(await back.evaluate((el) => el.closest('[inert]') !== null)).toBe(false)
    const box = (await back.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    // Bottom centre.
    const viewport = page.viewportSize()!
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(8)
    expect(box.y + box.height).toBeGreaterThan(viewport.height - 80)

    await back.click()
    await waitForMode(page, 'orbit')
    expect(distance((await camera(page)).position, before)).toBeLessThan(0.5)
    expect((await (await hook(page)).evaluate((h) => h.state())).selected).toBeNull()
  })

  test('Escape goes back too, from anywhere on the page', async ({ page }) => {
    await open(page)
    const before = (await camera(page)).position
    await sitIn(page, 'S-10-060')
    expect(distance((await camera(page)).position, EYE_S_10_060)).toBeLessThan(0.05)
    await page.keyboard.press('Escape')
    await waitForMode(page, 'orbit')
    expect(distance((await camera(page)).position, before)).toBeLessThan(0.5)
  })

  test('arriving in a seat names it, and says how to look around', async ({ page }) => {
    await open(page)
    await sitIn(page, 'P3-12-07')
    const hint = page.locator('[data-sv-hint]')
    await expect(hint).toHaveAttribute('data-open', '')
    await expect(hint).toContainText('Block 3 · Row 12 · Seat 7')
    await expect(hint).toContainText('Drag to look around')
    await expect(hint).toHaveAttribute('role', 'status')
    // It leaves after four seconds.
    await expect(hint).not.toHaveAttribute('data-open', '', { timeout: 6000 })
  })

  test('picking a second seat mid-flight carries on from where the camera is', async ({ page }) => {
    await open(page)
    await select(page, 'P1-01-01')
    await page.waitForTimeout(600)
    // Read the camera, retarget and read where the new flight began, all within one frame.
    const { before, start, flying } = await (await hook(page)).evaluate((h) => {
      const before = h.camera().position
      h.select('S-10-060')
      return { before, start: h.lastFlightStart()!, flying: h.state() }
    })
    expect(flying).toMatchObject({ mode: 'fly', selected: 'S-10-060' })
    expect(distance(before, start)).toBeLessThan(0.01)
    // The first flight had really begun: the camera had left the overview pose.
    expect(distance(before, [72, 64, -88])).toBeGreaterThan(0.2)
    await waitForMode(page, 'pov')
    expect(distance((await camera(page)).position, EYE_S_10_060)).toBeLessThan(0.05)
  })

  test('a click on another seat during a flight retargets it', async ({ page }) => {
    await open(page)
    const p = (await (await hook(page)).evaluate((h) => h.project('S-10-060')))!
    await select(page, 'P1-01-01')
    await page.mouse.click(p.x, p.y)
    // Whatever seat is under that point now that the camera has moved, the flight has a new target.
    const picked = (await (await hook(page)).evaluate((h) => h.state())).selected
    expect(picked).not.toBeNull()
    await waitForMode(page, 'pov')
  })

  test('a seat in the roofed VIP box can be flown into and out of', async ({ page }) => {
    await open(page)
    const before = (await camera(page)).position
    await sitIn(page, 'VIP-03-025')
    const c = await camera(page)
    // Row 3 of the box: floor at 3.9 m, eyes 1.15 m above it, looking south over the pitch.
    expect(distance(c.position, [-0.3, 5.05, -54.2])).toBeLessThan(0.05)
    expect(c.direction[2]).toBeGreaterThan(0.8)
    await page.keyboard.press('Escape')
    await waitForMode(page, 'orbit')
    expect(distance((await camera(page)).position, before)).toBeLessThan(0.5)
  })

  test('with reduced motion the flight is a short cut, not a ride', async ({ page }) => {
    await open(page, `${STADIUM}&reduced=1`)
    // Timed inside the page, so the test runner's own delays are not counted.
    const timeTo = (wanted: string, act: 'select' | 'back') =>
      page.evaluate(
        ([m, a]) =>
          new Promise<number>((resolve) => {
            const h = (window as unknown as { __stadiview: Hook }).__stadiview
            const t0 = performance.now()
            if (a === 'select') h.select('P3-12-07')
            else h.back()
            const timer = setInterval(() => {
              if (h.state().mode !== m) return
              clearInterval(timer)
              resolve(performance.now() - t0)
            }, 10)
          }),
        [wanted, act] as const,
      )
    expect(await timeTo('pov', 'select')).toBeLessThan(900)
    expect(distance((await camera(page)).position, EYE_P3_12_07)).toBeLessThan(0.05)
    expect(await timeTo('orbit', 'back')).toBeLessThan(900)
    expect(distance((await camera(page)).position, [72, 64, -88])).toBeLessThan(0.5)
  })
})

test.describe('the overview camera', () => {
  test('opens on the configured pose, north-east of the stadium', async ({ page }) => {
    await open(page)
    const c = await camera(page)
    expect(distance(c.position, [72, 64, -88])).toBeLessThan(0.01)
    expect(c.fov).toBeCloseTo(42, 3)
  })

  test('stands still under automation, and turns by itself when asked to', async ({ page }) => {
    await open(page)
    const a = (await camera(page)).position
    await page.waitForTimeout(1000)
    expect(distance((await camera(page)).position, a)).toBe(0)

    await open(page, `${STADIUM}&idle=1`)
    const b = (await camera(page)).position
    await page.waitForTimeout(1000)
    const c = (await camera(page)).position
    expect(distance(b, c)).toBeGreaterThan(0.5)
    // It circles: same height, same distance from its target.
    expect(c[1]).toBeCloseTo(b[1], 4)
    expect(distance(c, TARGET)).toBeCloseTo(distance(b, TARGET), 3)

    // The first press takes over.
    await page.mouse.move(700, 150)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(400)
    const d = (await camera(page)).position
    await page.waitForTimeout(800)
    expect(distance((await camera(page)).position, d)).toBeLessThan(0.01)
  })

  test('dragging turns the overview and keeps the camera between 60 and 220 m from its target', async ({ page }) => {
    await open(page)
    const before = (await camera(page)).position
    await page.mouse.move(700, 150)
    await page.mouse.down()
    await page.mouse.move(900, 260, { steps: 8 })
    await page.mouse.up()
    const after = (await camera(page)).position
    expect(distance(before, after)).toBeGreaterThan(5)
    expect(distance(after, TARGET)).toBeCloseTo(distance(before, TARGET), 3)
    expect((await (await hook(page)).evaluate((h) => h.state())).mode).toBe('orbit')

    // Dragging far up and far down stops at the limits: never under the ground, never straight overhead.
    for (const dy of [-2000, 2000]) {
      await page.mouse.move(700, 450)
      await page.mouse.down()
      await page.mouse.move(700, 450 + dy, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(500)
      const p = (await camera(page)).position
      const r = distance(p, TARGET)
      const fromOverhead = (Math.acos((p[1] - TARGET[1]) / r) * 180) / Math.PI
      expect(fromOverhead).toBeGreaterThanOrEqual(18 - 0.01)
      expect(fromOverhead).toBeLessThanOrEqual(80 + 0.01)
    }
  })

  test('the wheel zooms within the limits', async ({ page }) => {
    await open(page)
    await page.mouse.move(700, 400)
    const start = distance((await camera(page)).position, TARGET)
    await page.mouse.wheel(0, -300)
    await page.waitForTimeout(250)
    const closer = distance((await camera(page)).position, TARGET)
    expect(closer).toBeLessThan(start - 5)
    for (let k = 0; k < 5; k++) await page.mouse.wheel(0, -600)
    await page.waitForTimeout(250)
    expect(distance((await camera(page)).position, TARGET)).toBeCloseTo(60, 3)
    for (let k = 0; k < 8; k++) await page.mouse.wheel(0, 600)
    await page.waitForTimeout(250)
    expect(distance((await camera(page)).position, TARGET)).toBeCloseTo(220, 3)
    // The page itself never scrolled.
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('the keyboard turns and zooms the overview once the canvas has focus', async ({ page }) => {
    await open(page)
    const stage = page.locator('[data-stadium-canvas]')
    await stage.focus()
    await expect(stage).toBeFocused()
    await expect(stage).toHaveAttribute('role', 'application')
    const a = (await camera(page)).position
    await page.keyboard.press('ArrowLeft')
    const b = (await camera(page)).position
    expect(distance(a, b)).toBeGreaterThan(2)
    expect(b[1]).toBeCloseTo(a[1], 4)
    await page.keyboard.press('ArrowUp')
    const c = (await camera(page)).position
    expect(c[1]).toBeGreaterThan(b[1] + 1)
    await page.keyboard.press('+')
    const d = (await camera(page)).position
    expect(distance(d, TARGET)).toBeLessThan(distance(c, TARGET) - 5)
    await page.keyboard.press('-')
    expect(distance((await camera(page)).position, TARGET)).toBeCloseTo(distance(c, TARGET), 2)
  })
})

test.describe('first person', () => {
  test('dragging turns the head, not the seat', async ({ page }) => {
    await open(page)
    await sitIn(page, 'P3-12-07')
    const before = await camera(page)
    await page.mouse.move(700, 300)
    await page.mouse.down()
    await page.mouse.move(500, 360, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(600)
    const after = await camera(page)
    expect(distance(after.position, before.position)).toBeLessThan(1e-6)
    const turned = Math.acos(Math.min(1, before.direction[0] * after.direction[0] + before.direction[1] * after.direction[1] + before.direction[2] * after.direction[2]))
    expect((turned * 180) / Math.PI).toBeGreaterThan(5)
    expect(await mode(page)).toBe('pov')
    // Nothing is hovered or picked while seated.
    expect((await (await hook(page)).evaluate((h) => h.state())).hover).toBeNull()
    expect((await (await hook(page)).evaluate((h) => h.state())).selected).toBe('P3-12-07')
  })

  test('the view cannot tip past 35 degrees down or 50 degrees up', async ({ page }) => {
    await open(page)
    await sitIn(page, 'P3-12-07')
    for (const [dy, limit] of [[-3000, 50], [3000, -35]] as const) {
      await page.mouse.move(700, 450)
      await page.mouse.down()
      // Dragging down lifts the gaze, as when pulling a picture down to see what is above it.
      await page.mouse.move(700, 450 - dy, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(500)
      const d = (await camera(page)).direction
      const pitch = (Math.asin(d[1]) * 180) / Math.PI
      expect(pitch).toBeCloseTo(limit, 1)
    }
  })

  test('the wheel changes the field of view between 40 and 75 degrees', async ({ page }) => {
    await open(page)
    await sitIn(page, 'S-10-060')
    await page.mouse.move(700, 400)
    for (let k = 0; k < 4; k++) await page.mouse.wheel(0, -400)
    await page.waitForTimeout(250)
    expect((await camera(page)).fov).toBeCloseTo(40, 3)
    for (let k = 0; k < 5; k++) await page.mouse.wheel(0, 400)
    await page.waitForTimeout(250)
    expect((await camera(page)).fov).toBeCloseTo(75, 3)
    expect(distance((await camera(page)).position, EYE_S_10_060)).toBeLessThan(0.05)
  })

  test('the arrow keys turn the view, and a fresh visit to another seat opens at 62 degrees again', async ({ page }) => {
    await open(page)
    await sitIn(page, 'P3-12-07')
    await page.locator('[data-stadium-canvas]').focus()
    const a = (await camera(page)).direction
    await page.keyboard.press('ArrowLeft')
    const b = (await camera(page)).direction
    // Facing west, turning left swings the view toward the south (+Z).
    expect(b[2]).toBeGreaterThan(a[2] + 0.05)
    await page.keyboard.press('ArrowUp')
    expect((await camera(page)).direction[1]).toBeGreaterThan(b[1] + 0.03)
    await page.keyboard.press('+')
    expect((await camera(page)).fov).toBeLessThan(62)
    await sitIn(page, 'S-10-060')
    expect((await camera(page)).fov).toBeCloseTo(62, 3)
  })

  test('resizing the window keeps the seat and the mode', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await open(page)
    await sitIn(page, 'P3-12-07')
    const before = await camera(page)
    await page.setViewportSize({ width: 800, height: 1100 })
    await page.waitForTimeout(500)
    const after = await camera(page)
    expect(await mode(page)).toBe('pov')
    expect(distance(after.position, before.position)).toBeLessThan(1e-6)
    expect(after.fov).toBeCloseTo(before.fov, 3)
    // The picture fills the new shape.
    const box = (await page.locator('[data-stadium-canvas] canvas').boundingBox())!
    expect(box.width).toBeCloseTo(800, 0)
    expect(box.height).toBeCloseTo(1100, 0)
  })
})

test.describe('the overview on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('backs away until the six blocks and the stage are on screen', async ({ page }) => {
    await open(page)
    const seen = await (await hook(page)).evaluate((h) => ({
      first: h.project('P1-01-01'),
      last: h.project('P6-33-14'),
      stage: h.projectPoint([-46, 1.6, 0]),
      backdrop: h.projectPoint([-52, 12.6, 0]),
      camera: h.camera(),
    }))
    for (const p of [seen.first, seen.last, seen.stage, seen.backdrop]) {
      expect(p).not.toBeNull()
      expect(p!.x).toBeGreaterThan(0)
      expect(p!.x).toBeLessThan(390)
      // Clear of the title at the top.
      expect(p!.y).toBeGreaterThan(70)
      expect(p!.y).toBeLessThan(844)
    }
    // Further back than on a wide screen, along the same line of sight, and inside the orbit limit.
    const r = distance(seen.camera.position, TARGET)
    expect(r).toBeGreaterThan(140)
    expect(r).toBeLessThanOrEqual(220.001)
    expect(seen.camera.fov).toBeCloseTo(72, 3)
  })

  test('a tap flies into the seat and the back button fits the screen', async ({ page }) => {
    await open(page)
    await sitIn(page, 'P3-12-07')
    const box = (await page.locator('[data-sv-back]').boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    expect(box.height).toBeGreaterThanOrEqual(44)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(over).toBeLessThanOrEqual(0)
  })
})
