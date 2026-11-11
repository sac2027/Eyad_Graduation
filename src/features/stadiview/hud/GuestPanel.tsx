import { getDirectory } from '@/features/stadiview/data/graduateDirectory'
import { locatorService } from '@/features/stadiview/data/locatorService'
import { GraduateSearch } from '@/features/stadiview/hud/GraduateSearch'
import { SightlineReadout } from '@/features/stadiview/hud/SightlineReadout'
import { TicketLookup } from '@/features/stadiview/hud/TicketLookup'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useViewer } from '@/features/stadiview/state/useViewer'
import { useT } from '@/i18n'
import { getNow } from '@/time/clockStore'

/** The button in the top row that opens the guest tools. */
export function GuestToggle() {
  const t = useT()
  const viewer = useViewer()
  const open = useHud((s) => s.panel === 'guest')
  if (viewer.role !== 'guest') return null
  return (
    <button type="button" className="sv-plate sv-button sv-top__mine" aria-expanded={open} onClick={() => useHud.getState().setPanel(open ? 'none' : 'guest')} data-sv-guest-toggle>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.5 15.5L21 21" />
      </svg>
      {t('sv.guest.title')}
    </button>
  )
}

/**
 * The guest tools: find the seat on a ticket, and find a graduate. Everything here only looks
 * things up; nothing in guest mode can book, release or change a seat.
 */
export function GuestPanel({ canFly }: { canFly: boolean }) {
  const t = useT()
  const viewer = useViewer()
  const open = useHud((s) => s.panel === 'guest')
  if (!open || viewer.role !== 'guest') return null

  /** From a ticket to the graduate it was issued for: the same as finding them by name. */
  const findGraduate = (index: number) => {
    const hud = useHud.getState()
    const g = getDirectory().all[index]
    hud.setGuest({ graduate: index, byCode: false })
    const found = locatorService.locate({ graduate: g }, getNow())
    if (found.ok) hud.inspect(found.value.seat, true)
  }

  return (
    <aside className="sv-card sv-insp sv-guest" data-sv-guest aria-label={t('sv.guest.title')}>
      <div className="sv-matrix" aria-hidden />
      <header className="sv-insp__head">
        <div>
          <h2>{t('sv.guest.title')}</h2>
          <p>{t('sv.guest.lead')}</p>
        </div>
        <button type="button" className="sv-icon" aria-label={t('sv.guest.close')} onClick={() => useHud.getState().setPanel('none')} data-sv-guest-close>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>
      <TicketLookup canFly={canFly} onFindGraduate={findGraduate} />
      <GraduateSearch canFly={canFly} />
      <SightlineReadout canFly={canFly} />
    </aside>
  )
}
