import { expect, test } from '@playwright/test'

test('a non-admin is asked to sign in as admin first (mock SSO)', async ({ page }) => {
  await page.goto('/admin?persona=grad-m-gold&lang=en')
  await expect(page.getByText('This page is for Student Affairs staff.')).toBeVisible()
  await page.getByRole('button', { name: /Continue as admin/ }).click()
  await expect(page.locator('[data-admin]')).toBeVisible()
})

test('capacity numbers match the planned 5,000 / 3,000 / 300+300+100 case', async ({ page }) => {
  await page.goto('/admin?persona=admin&lang=en&t=2027-03-14T09:00')
  const v = async (k: string) => (await page.locator(`[data-cap="${k}"] dd`).innerText()).replace(/,/g, '')
  expect(await v('graduates')).toBe('3000')
  expect(await v('guaranteed')).toBe('3000')
  expect(await v('second')).toBe('1300')
  expect(await v('per-grad')).toBe('1.43')
  expect(await v('break-even')).toBe('43%')
  await expect(page.locator('[data-admin-mock]')).toContainText('pending committee decision')
})

test('adding an exception shows it, and bad or duplicate IDs are explained', async ({ page }) => {
  await page.goto('/admin?persona=admin&lang=en')
  await page.getByRole('button', { name: 'Add exception' }).click()
  await page.getByLabel('University ID').fill('12')
  await page.getByLabel('Name').fill('Someone')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('[data-admin-error]')).toContainText('6 to 12 digits')
  await page.getByLabel('University ID').fill('202100555')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('[data-exception="202100555"]')).toBeVisible()
  await page.getByRole('button', { name: 'Add exception' }).click()
  await page.getByLabel('University ID').fill('202100555')
  await page.getByLabel('Name').fill('Again')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('[data-admin-error]')).toContainText('already added')
})

test.describe('phone width with a worst-case name', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('a 60-character Arabic name wraps without breaking the layout', async ({ page }) => {
    await page.goto('/admin?persona=admin')
    await page.getByRole('button', { name: 'إضافة استثناء' }).click()
    await page.getByLabel('الرقم الجامعي').fill('202200777')
    await page.getByLabel('الاسم').fill('عبدالرحمن بن محمد بن عبدالعزيز بن سعود بن فيصل آل سعود الغامدي الشمري')
    await page.getByLabel('السبب').fill('طالب دولي يغادر المملكة قبل موعد الحفل ويرغب في الحضور مع أسرته')
    await page.getByRole('button', { name: 'حفظ' }).click()
    await expect(page.locator('[data-exception="202200777"]')).toBeVisible()
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(over).toBe(false)
  })
})
