import { ceremonyNight, occupancy } from '@/features/stadiview/data/occupancy'
import type { Occupancy } from '@/features/stadiview/data/occupancy'
import type { Graduate } from '@/features/stadiview/data/graduateDirectory'
import { usePitchSeats } from '@/features/stadiview/data/pitchSeatService'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useViewer } from '@/features/stadiview/state/useViewer'
import { getNow } from '@/time/clockStore'

/** Whether every seat is drawn filled: the demo switch, or ceremony night itself. */
export function fullHouseAt(now: number, switched: boolean): { full: boolean; byNight: boolean } {
  const byNight = ceremonyNight(now)
  return { full: switched || byNight, byNight }
}

/** Who sits where, from the stores as they are right now. For code outside React (the debug hook). */
export function occupancyNow(viewer: Graduate | null): Occupancy {
  const hud = useHud.getState()
  const now = getNow()
  return occupancy(viewer, now, { full: fullHouseAt(now, hud.fullHouse).full, ticketSeat: hud.role === 'guest' ? hud.guest.ticketSeat : -1 })
}

/** Who sits where, for the page as it is; re-renders when bookings, the minute, the switch or the looked-up ticket change. */
export function useOccupancy(): Occupancy {
  const viewer = useViewer()
  usePitchSeats()
  const switched = useHud((s) => s.fullHouse)
  const ticketSeat = useHud((s) => (s.role === 'guest' ? s.guest.ticketSeat : -1))
  return occupancy(viewer.graduate, viewer.now, { full: fullHouseAt(viewer.now, switched).full, ticketSeat })
}
