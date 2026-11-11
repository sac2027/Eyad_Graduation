import { useSyncExternalStore } from 'react'
import { getDirectory } from '@/features/stadiview/data/graduateDirectory'
import type { Graduate } from '@/features/stadiview/data/graduateDirectory'
import { locatorService } from '@/features/stadiview/data/locatorService'
import { usePitchSeats } from '@/features/stadiview/data/pitchSeatService'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useViewer } from '@/features/stadiview/state/useViewer'

export interface Located {
  graduate: Graduate | null
  seat: number
  state: 'none' | 'found' | 'no-seat-yet' | 'locator-off'
}

/** The graduate a guest has chosen, and where they are, if the guest may know. */
export function useLocated(): Located {
  const viewer = useViewer()
  usePitchSeats()
  useSyncExternalStore(locatorService.subscribe, locatorService.version)
  const guest = useHud((s) => s.guest)
  const graduate = guest.graduate >= 0 ? (getDirectory().all[guest.graduate] ?? null) : null
  if (!graduate) return { graduate: null, seat: -1, state: 'none' }
  // The share code is the graduate's own consent, so it finds them whatever the locator says.
  const found = locatorService.locate(guest.byCode ? { shareCode: graduate.shareCode } : { graduate }, viewer.now)
  if (found.ok) return { graduate, seat: found.value.seat, state: 'found' }
  return { graduate, seat: -1, state: found.error === 'locator-off' ? 'locator-off' : 'no-seat-yet' }
}

/**
 * The gold line from a guest's ticket seat to their located graduate: both seats, when a guest has
 * a ticket and a graduate it may see, and has not turned the line off; otherwise null.
 */
export function useSightline(): { from: number; to: number } | null {
  const located = useLocated()
  const viewer = useViewer()
  const ticketSeat = useHud((s) => s.guest.ticketSeat)
  const on = useHud((s) => s.sightline)
  if (!on || viewer.role !== 'guest' || ticketSeat < 0 || located.state !== 'found') return null
  return { from: ticketSeat, to: located.seat }
}

/** The located graduate's seat, for the beacon over it; -1 when there is none to show. */
export function useBeaconSeat(): number {
  const viewer = useViewer()
  const located = useLocated()
  return viewer.role === 'guest' && located.state === 'found' ? located.seat : -1
}
