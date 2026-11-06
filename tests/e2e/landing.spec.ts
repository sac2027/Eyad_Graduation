import { expect, test } from '@playwright/test'

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the families links are visible without scrolling and there is no login prompt', async ({ page }) => {
    await page.goto('/?t=2027-03-16T10:00')
    const strip = page.locator('[data-families]')
    for (const name of ['أي بوابة', 'المواقف', 'مقعدي', 'تسهيلات الوصول']) {
      await expect(strip.getByRole('link', { name })).toBeVisible()
    }
    const box = await strip.boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
    await expect(page.getByText(/كلمة المرور|password/i)).toHaveCount(0)
  })

  test('the journey shows nine checkpoints with the current one marked', async ({ page }) => {
    await page.goto('/?t=2027-03-16T10:00')
    await expect(page.locator('[data-scene="tall"]')).toBeVisible()
    await expect(page.locator('[data-checkpoint]')).toHaveCount(9)
    await expect(page.locator('[data-checkpoint="attire"]')).toHaveAttribute('data-checkpoint-state', 'current')
    await expect(page.locator('[data-checkpoint="candidacy"]')).toHaveAttribute('data-checkpoint-state', 'passed')
    await expect(page.locator('[data-checkpoint="tickets"]')).toHaveAttribute('data-checkpoint-state', 'next')
    await expect(page.getByRole('img', { name: 'شهادتك' })).toBeVisible()
  })

  test('the stage screens count down to the certificate moment', async ({ page }) => {
    await page.goto('/?t=2027-03-16T10:00')
    await expect(page.locator('[data-screen="left"]')).toContainText('22')
    await expect(page.locator('[data-screen="right"]')).toContainText('11:30:00')
  })

  test('with worst-case data at 320px nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await page.goto('/?t=2027-03-16T10:00&worst=1')
    await expect(page.locator('[data-scene]')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  })
})

test('desktop shows the wide scene with names and dates beside the posts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?t=2027-03-16T10:00&lang=en')
  await expect(page.locator('[data-scene="wide"]')).toBeVisible()
  await expect(page.locator('[data-checkpoint="information"]')).toContainText('14 Feb')
  await expect(page.locator('[data-checkpoint="attire"]')).toContainText('You are here')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('every step brings you closer')
})

test('the date TBC switch shows the announcement and keeps the graduate at the gate', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en&tbc=1')
  await expect(page.locator('[data-screen="left"]')).toContainText('The ceremony date will be announced soon')
  await expect(page.locator('[data-scene]')).toHaveAttribute('data-progress', '0.000')
})

test('the scene follows simulated time: on stage at 20:20, holding the certificate after', async ({ page }) => {
  await page.goto('/?t=2027-04-07T20:20&lang=en')
  await expect(page.locator('[data-scene]')).toHaveAttribute('data-figure', 'stage')
  await expect(page.locator('[data-scene]')).toHaveAttribute('data-beams', 'true')
  await page.goto('/?t=2027-04-09T10:00&lang=en')
  await expect(page.locator('[data-scene]')).toHaveAttribute('data-figure', 'holding')
  await expect(page.locator('[data-screen-congrats]')).toHaveText('Congratulations, Class 57')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('this is your certificate')
})

test('a guest sees the nameless line, and "I\'m graduating" opens the graduate area', async ({ page }) => {
  await page.goto('/?t=2027-03-16T10:00&lang=en&persona=guest')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every step brings our graduates closer to the moment they dreamed of.')
  await page.getByRole('button', { name: "I'm graduating" }).click()
  await expect(page).toHaveURL(/\/me/)
})

test('the phase attributes follow the simulated time', async ({ page }) => {
  await page.goto('/?t=2027-04-07T20:00')
  await expect(page.locator('html')).toHaveAttribute('data-phase', 'ceremony-day')
  await expect(page.locator('html')).toHaveAttribute('data-slot', 'ceremony')
  await page.goto('/?t=2027-04-09T10:00')
  await expect(page.locator('html')).toHaveAttribute('data-phase', 'afterglow')
})

test('the language button stays readable on the dark ceremony header', async ({ page }) => {
  await page.goto('/?t=2027-04-09T10:00&lang=en')
  const btn = page.locator('header').getByRole('button', { name: 'العربية' })
  const colour = await btn.evaluate((el) => getComputedStyle(el).color)
  expect(colour).toBe('rgb(236, 224, 199)')
})

test('the header Sign in button switches a guest to the graduate area', async ({ page }) => {
  await page.goto('/?lang=en&persona=guest')
  await page.locator('header').getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/me/)
  await expect(page.locator('header').getByRole('button', { name: 'Sign in' })).toHaveCount(0)
})
