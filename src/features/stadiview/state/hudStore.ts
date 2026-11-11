import { create } from 'zustand'
import type { CollegeCode, Degree } from '@/features/stadiview/config/venue'
import type { SeatStatus } from '@/features/stadiview/data/pitchSeatService'
import { SeatKind } from '@/features/stadiview/layout/types'
import type { VenueLayout } from '@/features/stadiview/layout/types'
import { isPhone } from '@/features/stadiview/state/usePhone'

/** Who is looking: a signed-in graduate who may book, or a family member or guest who may only look. */
export type Role = 'graduate' | 'guest'

/**
 * The panel that is open. On a phone only one fits at a time, and this names it. On a wide screen the
 * seat map and the inspector sit side by side whatever this says, and only 'mine' and 'guest' matter:
 * they take the inspector's place while open.
 */
export type Panel = 'none' | 'matrix' | 'inspector' | 'mine' | 'guest'

/** What the 2D matrix can be asked to show. */
export type MatrixFit = 'all' | 'pitch' | { zone: number }

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
  /**
   * Guest tools: the seat of the ticket that was looked up, the directory index of the graduate being
   * located (-1 for none), and whether that graduate was reached with their Family Share Code.
   */
  guest: { ticketSeat: number; graduate: number; byCode: boolean }
  /** Whether the graduate's seat card is open, and whether it opened because a seat was booked a moment ago. */
  cardOpen: boolean
  cardFresh: boolean
  setCardOpen(open: boolean, fresh?: boolean): void
  /** A request to the 2D matrix to show a part of the venue; `token` changes with every request. */
  matrixFit: { what: MatrixFit; token: number }
  /** Asks the matrix to show a place. On a phone that also brings the map forward, unless `bringForward` is false. */
  fitMatrix(what: MatrixFit, bringForward?: boolean): void
  setRole(role: Role): void
  /** Shows a seat in the inspector. A side panel that is open gives way to it, unless that panel asked to stay. */
  inspect(seat: number, keepPanel?: boolean): void
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
  guest: { ticketSeat: -1, graduate: -1, byCode: false },
  cardOpen: false,
  cardFresh: false,
  setCardOpen: (cardOpen, fresh = false) => set({ cardOpen, cardFresh: cardOpen && fresh }),
  matrixFit: { what: 'pitch', token: 0 },
  fitMatrix: (what, bringForward = true) => set((s) => ({ matrixFit: { what, token: s.matrixFit.token + 1 }, panel: bringForward && isPhone() ? 'matrix' : s.panel })),
  // Someone who chooses Guest came to look something up: their tools open with the role.
  setRole: (role) => set((s) => (s.role === role ? s : { role, inspected: -1, panel: role === 'guest' ? 'guest' : 'none', cardOpen: false, cardFresh: false })),
  inspect: (seat, keepPanel = false) =>
    set((s) => {
      const inspected = Number.isInteger(seat) && seat >= 0 ? seat : -1
      let panel = s.panel
      if (inspected >= 0 && !keepPanel) {
        // On a phone the inspector is a sheet of its own and comes forward; on a wide screen it only needs its place back.
        if (isPhone()) panel = 'inspector'
        else if (panel === 'mine' || panel === 'guest') panel = 'none'
      } else if (inspected < 0 && panel === 'inspector') panel = 'none'
      return inspected === s.inspected && panel === s.panel ? s : { inspected, panel }
    }),
  setPanel: (panel) => set({ panel }),
  setFilters: (part) => set((s) => ({ filters: { ...s.filters, ...part } })),
  setGuest: (part) => set((s) => ({ guest: { ...s.guest, ...part } })),
  reset: () => set({ role: 'guest', inspected: -1, panel: 'none', filters: NO_FILTERS, guest: { ticketSeat: -1, graduate: -1, byCode: false }, cardOpen: false, cardFresh: false }),
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
