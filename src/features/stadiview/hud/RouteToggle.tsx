import { useMemo } from 'react'
import { routeTo, walkMinutes } from '@/features/stadiview/engine/routes'
import { useHud } from '@/features/stadiview/state/hudStore'
import { formatNumber, useLocale, useT } from '@/i18n'

/**
 * "Show my route": draws the walking route from the gate to a seat, in 3D and on the seat map, and
 * says it in words. One route shows at a time; showing it does not move the camera.
 */
export function RouteToggle({ seat, onShow, place }: { seat: number; onShow?: () => void; place: string }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const shown = useHud((s) => s.route === seat)
  const route = useMemo(() => routeTo(seat), [seat])
  const n = (x: number) => formatNumber(x, locale)
  const minutes = walkMinutes(route)
  return (
    <div className="sv-route" data-sv-route-toggle={place}>
      <button
        type="button"
        className="sv-plate sv-button"
        aria-pressed={shown}
        onClick={() => {
          useHud.getState().setRoute(shown ? -1 : seat)
          if (!shown) onShow?.()
        }}
        data-sv-route-button
      >
        {t(shown ? 'sv.route.hide' : 'sv.route.show')}
      </button>
      <p data-sv-route-words>
        {t('sv.route.words', {
          m: n(Math.round(route.length / 10) * 10),
          gate: n(route.gate),
          min: t(`sv.route.min.${new Intl.PluralRules(locale).select(minutes)}`, { n: n(minutes) }),
        })}
      </p>
    </div>
  )
}
