import { useNavigate } from 'react-router-dom'
import { PERSONAS } from '@/data/fixtures/graduates'
import { useLocale, useT, formatDate } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { useNow } from '@/time/clockStore'
import { getPhase } from '@/time/phaseEngine'
import { SCHEDULE } from '@/time/schedule'
import { Button, ButtonLink } from '@/ui/Button'
import { Countdown } from './Countdown'
import { JourneySection } from '@/features/journey/JourneySection'

export function GuestHome() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const now = useNow(1000)
  const nav = useNavigate()
  const { persona, setPersona } = useSession()
  const { phase } = getPhase(now)

  const asGraduate = () => {
    if (persona.role !== 'graduate') setPersona(PERSONAS.find((p) => p.role === 'graduate')!.id)
    nav('/me')
  }
  const asGuest = () => {
    setPersona('guest')
    nav('/guide')
  }

  return (
    <main>
      <section aria-labelledby="hero-title" className="bg-turquoise text-beige" data-hero>
        <div className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-5xl content-center gap-8 px-4 py-10">
          <div>
            <h1 id="hero-title" className="text-balance text-[clamp(2.5rem,9vw,5.5rem)] font-black leading-[1.05]">
              {t(`hero.${phase}`)}
            </h1>
            <p className="mt-3 max-w-xl text-lg">{t('hero.sub')}</p>
            <p className="mt-1 text-base opacity-90">{t('hero.date', { date: formatDate(SCHEDULE.ceremonyDay.ceremony.start, locale) })}</p>
          </div>
          <Countdown />
          <div id="practical" className="grid gap-3 sm:grid-cols-3">
            <ButtonLink to="/guide#gates" variant="gold" size="lg">{t('cta.gate')}</ButtonLink>
            <ButtonLink to="/me/tickets" variant="gold" size="lg">{t('cta.seat')}</ButtonLink>
            <ButtonLink to="/guide#map" variant="gold" size="lg">{t('cta.map')}</ButtonLink>
          </div>
          <a href="#journey" className="inline-flex min-h-11 w-fit items-center gap-2 font-semibold underline underline-offset-4">
            {t('cta.journey')}
            <span aria-hidden>↓</span>
          </a>
        </div>
      </section>

      <JourneySection />

      <section aria-labelledby="roles-title" className="mx-auto max-w-5xl px-4 py-14">
        <h2 id="roles-title" className="mb-6 text-3xl font-black text-turquoise">{t('role.title')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-6">
            <Button size="lg" onClick={asGraduate}>{t('cta.me')}</Button>
            <p className="mt-3 text-sm">{t('role.graduate.note')}</p>
          </div>
          <div className="rounded-2xl bg-white p-6">
            <Button size="lg" variant="secondary" onClick={asGuest}>{t('cta.guest')}</Button>
            <p className="mt-3 text-sm">{t('role.guest.note')}</p>
          </div>
        </div>
      </section>
    </main>
  )
}
