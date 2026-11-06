import { MatrixField } from '@/brand/matrix/MatrixField'
import { formatDate, formatNumber, useLocale, useT } from '@/i18n'
import { SCHEDULE } from '@/time/schedule'
import { ButtonLink } from '@/ui/Button'
import type { PersonalStatus, StepInfo } from './steps'

interface Props {
  step: StepInfo
  gender: 'm' | 'f'
  /** The signed-in graduate's status, or null for visitors and steps with nothing to show. */
  status: PersonalStatus | null
  isGrad: boolean
}

const STATUS: Record<PersonalStatus, string> = {
  done: 'bg-green text-black',
  pending: 'bg-yellow text-black',
  late: 'bg-error text-black',
}

/** One chapter of the journey: an emotional title, then the plain facts and the action. */
export function StepSection({ step, gender, status, isGrad }: Props) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const { id, n, to } = step
  const w = SCHEDULE.stages[id]
  const dark = n % 2 === 0
  const date = (ms: number) => formatDate(ms, locale, { day: 'numeric', month: 'long' })
  const timeOnly = id === 'arrival' || id === 'ceremony' || id === 'celebration'
  const when = timeOnly
    ? `${date(w.opens)} · ${formatDate(w.opens, locale, { hour: 'numeric', minute: '2-digit' })}`
    : w.due
      ? `${t('step.opens', { date: date(w.opens) })} · ${t('step.deadline', { date: date(w.due) })}`
      : date(w.opens)
  const showCta = to && (isGrad || !to.startsWith('/me'))

  return (
    <section id={`step-${id}`} data-step={id} aria-labelledby={`step-${id}-title`} className="scroll-mt-24 overflow-x-clip py-6 sm:py-10">
      <div className={dark ? 'bg-turquoise text-beige [transform:skewY(-2deg)]' : ''}>
        <div className={`mx-auto grid max-w-5xl items-center gap-6 px-4 py-8 md:grid-cols-[1.1fr_1fr] md:gap-10 ${dark ? '[transform:skewY(2deg)]' : ''}`}>
          <div>
            <div className={`font-display text-7xl font-black leading-none sm:text-8xl ${dark ? 'text-yellow' : 'text-turquoise'}`} aria-hidden>
              {formatNumber(n, locale).padStart(2, formatNumber(0, locale))}
            </div>
            <p className={`mt-2 text-sm font-bold uppercase tracking-wide ${dark ? 'text-beige/90' : 'text-turquoise'}`}>{t(`stage.${id}`)}</p>
            <h2 id={`step-${id}-title`} className={`mt-1 text-balance font-display text-3xl font-black leading-tight sm:text-4xl ${dark ? '' : 'text-turquoise'}`}>
              {t(`step.${id}.title.${gender}`)}
            </h2>
            <p className="mt-3 max-w-prose text-lg">{t(`step.${id}.sub`)}</p>
          </div>

          <div className={`rounded-2xl p-5 shadow-sm ${dark ? 'bg-ink/40' : 'bg-white'}`}>
            <dl className="grid gap-3">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide opacity-80">{t('step.when')}</dt>
                <dd className="font-semibold">{when}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide opacity-80">{t('step.do')}</dt>
                <dd>{t(`step.${id}.do`, { date: date(SCHEDULE.certificateCollection) })}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide opacity-80">{t('step.need')}</dt>
                <dd>{t(`step.${id}.need`)}</dd>
              </div>
            </dl>
            {(status || showCta) && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {status && (
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${STATUS[status]}`} data-step-status={status}>
                    {t(`step.status.${status}`)}
                  </span>
                )}
                {showCta && (
                  <ButtonLink to={to!} variant={dark ? 'gold' : 'primary'} size="md">
                    {t(`step.${id}.cta`)}
                  </ButtonLink>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {n === 9 && (
        <div className="mx-auto mt-6 h-24 max-w-5xl overflow-hidden px-4" aria-hidden>
          <MatrixField background="beige" stripes="yellow" seed={57} density={0.5} className="h-full w-full" />
        </div>
      )}
    </section>
  )
}
