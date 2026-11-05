import clsx from 'clsx'
import { useLocale, useT, formatDate } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { STAGE_ORDER, SCHEDULE, type StageId } from '@/time/schedule'
import { useReducedMotion } from '@/ui/motionPrefs'
import { useJourney } from './useJourney'
import { Walker } from './Walker'

interface JourneyBarProps {
  variant?: 'story' | 'tracker'
  /** Stages the graduate has finished (tracker only). */
  completed?: Set<StageId>
  className?: string
}

/** The Journey Bar: time until the graduate holds the shield, shown as a walker climbing along eight stage ticks. */
export function JourneyBar({ variant = 'story', completed, className }: JourneyBarProps) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const reduced = useReducedMotion()
  const { persona } = useSession()
  const j = useJourney()
  const pct = `${(j.progress * 100).toFixed(3)}%`
  const next = j.nextDeadline

  return (
    <div className={clsx('w-full', className)} data-journey-bar={variant} data-progress={j.progress.toFixed(4)} data-stage={j.stageId}>
      <div
        role="progressbar"
        aria-label={t('journey.aria')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(j.progress * 100)}
        className="relative h-14"
      >
        <div className="absolute inset-x-3 top-8 h-3 overflow-hidden rounded-full bg-black/25">
          <div
            className="absolute inset-y-0 start-0 rounded-full bg-yellow"
            style={{ width: pct, transition: reduced ? 'none' : 'width 600ms var(--ease-out-strong)' }}
          />
        </div>
        {STAGE_ORDER.map((id, i) => {
          const at = i / (STAGE_ORDER.length - 1)
          const passed = j.progress >= at - 1e-9
          const done = completed?.has(id)
          return (
            <span
              key={id}
              data-tick={id}
              title={t(`stage.${id}`)}
              className={clsx(
                'absolute top-7 h-5 w-[5px] -translate-x-1/2 -skew-x-[5deg] rounded-sm rtl:translate-x-1/2',
                done ? 'bg-green outline outline-2 outline-beige' : passed ? 'bg-turquoise' : 'bg-beige/70',
              )}
              style={{ insetInlineStart: `calc(0.75rem + (100% - 1.5rem) * ${at})` }}
            />
          )
        })}
        <div
          data-you-are-here
          data-stage={j.stageId}
          className="absolute top-0 -translate-x-1/2 rtl:translate-x-1/2"
          style={{
            insetInlineStart: `calc(0.75rem + (100% - 1.5rem) * ${j.progress})`,
            transition: reduced ? 'none' : 'inset-inline-start 600ms var(--ease-out-strong)',
          }}
        >
          <div className={clsx(locale === 'ar' && '-scale-x-100')}>
            <Walker gender={persona.gender} college={persona.college} size={38} />
          </div>
        </div>
        <span
          aria-hidden
          className="absolute end-0 top-4 inline-grid size-9 place-items-center rounded-lg bg-yellow font-black text-turquoise [clip-path:polygon(25%_0,75%_0,100%_25%,100%_75%,75%_100%,25%_100%,0_75%,0_25%)]"
        >
          ✓
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
        <span data-you-are-here-label className="font-semibold">
          {j.dateStatus === 'tbc' ? t('journey.tbc') : `${t('journey.you-are-here')}: ${t(`stage.${j.stageId}`)}`}
        </span>
        {variant === 'tracker' && (
          <span>{next ? t('journey.next', { stage: t(`stage.${next.id}`), date: formatDate(next.due, locale) }) : t('journey.none')}</span>
        )}
        {variant === 'story' && <span className="opacity-80">{formatDate(SCHEDULE.ceremonyDay.ceremony.start, locale)}</span>}
      </div>
    </div>
  )
}
