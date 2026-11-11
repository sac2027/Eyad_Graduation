import { useStadium } from '@/features/stadiview/state/stadiumStore'
import { useT } from '@/i18n'

/**
 * The way out of a seat: a button at the bottom centre that flies the camera back to the overview.
 *
 * It is on screen only while the viewer is seated. It stays in the page the rest of the time,
 * switched off, so that it can fade out as it fades in instead of vanishing.
 */
export function BackButton() {
  const t = useT()
  const seated = useStadium((s) => s.mode === 'pov')
  const back = useStadium((s) => s.back)
  return (
    <div className="sv-dock" data-open={seated ? '' : undefined} inert={!seated}>
      <button type="button" className="sv-plate sv-button sv-button--cta" onClick={back} data-sv-back>
        {/* The arrow points back the way the text was read from, so it is mirrored in Arabic. */}
        <svg className="sv-arrow" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
          <path d="M20 12H5M11 5.5 4.5 12l6.5 6.5" />
        </svg>
        {t('sv.back')}
      </button>
    </div>
  )
}
