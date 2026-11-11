import NumberFlow from '@number-flow/react'
import { Link } from 'react-router-dom'
import { PERSONAS, seatService, ticketService, useSeatVersion, useTicketClaims } from '@/data'
import { useLocale, useT, formatDate } from '@/i18n'
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
      <main className="mx-auto max-w-3xl px-4 py-10" data-tickets-guest>
        <h1 className="text-4xl font-black text-turquoise">{t('tickets.guest.title')}</h1>
        <p className="mt-3 text-lg">{t('tickets.guest.note')}</p>
        <p className="mt-1 text-sm">{t('tickets.guest.mock')}</p>
        <div className="mt-6">
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
    <main className="mx-auto max-w-4xl px-4 py-8" data-tickets>
      <h1 className="text-4xl font-black text-turquoise">{t('tickets.title')}</h1>
      <p className="mt-2">
        <Link to="/stadium" className="inline-flex min-h-11 items-center font-semibold text-turquoise underline" data-stadium-link>{t('stadium.link.see')}</Link>
      </p>
      {closedMsg && <p className="mt-3 rounded-xl bg-white p-4 font-semibold" role="status" data-tickets-msg>{closedMsg}</p>}

      <section className="mt-6 rounded-2xl bg-white p-5" aria-labelledby="s1">
        <h2 id="s1" className="mb-3 text-xl font-bold">1. {t('tickets.step1')}</h2>
        {attending ? (
          <p className="font-bold text-turquoise" data-attending>{t('tickets.attending')} ✓</p>
        ) : (
          <Button onClick={() => attend(persona.id)} disabled={!bookingOpen}>{t('tickets.attend')}</Button>
        )}
      </section>

      {attending && (
        <>
          <section className="mt-4 rounded-2xl bg-white p-5" aria-labelledby="s2">
            <h2 id="s2" className="mb-3 text-xl font-bold">2. {t('tickets.step2')}</h2>
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

          <section className="mt-4" aria-labelledby="s3">
            <h2 id="s3" className="mb-3 text-xl font-bold">3. {t('tickets.step3')}</h2>
            <div className="mb-3 flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4">
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input type="checkbox" className="size-5 accent-green" checked={canEasy} onChange={(e) => seatService.setNeedsEasyAccess(persona.id, e.target.checked)} />
                {t('tickets.easy')}
              </label>
              <Link to="/guide#access" className="font-semibold underline">{t('tickets.easy.link')}</Link>
            </div>
            {bookingOpen ? (
              <SeatMap userId={persona.id} allowance={allowance} canEasy={canEasy} />
            ) : (
              <p className="rounded-xl bg-white p-4">{closedMsg}</p>
            )}
          </section>
        </>
      )}

      {confirmed.length > 0 && (
        <section className="mt-6" aria-labelledby="s4" data-your-tickets>
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
    </main>
  )
}
