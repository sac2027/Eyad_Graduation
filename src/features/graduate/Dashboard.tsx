import { honorTier } from '@/domain/honorTier'
import { PERSONAS, seatService, useGownRecord, useSeatVersion } from '@/data'
import type { CSSProperties } from 'react'
import { useLocale, useT, formatDate, formatNumber, genderForm } from '@/i18n'
import { PageHero } from '@/ui/PageHero'
import { Reveal } from '@/ui/Reveal'
import { useSession } from '@/session/sessionStore'
import { useJourney } from '@/features/journey/useJourney'
import { ProgressTrail } from '@/features/stadium/ProgressTrail'
import { SCHEDULE, type StageId } from '@/time/schedule'
import { getStageStatus } from '@/time/stageEngine'
import { Button, ButtonLink } from '@/ui/Button'
import { StatusChip } from '@/ui/StatusChip'
import { useConfirmed } from './checklist'
import { celebrate } from '@/features/celebrate/celebrate'

export function Dashboard() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const { persona, setPersona } = useSession()
  const j = useJourney()
  const gown = useGownRecord(persona.id)
  useSeatVersion()
  const confirmed = useConfirmed((s) => !!s.confirmed[persona.id])
  const confirm = useConfirmed((s) => s.confirm)

  if (persona.role !== 'graduate') {
    return (
      <main className="rise mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-4xl font-black text-turquoise">{t('nav.me')}</h1>
        <p className="mt-3 text-lg">{t('me.not-grad')}</p>
        <Button className="mt-5" onClick={() => setPersona(PERSONAS.find((p) => p.role === 'graduate')!.id)}>{t('me.sign-in')}</Button>
      </main>
    )
  }

  const tier = honorTier(persona.gpa)
  const hasSeat = seatService.listUserSeats(persona.id).some((s) => s.status === 'confirmed')
  const completed = new Set<StageId>()
  if (confirmed) completed.add('candidacy')
  if (gown.status !== 'none') completed.add('attire')
  if (hasSeat) completed.add('tickets')
  // A step is late for this graduate when its deadline has passed and it is not done.
  const late: Partial<Record<StageId, boolean>> = {}
  for (const id of ['candidacy', 'attire', 'tickets'] as const) {
    const due = SCHEDULE.stages[id].due
    if (due !== undefined && j.now > due && !completed.has(id)) late[id] = true
  }

  const tasks: { id: StageId; title: string; cta: string; to?: string; note?: string; done: boolean }[] = [
    { id: 'candidacy', title: t('task.candidacy'), cta: t('task.candidacy.cta'), done: confirmed },
    { id: 'attire', title: t('task.attire'), cta: t('task.attire.cta'), to: '/me/attire', done: gown.status === 'slot-booked' || gown.status === 'picked-up' || gown.status === 'returned' },
    { id: 'tickets', title: t('task.tickets'), cta: t('task.tickets.cta'), to: '/me/tickets', done: hasSeat },
    { id: 'rehearsal', title: t('task.rehearsal'), cta: '', note: t('task.rehearsal.note', { from: formatDate(SCHEDULE.stages.rehearsal.opens, locale, { dateStyle: 'medium' }), to: formatDate(SCHEDULE.stages.rehearsal.closes!, locale, { dateStyle: 'medium' }) }), done: false },
  ]

  const doneCount = tasks.filter((x) => x.done).length
  const step = (i: number) => ({ '--i': i }) as CSSProperties

  return (
    <main data-dashboard>
      <PageHero
        eyebrow={t('nav.me')}
        title={t('me.hello', { name: persona.name[locale] })}
        titleProps={{ 'data-me-name': '' }}
        sub={genderForm(locale, persona.gender, { m: t('me.candidate.m'), f: t('me.candidate.f') })}
      >
        <ProgressTrail now={j.now} late={late} />
      </PageHero>

      <div className="mx-auto max-w-5xl px-4 pb-14">
        <section className="rise relative -mt-2 grid items-center gap-4 overflow-hidden rounded-[1.25rem] bg-ink p-5 text-beige sm:grid-cols-[1fr_auto] sm:p-7" style={step(4)} aria-labelledby="me-stadium-h">
          <PitchArt />
          <div className="relative">
            <h2 id="me-stadium-h" className="text-2xl font-black text-yellow sm:text-3xl">{t('me.stadium.title')}</h2>
            <p className="mt-1 max-w-prose text-beige/90">{t('me.stadium.note')}</p>
          </div>
          <div className="relative">
            <ButtonLink to="/stadium" variant="gold" size="lg" data-stadium-link>{t('stadium.link.book')}</ButtonLink>
          </div>
        </section>

        <div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-black text-turquoise sm:text-3xl">{t('me.tasks')}</h2>
          <p className="text-sm font-bold text-turquoise" data-me-progress>
            {t('me.progress', { done: formatNumber(doneCount, locale), total: formatNumber(tasks.length, locale) })}
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {tasks.map((task, i) => {
            const status = getStageStatus(task.id, j.now)
            const due = SCHEDULE.stages[task.id].due
            const stripe = task.done ? 'var(--color-green)' : late[task.id] ? 'var(--color-error)' : status === 'open' ? 'var(--color-green)' : status === 'due-soon' ? 'var(--color-yellow)' : 'var(--color-gray)'
            return (
              <li key={task.id} data-task={task.id} data-done={task.done} className="panel stripe rise flex flex-col p-5 ps-7" style={{ ...step(5 + i), '--stripe': stripe } as CSSProperties}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden className="mt-0.5 font-display text-3xl font-black leading-none text-turquoise/25">{formatNumber(i + 1, locale)}</span>
                    <h3 className="text-lg font-black leading-snug">{task.title}</h3>
                  </div>
                  <StatusChip status={status} />
                </div>
                {due && <p className="mt-2 text-sm text-ink/75">{t('me.due', { date: formatDate(due, locale) })}</p>}
                {task.note && <p className="mt-2 text-sm text-ink/75">{task.note}</p>}
                <div className="mt-auto pt-4">
                  {task.done ? (
                    <span className="pop inline-flex items-center gap-2 font-bold text-turquoise">
                      <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" className="draw-check rounded-full bg-green p-1 text-black">
                        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {t('me.done')} ✓
                    </span>
                  ) : task.to ? (
                    <ButtonLink to={task.to} variant="secondary">{task.cta}</ButtonLink>
                  ) : task.id === 'candidacy' ? (
                    <Button onClick={() => { confirm(persona.id); celebrate('task', `candidacy:${persona.id}`) }} disabled={status === 'upcoming' || status === 'closed'}>{task.cta}</Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>

        {tier && (
          <Reveal className="mt-10 overflow-x-clip">
            <section className="flex flex-wrap items-center justify-between gap-3 bg-yellow px-6 py-5 text-black [transform:skewX(-5deg)]" data-honor-card>
              <div className="[transform:skewX(5deg)]"><strong className="font-display text-2xl font-black">{t('me.honor')}</strong></div>
              <div className="[transform:skewX(5deg)]"><ButtonLink to="/honors" variant="secondary">{t('me.honor.cta')}</ButtonLink></div>
            </section>
          </Reveal>
        )}
      </div>
    </main>
  )
}

/** A pitch seen from above, drawn in lines: the seat blocks, the carpet round them, the stage. Decoration only. */
function PitchArt() {
  return (
    <svg aria-hidden viewBox="0 0 400 160" preserveAspectRatio="xMaxYMid meet" className="absolute inset-0 h-full w-full opacity-40 rtl:-scale-x-100">
      <g fill="none" stroke="#009767" strokeWidth="1.5">
        <ellipse cx="300" cy="80" rx="150" ry="95" />
        <ellipse cx="300" cy="80" rx="118" ry="68" />
      </g>
      <rect x="226" y="34" width="150" height="92" rx="6" fill="none" stroke="#f0ba4f" strokeWidth="2.5" />
      <g fill="#009767">
        {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={236 + c * 28} y={44 + r * 25} width="22" height="19" rx="2" opacity={0.55} />))}
      </g>
      <rect x="352" y="52" width="12" height="56" fill="#f0ba4f" />
    </svg>
  )
}
