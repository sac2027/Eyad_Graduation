import { expect, type Page } from '@playwright/test'

/** Shared helpers for the stadium's browser tests. */

export type V3 = [number, number, number]
export interface Point {
  x: number
  y: number
}

export interface Hook {
  ready: boolean
  tier: number
  info(): { calls: number; triangles: number }
  project(seatId: string): Point | null
  projectPoint(p: V3): Point | null
  state(): { mode: string; hover: string | null; selected: string | null }
  select(seatId: string): void
  back(): void
  camera(): { position: V3; fov: number; direction: V3 }
  lastFlightStart(): V3 | null
  inspect(seatId: string): void
  hud(): { role: 'graduate' | 'guest'; inspected: string | null; panel: string }
  status(seatId: string): 'available' | 'taken' | 'mine'
  matrixPoint(seatId: string): Point | null
  freeSeat(zoneOf: string, skip?: number): string | null
  takenSeat(zoneOf: string): string | null
  me(): { index: number; studentId: string; shareCode: string } | null
  myZone(): string | null
  sampleGraduate(booked: boolean, skip?: number): { index: number; name: { ar: string; en: string }; studentId: string; shareCode: string; seat: string | null; tickets: string[] } | null
  mySeat(): string | null
}

/** A moment in the middle of the booking window (14 March to 1 April 2027). */
export const IN_WINDOW = '2027-03-20T10:00'

/** The stadium for a persona at a time, on the lightest 3D tier (software WebGL is slow). */
export function stadiumUrl(opts: { persona?: string; t?: string; lang?: 'en' | 'ar'; tier?: number; extra?: string } = {}): string {
  const q = [`tier=${opts.tier ?? 1}`, `persona=${opts.persona ?? 'grad-m-gold'}`, `t=${opts.t ?? IN_WINDOW}`]
  if ((opts.lang ?? 'en') === 'en') q.push('lang=en')
  if (opts.extra) q.push(opts.extra)
  return `/stadium?${q.join('&')}`
}

export const hook = (page: Page) => page.evaluateHandle(() => (window as unknown as { __stadiview: Hook }).__stadiview)

export async function ready(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __stadiview?: Hook }).__stadiview?.ready === true, undefined, { timeout: 30_000 })
}

export async function open(page: Page, url: string) {
  await page.goto(url)
  await ready(page)
}

export async function call<T>(page: Page, fn: (h: Hook, arg: string) => T, arg = ''): Promise<T> {
  return (await hook(page)).evaluate(fn as (h: Hook, arg: string) => T, arg) as Promise<T>
}

export async function waitForMode(page: Page, wanted: string, timeout = 12_000) {
  await page.waitForFunction((m) => (window as unknown as { __stadiview: Hook }).__stadiview.state().mode === m, wanted, { timeout })
}

export async function project(page: Page, seatId: string): Promise<Point> {
  const p = await call(page, (h, id) => h.project(id), seatId)
  expect(p, `${seatId} should be on screen`).not.toBeNull()
  return p!
}
