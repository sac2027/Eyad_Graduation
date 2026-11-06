import { Link, useNavigate } from 'react-router-dom'
import { PERSONAS } from '@/data/fixtures/graduates'
import { useDemoFlags } from '@/features/demo-console/flags'
import { StadiumScene } from '@/features/stadium/StadiumScene'
import { formatDate, useLocale, useT } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { useNow } from '@/time/clockStore'
import { SCHEDULE, type StageId } from '@/time/schedule'
import { ButtonLink } from '@/ui/Button'
import { seatService, useGownRecord, useSeatVersion } from '@/data'
import { useConfirmed } from '@/features/graduate/checklist'
import { FamiliesBlock } from '@/features/steps/FamiliesBlock'
import { StepSection } from '@/features/steps/StepSection'
import { personalStatus, STEPS } from '@/features/steps/steps'

const DEFAULT_GRAD = PERSONAS.find((p) => p.role === 'graduate')!

export function GuestHome() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const now = useNow(1000)
  const nav = useNavigate()
  const { persona, setPersona } = useSession()
  const dateStatus = useDemoFlags((s) => s.dateStatus)
  const isGrad = persona.role === 'graduate'
  const gender = isGrad ? persona.gender : DEFAULT_GRAD.gender

  const done = now >= SCHEDULE.afterglowStart
  const key = done ? 'landing.done' : 'landing.line'
  useSeatVersion()
  const gown = useGownRecord(persona.id)
  const confirmed = useConfirmed((st) => !!st.confirmed[persona.id])
  const facts = {
    confirmed,
    gownDone: gown.status === 'slot-booked' || gown.status === 'picked-up' || gown.status === 'returned',
    hasSeat: seatService.listUserSeats(persona.id).some((x) => x.status === 'confirmed'),
  }
  const line = isGrad ? t(`${key}.named.${persona.gender}`, { name: persona.name[locale] }) : t(`${key}.anon`)

  const toStep = (id: StageId) => {
    const el = document.getElementById(`step-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const asGraduate = () => {
    if (!isGrad) setPersona(DEFAULT_GRAD.id)
    nav('/me')
  }

  return (
    <main>
      <section aria-labelledby="hero-title" className="overflow-hidden bg-ink text-beige" data-hero>
        <StadiumScene
          now={now}
          outfit={gender === 'm' ? 'bisht' : 'abaya'}
          mode="live"
          dateStatus={dateStatus}
          onCheckpoint={toStep}
          headline={
            <div className="flex h-full flex-col items-center justify-start gap-1 text-center">
              <h1 id="hero-title" className="text-balance font-display text-[clamp(1.25rem,2.5vw,2.4rem)] font-black leading-[1.15]">
                {line}
              </h1>
              <p className="flex flex-wrap items-center justify-center gap-x-4 text-sm">
                <span className="opacity-90">{t('landing.place', { date: formatDate(SCHEDULE.ceremonyDay.ceremony.start, locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}</span>
                <button type="button" onClick={asGraduate} className="min-h-11 font-semibold underline underline-offset-4">{t('landing.ways.grad')}</button>
                <Link to="/guide" onClick={() => setPersona('guest')} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">{t('landing.ways.guest')}</Link>
              </p>
            </div>
          }
        />
        <nav id="practical" aria-label={t('families.title')} className="mx-auto grid max-w-5xl grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-4" data-families>
          <ButtonLink to="/guide#gates" variant="gold">{t('families.gates')}</ButtonLink>
          <ButtonLink to="/guide#map" variant="gold">{t('families.parking')}</ButtonLink>
          <ButtonLink to="/me/tickets" variant="gold">{t('families.seat')}</ButtonLink>
          <ButtonLink to="/guide#access" variant="gold">{t('families.access')}</ButtonLink>
        </nav>
      </section>

      {STEPS.map((step) => (
        <StepSection key={step.id} step={step} gender={gender} isGrad={isGrad} status={isGrad ? personalStatus(step.id, facts, now) : null} />
      ))}
      <FamiliesBlock />
    </main>
  )
}
