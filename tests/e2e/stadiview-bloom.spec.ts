import { expect, test } from '@playwright/test'
import { call, open, stadiumUrl } from './support/stadium'

test.describe('bloom', () => {
  test('tier 3 draws through bloom, and still counts every draw', async ({ page }) => {
    // This machine draws in software, slower than bloom's own limit; ?svbloom=1 keeps it on regardless.
    await open(page, stadiumUrl({ tier: 3, extra: 'svbloom=1' }))
    await expect.poll(async () => call(page, (h) => h.postprocessing()), { timeout: 30_000 }).toBe('bloom')
    const info = await call(page, (h) => h.info())
    expect(info.triangles).toBeGreaterThan(160_000)
    expect(info.calls).toBeGreaterThan(30)
  })

  test('tier 3 with bloom still makes the inspector\'s view picture', async ({ page }) => {
    await open(page, stadiumUrl({ tier: 3, extra: 'svbloom=1' }))
    await expect.poll(async () => call(page, (h) => h.postprocessing()), { timeout: 30_000 }).toBe('bloom')
    await call(page, (h) => h.inspect('P3-12-07'))
    await expect(page.locator('[data-preview-seat="P3-12-07"][data-ready]')).toBeVisible({ timeout: 20_000 })
  })

  test('tier 1 has no bloom and never downloads it', async ({ page }) => {
    const fetched: string[] = []
    page.on('request', (r) => fetched.push(r.url()))
    await open(page, stadiumUrl())
    await page.waitForTimeout(1500)
    expect(await call(page, (h) => h.postprocessing())).toBe('none')
    expect(fetched.filter((u) => /UnrealBloomPass|EffectComposer|OutputPass/.test(u))).toEqual([])
  })
})
