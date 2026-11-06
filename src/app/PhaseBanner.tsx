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
    <div role="status" key={key} data-phase-banner={phase} className="phase-banner bg-yellow px-4 py-2 text-center text-sm font-bold text-black">
      {t(key)}
    </div>
  )
}
