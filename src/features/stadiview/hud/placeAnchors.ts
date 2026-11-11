import type { Vec3 } from '@/features/stadiview/config/venue'
import { VENUE } from '@/features/stadiview/config/venue'

/**
 * The three places of the march that carry a label in the overview: the Procession Gate, the
 * Procession Start and the Procession Exit. The scene projects their points to the screen every
 * frame and sends the result here; the labels move their own elements. Nothing re-renders.
 */
export type PlaceId = 'gate' | 'start' | 'exit'

export const PLACES: { id: PlaceId; at: Vec3 }[] = [
  { id: 'gate', at: [VENUE.arch.x, VENUE.arch.height + 0.5, VENUE.march.north] },
  { id: 'start', at: [VENUE.march.start[0], 3, VENUE.march.start[2]] },
  { id: 'exit', at: [VENUE.march.exit[0], 4.2, VENUE.march.exit[2]] },
]

/** Screen positions in CSS pixels, or null where the place is off screen or the labels are hidden. */
export type PlaceScreen = Record<PlaceId, { x: number; y: number } | null>

type Listener = (at: PlaceScreen) => void
const listeners = new Set<Listener>()

export function publishPlaces(at: PlaceScreen): void {
  for (const fn of listeners) fn(at)
}

export function onPlaces(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
