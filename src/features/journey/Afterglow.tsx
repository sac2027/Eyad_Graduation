import { Link } from 'react-router-dom'
import { MatrixLoop } from '@/brand/matrix/MatrixLoop'
import { honorTier } from '@/domain/honorTier'
import { useGownRecord } from '@/data'
import { useLocale, useT, formatDate } from '@/i18n'
import { daysSinceLabel } from '@/i18n/plurals'
import { useSession } from '@/session/sessionStore'
import { SCHEDULE } from '@/time/schedule'
import { ButtonLink } from '@/ui/Button'
import { daysSinceCeremony } from './completion'
import { useJourney } from './useJourney'
import { Walker } from './Walker'

/** After the ceremony: the walker stands on the stage with the certificate, and the next steps are clear. */
export function Afterglow() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const { persona } = useSession()
  const j = useJourney()
  const gown = useGownRecord(persona.id)
  const n = daysSinceCeremony(j.now)
  const isGrad = persona.role === 'graduate'
  const tier = isGrad ? honorTier(persona.gpa) : null
  const steps = [
    { key: 'photos', note: t('after.photos.note'), to: '/guide#photos' },
    { key: 'certificate', note: t('after.certificate.note', { date: formatDate(SCHEDULE.certificateCollection, locale) }) },
    ...(isGrad && gown.status !== 'returned'
      ? [{ key: 'gown', note: t('after.gown.note', { from: formatDate(SCHEDULE.gownReturnOpens, locale), to: formatDate(SCHEDULE.gownReturnDue, locale) }) }]
      : []),
    { key: 'survey', note: t('after.survey.note') },
    ...(tier ? [{ key: 'honors', note: t('after.honors.note'), to: '/honors' }] : []),
  ]
  return (
    <section id="journey" data-journey-mode="afterglow" data-afterglow className="relative overflow-hidden bg-beige text-ink">
      <MatrixLoop id="afterglow" background="beige" stripes="turquoise" className="absolute inset-0 h-full w-full" />
      <div className="relative mx-auto max-w-5xl px-4 py-14">
        <div className="bg-turquoise px-6 py-8 text-beige [transform:skewX(-5deg)] sm:px-10">
          <div className="[transform:skewX(5deg)]">
            <div className="flex flex-wrap items-end gap-6">
              <div className="relative grid h-40 w-32 place-items-end" aria-hidden>
                <div className={locale === 'ar' ? '-scale-x-100' : ''}>
                  <Walker gender={persona.gender} college={persona.college} size={130} />
                </div>
                <span className="absolute bottom-6 start-full ms-[-6px] block h-9 w-12 rounded-sm bg-[#1d5a3d] outline outline-2 outline-yellow" data-certificate-held />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-balance text-4xl font-black sm:text-6xl" data-afterglow-title>
                  {isGrad ? t('afterglow.title', { name: persona.name[locale] }) : t('afterglow.guest')}
                </h2>
                <p className="mt-2 text-lg">{t('afterglow.note')}</p>
                <p className="mt-1 text-sm opacity-90" data-days-since={n}>{daysSinceLabel(locale, n)}</p>
              </div>
            </div>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {steps.map((s) => (
                <li key={s.key} data-after-step={s.key} className="rounded-xl bg-black/20 p-4">
                  <h3 className="text-xl font-black">{t(`after.${s.key}`)}</h3>
                  <p className="mt-1 text-sm">{s.note}</p>
                  {s.to && (
                    <ButtonLink to={s.to} variant="gold" size="md" className="mt-3">{t(`after.${s.key}.cta`)}</ButtonLink>
                  )}
                </li>
              ))}
            </ul>
            <Link to="/guide" className="sr-only">{t('journey.reveal.guest')}</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
