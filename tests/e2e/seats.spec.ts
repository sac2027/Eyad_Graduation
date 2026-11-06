import { expect, test } from '@playwright/test'

const BASE = '/me/tickets?t=2027-03-20T10:00&persona=grad-m-gold&lang=en'

async function openSection(page: import('@playwright/test').Page, id = 'G01') {
  await page.getByRole('button', { name: "I'll attend the ceremony" }).click()
  await page.locator(`[data-section="${id}"]`).click()
}

test('a hold counts down on simulated time and releases when time passes it', async ({ page }) => {
  await page.goto(BASE)
  await openSection(page)
  await page.locator('[data-seat="G01-1-5"]').click()
  await page.getByRole('button', { name: 'Hold this seat for 10 minutes' }).click()
  await expect(page.locator('[data-hold-bar]')).toBeVisible()
  await expect(page.locator('[data-hold-left]')).toHaveAttribute('data-hold-left', '600')
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByLabel('Jump to date and time').fill('2027-03-20T10:05')
  await expect(page.locator('[data-hold-left]')).toHaveAttribute('data-hold-left', '300')
  await page.getByLabel('Jump to date and time').fill('2027-03-20T10:11')
  await expect(page.locator('[data-hold-bar]')).toHaveCount(0)
  await expect(page.locator('[data-seat="G01-1-5"]')).toHaveAttribute('data-state', 'available')
})

test('scrubbing back before the hold releases it and never duplicates it', async ({ page }) => {
  await page.goto(BASE)
  await openSection(page)
  await page.locator('[data-seat="G01-1-6"]').click()
  await page.getByRole('button', { name: 'Hold this seat for 10 minutes' }).click()
  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByLabel('Jump to date and time').fill('2027-03-20T09:00')
  await expect(page.locator('[data-hold-bar]')).toHaveCount(0)
  await expect(page.locator('[data-seat][data-state="mine"]')).toHaveCount(0)
})

test('a rival taking the seat you selected shows the conflict and a suggestion', async ({ page }) => {
  await page.goto(BASE)
  await openSection(page)
  await page.locator('[data-seat="G01-2-8"]').click()
  await page.locator('[data-demo-rival]').click()
  await page.getByRole('button', { name: 'Hold this seat for 10 minutes' }).click()
  const c = page.locator('[data-conflict]')
  await expect(c).toBeVisible()
  await expect(c).toContainText('Another guest got to this seat first')
  await expect(c).toContainText('Nearest free seat')
  await page.getByRole('button', { name: 'Choose the suggested seat' }).click()
  await page.getByRole('button', { name: 'Hold this seat for 10 minutes' }).click()
  await expect(page.locator('[data-hold-bar]')).toBeVisible()
})

test('confirmed seats cannot be selected again and show a QR ticket', async ({ page }) => {
  await page.goto(BASE)
  await openSection(page)
  await page.locator('[data-seat="G01-3-3"]').click()
  await page.getByRole('button', { name: 'Hold this seat for 10 minutes' }).click()
  await page.getByRole('button', { name: 'Confirm seats' }).click()
  await expect(page.locator('[data-your-tickets] [data-qr-card]')).toHaveCount(1)
  await expect(page.locator('[data-your-tickets] svg[role="img"]')).toBeVisible()
  await expect(page.locator('[data-seat="G01-3-3"]')).toHaveAttribute('data-state', 'mine')
  await expect(page.locator('[data-picked-confirmed]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hold this seat for 10 minutes' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Release this seat' })).toHaveCount(0)
})

test('the second-ticket counter never goes below zero and a claim is made once', async ({ page }) => {
  await page.goto('/me/tickets?t=2027-03-25T23:30&persona=grad-m-gold&lang=en')
  await page.getByRole('button', { name: "I'll attend the ceremony" }).click()
  const n = Number(await page.locator('[data-pool-remaining]').getAttribute('data-pool-remaining'))
  expect(n).toBeGreaterThanOrEqual(0)
  await page.getByRole('button', { name: 'Request the second ticket' }).click()
  await expect(page.locator('[data-second="claimed"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request the second ticket' })).toHaveCount(0)
})

test('only a small number of seat nodes is ever in the DOM', async ({ page }) => {
  await page.goto(BASE)
  await openSection(page)
  const count = await page.locator('[data-seat]').count()
  expect(count).toBeGreaterThan(0)
  expect(count).toBeLessThanOrEqual(400)
})

test('easy-access seats are locked until the party needs them', async ({ page }) => {
  await page.goto(BASE)
  await page.getByRole('button', { name: "I'll attend the ceremony" }).click()
  await expect(page.locator('[data-section="E1"]')).toHaveAttribute('data-locked', 'true')
  await page.getByLabel('Someone in my party needs easy-access seating').check()
  await expect(page.locator('[data-section="E1"]')).not.toHaveAttribute('data-locked', 'true')
  await page.locator('[data-section="E1"]').click()
  await expect(page.locator('[data-seat-grid-section="E1"]')).toBeVisible()
})

test('a guest sees a ticket link view with a QR and no login', async ({ page }) => {
  await page.goto('/me/tickets?persona=guest&lang=en')
  await expect(page.locator('[data-tickets-guest]')).toBeVisible()
  await expect(page.locator('[data-qr-card] svg[role="img"]')).toBeVisible()
  await expect(page.getByText(/sign in|password/i)).toHaveCount(0)
})

test('the seat grid works from the keyboard', async ({ page }) => {
  await page.goto(BASE)
  await openSection(page)
  await page.locator('[data-seat="G01-1-1"]').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-seat="G01-1-2"]')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('[data-seat="G01-2-2"]')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-picked="G01-2-2"]')).toBeVisible()
})

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('the seat map never makes the page scroll sideways', async ({ page }) => {
    await page.goto(BASE)
    await openSection(page)
    await page.locator('[data-seat="G01-1-5"]').click()
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(over).toBe(false)
  })
})
