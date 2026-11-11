import { create } from 'zustand'
import type { CollegeCode, Degree } from '@/features/stadiview/config/venue'
import type { SeatStatus } from '@/features/stadiview/data/pitchSeatService'
import { SeatKind } from '@/features/stadiview/layout/types'
import type { VenueLayout } from '@/features/stadiview/layout/types'

/** Who is looking: a signed-in graduate who may book, or a family member or guest who may only look. */
export type Role = 'graduate' | 'guest'

/** The panel open on a phone, where only one fits at a time. On a wide screen the panels sit side by side and this is ignored. */
export type Panel = 'none' | 'matrix' | 'inspector' | 'mine' | 'guest'

export interface SeatFilters {
  college: CollegeCode | null
  degree: Degree | null
  /** Show only seats nobody has taken. */
  availableOnly: boolean
  /** Show only wheelchair bays and the accessibility platform. */
  accessibleOnly: boolean
}

export interface HudState {
  role: Role
  /** The seat the inspector shows, -1 for none. It is marked in the 3D scene and in the 2D matrix. */
  inspected: number
  panel: Panel
  filters: SeatFilters
  /** Guest tools: the seat of the ticket that was looked up, and the directory index of the graduate being located. -1 for none. */
  guest: { ticketSeat: number; graduate: number }
  /** Whether the graduate's seat card is open. */
  cardOpen: boolean
  setCardOpen(open: boolean): void
  setRole(role: Role): void
  inspect(seat: number): void
  setPanel(panel: Panel): void
  setFilters(part: Partial<SeatFilters>): void
  setGuest(part: Partial<HudState['guest']>): void
  reset(): void
}

const NO_FILTERS: SeatFilters = { college: null, degree: null, availableOnly: false, accessibleOnly: false }

/**
 * What the HUD shows: the role, the inspected seat, the filters, and what a guest looked up.
 * The 3D scene, the 2D matrix and the panels all read this one store, which is what keeps them in step.
 */
export const useHud = create<HudState>((set) => ({
  role: 'guest',
  inspected: -1,
  panel: 'none',
  filters: NO_FILTERS,
  guest: { ticketSeat: -1, graduate: -1 },
  cardOpen: false,
  setCardOpen: (cardOpen) => set({ cardOpen }),
  setRole: (role) => set((s) => (s.role === role ? s : { role, inspected: -1, panel: 'none', cardOpen: false })),
  inspect: (seat) => set((s) => (s.inspected === seat ? s : { inspected: Number.isInteger(seat) && seat >= 0 ? seat : -1 })),
  setPanel: (panel) => set({ panel }),
  setFilters: (part) => set((s) => ({ filters: { ...s.filters, ...part } })),
  setGuest: (part) => set((s) => ({ guest: { ...s.guest, ...part } })),
  reset: () => set({ role: 'guest', inspected: -1, panel: 'none', filters: NO_FILTERS, guest: { ticketSeat: -1, graduate: -1 }, cardOpen: false }),
}))

/** True when no filter is set. */
export function filtersOff(f: SeatFilters): boolean {
  return f.college === null && f.degree === null && !f.availableOnly && !f.accessibleOnly
}

/**
 * Whether a seat passes the filters. The college and degree filters are about graduate seats, so
 * stand seats and bays fail them; "wheelchair bays" passes the bays and the accessibility platform.
 */
export function seatMatches(i: number, v: VenueLayout, f: SeatFilters, status: SeatStatus): boolean {
  const kind = v.kind[i]
  if (f.accessibleOnly) {
    const accessible = kind === SeatKind.AccessBay || (kind === SeatKind.Stand && v.sections[v.section[i]].id === 'ACC')
    if (!accessible) return false
  }
  if (f.college !== null || f.degree !== null) {
    if (kind !== SeatKind.Pitch) return false
    const zone = v.zones[v.zone[i]]
    if (f.college !== null && zone.college !== f.college) return false
    if (f.degree !== null && zone.degree !== f.degree) return false
  }
  if (f.availableOnly && (kind === SeatKind.Stand || status !== 'available')) return false
  return true
}
