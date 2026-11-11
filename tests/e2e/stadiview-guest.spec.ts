import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { call, open, stadiumUrl, waitForMode } from './support/stadium'

type Sample = { index: number; name: { ar: string; en: string }; studentId: string; shareCode: string; seat: string | null; tickets: string[] }
type Hooked = { __stadiview: { sampleGraduate(booked: boolean, skip: number): Sample | null } }

/** A graduate of the simulated class who has (or has not) booked by the page's time. */
const sample = (page: Page, booked: boolean, skip = 0) =>
  page.evaluate(([b, s]) => (window as unknown as Hooked).__stadiview.sampleGraduate(b as boolean, s as number), [booked, skip] as const) as Promise<Sample>

async function openGuest(page: Page, opts: Parameters<typeof stadiumUrl>[0] = {}) {
  await open(page, stadiumUrl({ persona: 'guest', ...opts }))
  await page.locator('[data-sv-guest-toggle]').click()
  await expect(page.locator('[data-sv-guest]')).toBeVisible()
}

async function findTicket(page: Page, text: string) {
  await page.locator('[data-sv-ticket-input]').fill(text)
  await page.locator('[data-sv-ticket-find]').click()
}

const inspected = async (page: Page) => (await call(page, (h) => h.hud())).inspected

test.describe('a guest looks up a ticket', () => {
  test('a ticket number shows its seat, gate, parking and arrival time', async ({ page }) => {
    await openGuest(page)
    await findTicket(page, 'TICKET-G1-204')
    const result = page.locator('[data-sv-ticket-result="TICKET-G1-204"]')
    await expect(result).toContainText('South stand')
    await expect(result).toContainText('Row 2')
    await expect(result).toContainText('Seat 84')
    await expect(page.locator('[data-sv-ticket-gate]')).toHaveText('Enter by Gate 1')
    await expect(result).toContainText('Park in P1')
    await expect(result).toContainText('6:45 pm')
    expect(await inspected(page)).toBe('S-02-084')
    // The guest tools stay open: the seat is marked without the inspector taking their place.
    await expect(page.locator('[data-sv-guest]')).toBeVisible()
    await expect(page.locator('[data-sv-inspector]')).toHaveCount(0)
  })

  test('"View from my seat" sits the guest in that seat', async ({ page }) => {
    await openGuest(page, { extra: 'reduced=1' })
    await findTicket(page, 'TICKET-G1-204')
    await page.locator('[data-sv-ticket-view]').click()
    await waitForMode(page, 'pov')
    expect((await call(page, (h) => h.state())).selected).toBe('S-02-084')
  })

  test('a ticket typed loosely is still read', async ({ page }) => {
    await openGuest(page)
    await findTicket(page, '  ticket g1 204 ')
    await expect(page.locator('[data-sv-ticket-result="TICKET-G1-204"]')).toBeVisible()
    // The box is tidied to the ticket as printed.
    await expect(page.locator('[data-sv-ticket-input]')).toHaveValue('TICKET-G1-204')
  })

  test('a wrong ticket is told what is wrong with it', async ({ page }) => {
    await openGuest(page)
    await findTicket(page, 'TICKET-G1-99999')
    await expect(page.locator('[data-sv-ticket-error="range"]')).toContainText('too high for gate 1')
    await expect(page.locator('[data-sv-ticket-input]')).toHaveAttribute('aria-invalid', 'true')
    await findTicket(page, 'TICKET-G9-1')
    await expect(page.locator('[data-sv-ticket-error="gate"]')).toContainText('no ticket gate 9')
    await findTicket(page, 'hello')
    await expect(page.locator('[data-sv-ticket-error="format"]')).toContainText('TICKET-G1-204')
    await expect(page.locator('[data-sv-ticket-result]')).toHaveCount(0)
    expect(await inspected(page)).toBeNull()
  })

  test('a demo chip fills the box and looks the ticket up', async ({ page }) => {
    await openGuest(page)
    const chip = page.locator('[data-sv-demo-ticket]').first()
    const code = (await chip.getAttribute('data-sv-demo-ticket'))!
    await chip.click()
    await expect(page.locator('[data-sv-ticket-input]')).toHaveValue(code)
    await expect(page.locator(`[data-sv-ticket-result="${code}"]`)).toBeVisible()
  })
})

test.describe('a guest locates a graduate', () => {
  test('a search by English name, then by Arabic name, lists the graduate with a masked ID', async ({ page }) => {
    await openGuest(page)
    const g = await sample(page, true, 3)
    const masked = `${g.studentId.slice(0, 4)}•••${g.studentId.slice(-2)}`
    for (const name of [g.name.en, g.name.ar]) {
      await page.locator('[data-sv-graduate-search]').fill(name)
      const row = page.locator(`[data-sv-graduate-result="${g.index}"]`)
      await expect(row).toContainText(masked)
      await expect(row).not.toContainText(g.studentId)
    }
  })

  test('choosing a graduate who has booked marks their seat', async ({ page }) => {
    await openGuest(page)
    const g = await sample(page, true, 3)
    await page.locator('[data-sv-graduate-search]').fill(g.studentId)
    await page.locator(`[data-sv-graduate-result="${g.index}"]`).click()
    await expect(page.locator('[data-sv-located="found"]')).toHaveAttribute('data-seat', g.seat!)
    await expect(page.locator('[data-sv-located="found"]')).toContainText(g.name.en)
    expect(await inspected(page)).toBe(g.seat)
    await expect(page.locator('[data-sv-fly-graduate]')).toBeVisible()
    // A guest can look at the seat, and nothing more.
    await expect(page.locator('[data-sv-book]')).toHaveCount(0)
  })

  test('a common name shows eight results and says how many more there are', async ({ page }) => {
    await openGuest(page)
    await page.locator('[data-sv-graduate-search]').fill('al')
    await expect(page.locator('[data-sv-graduate-result]')).toHaveCount(8)
    await expect(page.locator('[data-sv-search-status]')).toContainText(/and [\d,]+ more: add a second name or the ID/)
  })

  test('the college picker narrows the search', async ({ page }) => {
    await openGuest(page)
    await page.locator('[data-sv-graduate-search]').fill('al')
    await page.locator('[data-sv-search-college]').selectOption('KBS')
    await expect(page.locator('[data-sv-graduate-result]').first()).toBeVisible()
    for (const row of await page.locator('[data-sv-graduate-result]').all()) await expect(row).toContainText('Business')
  })

  test('no match says so', async ({ page }) => {
    await openGuest(page)
    await page.locator('[data-sv-graduate-search]').fill('zzzzqq')
    await expect(page.locator('[data-sv-search-status]')).toContainText('No graduate found')
    await expect(page.locator('[data-sv-graduate-result]')).toHaveCount(0)
  })

  test('a graduate without a seat shows where their group sits, on the map too', async ({ page }) => {
    await openGuest(page)
    const g = await sample(page, false, 2)
    const before = Number(await page.locator('[data-seat-matrix]').getAttribute('data-scale'))
    await page.locator('[data-sv-graduate-search]').fill(g.studentId)
    await page.locator(`[data-sv-graduate-result="${g.index}"]`).click()
    await expect(page.locator('[data-sv-no-seat]')).toContainText(`${g.name.en} has not booked a seat yet. Their group sits in Block`)
    await expect(page.locator('[data-sv-no-seat]')).toContainText(/rows? \d+/i)
    // The map closes in on the group's zone, and its filter lights that zone.
    await expect.poll(async () => Number(await page.locator('[data-seat-matrix]').getAttribute('data-scale'))).toBeGreaterThan(before)
    await expect(page.locator('[data-sv-filter="college"]')).not.toHaveValue('')
    // "Find another graduate" puts everything back.
    await page.locator('[data-sv-clear-graduate]').click()
    await expect(page.locator('[data-sv-filter="college"]')).toHaveValue('')
    await expect(page.locator('[data-sv-graduate-search]')).toBeVisible()
  })

  test('with the locator off a search asks for the share code, and the right code shows the seat', async ({ page }) => {
    // Khaled books and switches his locator off; then a guest looks for him.
    await open(page, stadiumUrl())
    const zone = (await call(page, (h) => h.myZone()))!
    const seat = (await call(page, (h, z) => h.freeSeat(z), zone))!
    await call(page, (h, id) => h.inspect(id), seat)
    await page.locator('[data-sv-book]').click()
    await page.locator('[data-sv-card-close]').click()
    await page.locator('[data-sv-my-seat-toggle]').click()
    const code = (await page.locator('[data-sv-share-code]').innerText()).trim()
    const me = (await call(page, (h) => h.me()))!
    await page.locator('[data-sv-locator]').uncheck()

    await page.locator('[data-sv-role-option="guest"]').click()
    await expect(page.locator('[data-sv-guest]')).toBeVisible()
    // By student ID: other graduates share his name.
    await page.locator('[data-sv-graduate-search]').fill(me.studentId)
    await page.locator(`[data-sv-graduate-result="${me.index}"]`).click()
    await expect(page.locator('[data-sv-locator-off]')).toContainText('Khaled Alotaibi has not turned on the family locator. Ask them for their Family Share Code.')
    // Nothing gives the seat away.
    await expect(page.locator('[data-sv-located-seat]')).toHaveCount(0)
    expect(await inspected(page)).toBeNull()

    await page.locator('[data-sv-code-input]').fill('KF-ZZZZ-ZZ')
    await page.locator('[data-sv-code-find]').click()
    await expect(page.locator('[data-sv-code-error]')).toContainText('No graduate has that code')
    // The code as people type it: lower case, no dashes.
    await page.locator('[data-sv-code-input]').fill(code.toLowerCase().replace(/-/g, ''))
    await page.locator('[data-sv-code-find]').click()
    await expect(page.locator('[data-sv-located="found"]')).toHaveAttribute('data-seat', seat)
    expect(await inspected(page)).toBe(seat)
  })

  test('a share code alone finds its graduate', async ({ page }) => {
    await openGuest(page)
    const g = await sample(page, true, 4)
    await page.locator('[data-sv-have-code]').click()
    await page.locator('[data-sv-code-input]').fill(g.shareCode)
    await page.locator('[data-sv-code-find]').click()
    await expect(page.locator('[data-sv-located="found"]')).toHaveAttribute('data-seat', g.seat!)
  })
})

test.describe('from the ticket seat to the graduate', () => {
  test('"Find my graduate" on a ticket leads to the graduate it was issued for', async ({ page }) => {
    await openGuest(page)
    const g = await sample(page, true, 5)
    await findTicket(page, g.tickets[0])
    await page.locator('[data-sv-ticket-graduate]').click()
    await expect(page.locator('[data-sv-located="found"]')).toHaveAttribute('data-seat', g.seat!)
    await expect(page.locator('[data-sv-located="found"]')).toContainText(g.name.en)
  })

  test('with a ticket and a graduate, the readout gives the distance and the direction', async ({ page }) => {
    await openGuest(page)
    const g = await sample(page, true, 5)
    await findTicket(page, g.tickets[0])
    await page.locator('[data-sv-ticket-graduate]').click()
    const sight = page.locator('[data-sv-sightline]')
    await expect(sight).toContainText(new RegExp(`${g.name.en} is \\d+ m from your seat, to the (north|south|east|west)`))
    await expect(sight).toContainText(/(look \d+° to the (left|right)|in line with the stage)/)
    const metres = Number(await sight.getAttribute('data-distance'))
    expect(metres).toBeGreaterThan(5)
    expect(metres).toBeLessThan(200)
  })

  test('"View from my seat, facing them" ends in the ticket seat, looking at the graduate', async ({ page }) => {
    await openGuest(page, { extra: 'reduced=1' })
    const g = await sample(page, true, 5)
    await findTicket(page, g.tickets[0])
    const ticketSeat = (await inspected(page))!
    await page.locator('[data-sv-ticket-graduate]').click()
    await page.locator('[data-sv-face-them]').click()
    await waitForMode(page, 'pov')
    expect((await call(page, (h) => h.state())).selected).toBe(ticketSeat)
    // The graduate's seat is at the centre of the picture, left to right: the view is turned to them.
    const at = await call(page, (h, id) => h.project(id), g.seat!)
    expect(at).not.toBeNull()
    const width = page.viewportSize()!.width
    expect(Math.abs(at!.x - width / 2)).toBeLessThan(width * 0.03)
  })

  test('the same flow reads in Arabic, with Latin digits', async ({ page }) => {
    await openGuest(page, { lang: 'ar' })
    const g = await sample(page, true, 5)
    await findTicket(page, g.tickets[0])
    await expect(page.locator('[data-sv-ticket-gate]')).toHaveText('الدخول من البوابة 1')
    await page.locator('[data-sv-ticket-graduate]').click()
    await expect(page.locator('[data-sv-located="found"]')).toContainText(g.name.ar)
    const sight = page.locator('[data-sv-sightline]')
    await expect(sight).toContainText(/يبعد .+ عن مقعدك \d+ م/)
    // No Arabic-Indic digits anywhere in the panel.
    expect(await page.locator('[data-sv-guest]').innerText()).not.toMatch(/[٠-٩]/)
  })

  test('nothing in guest mode can book or change a seat', async ({ page }) => {
    await openGuest(page)
    const g = await sample(page, true, 5)
    await findTicket(page, g.tickets[0])
    await page.locator('[data-sv-ticket-graduate]').click()
    for (const control of ['[data-sv-book]', '[data-sv-release]', '[data-sv-rival]', '[data-sv-my-seat-toggle]', '[data-sv-mine-release]']) await expect(page.locator(control)).toHaveCount(0)
    // Looking at the graduate's seat in the inspector says so too.
    await call(page, (h, id) => h.inspect(id), g.seat!)
    await expect(page.locator('[data-sv-view-only]')).toBeVisible()
    await expect(page.locator('[data-sv-book]')).toHaveCount(0)
  })

  test('the guest tools pass the accessibility checks in both languages', async ({ page }) => {
    for (const lang of ['en', 'ar'] as const) {
      await openGuest(page, { lang })
      const g = await sample(page, true, 5)
      await findTicket(page, g.tickets[0])
      await page.locator('[data-sv-ticket-graduate]').click()
      await expect(page.locator('[data-sv-sightline]')).toBeVisible()
      const results = await new AxeBuilder({ page }).include('[data-sv-guest]').analyze()
      expect(results.violations, `${lang}: ${results.violations.map((v) => `${v.id} ${v.nodes[0]?.html}`).join(', ')}`).toEqual([])
      // And the empty panel, with its search box and chips.
      await page.locator('[data-sv-clear-graduate]').click()
      await page.locator('[data-sv-graduate-search]').fill('al')
      await expect(page.locator('[data-sv-graduate-result]').first()).toBeVisible()
      const empty = await new AxeBuilder({ page }).include('[data-sv-guest]').analyze()
      expect(empty.violations, `${lang} search: ${empty.violations.map((v) => `${v.id} ${v.nodes[0]?.html}`).join(', ')}`).toEqual([])
    }
  })
})
