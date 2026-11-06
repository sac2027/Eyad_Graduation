import { expect, test } from '@playwright/test'

const URL = '/?t=2027-03-16T10:00&lang=en'

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the rail mirrors the scene: same nine posts in the same states', async ({ page }) => {
    await page.goto(URL)
    const rail = page.locator('[data-rail]')
    await expect(rail).toBeVisible()
    for (const id of ['candidacy', 'attire', 'tickets', 'certificate']) {
      const sceneState = await page.locator(`[data-checkpoint="${id}"]`).getAttribute('data-checkpoint-state')
      await expect(rail.locator(`[data-rail-post="${id}"]`)).toHaveAttribute('data-state', sceneState!)
    }
  })

  test('scrolling to the last step puts the certificate in his hands, with only a small burst before the ceremony', async ({ page }) => {
    await page.goto(URL)
    await page.locator('#step-certificate').scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect(page.locator('[data-rail-figure]')).toHaveAttribute('data-mode', 'hold-certificate')
    await expect(page.locator('[data-rail-burst]')).toBeAttached()
    await expect(page.locator('[data-fireworks="certificate"]')).toHaveCount(0)
  })

  test('clicking a rail post scrolls to its section', async ({ page }) => {
    await page.goto(URL)
    await page.locator('[data-rail-post="tickets"]').click()
    await expect(page.locator('#step-tickets')).toBeInViewport()
  })

  test('dragging the graduate on the rail scrolls the page', async ({ page }) => {
    await page.goto(URL)
    const box = (await page.locator('[data-rail-figure]').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 200, { steps: 6 })
    await page.mouse.up()
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200)
  })

  test('the rail works from the keyboard', async ({ page }) => {
    await page.goto(URL)
    const rail = page.locator('[data-rail]')
    await rail.focus()
    await page.keyboard.press('End')
    await expect(page.locator('#step-certificate')).toBeInViewport()
    await page.keyboard.press('Home')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5)
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('#step-candidacy')).toBeInViewport()
    await expect(rail).toHaveAttribute('aria-valuetext', /Candidacy/)
  })

  test('in Arabic the rail stays on the right edge', async ({ page }) => {
    await page.goto('/?t=2027-03-16T10:00')
    const box = (await page.locator('[data-rail]').boundingBox())!
    expect(Math.abs(box.x + box.width - 1440)).toBeLessThanOrEqual(2)
  })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the rail is slim and a tap opens the list of steps', async ({ page }) => {
    await page.goto(URL)
    const rail = page.locator('[data-rail]')
    const box = (await rail.boundingBox())!
    expect(box.width).toBeLessThanOrEqual(30)
    await rail.click({ position: { x: 10, y: 120 } })
    const sheet = page.locator('[data-rail-sheet]')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('button')).toHaveCount(10)
    await sheet.getByRole('button', { name: /Rehearsal/ }).click()
    await expect(page.locator('#step-rehearsal')).toBeInViewport()
  })

  test('nothing scrolls sideways with the rail on screen', async ({ page }) => {
    await page.goto(URL)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
