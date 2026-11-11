import { expect, test } from '@playwright/test'

/** The stadium and the rest of the site point at each other, and tell one story about the gates. */

const AT = 't=2027-03-20T10:00&lang=en'

test('the guide lists the gates as the stadium uses them', async ({ page }) => {
  await page.goto(`/guide?${AT}`)
  const notes: Record<string, string> = {
    '1': 'Families',
    '2': 'Individual guests and male graduates',
    '3': 'Guests with disabilities and older guests',
    '4': 'Staff, faculty and VIP guests',
    '5': 'Female graduates',
  }
  for (const [gate, note] of Object.entries(notes)) {
    await page.locator(`[data-gate-chip="${gate}"]`).first().click()
    await expect(page.locator('[data-gate-note]').first()).toContainText(note)
  }
})

test('the gates read the same in Arabic', async ({ page }) => {
  await page.goto('/guide?t=2027-03-20T10:00')
  await page.locator('[data-gate-chip="2"]').first().click()
  await expect(page.locator('[data-gate-note]').first()).toContainText('الضيوف الأفراد والخريجون')
  await page.locator('[data-gate-chip="5"]').first().click()
  await expect(page.locator('[data-gate-note]').first()).toContainText('الخريجات')
})

test('the arrival step sends men to Gate 2 and women to Gate 5', async ({ page }) => {
  await page.goto(`/?${AT}`)
  const step = page.locator('[data-step="arrival"]')
  await expect(step).toContainText('Gate 2')
  await expect(step).toContainText('Gate 5')
  await expect(step).toContainText('Gate 3')
})

test('the dashboard links to the stadium, keeping the person and the time', async ({ page }) => {
  await page.goto(`/me?persona=grad-m-gold&${AT}`)
  const link = page.locator('[data-stadium-link]').first()
  await expect(link).toContainText('Book your seat on the pitch')
  await link.click()
  await expect(page).toHaveURL(/\/stadium/)
  await expect(page.locator('[data-stadiview]')).toBeVisible()
  // The demo's state is put back on the new address.
  await expect(page).toHaveURL(/persona=grad-m-gold/)
  await expect(page).toHaveURL(/t=2027-03-20/)
  await expect(page.locator('[data-sv-viewer-name]')).toHaveText('Khaled Alotaibi')
})

test('the family tickets page links to the stadium', async ({ page }) => {
  await page.goto(`/me/tickets?persona=grad-m-gold&${AT}`)
  const link = page.locator('[data-stadium-link]').first()
  await expect(link).toContainText('See the stadium in 3D')
  await link.click()
  await expect(page).toHaveURL(/\/stadium/)
  await expect(page).toHaveURL(/persona=grad-m-gold/)
})

test('the guide links to the stadium', async ({ page }) => {
  await page.goto(`/guide?${AT}`)
  const link = page.locator('[data-stadium-link]').first()
  await expect(link).toContainText('See the stadium in 3D')
  await expect(link).toHaveAttribute('href', '/stadium')
})

test('the stadium links back to family tickets from a stand seat', async ({ page }) => {
  await page.goto(`/stadium?tier=0&persona=grad-m-gold&${AT}`)
  await page.waitForFunction(() => typeof (window as unknown as { __stadiview?: { inspect?: unknown } }).__stadiview?.inspect === 'function')
  await page.evaluate(() => (window as unknown as { __stadiview: { inspect(id: string): void } }).__stadiview.inspect('S-02-084'))
  const link = page.locator('[data-sv-inspector] a[href="/me/tickets"]')
  await expect(link).toContainText('Family tickets')
})
