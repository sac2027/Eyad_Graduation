import { expect, test } from '@playwright/test'
import { call, open, project, stadiumUrl, waitForMode } from './support/stadium'

const matrix = '[data-seat-matrix]'

async function matrixPoint(page: import('@playwright/test').Page, seatId: string) {
  const p = await call(page, (h, id) => h.matrixPoint(id), seatId)
  expect(p, `${seatId} should be on the map`).not.toBeNull()
  return p!
}

test.describe('the 2D seat matrix', () => {
  test('shows the stadium with the number of booked seats at that time', async ({ page }) => {
    await open(page, stadiumUrl())
    await expect(page.locator(matrix)).toBeVisible()
    await expect(page.locator(`${matrix} canvas`)).toHaveAttribute('role', 'img')
    const text = await page.locator('[data-sv-count]').innerText()
    const booked = Number(text.match(/^([\d,]+) of 2,986/)![1].replace(/,/g, ''))
    // About half are in by 20 March.
    expect(booked).toBeGreaterThan(1200)
    expect(booked).toBeLessThan(2400)
    await open(page, stadiumUrl({ t: '2027-03-01T10:00' }))
    await expect(page.locator('[data-sv-count]')).toHaveText(/^0 of 2,986/)
  })

  test('a click on the map inspects the seat and marks it in 3D, without flying', async ({ page }) => {
    await open(page, stadiumUrl())
    const p = await matrixPoint(page, 'P3-12-07')
    await page.mouse.click(p.x, p.y)
    await expect.poll(async () => (await call(page, (h) => h.hud())).inspected).toBe('P3-12-07')
    await expect(page.locator(matrix)).toHaveAttribute('data-inspected', 'P3-12-07')
    await page.waitForTimeout(300)
    expect((await call(page, (h) => h.state())).mode).toBe('orbit')
    expect((await call(page, (h) => h.state())).selected).toBeNull()
  })

  test('hover is shared both ways between the map and the 3D scene', async ({ page }) => {
    await open(page, stadiumUrl())
    const p = await matrixPoint(page, 'P4-10-03')
    await page.mouse.move(p.x - 6, p.y - 6)
    await page.mouse.move(p.x, p.y, { steps: 2 })
    await expect.poll(async () => (await call(page, (h) => h.state())).hover).toBe('P4-10-03')
    // The tooltip names the seat beside the pointer on the map.
    await expect(page.locator('[data-seat-tooltip]')).toContainText('Block 4')
    // And the other way: a seat hovered in 3D is ringed on the map.
    const q = await project(page, 'S-10-060')
    await page.mouse.move(q.x - 20, q.y - 14)
    await page.mouse.move(q.x, q.y, { steps: 3 })
    await expect(page.locator(matrix)).toHaveAttribute('data-hover', 'S-10-060')
  })

  test('a double click on the map flies into the seat', async ({ page }) => {
    await open(page, stadiumUrl())
    const p = await matrixPoint(page, 'P3-12-07')
    await page.mouse.dblclick(p.x, p.y)
    await waitForMode(page, 'pov')
    expect((await call(page, (h) => h.state())).selected).toBe('P3-12-07')
  })

  test('the wheel zooms about the pointer, and dragging moves the map without picking a seat', async ({ page }) => {
    await open(page, stadiumUrl())
    const p = await matrixPoint(page, 'P3-12-07')
    const before = Number(await page.locator(matrix).getAttribute('data-scale'))
    await page.mouse.move(p.x, p.y)
    await page.mouse.wheel(0, -300)
    await expect.poll(async () => Number(await page.locator(matrix).getAttribute('data-scale'))).toBeGreaterThan(before * 1.3)
    const after = await matrixPoint(page, 'P3-12-07')
    expect(Math.abs(after.x - p.x)).toBeLessThan(1.5)
    expect(Math.abs(after.y - p.y)).toBeLessThan(1.5)

    await page.mouse.down()
    await page.mouse.move(p.x + 40, p.y + 25, { steps: 4 })
    await page.mouse.up()
    const moved = await matrixPoint(page, 'P3-12-07')
    expect(moved.x - after.x).toBeCloseTo(40, 0)
    expect(moved.y - after.y).toBeCloseTo(25, 0)
    expect((await call(page, (h) => h.hud())).inspected).toBeNull()
    // The page did not scroll and the 3D camera did not zoom.
    const c = (await call(page, (h) => h.camera())).position
    expect(Math.hypot(c[0] - 72, c[1] - 64, c[2] + 88)).toBeLessThan(0.01)
  })

  test('the zoom and fit buttons work, and My zone frames the graduate\'s own seats', async ({ page }) => {
    await open(page, stadiumUrl())
    const scale = async () => Number(await page.locator(matrix).getAttribute('data-scale'))
    const start = await scale()
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect.poll(scale).toBeCloseTo(start * 1.5, 1)
    await page.locator('[data-sv-fit="all"]').click()
    await expect.poll(scale).toBeLessThan(start)
    expect(await call(page, (h) => h.matrixPoint('S-20-120'))).not.toBeNull()
    await page.locator('[data-sv-fit="zone"]').click()
    await expect.poll(scale).toBeGreaterThan(start)
    // Khaled's zone is the front five rows of the men's blocks; the far corner of the pitch is out of the picture.
    expect(await call(page, (h) => h.matrixPoint('P2-01-01'))).not.toBeNull()
    expect(await call(page, (h) => h.matrixPoint('P1-45-01'))).toBeNull()
  })

  test('the search box goes to a seat, or says there is none', async ({ page }) => {
    await open(page, stadiumUrl())
    const box = page.locator('[data-sv-seat-search]')
    await box.fill('p3 12 7')
    await box.press('Enter')
    await expect.poll(async () => (await call(page, (h) => h.hud())).inspected).toBe('P3-12-07')
    await box.fill('P9-01-01')
    await box.press('Enter')
    await expect(page.getByText('There is no seat with that number.')).toBeVisible()
    await expect(box).toHaveAttribute('aria-invalid', 'true')
    expect((await call(page, (h) => h.hud())).inspected).toBe('P3-12-07')
  })

  test('the filters are kept in the shared store', async ({ page }) => {
    await open(page, stadiumUrl())
    await page.locator('[data-sv-filter="available"]').check()
    await page.locator('[data-sv-filter="college"]').selectOption('CCM')
    await expect(page.locator('[data-sv-filter="available"]')).toBeChecked()
    await expect(page.locator('[data-sv-filter="college"]')).toHaveValue('CCM')
  })

  test('the card can be folded away and brought back', async ({ page }) => {
    await open(page, stadiumUrl())
    await page.locator('[data-sv-matrix-toggle]').click()
    await expect(page.locator(`${matrix} canvas`)).toHaveCount(0)
    await expect(page.locator('[data-sv-matrix-toggle]')).toHaveAttribute('aria-expanded', 'false')
    await page.locator('[data-sv-matrix-toggle]').click()
    await expect(page.locator(`${matrix} canvas`)).toBeVisible()
  })

  test('in Arabic the card moves to the right, but the map itself is not mirrored', async ({ page }) => {
    await open(page, stadiumUrl({ lang: 'ar' }))
    const card = (await page.locator(matrix).boundingBox())!
    expect(card.x + card.width).toBeGreaterThan(page.viewportSize()!.width - 40)
    // West is still on the left: block 1's front row (near the stage) is left of its back row.
    const front = await matrixPoint(page, 'P1-01-01')
    const back = await matrixPoint(page, 'P1-45-01')
    expect(front.x).toBeLessThan(back.x)
    await expect(page.locator('[data-sv-count]')).toContainText('2,986')
  })
})
