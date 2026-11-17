import { useT } from '@/i18n'
import { useJourney } from '@/features/journey/useJourney'

/** A slim strip that tells the whole site what moment it is. */
export function PhaseBanner() {
  const t = useT()
  const { phase, slot } = useJourney()
  const key =
    phase === 'final-week' ? 'banner.final-week'
    : phase === 'honors-day' ? 'banner.honors-day'
    : phase === 'ceremony-day' ? `banner.slot.${slot}`
    : phase === 'afterglow' ? 'banner.afterglow'
    : null
  if (!key) return null
  return (
    <div role="status" key={key} data-phase-banner={phase} className="phase-banner relative overflow-hidden bg-yellow px-4 py-2.5 text-center text-sm font-bold text-black">
      <span aria-hidden className="banner-bars start-0" />
      <span aria-hidden className="banner-bars end-0 -scale-x-100" />
      <span className="banner-text relative inline-flex items-center justify-center gap-2.5">
        <span aria-hidden className="relative grid size-2.5 place-items-center">
          <span className="banner-dot absolute inset-0 rounded-full bg-turquoise" />
          <span className="relative size-2.5 rounded-full bg-turquoise" />
        </span>
        {t(key)}
      </span>
    </div>
  )
}
