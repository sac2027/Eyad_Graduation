import NumberFlow from '@number-flow/react'
import { Link } from 'react-router-dom'
import { PERSONAS, seatService, ticketService, useSeatVersion, useTicketClaims } from '@/data'
import type { CSSProperties } from 'react'
import { useLocale, useT, formatDate, formatNumber } from '@/i18n'
import { PageHero } from '@/ui/PageHero'
import { useSession } from '@/session/sessionStore'
import { useNow } from '@/time/clockStore'
import { SCHEDULE } from '@/time/schedule'
import { Button } from '@/ui/Button'
import { QrCard } from '@/ui/QrCard'
import { toast } from '@/ui/toast'
import { useAttending } from './checklist'
import { SeatMap } from './SeatMap'

export function Tickets() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const now = useNow(1000)
  const { persona, setPersona } = useSession()
  const claims = useTicketClaims()
  useSeatVersion()
  const attending = useAttending((s) => !!s.attending[persona.id])
  const attend = useAttending((s) => s.attend)

  if (persona.role !== 'graduate') {
    return (
      <main data-tickets-guest>
        <PageHero width="narrow" seed={44} title={t('tickets.guest.title')} sub={t('tickets.guest.note')} />
        <div className="mx-auto max-w-3xl px-4 pb-14">
        <p className="text-sm text-ink/75">{t('tickets.guest.mock')}</p>
        <div className="rise mt-6" style={{ '--i': 4 } as CSSProperties}>
          <QrCard
            name={locale === 'ar' ? 'ضيف خالد العتيبي' : 'Guest of Khaled Alotaibi'}
            label={t('tickets.your-tickets')}
            code="KFUPM57-G05-3-12-SAMPLE"
            rows={[
              { label: t('access.gate'), value: t('gate.of.general') },
              { label: t('seat.col.section'), value: 'G05' },
              { label: t('seat.col.seat'), value: '3 · 12' },
            ]}
          />
        </div>
        <Button className="mt-6" variant="ghost" onClick={() => setPersona(PERSONAS.find((p) => p.role === 'graduate')!.id)}>{t('me.sign-in')}</Button>
        </div>
      </main>
    )
  }

  const w = SCHEDULE.stages.tickets
  const ent = ticketService.getEntitlement(persona.id)
  void claims
  const remaining = ticketService.remaining(now)
  const claimsOpen = ticketService.claimsOpen(now)
  // Free booking runs to the deadline, then reopens once unclaimed seats are released.
  const bookingOpen = claimsOpen
  const allowance = 1 + (ent.second === 'claimed' ? 1 : 0)
  const confirmed = seatService.listUserSeats(persona.id).filter((s) => s.status === 'confirmed')
  const canEasy = seatService.needsEasyAccess(persona.id)

  const closedMsg = now < w.opens
    ? t('tickets.closed.before', { date: formatDate(w.opens, locale) })
    : now > w.closes!
      ? t('tickets.closed.after', { date: formatDate(w.closes!, locale) })
      : now > w.due! && now < SCHEDULE.seatsReleased
        ? t('tickets.closed.between', { date: formatDate(SCHEDULE.seatsReleased, locale) })
        : null

  return (
    <main data-tickets>
      <PageHero seed={44} eyebrow={t('tickets.eyebrow')} title={t('tickets.title')}>
        <Link to="/stadium" className="text-link text-yellow" data-stadium-link>{t('stadium.link.see')} <span className="go" aria-hidden>→</span></Link>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 pb-14">
      {closedMsg && (
        <p className="panel-quiet rise flex items-center gap-3 p-4 font-semibold" style={{ '--i': 4 } as CSSProperties} role="status" data-tickets-msg>
          <span aria-hidden className="grid size-8 flex-none place-items-center rounded-full bg-yellow font-black text-black">!</span>
          {closedMsg}
        </p>
      )}

      <section className="panel rise mt-6 p-5 sm:p-6" style={{ '--i': 5 } as CSSProperties} aria-labelledby="s1">
        <h2 id="s1" className="mb-3 flex items-center gap-3 text-xl font-bold"><StepNo n={1} done={attending} />{t('tickets.step1')}</h2>
        {attending ? (
          <p className="font-bold text-turquoise" data-attending>{t('tickets.attending')} ✓</p>
        ) : (
          <Button onClick={() => attend(persona.id)} disabled={!bookingOpen}>{t('tickets.attend')}</Button>
        )}
      </section>

      {attending && (
        <>
          <section className="panel pop mt-4 p-5 sm:p-6" aria-labelledby="s2">
            <h2 id="s2" className="mb-3 flex items-center gap-3 text-xl font-bold"><StepNo n={2} done={ent.second === 'claimed'} />{t('tickets.step2')}</h2>
            <p className="font-semibold">{t('tickets.guaranteed')}</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <div className="text-sm">{t('tickets.pool')}</div>
                <span data-pool-remaining={remaining}><NumberFlow value={remaining} locales="en" format={{ useGrouping: true }} className="font-display text-4xl font-black tabular-nums text-turquoise" /></span>
              </div>
              {ent.second === 'unclaimed' && (
                <Button
                  variant="secondary"
                  disabled={!claimsOpen}
                  onClick={() => {
                    const r = ticketService.claimSecond(persona.id, now)
                    if (!r.ok) toast.error(r.error === 'already-claimed' ? t('tickets.error.already') : t('tickets.error.closed'))
                    else toast.success(r.value === 'claimed' ? t('tickets.claimed') : t('tickets.waitlist', { date: formatDate(SCHEDULE.seatsReleased, locale) }))
                  }}
                >
                  {t('tickets.claim')}
                </Button>
              )}
            </div>
            {ent.second === 'claimed' && <p className="mt-2 font-bold text-turquoise" data-second="claimed">{t('tickets.claimed')} ✓</p>}
            {ent.second === 'waitlist' && <p className="mt-2 font-bold" data-second="waitlist">{t('tickets.waitlist', { date: formatDate(SCHEDULE.seatsReleased, locale) })}</p>}
          </section>

          <section className="pop mt-6" aria-labelledby="s3">
            <h2 id="s3" className="mb-3 flex items-center gap-3 text-xl font-bold"><StepNo n={3} done={confirmed.length > 0} />{t('tickets.step3')}</h2>
            <div className="panel mb-3 flex flex-wrap items-center gap-4 p-4">
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input type="checkbox" className="size-5 accent-green" checked={canEasy} onChange={(e) => seatService.setNeedsEasyAccess(persona.id, e.target.checked)} />
                {t('tickets.easy')}
              </label>
              <Link to="/guide#access" className="text-link text-turquoise">{t('tickets.easy.link')}</Link>
            </div>
            {bookingOpen ? (
              <SeatMap userId={persona.id} allowance={allowance} canEasy={canEasy} />
            ) : (
              <p className="panel-quiet p-4">{closedMsg}</p>
            )}
          </section>
        </>
      )}

      {confirmed.length > 0 && (
        <section className="pop mt-8" aria-labelledby="s4" data-your-tickets>
          <h2 id="s4" className="mb-3 text-2xl font-black text-turquoise">{t('tickets.your-tickets')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {confirmed.map((s) => (
              <QrCard
                key={s.id}
                name={persona.name[locale]}
                label={`${t('tickets.your-tickets')} ${s.id}`}
                code={`KFUPM57-${s.id}-${persona.id}`}
                rows={[
                  { label: t('access.gate'), value: t(`gate.of.${s.zone === 'easy-access' ? 'easy-access' : 'general'}`) },
                  { label: t('seat.col.section'), value: s.section },
                  { label: t('seat.col.seat'), value: `${s.row} · ${s.number}` },
                ]}
                onShare={() => {
                  void navigator.clipboard?.writeText?.(`https://example.invalid/ticket/${s.id}`).catch(() => {})
                  toast.success(t('tickets.shared'))
                }}
              />
            ))}
          </div>
        </section>
      )}
      </div>
    </main>
  )
}

/** A step's number in a ring; a tick once the step is done. */
function StepNo({ n, done }: { n: number; done: boolean }) {
  const locale = useLocale((s) => s.locale)
  return (
    <span className={`grid size-8 flex-none place-items-center rounded-full text-sm font-black transition-colors duration-200 ${done ? 'bg-green text-black' : 'bg-turquoise text-beige'}`}>
      {/* The full stop keeps the heading reading "1. Confirm..." to a screen reader and in plain text. */}
      <span>{formatNumber(n, locale)}<span className="sr-only">. </span></span>
    </span>
  )
}
