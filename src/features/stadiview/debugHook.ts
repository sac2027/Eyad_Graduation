import type { Vec3 } from '@/features/stadiview/config/venue'
import type { Tier } from '@/features/stadiview/engine/tiers'
import type { CameraMode } from '@/features/stadiview/state/stadiumStore'

/**
 * A small window into the 3D scene for browser tests and for looking around by hand.
 *
 * A test cannot ask a canvas "where is seat P3-12-07?" or "has the flight finished?", so the scene
 * answers through `window.__stadiview`. It exists only in development, under browser automation,
 * or when the URL carries `?svdebug=1`; visitors never get it.
 *
 * The scene fills it in piece by piece as its parts mount, so every member is optional except the
 * three the page itself provides.
 */
export interface StadiViewDebug {
  /** True once the first frame has been drawn. */
  ready: boolean
  tier: Tier
  /** Draw calls and triangles of the most recent frame. */
  info(): { calls: number; triangles: number }
  /** Where a seat's aim point (the top of its back) is on screen, in CSS pixels; null when it is off screen or behind the camera. */
  project?(seatId: string): { x: number; y: number } | null
  /** The same for any point of the venue, in metres. */
  projectPoint?(p: Vec3): { x: number; y: number } | null
  state?(): { mode: CameraMode; hover: string | null; selected: string | null }
  select?(seatId: string): void
  back?(): void
  /** Where the camera is, its vertical field of view in degrees, and the unit vector it looks along. */
  camera?(): { position: Vec3; fov: number; direction: Vec3 }
  /** Where the camera was when the most recent flight began; null before the first flight. */
  lastFlightStart?(): Vec3 | null
  /** Shows a seat in the inspector without flying to it. */
  inspect?(seatId: string): void
  hud?(): { role: 'graduate' | 'guest'; inspected: string | null; panel: string }
  /** Whether a seat is free, taken, or the viewer's own, at the simulated time. */
  status?(seatId: string): 'available' | 'taken' | 'mine'
  /** For tests: the id of a free (or taken) seat in the same zone as the seat named; `skip` passes over that many first. */
  freeSeat?(zoneOf: string, skip?: number): string | null
  takenSeat?(zoneOf: string): string | null
  /** For tests: a graduate of the simulated class (not a persona) who has, or has not, booked a seat by now. */
  sampleGraduate?(booked: boolean, skip?: number): SampleGraduate | null
  /** Who sits where now: how many seats hold someone, and how many of each figure. */
  occupancy?(): { reserved: number; byKind: Record<string, number> }
  /** Demo: draw every seat filled (or not). */
  setFull?(on: boolean): void
  /** The figures drawn: in all, near and far, those cleared round a seated viewer's eyes, and the gold-highlighted seats. */
  avatars?(): { drawn: number; near: number; far: number; hiddenNear: string[]; highlight: string[] }
  /** The march carpet: its length in metres, how many edge lights it has, and whether its arrows move. */
  march?(): { length: number; lights: number; arrowsMoving: boolean }
  /** For tests: the signed-in graduate's place in the directory. */
  me?(): { index: number; studentId: string; shareCode: string } | null
  /** For tests: the first seat of the signed-in graduate's own zone, to pass to `freeSeat`. */
  myZone?(): string | null
  /** The signed-in graduate's own seat, or null. */
  mySeat?(): string | null
  /** Where a seat is on the 2D matrix, in CSS pixels of the viewport; null when it is outside the card. */
  matrixPoint?(seatId: string): { x: number; y: number } | null
}

export interface SampleGraduate {
  index: number
  name: { ar: string; en: string }
  studentId: string
  shareCode: string
  seat: string | null
  tickets: string[]
}

declare global {
  interface Window {
    __stadiview?: StadiViewDebug
  }
}

/** Whether this page load gets the hook at all. */
export function debugEnabled(): boolean {
  if (import.meta.env.DEV) return true
  try {
    return navigator.webdriver === true || new URLSearchParams(window.location.search).get('svdebug') === '1'
  } catch {
    return false
  }
}

/**
 * Creates the hook (when enabled) with the members the page knows before any 3D code has loaded.
 * A part of the page that mounted first may already have added to it; those members are kept.
 */
export function installDebugHook(tier: Tier): void {
  if (!debugEnabled()) return
  window.__stadiview = { ...window.__stadiview, ready: false, tier, info: window.__stadiview?.info ?? (() => ({ calls: 0, triangles: 0 })) }
}

/**
 * Adds members to the hook, or replaces them. React runs a child's effects before its parent's, so
 * a panel may get here before the page has installed the hook: the hook is then started here.
 */
export function extendDebugHook(part: Partial<StadiViewDebug>): void {
  if (!debugEnabled()) return
  window.__stadiview = Object.assign(window.__stadiview ?? { ready: false, tier: 0 as Tier, info: () => ({ calls: 0, triangles: 0 }) }, part)
}

/** Takes the hook away when the page is left, so a stale scene cannot answer for a new one. */
export function removeDebugHook(): void {
  delete window.__stadiview
}
