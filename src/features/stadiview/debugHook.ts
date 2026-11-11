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
  /** The signed-in graduate's own seat, or null. */
  mySeat?(): string | null
  /** Where a seat is on the 2D matrix, in CSS pixels of the viewport; null when it is outside the card. */
  matrixPoint?(seatId: string): { x: number; y: number } | null
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

/** Creates the hook (when enabled) with the members the page knows before any 3D code has loaded. */
export function installDebugHook(tier: Tier): void {
  if (!debugEnabled()) return
  window.__stadiview = { ready: false, tier, info: () => ({ calls: 0, triangles: 0 }) }
}

/** Adds members to the hook, or replaces them. Does nothing when the hook is not installed. */
export function extendDebugHook(part: Partial<StadiViewDebug>): void {
  if (window.__stadiview) Object.assign(window.__stadiview, part)
}

/** Takes the hook away when the page is left, so a stale scene cannot answer for a new one. */
export function removeDebugHook(): void {
  delete window.__stadiview
}
