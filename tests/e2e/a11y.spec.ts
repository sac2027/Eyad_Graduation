import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const PAGES: [string, string][] = [
  ['landing', '/?t=2027-03-14T09:00'],
  ['guide', '/guide?persona=guest'],
  ['dashboard', '/me?t=2027-03-20T10:00&persona=grad-m-gold'],
  ['attire', '/me/attire?t=2027-03-20T10:00&persona=grad-f-gold'],
  ['tickets', '/me/tickets?t=2027-03-20T10:00&persona=grad-m-gold'],
  ['honors-details', '/honors?persona=grad-m-none'],
  ['admin', '/admin?persona=admin'],
  ['ceremony-day', '/?t=2027-04-07T20:20'],
  ['afterglow', '/?t=2027-04-09T10:00'],
]

for (const lang of ['ar', 'en']) {
  for (const [name, url] of PAGES) {
    test(`axe: ${name} (${lang}) has no serious or critical violations`, async ({ page }) => {
      await page.goto(`${url}${url.includes('?') ? '&' : '?'}lang=${lang}`)
      await page.waitForTimeout(900)
      // The demo console is demo chrome, not part of the design under test.
      const results = await new AxeBuilder({ page }).exclude('[data-demo-console]').analyze()
      const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
    })
  }
}

test('every page has one h1 and no empty buttons or links', async ({ page }) => {
  for (const [, url] of PAGES) {
    await page.goto(`${url}${url.includes('?') ? '&' : '?'}lang=en`)
    await page.waitForTimeout(500)
    const h1 = await page.locator('h1').count()
    expect(h1, url).toBeGreaterThanOrEqual(1)
    const empty = await page.evaluate(() =>
      [...document.querySelectorAll('button, a[href]')].filter((el) => {
        const e = el as HTMLElement
        if (e.closest('[data-demo-console]')) return false
        const name = (e.getAttribute('aria-label') ?? e.textContent ?? '').trim()
        return name.length === 0
      }).length,
    )
    expect(empty, url).toBe(0)
  }
})

const STATES: [string, (p: import('@playwright/test').Page) => Promise<void>][] = [
  ['seat map with a hold', async (p) => {
    await p.goto('/me/tickets?t=2027-03-20T10:00&persona=grad-m-gold&lang=en')
    await p.getByRole('button', { name: "I'll attend the ceremony" }).click()
    await p.getByRole('button', { name: 'Request the second ticket' }).click()
    await p.locator('[data-section="G02"]').click()
    await p.locator('[data-seat="G02-1-4"]').click()
    await p.getByRole('button', { name: 'Hold this seat for 10 minutes' }).click()
  }],
  ['seat conflict message', async (p) => {
    await p.goto('/me/tickets?t=2027-03-20T10:00&persona=grad-m-gold&lang=en')
    await p.getByRole('button', { name: "I'll attend the ceremony" }).click()
    await p.locator('[data-section="G02"]').click()
    await p.locator('[data-seat="G02-2-4"]').click()
    await p.locator('[data-demo-rival]').click()
    await p.getByRole('button', { name: 'Hold this seat for 10 minutes' }).click()
  }],
  ['honor hero (gold, after the sequence)', async (p) => {
    await p.goto('/honors?persona=grad-m-gold&lang=en')
    await p.locator('canvas').waitFor()
    await p.getByRole('button', { name: 'Skip' }).click()
  }],
  ['honor hero (2D version)', async (p) => {
    await p.goto('/honors?persona=grad-f-silver&lang=en&lowend=1')
    await p.locator('[data-honor-cta="on"]').waitFor({ timeout: 8000 })
  }],
  ['landing scene on a phone on ceremony night', async (p) => {
    await p.setViewportSize({ width: 390, height: 844 })
    await p.goto('/?t=2027-04-07T20:20')
    await p.locator('[data-scene="tall"]').waitFor()
  }],
  ['access route result', async (p) => {
    await p.goto('/guide?persona=grad-m-gold&lang=en#access')
    await p.getByLabel('Wheelchair').check()
    await p.getByRole('button', { name: 'Show my route' }).click()
  }],
  ['ui kit', async (p) => { await p.goto('/kit?lang=en') }],
  ['attire with a booked slot and QR', async (p) => {
    await p.goto('/me/attire?t=2027-03-20T10:00&persona=grad-m-gold&lang=en')
    await p.locator('[data-size="56"]').click()
    await p.getByRole('button', { name: 'Save size' }).click()
    await p.locator('[data-slot]').first().click()
    await p.getByRole('button', { name: 'Book slot' }).click()
  }],
]

for (const [name, setup] of STATES) {
  test(`axe (interactive): ${name}`, async ({ page }) => {
    await setup(page)
    await page.waitForTimeout(700)
    const results = await new AxeBuilder({ page }).exclude('[data-demo-console]').exclude('canvas').analyze()
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
  })
}
