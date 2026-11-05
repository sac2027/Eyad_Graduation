import { honorTier } from '@/domain/honorTier'
import { PERSONAS, seatService, useGownRecord, useSeatVersion } from '@/data'
import { useLocale, useT, formatDate, genderForm } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { useJourney } from '@/features/journey/useJourney'
import { JourneyBar } from '@/features/journey/JourneyBar'
import { SCHEDULE, type StageId } from '@/time/schedule'
import { getStageStatus } from '@/time/stageEngine'
import { Button, ButtonLink } from '@/ui/Button'
import { StatusChip } from '@/ui/StatusChip'
import { useConfirmed } from './checklist'

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
      <main className="mx-auto max-w-3xl px-4 py-14">
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

  const tasks: { id: StageId; title: string; cta: string; to?: string; note?: string; done: boolean }[] = [
    { id: 'candidacy', title: t('task.candidacy'), cta: t('task.candidacy.cta'), done: confirmed },
    { id: 'attire', title: t('task.attire'), cta: t('task.attire.cta'), to: '/me/attire', done: gown.status === 'slot-booked' || gown.status === 'picked-up' || gown.status === 'returned' },
    { id: 'tickets', title: t('task.tickets'), cta: t('task.tickets.cta'), to: '/me/tickets', done: hasSeat },
    { id: 'rehearsal', title: t('task.rehearsal'), cta: '', note: t('task.rehearsal.note', { from: formatDate(SCHEDULE.stages.rehearsal.opens, locale, { dateStyle: 'medium' }), to: formatDate(SCHEDULE.stages.rehearsal.closes!, locale, { dateStyle: 'medium' }) }), done: false },
  ]

  return (
    <main className="mx-auto max-w-5xl px-4 py-8" data-dashboard>
      <section className="bg-turquoise px-5 py-6 text-beige [transform:skewX(-5deg)] sm:px-8">
        <div className="[transform:skewX(5deg)]">
          <h1 className="break-words text-4xl font-black [overflow-wrap:anywhere] sm:text-5xl" data-me-name>{t('me.hello', { name: persona.name[locale] })}</h1>
          <p className="mt-1">{genderForm(locale, persona.gender, { m: t('me.candidate.m'), f: t('me.candidate.f') })}</p>
          <div className="mt-5">
            <JourneyBar variant="tracker" completed={completed} />
          </div>
        </div>
      </section>

      <h2 className="mb-3 mt-8 text-2xl font-black text-turquoise">{t('me.tasks')}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {tasks.map((task) => {
          const status = getStageStatus(task.id, j.now)
          const due = SCHEDULE.stages[task.id].due
          return (
            <li key={task.id} data-task={task.id} data-done={task.done} className="rounded-2xl bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-black">{task.title}</h3>
                <StatusChip status={status} />
              </div>
              {due && <p className="mt-1 text-sm">{t('me.due', { date: formatDate(due, locale) })}</p>}
              {task.note && <p className="mt-1 text-sm">{task.note}</p>}
              <div className="mt-3">
                {task.done ? (
                  <span className="font-bold text-green">{t('me.done')} ✓</span>
                ) : task.to ? (
                  <ButtonLink to={task.to} variant="secondary">{task.cta}</ButtonLink>
                ) : task.id === 'candidacy' ? (
                  <Button onClick={() => confirm(persona.id)} disabled={status === 'upcoming'}>{task.cta}</Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      {tier && (
        <section className="mt-8 flex flex-wrap items-center justify-between gap-3 bg-yellow px-5 py-4 text-turquoise [transform:skewX(-5deg)]" data-honor-card>
          <div className="[transform:skewX(5deg)]"><strong className="text-xl">{t('me.honor')}</strong></div>
          <div className="[transform:skewX(5deg)]"><ButtonLink to="/honors" variant="secondary">{t('me.honor.cta')}</ButtonLink></div>
        </section>
      )}
    </main>
  )
}
