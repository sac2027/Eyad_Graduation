import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { celebrate, useCelebrations } from '@/features/celebrate/celebrate'
import { welcomeThisVisit } from '@/features/celebrate/welcome'
import { getPhase } from '@/time/phaseEngine'
import { getNow } from '@/time/clockStore'
import { useReducedMotion } from '@/ui/motionPrefs'
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
import { ScrollRail } from '@/features/rail/ScrollRail'

const DEFAULT_GRAD = PERSONAS.find((p) => p.role === 'graduate')!

export function GuestHome() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const now = useNow(1000)
  const nav = useNavigate()
  const { persona, setPersona } = useSession()
  const dateStatus = useDemoFlags((s) => s.dateStatus)
  const lowEnd = useDemoFlags((s) => s.lowEnd)
  const reduced = useReducedMotion()
  const [welcome, setWelcome] = useState(welcomeThisVisit)
  // The welcome moment: lights on, fireworks over the stage, a welcome line on the screens; about 4 s.
  useEffect(() => {
    if (!welcome) return
    const { phase } = getPhase(getNow())
    celebrate(phase === 'ceremony-day' || phase === 'afterglow' ? 'ceremony-entry' : 'welcome', 'landing-show')
    const tm = window.setTimeout(() => setWelcome(false), reduced || lowEnd ? 3000 : 4200)
    return () => window.clearTimeout(tm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcome])
  const skipWelcome = () => {
    if (!welcome) return
    setWelcome(false)
    useCelebrations.getState().stop()
  }
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
  // The scene, the rail and the dashboard agree on which steps are late for this graduate.
  const late = isGrad ? Object.fromEntries(STEPS.map((st) => [st.id, personalStatus(st.id, facts, now) === 'late'])) : undefined
  const outfit = gender === 'm' ? 'bisht' : 'abaya'
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
    <main className="pr-7 md:pr-16">
      <section aria-labelledby="hero-title" className="overflow-hidden bg-ink text-beige" data-hero onClick={skipWelcome}>
        <StadiumScene
          now={now}
          outfit={outfit}
          late={late}
          mode="live"
          dateStatus={dateStatus}
          welcome={welcome}
          onCheckpoint={toStep}
          headline={
            <div className="flex h-full flex-col items-center justify-start gap-1 text-center">
              <h1 id="hero-title" className="text-balance font-display text-[clamp(1.25rem,2.5vw,2.4rem)] font-black leading-[1.15]">
                {line}
              </h1>
              <p className="flex flex-wrap items-center justify-center gap-x-4 text-sm">
                <span className="opacity-90">{t('landing.place', { date: formatDate(SCHEDULE.ceremonyDay.ceremony.start, locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}</span>
<WaysIn className="hidden [@media(min-aspect-ratio:1/1)]:contents" onGrad={asGraduate} onGuest={() => setPersona('guest')} />
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
        <p className="flex justify-center gap-6 pb-3 text-sm [@media(min-aspect-ratio:1/1)]:hidden">
          <WaysIn onGrad={asGraduate} onGuest={() => setPersona('guest')} />
        </p>
      </section>

      {STEPS.map((step) => (
        <StepSection key={step.id} step={step} gender={gender} isGrad={isGrad} status={isGrad ? personalStatus(step.id, facts, now) : null} />
      ))}
      <FamiliesBlock />
      <ScrollRail now={now} outfit={outfit} late={late} />
    </main>
  )
}

/** The two ways in: as a graduate or as a guest. */
function WaysIn({ onGrad, onGuest, className }: { onGrad: () => void; onGuest: () => void; className?: string }) {
  const t = useT()
  return (
    <span className={className ?? 'contents'}>
      <button type="button" onClick={onGrad} className="min-h-11 font-semibold underline underline-offset-4">{t('landing.ways.grad')}</button>
      <Link to="/guide" onClick={onGuest} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">{t('landing.ways.guest')}</Link>
    </span>
  )
}
