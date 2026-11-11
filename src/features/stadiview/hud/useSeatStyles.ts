import { useMemo } from 'react'
import { pitchSeats, usePitchSeats } from '@/features/stadiview/data/pitchSeatService'
import type { SeatStatus } from '@/features/stadiview/data/pitchSeatService'
import { PAINT } from '@/features/stadiview/hud/matrixDraw'
import type { SeatStyles } from '@/features/stadiview/hud/matrixDraw'
import { southLetterMask } from '@/features/stadiview/layout/standsLayout'
import { SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { FILTER_DIM, ZONE_DIM } from '@/features/stadiview/scene/seatColors'
import { VENUE } from '@/features/stadiview/config/venue'
import { filtersOff, seatMatches, useHud } from '@/features/stadiview/state/hudStore'
import { useViewer } from '@/features/stadiview/state/useViewer'

/**
 * How every seat is drawn in the 2D matrix right now: the same colours and the same dimming as in
 * the 3D scene. Worked out again when the time, the bookings, the viewer or the filters change.
 */
export function useSeatStyles(): { styles: SeatStyles; booked: number; total: number } {
  const viewer = useViewer()
  const bookings = usePitchSeats()
  const filters = useHud((s) => s.filters)
  const ticketSeat = useHud((s) => s.guest.ticketSeat)
  const graduate = viewer.graduate
  const minute = Math.floor(viewer.now / 60_000)

  return useMemo(() => {
    const v = getVenue()
    const service = pitchSeats()
    const paint = new Uint8Array(v.count)
    const strength = new Float32Array(v.count).fill(1)
    const filtering = !filtersOff(filters)
    const lettered = v.sections.findIndex((s) => s.id === VENUE.lettering.stand)
    for (let i = 0; i < v.count; i++) {
      const stand = v.kind[i] === SeatKind.Stand
      const status: SeatStatus = stand ? (i === ticketSeat ? 'mine' : 'available') : service.statusOf(i, graduate, viewer.now)
      if (status === 'mine') paint[i] = PAINT.gold
      else if (stand) paint[i] = v.section[i] === lettered && southLetterMask(v.row[i], v.number[i]) ? PAINT.letter : PAINT.stand
      else paint[i] = status === 'taken' ? PAINT.taken : PAINT.free
      if (status === 'mine') continue
      if (filtering && !seatMatches(i, v, filters, status)) strength[i] = FILTER_DIM
      else if (graduate && v.kind[i] === SeatKind.Pitch && v.zone[i] !== graduate.zone) strength[i] = ZONE_DIM
    }
    const counts = service.counts(viewer.now)
    return { styles: { paint, strength }, booked: counts.booked, total: counts.total }
    // `minute` and `bookings` stand for the time and the service's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graduate, minute, bookings, filters, ticketSeat])
}
