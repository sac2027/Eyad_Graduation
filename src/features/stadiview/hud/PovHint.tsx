import { useEffect, useState } from 'react'
import { seatWords } from '@/features/stadiview/hud/SeatTooltip'
import { useStadium } from '@/features/stadiview/state/stadiumStore'
import { useLocale, useT } from '@/i18n'

/** How long the hint stays before it fades. */
const HINT_MS = 4000

/**
 * On arriving in a seat: which seat this is, and how to look around. It shows for four seconds.
 *
 * It is also how a screen-reader user learns that the view has changed, so it is a live region
 * and its words stay in the page after the plate has faded from sight.
 */
export function PovHint() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const seated = useStadium((s) => s.mode === 'pov')
  const seat = useStadium((s) => s.selected)
  const [fresh, setFresh] = useState(false)

  useEffect(() => {
    if (!seated) return
    setFresh(true)
    const timer = window.setTimeout(() => setFresh(false), HINT_MS)
    return () => {
      window.clearTimeout(timer)
      setFresh(false)
    }
  }, [seated, seat])

  const words = seated && seat >= 0 ? seatWords(seat, t, locale) : null

  return (
    <div className="sv-hint" data-open={seated && fresh ? '' : undefined} role="status" data-sv-hint>
      {words && (
        <p className="sv-plate sv-hint__plate">
          {/* Sighted users see where they are; a screen reader is told that the view changed. */}
          <span className="sv-sr">{t('sv.pov.from')}</span>
          <strong>{words.place}</strong>
          {words.detail && <span>{words.detail}</span>}
          <em>{t('sv.pov.hint')}</em>
        </p>
      )}
    </div>
  )
}
