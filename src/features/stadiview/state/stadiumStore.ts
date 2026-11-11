import { create } from 'zustand'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

/** Where the camera is: circling the stadium, on its way somewhere, or sitting in a seat. */
export type CameraMode = 'orbit' | 'fly' | 'pov'

export interface StadiumState {
  mode: CameraMode
  /** Index of the seat under the pointer, -1 for none. Only ever set in the overview. */
  hover: number
  /**
   * Index of the chosen seat, -1 for none. It also says which way a flight is going:
   * 'fly' with a seat is a flight in to that seat, 'fly' with -1 is the flight back to the overview.
   */
  selected: number
  /**
   * Index of a seat to look toward on arriving in first person, -1 to look at the stage as usual.
   * A guest uses it to sit in their own seat and face their graduate's.
   */
  facing: number
  setHover(i: number): void
  /** Flies to a seat. With `facing`, the view on arrival is turned toward that other seat instead of the stage. */
  select(i: number, facing?: number): void
  back(): void
  /** For the camera rig, when a flight ends: 'pov' after a flight in, 'orbit' after a flight back. */
  setMode(m: CameraMode): void
}

const NO_SEAT = -1

/** True for an index that names a seat of the venue. Anything else (-1, NaN, 7998) names none. */
function isSeat(i: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < getVenue().count
}

/**
 * The camera mode, the hovered seat and the selected seat of the 3D stadium.
 *
 * Every action that would leave the three values as they are returns without calling `set`.
 * Subscribers (the camera rig, the seat colours) are therefore told only about real changes: a
 * pointer moving within one seat, a double click or a held Escape key cannot restart a flight.
 */
export const useStadium = create<StadiumState>((set, get) => ({
  mode: 'orbit',
  hover: NO_SEAT,
  selected: NO_SEAT,
  facing: NO_SEAT,

  setHover(i) {
    const s = get()
    // Seats are only highlighted in the overview. During a flight or in first person the pointer
    // turns the view, and a seat lighting up under it would be noise.
    const hover = s.mode === 'orbit' && isSeat(i) ? i : NO_SEAT
    if (hover !== s.hover) set({ hover })
  },

  select(i, facing = NO_SEAT) {
    if (!isSeat(i)) return
    const toward = isSeat(facing) && facing !== i ? facing : NO_SEAT
    const s = get()
    if (s.mode === 'fly' && s.selected === i && s.facing === toward) return // already on the way to this seat
    // One update, so no subscriber sees the new mode with the old seat or a leftover hover.
    set({ mode: 'fly', selected: i, facing: toward, hover: NO_SEAT })
  },

  back() {
    const s = get()
    if (s.mode === 'orbit') return // already in the overview
    if (s.mode === 'fly' && s.selected === NO_SEAT) return // already on the way back
    set({ mode: 'fly', selected: NO_SEAT, facing: NO_SEAT, hover: NO_SEAT })
  },

  setMode(mode) {
    const s = get()
    // First person needs a seat to sit in. This call can arrive late, from a flight that ended
    // in the same moment the viewer pressed Back; the flight back is then already under way.
    if (mode === 'pov' && s.selected === NO_SEAT) return
    if (mode === s.mode) return
    // The mode changes, so the camera is either leaving the overview (the hover must go) or was
    // already outside it (there is no hover). Either way none is left.
    set({ mode, hover: NO_SEAT })
  },
}))
