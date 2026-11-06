import { expect, test } from '@playwright/test'
import { PRESETS } from '../../src/time/presets'

for (const lang of ['ar', 'en']) {
  for (const p of PRESETS) {
    test(`preset ${p.id} (${lang}) loads cleanly in phase ${p.expectedPhase}`, async ({ page }) => {
      const errors: string[] = []
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      page.on('pageerror', (e) => errors.push(e.message))
      const t = new Date(p.at + 3 * 3_600_000).toISOString().slice(0, 16)
      await page.goto(`/?lang=${lang}&t=${t}`)
      await expect(page.locator('html')).toHaveAttribute('data-phase', p.expectedPhase)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.waitForTimeout(400)
      expect(errors).toEqual([])
    })
  }
}
