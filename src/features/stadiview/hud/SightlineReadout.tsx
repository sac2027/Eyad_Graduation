import { VENUE } from '@/features/stadiview/config/venue'
import { seatEye } from '@/features/stadiview/engine/cameraMath'
import { bearingBetween, relativeToStage } from '@/features/stadiview/engine/bearing'
import { seatAim } from '@/features/stadiview/engine/seatFrame'
import { useLocated } from '@/features/stadiview/state/useLocated'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useStadium } from '@/features/stadiview/state/stadiumStore'
import { formatNumber, useLocale, useT } from '@/i18n'

/** Eight compass directions are enough to point across a stadium. */
const EIGHT = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const

/**
 * With a ticket seat and a located graduate both known: how far apart they are, in which
 * direction, and where to look from the ticket seat. The button sits the guest in their own seat,
 * already turned toward their graduate.
 */
export function SightlineReadout({ canFly }: { canFly: boolean }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const ticketSeat = useHud((s) => s.guest.ticketSeat)
  const showLine = useHud((s) => s.sightline)
  const located = useLocated()
  if (ticketSeat < 0 || located.state !== 'found' || !located.graduate) return null

  const v = getVenue()
  const eye = seatEye(ticketSeat, v)
  const target = seatAim(located.seat, v)
  const between = bearingBetween(eye, target)
  const turn = relativeToStage(eye, target, VENUE.stage.podium)
  const n = (value: number) => formatNumber(Math.round(value), locale)
  const name = located.graduate.name[locale]
  const direction = t(`sv.compass.${EIGHT[Math.round(between.degrees / 45) % 8]}`)

  return (
    <section className="sv-guest__part sv-guest__sight" aria-labelledby="sv-sight-title" data-sv-sightline data-distance={Math.round(between.distance)} data-side={turn.side}>
      <h3 id="sv-sight-title">{t('sv.sight.title')}</h3>
      <p>{t('sv.sight.where', { name, m: n(between.distance), direction })}</p>
      <p>
        {turn.side === 'ahead' ? t('sv.sight.ahead') : t(`sv.sight.${turn.side}`, { deg: n(turn.degrees) })}
        {turn.tilt !== 'level' && `${locale === 'ar' ? '، ' : ', '}${t(`sv.sight.${turn.tilt}`)}`}.
      </p>
      <label className="sv-switch">
        <input type="checkbox" role="switch" checked={showLine} onChange={(e) => useHud.getState().setSightline(e.target.checked)} data-sv-show-line />
        <span className="sv-switch__track" aria-hidden />
        <span className="sv-switch__words">
          <b>{t('sv.sight.line')}</b>
          <small>{t('sv.sight.lineHint')}</small>
        </span>
      </label>
      {canFly && (
        <button type="button" className="sv-plate sv-button sv-button--gold" onClick={() => useStadium.getState().select(ticketSeat, located.seat)} data-sv-face-them>
          {t('sv.sight.face')}
        </button>
      )}
    </section>
  )
}
