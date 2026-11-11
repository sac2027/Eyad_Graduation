import { VENUE } from '@/features/stadiview/config/venue'
import type { Vec3 } from '@/features/stadiview/config/venue'
import { seatEye } from '@/features/stadiview/engine/cameraMath'
import { seatAim } from '@/features/stadiview/engine/seatFrame'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useHud } from '@/features/stadiview/state/hudStore'
import { requestLook } from '@/features/stadiview/state/lookChannel'
import { useStadium } from '@/features/stadiview/state/stadiumStore'
import { useLocated } from '@/features/stadiview/state/useLocated'
import { useViewer } from '@/features/stadiview/state/useViewer'
import { useT } from '@/i18n'

export type LandmarkId = 'stage' | 'screens' | 'vip' | 'family' | 'gate' | 'graduate'

/**
 * In first person, a row of chips that turn the view toward the stadium's landmarks: the stage, the
 * nearer LED screen, the VIP box, the family stands (a guest's own seat, when they have a ticket),
 * the Procession Gate, and a guest's located graduate. The camera never leaves the seat.
 */
export function LandmarkChips() {
  const t = useT()
  const seat = useStadium((s) => (s.mode === 'pov' ? s.selected : -1))
  const viewer = useViewer()
  const ticketSeat = useHud((s) => s.guest.ticketSeat)
  const located = useLocated()
  if (seat < 0) return null

  const v = getVenue()
  const eye = seatEye(seat, v)
  const L = VENUE.landmarks
  const nearer = (a: Vec3, b: Vec3) => (Math.hypot(a[0] - eye[0], a[2] - eye[2]) <= Math.hypot(b[0] - eye[0], b[2] - eye[2]) ? a : b)
  const guest = viewer.role === 'guest'
  const chips: { id: LandmarkId; at: Vec3 }[] = [
    { id: 'stage', at: L.stage },
    { id: 'screens', at: nearer(L.screens[0], L.screens[1]) },
    { id: 'vip', at: L.vip },
    { id: 'family', at: guest && ticketSeat >= 0 && ticketSeat !== seat ? seatAim(ticketSeat, v) : L.familyStand },
    { id: 'gate', at: L.processionGate },
  ]
  if (guest && located.state === 'found' && located.seat !== seat) chips.push({ id: 'graduate', at: seatAim(located.seat, v) })

  return (
    <div className="sv-chips" role="group" aria-label={t('sv.look.label')} data-sv-landmarks>
      {chips.map((c) => (
        <button key={c.id} type="button" className="sv-plate sv-button sv-chips__chip" onClick={() => requestLook(c.at)} data-sv-landmark={c.id} data-at={c.at.join(',')}>
          {t(`sv.look.${c.id}`)}
        </button>
      ))}
    </div>
  )
}
