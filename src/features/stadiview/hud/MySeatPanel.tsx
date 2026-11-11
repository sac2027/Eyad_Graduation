import { useSyncExternalStore } from 'react'
import { COLLEGE_COLORS, COLLEGE_NAMES } from '@/domain/types'
import { COLLEGE_ID } from '@/features/stadiview/config/venue'
import { bookingPhase } from '@/features/stadiview/data/bookingWindow'
import { locatorService } from '@/features/stadiview/data/locatorService'
import { pitchSeats, usePitchSeats } from '@/features/stadiview/data/pitchSeatService'
import { seatWords } from '@/features/stadiview/hud/SeatTooltip'
import { NO_ZONE } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useStadium } from '@/features/stadiview/state/stadiumStore'
import { useViewer } from '@/features/stadiview/state/useViewer'
import { useLocale, useT } from '@/i18n'
import { getNow } from '@/time/clockStore'
import { toast } from '@/ui/toast'

/** The button in the top row that opens "My seat". It says at a glance whether a seat is booked. */
export function MySeatToggle() {
  const t = useT()
  const viewer = useViewer()
  usePitchSeats()
  const open = useHud((s) => s.panel === 'mine')
  if (!viewer.graduate) return null
  const seat = pitchSeats().seatOf(viewer.graduate, viewer.now)
  return (
    <button
      type="button"
      className="sv-plate sv-button sv-top__mine"
      aria-expanded={open}
      onClick={() => useHud.getState().setPanel(open ? 'none' : 'mine')}
      data-sv-my-seat-toggle
      data-booked={seat >= 0 ? '' : undefined}
    >
      <i aria-hidden />
      {t('sv.mine.title')}
    </button>
  )
}

/**
 * "My seat": the signed-in graduate's own corner. Their seat and what they can do with it, their
 * Family Share Code, and the two choices that are theirs alone: whether family may find their seat
 * by name, and whether they need a wheelchair bay.
 */
export function MySeatPanel({ canFly }: { canFly: boolean }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const viewer = useViewer()
  usePitchSeats()
  useSyncExternalStore(locatorService.subscribe, locatorService.version)
  const open = useHud((s) => s.panel === 'mine')

  const graduate = viewer.graduate
  if (!open || !graduate || !viewer.name) return null
  const v = getVenue()
  const service = pitchSeats()
  const hud = useHud.getState()
  const seat = service.seatOf(graduate, viewer.now)
  const zone = v.zones[graduate.zone]
  const phase = bookingPhase(viewer.now)
  const locatorOn = locatorService.isAllowed(graduate)
  const needsBay = service.needsBay(graduate)

  const show = () => {
    hud.inspect(seat)
    if (canFly) useStadium.getState().select(seat)
  }
  const change = () => {
    hud.fitMatrix({ zone: graduate.zone })
    hud.setPanel('none')
  }
  const release = () => {
    if (service.release(graduate, getNow()).ok) toast.success(t('sv.book.released'))
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(graduate.shareCode)
      toast.success(t('sv.mine.copied'))
    } catch {
      // No clipboard (an insecure page, or permission refused): the code is on screen to copy by hand.
      toast.error(t('sv.mine.copyFailed'))
    }
  }

  return (
    <aside className="sv-card sv-insp sv-mine" data-sv-my-seat data-seat={seat >= 0 ? v.idOf(seat) : ''} aria-label={t('sv.mine.title')}>
      <div className="sv-matrix" aria-hidden />
      <header className="sv-insp__head">
        <div>
          <h2>{t('sv.mine.title')}</h2>
          <p className="sv-mine__name">{viewer.name[locale]}</p>
          <p>
            <i className="sv-insp__college" style={{ background: COLLEGE_COLORS[COLLEGE_ID[zone.college]] }} aria-hidden />
            {COLLEGE_NAMES[COLLEGE_ID[zone.college]][locale]} · {t(`sv.degree.${zone.degree}`)}
          </p>
        </div>
        <button type="button" className="sv-icon" aria-label={t('sv.mine.close')} onClick={() => hud.setPanel('none')} data-sv-my-seat-close>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="sv-mine__seat" data-sv-my-seat-place>
        {seat >= 0 ? (
          <>
            <b>{seatWords(seat, t, locale).place}</b>
            {v.zone[seat] === NO_ZONE && <span>{seatWords(seat, t, locale).detail}</span>}
            <bdi dir="ltr">{v.idOf(seat)}</bdi>
          </>
        ) : (
          <>
            <b>{t('sv.mine.none')}</b>
            <span>{t(phase === 'open' ? 'sv.mine.noneHint' : phase === 'before' ? 'sv.mine.noneBefore' : 'sv.mine.noneClosed')}</span>
          </>
        )}
      </div>

      <div className="sv-mine__actions">
        {seat >= 0 ? (
          <>
            <button type="button" className="sv-plate sv-button sv-button--gold" onClick={() => hud.setCardOpen(true)} data-sv-mine-card>
              {t('sv.mine.card')}
            </button>
            <button type="button" className="sv-plate sv-button" onClick={show} data-sv-mine-show>
              {t(canFly ? 'sv.mine.show' : 'sv.mine.showMap')}
            </button>
            {phase === 'open' && (
              <>
                <button type="button" className="sv-plate sv-button" onClick={change} data-sv-mine-change>
                  {t('sv.mine.change')}
                </button>
                <button type="button" className="sv-plate sv-button" onClick={release} data-sv-mine-release>
                  {t('sv.mine.release')}
                </button>
              </>
            )}
          </>
        ) : (
          <button type="button" className="sv-plate sv-button sv-button--gold" onClick={change} data-sv-mine-change>
            {t('sv.mine.choose')}
          </button>
        )}
      </div>

      <p className="sv-insp__promise sv-mine__promise">{t('sv.book.promise')}</p>

      <section className="sv-mine__share" aria-labelledby="sv-share-title">
        <h3 id="sv-share-title">{t('sv.mine.share')}</h3>
        <div className="sv-mine__code">
          <bdi dir="ltr" data-sv-share-code>
            {graduate.shareCode}
          </bdi>
          <button type="button" className="sv-chip" onClick={copy} data-sv-copy-code>
            {t('sv.mine.copy')}
          </button>
        </div>
        <p>{t('sv.mine.shareHint')}</p>
      </section>

      <div className="sv-mine__switches">
        <label className="sv-switch">
          <input type="checkbox" role="switch" checked={locatorOn} onChange={(e) => locatorService.setAllowed(graduate, e.target.checked)} data-sv-locator />
          <span className="sv-switch__track" aria-hidden />
          <span className="sv-switch__words">
            <b>{t('sv.mine.locator')}</b>
            <small>{t(locatorOn ? 'sv.mine.locatorOn' : 'sv.mine.locatorOff')}</small>
          </span>
        </label>
        <label className="sv-switch">
          <input type="checkbox" role="switch" checked={needsBay} onChange={(e) => service.setNeedsBay(graduate, e.target.checked)} data-sv-wheelchair />
          <span className="sv-switch__track" aria-hidden />
          <span className="sv-switch__words">
            <b>{t('sv.mine.wheelchair')}</b>
            <small>{t('sv.mine.wheelchairHint')}</small>
          </span>
        </label>
      </div>
    </aside>
  )
}
