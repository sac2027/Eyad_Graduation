import NumberFlow from '@number-flow/react'
import { useT, useLocale } from '@/i18n'
import { useNow } from '@/time/clockStore'
import { getPhase } from '@/time/phaseEngine'
import { SCHEDULE } from '@/time/schedule'
import { useDemoFlags } from '@/features/demo-console/flags'
import { daysSinceCeremony } from '@/features/journey/completion'

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export function Countdown() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const dateStatus = useDemoFlags((s) => s.dateStatus)
  const now = useNow(1000)
  const { phase } = getPhase(now)
  const target = SCHEDULE.ceremonyDay.ceremony.start

  if (dateStatus === 'tbc') return <p className="text-xl font-semibold">{t('count.tbc')}</p>
  if (phase === 'afterglow') {
    const n = daysSinceCeremony(now)
    return <p className="text-xl font-semibold">{t('count.since', { n })}</p>
  }
  if (now >= target) return <p className="text-xl font-semibold">{t('count.live')}</p>

  const left = target - now
  const onTheDay = phase === 'ceremony-day'
  const parts = onTheDay
    ? [
        { v: Math.floor(left / HOUR), u: 'unit.h' },
        { v: Math.floor((left % HOUR) / MIN), u: 'unit.m' },
        { v: Math.floor((left % MIN) / SEC), u: 'unit.s' },
      ]
    : [
        { v: Math.floor(left / DAY), u: 'unit.d' },
        { v: Math.floor((left % DAY) / HOUR), u: 'unit.h' },
        { v: Math.floor((left % HOUR) / MIN), u: 'unit.m' },
      ]
  return (
    <div role="timer" aria-label={t('count.label')} className="flex gap-6" dir="ltr" data-countdown={onTheDay ? 'day' : 'days'}>
      {parts.map((p) => (
        <div key={p.u} className="text-center">
          <NumberFlow
            value={p.v}
            locales="en"
            format={{ minimumIntegerDigits: 2, useGrouping: false }}
            className="font-display text-5xl font-black tabular-nums sm:text-6xl"
          />
          <div className="mt-1 text-sm opacity-80" dir={locale === 'ar' ? 'rtl' : 'ltr'}>{t(p.u)}</div>
        </div>
      ))}
    </div>
  )
}
