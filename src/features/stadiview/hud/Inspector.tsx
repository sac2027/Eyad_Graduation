import { useEffect, useState } from 'react'
import { COLLEGE_COLORS, COLLEGE_NAMES } from '@/domain/types'
import { COLLEGE_ID } from '@/features/stadiview/config/venue'
import { bookingPhase, bookingWindow } from '@/features/stadiview/data/bookingWindow'
import { guestTicketService } from '@/features/stadiview/data/guestTicketService'
import { pitchSeats, usePitchSeats } from '@/features/stadiview/data/pitchSeatService'
import type { BookError } from '@/features/stadiview/data/pitchSeatService'
import { seatFacts } from '@/features/stadiview/hud/seatFacts'
import { SeatPreview } from '@/features/stadiview/hud/SeatPreview'
import { seatWords } from '@/features/stadiview/hud/SeatTooltip'
import { NO_ZONE, SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useStadium } from '@/features/stadiview/state/stadiumStore'
import { useViewer } from '@/features/stadiview/state/useViewer'
import { formatDate, formatNumber, useLocale, useT } from '@/i18n'
import { getNow, useClock } from '@/time/clockStore'
import { toast } from '@/ui/toast'

/** The demo's "jump into the booking period" lands this long after it opens: far enough in for half the seats to be taken. */
const JUMP_INTO_WINDOW_MS = 6.4 * 86_400_000

/**
 * The inspector: everything about one seat, and what the viewer can do with it.
 *
 * A graduate books here. A guest only looks. It opens whenever a seat is inspected, from the 3D
 * scene, from the 2D map or from the seat finder, and works the same without the 3D canvas.
 */
export function Inspector({ canFly, livePreview }: { canFly: boolean; livePreview: boolean }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const viewer = useViewer()
  usePitchSeats()
  const seat = useHud((s) => s.inspected)
  const mode = useStadium((s) => s.mode)
  const seatedHere = useStadium((s) => s.mode === 'pov' && s.selected === seat)
  const [error, setError] = useState<BookError | null>(null)

  // A message about one seat must not linger over the next.
  useEffect(() => setError(null), [seat, viewer.graduate])

  if (seat < 0) return null
  const v = getVenue()
  const service = pitchSeats()
  const now = viewer.now
  const n = (x: number) => formatNumber(Math.round(x), locale)
  const kind = v.kind[seat]
  const stand = kind === SeatKind.Stand
  const status = stand ? 'available' : service.statusOf(seat, viewer.graduate, now)
  const words = seatWords(seat, t, locale, status)
  const facts = seatFacts(seat, v)
  const zone = v.zone[seat] === NO_ZONE ? null : v.zones[v.zone[seat]]
  const ticket = stand ? guestTicketService.forSeat(seat) : null
  const graduate = viewer.graduate
  const allowed = graduate && !stand ? service.canBook(seat, graduate, getNow()) : null
  const phase = bookingPhase(now)
  const mine = graduate ? service.seatOf(graduate, now) : -1
  const zoneName = (z: { college: keyof typeof COLLEGE_ID; degree: 'B' | 'G' }) => `${COLLEGE_NAMES[COLLEGE_ID[z.college]][locale]}\u00A0· ${t(`sv.degree.${z.degree}`)}`

  const book = () => {
    if (!graduate) return
    const result = service.book(seat, graduate, getNow())
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    toast.success(t(result.value.released >= 0 ? 'sv.book.moved' : 'sv.book.done', { seat: words.place }))
    useHud.getState().setCardOpen(true)
  }
  const release = () => {
    if (!graduate) return
    if (service.release(graduate, getNow()).ok) toast.success(t('sv.book.released'))
  }

  const stageLine =
    facts.side === 'centre'
      ? t('sv.fact.stage.centre', { m: n(facts.toStage) })
      : t(`sv.fact.stage.${facts.side}`, { m: n(facts.toStage), deg: n(facts.stageAngle) })

  return (
    <aside className="sv-card sv-insp" data-sv-inspector data-seat={v.idOf(seat)} data-status={status} aria-label={t('sv.insp.title')}>
      <div className="sv-matrix" aria-hidden />
      <header className="sv-insp__head">
        <div>
          <h2>{words.place}</h2>
          {words.detail && (
            <p>
              {zone && <i className="sv-insp__college" style={{ background: COLLEGE_COLORS[COLLEGE_ID[zone.college]] }} aria-hidden />}
              {words.detail}
            </p>
          )}
        </div>
        <button type="button" className="sv-icon" aria-label={t('sv.insp.close')} onClick={() => useHud.getState().inspect(-1)} data-sv-inspector-close>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      {!stand && (
        <p className="sv-insp__status" data-status={status} data-sv-status>
          <i aria-hidden />
          {t(`sv.status.${status}`)}
        </p>
      )}

      {canFly && <SeatPreview seat={seat} live={livePreview} />}

      <ul className="sv-insp__facts">
        <li>{stageLine}</li>
        <li>{t('sv.fact.gate', { n: formatNumber(facts.gate, locale) })}</li>
        {kind !== SeatKind.AccessBay && <li>{facts.toAisle < 1 ? t('sv.fact.onAisle') : t('sv.fact.aisle', { m: n(facts.toAisle) })}</li>}
        {!facts.clearView && <li>{t('sv.fact.blocked')}</li>}
        {ticket && <li data-sv-ticket>{t('sv.insp.ticket', { ticket: ticket.ticket })}</li>}
      </ul>

      <div className="sv-insp__actions">
        {error && (
          <p className="sv-insp__error" role="alert" data-sv-book-error={error}>
            {t(`sv.book.err.${error}`)}
          </p>
        )}

        {viewer.role === 'guest' && <p className="sv-insp__note" data-sv-view-only>{t('sv.insp.viewOnly')}</p>}

        {graduate && stand && <p className="sv-insp__note">{t('sv.insp.standSeat')}</p>}

        {graduate && allowed && (
          <>
            {allowed.ok && (
              <>
                {mine >= 0 && <p className="sv-insp__note">{t('sv.insp.willRelease', { seat: seatWords(mine, t, locale).place })}</p>}
                <button type="button" className="sv-plate sv-button sv-button--gold sv-button--cta" onClick={book} data-sv-book>
                  {t(mine >= 0 ? 'sv.book.move' : 'sv.book.confirm')}
                </button>
                <p className="sv-insp__promise">{t('sv.book.promise')}</p>
                <p className="sv-insp__demo">
                  <span>{t('sv.demo')}</span>
                  <button type="button" className="sv-link" onClick={() => service.rivalTakes(seat, getNow())} data-sv-rival>
                    {t('sv.book.rival')}
                  </button>
                </p>
              </>
            )}
            {!allowed.ok && allowed.error === 'same-seat' && (
              <>
                <p className="sv-insp__note" data-sv-yours>{t('sv.insp.yours')}</p>
                <button type="button" className="sv-plate sv-button sv-button--gold" onClick={() => useHud.getState().setCardOpen(true)} data-sv-show-card>
                  {t('sv.insp.showCard')}
                </button>
                <button type="button" className="sv-plate sv-button" onClick={release} data-sv-release>
                  {t('sv.insp.release')}
                </button>
              </>
            )}
            {!allowed.ok && allowed.error === 'taken' && <p className="sv-insp__note">{t('sv.insp.taken')}</p>}
            {!allowed.ok && allowed.error === 'wrong-zone' && zone && (
              <p className="sv-insp__note" data-sv-wrong-zone>
                {t('sv.insp.wrongZone', { theirs: zoneName(zone), yours: zoneName(v.zones[graduate.zone]) })}
              </p>
            )}
            {!allowed.ok && allowed.error === 'bay-not-needed' && <p className="sv-insp__note">{t('sv.insp.bay')}</p>}
            {!allowed.ok && allowed.error === 'wrong-block' && <p className="sv-insp__note">{t('sv.insp.wrongBlock')}</p>}
            {!allowed.ok && (allowed.error === 'before' || allowed.error === 'closed') && (
              <>
                <p className="sv-insp__note" data-sv-window={phase}>
                  {t(`sv.insp.${allowed.error}`, { date: formatDate(allowed.error === 'before' ? bookingWindow().opens : bookingWindow().closes, locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
                </p>
                <p className="sv-insp__demo">
                  <span>{t('sv.demo')}</span>
                  <button type="button" className="sv-link" onClick={() => useClock.getState().setSimulated(bookingWindow().opens + JUMP_INTO_WINDOW_MS)} data-sv-jump>
                    {t('sv.insp.jump')}
                  </button>
                </p>
              </>
            )}
          </>
        )}

        {canFly && !seatedHere && mode !== 'fly' && (
          <button type="button" className="sv-plate sv-button" onClick={() => useStadium.getState().select(seat)} data-sv-view-from>
            {t('sv.insp.viewFrom')}
          </button>
        )}
      </div>
    </aside>
  )
}
