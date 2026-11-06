import NumberFlow from '@number-flow/react'
import { daysSinceCeremony } from '@/features/journey/completion'
import { useLocale, useT } from '@/i18n'
import { daysSinceLabel } from '@/i18n/plurals'
import { SCHEDULE } from '@/time/schedule'
import { countdownParts } from './countdown'
import type { SceneGeom } from './geometry'

const pct = (v: number, of: number) => `${(v / of) * 100}%`

/** The two LED screens on the stage: the countdown to the certificate, the welcome line, or the congratulations. */
export function StageScreens({ g, now, tbc, welcome = false }: { g: SceneGeom; now: number; tbc: boolean; welcome?: boolean }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const c = countdownParts(now, SCHEDULE.afterglowStart)
  const since = daysSinceCeremony(now)
  const two = (n: number) => String(n).padStart(2, '0')
  const [l, r] = g.screens
  const box = (rect: typeof l) => ({ left: pct(rect.x, g.w), top: pct(rect.y, g.h), width: pct(rect.w, g.w), height: pct(rect.h, g.h) })
  return (
    <>
      <div className="absolute grid place-content-center gap-0.5 px-1 text-center text-beige" style={box(l)} data-screen="left" data-days={c.days}>
        {welcome ? (
          <span className="text-balance px-2 font-display text-[clamp(0.8rem,1.8vw,1.5rem)] font-black leading-tight text-yellow" data-screen-welcome>{t('welcome.line')}</span>
        ) : tbc ? (
          <span className="px-2 text-[10px] font-bold leading-tight sm:text-sm">{t('count.tbc')}</span>
        ) : c.done ? (
          <span className="text-balance px-2 font-display text-[clamp(0.85rem,2vw,1.6rem)] font-black leading-tight text-yellow" data-screen-congrats>{t('screens.congrats')}</span>
        ) : (
          <>
            <span className="font-display text-[clamp(1.3rem,3.6vw,3rem)] font-black leading-none tabular-nums text-yellow">
              <NumberFlow value={c.days} locales="en" /> <span className="text-[0.45em] font-bold text-beige">{t('screens.days')}</span>
            </span>
            <span className="text-balance text-[9px] font-semibold leading-tight sm:text-xs" data-screens-label>{t('screens.until')}</span>
          </>
        )}
      </div>
      <div className="absolute grid place-content-center gap-0.5 text-center text-beige" style={box(r)} data-screen="right" data-time={`${two(c.h)}:${two(c.m)}:${two(c.s)}`}>
        {welcome && <span className="text-balance px-2 text-[10px] font-bold leading-tight sm:text-base">{t('welcome.sub')}</span>}
        {!welcome && !tbc && c.done && <span className="text-balance px-2 text-[10px] font-bold leading-tight sm:text-base">{daysSinceLabel(locale, since)}</span>}
        {!welcome && !tbc && !c.done && (
          <>
            <span dir="ltr" className="font-display text-[clamp(1rem,2.8vw,2.3rem)] font-black leading-none tabular-nums text-yellow" aria-label={`${two(c.h)}:${two(c.m)}:${two(c.s)}`}>
              <NumberFlow value={c.h} format={{ minimumIntegerDigits: 2 }} locales="en" />:
              <NumberFlow value={c.m} format={{ minimumIntegerDigits: 2 }} locales="en" />:
              <NumberFlow value={c.s} format={{ minimumIntegerDigits: 2 }} locales="en" />
            </span>
            <span className="text-[9px] font-semibold sm:text-xs">{t('screens.hms')}</span>
          </>
        )}
      </div>
    </>
  )
}

