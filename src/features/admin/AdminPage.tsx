import { useState } from 'react'
import { adminService, GRADUATES, PERSONAS, RESERVED, seatService, ticketService, TOTAL_SEATS, useExceptions, useSeatVersion, useTicketClaims } from '@/data'
import { computeCapacity } from '@/domain/capacity'
import { useLocale, useT, formatNumber } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { useNow } from '@/time/clockStore'
import { Button } from '@/ui/Button'
import type { CSSProperties } from 'react'
import { PageHero } from '@/ui/PageHero'
import { Dialog } from '@/ui/Dialog'
import { toast } from '@/ui/toast'

function Bar({ label, value, max, color, i }: { label: string; value: number; max: number; color: string; i: number }) {
  const locale = useLocale((s) => s.locale)
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between gap-3 text-sm"><span>{label}</span><strong dir="ltr">{formatNumber(value, locale)}</strong></div>
      <div className="h-3 overflow-hidden rounded-full bg-black/10" role="presentation">
        <div className="meter-fill h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color, '--i': i } as CSSProperties} />
      </div>
    </div>
  )
}

export function AdminPage() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const { persona, setPersona } = useSession()
  const now = useNow(1000)
  const exceptions = useExceptions()
  useTicketClaims()
  useSeatVersion()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ id: '', name: '', reason: '' })
  const [error, setError] = useState<string | null>(null)

  if (persona.role !== 'admin') {
    return (
      <main className="rise mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-4xl font-black text-turquoise">{t('admin.title')}</h1>
        <p className="mt-3">{t('admin.not-admin')}</p>
        <Button className="mt-5" onClick={() => setPersona(PERSONAS.find((p) => p.role === 'admin')!.id)}>{t('admin.sign-in')}</Button>
      </main>
    )
  }

  const cap = computeCapacity({ totalSeats: TOTAL_SEATS, graduates: GRADUATES, reserved: RESERVED })
  const confirmed = seatService.countConfirmed()
  const fmt = (n: number) => formatNumber(n, locale)

  const submit = () => {
    const r = adminService.addException(form)
    if (r.ok) {
      setOpen(false)
      setForm({ id: '', name: '', reason: '' })
      setError(null)
      toast.success(t('admin.added'))
    } else {
      setError(t(`admin.err.${r.error}`))
    }
  }

  return (
    <main data-admin>
      <PageHero seed={77} eyebrow={t('admin.eyebrow')} title={t('admin.title')} sub={<span data-admin-mock>{t('admin.mock')}</span>} />
      <div className="mx-auto max-w-5xl px-4 pb-14">
      <section className="rise grid gap-4 md:grid-cols-2" style={{ '--i': 4 } as CSSProperties} aria-labelledby="cap-h">
        <div className="panel p-5 sm:p-6">
          <h2 id="cap-h" className="mb-3 text-xl font-black">{t('admin.capacity')}</h2>
          <Bar i={0} label={t('admin.total')} value={TOTAL_SEATS} max={TOTAL_SEATS} color="#115f66" />
          <Bar i={1} label={`${t('admin.reserved')}: ${t('admin.vip')}`} value={RESERVED.vip} max={TOTAL_SEATS} color="#aa8c6d" />
          <Bar i={2} label={`${t('admin.reserved')}: ${t('admin.easy')}`} value={RESERVED.easyAccess} max={TOTAL_SEATS} color="#71b8d4" />
          <Bar i={3} label={`${t('admin.reserved')}: ${t('admin.ops')}`} value={RESERVED.ops} max={TOTAL_SEATS} color="#adacad" />
          <Bar i={4} label={t('admin.pool')} value={cap.pool} max={TOTAL_SEATS} color="#009767" />
        </div>
        <dl className="panel grid content-start divide-y divide-ink/10 p-5 sm:p-6" data-admin-capacity>
          {[
            ['graduates', t('admin.graduates'), fmt(GRADUATES)],
            ['guaranteed', t('admin.guaranteed'), fmt(cap.guaranteed)],
            ['second', t('admin.second'), fmt(cap.secondPool)],
            ['second-left', t('admin.second-left'), fmt(ticketService.remaining(now))],
            ['per-grad', t('admin.per-grad'), cap.perGraduate.toFixed(2)],
            ['break-even', t('admin.break-even'), `${Math.round(cap.breakEvenTakeUp * 100)}%`],
            ['confirmed', t('admin.seats-confirmed'), fmt(confirmed)],
          ].map(([k, label, value]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 py-2" data-cap={k}>
              <dt>{label}</dt>
              <dd className="font-display text-2xl font-black tabular-nums text-turquoise" dir="ltr">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rise mt-10" style={{ '--i': 5 } as CSSProperties} aria-labelledby="ex-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="ex-h" className="text-2xl font-black text-turquoise">{t('admin.exceptions')}</h2>
            <p className="text-sm">{t('admin.exceptions.note')}</p>
          </div>
          <Button onClick={() => setOpen(true)}>{t('admin.add')}</Button>
        </div>
        {exceptions.length === 0 ? (
          <p className="panel-quiet mt-4 p-5 text-center">{t('admin.empty')}</p>
        ) : (
          <ul className="mt-4 grid gap-3" data-exceptions>
            {exceptions.map((e) => (
              <li key={e.id} data-exception={e.id} className="panel stripe pop p-4 ps-6 [--stripe:var(--color-yellow)]">
                <p className="font-display text-lg font-black" dir="ltr">{e.id}</p>
                <p className="break-words font-bold [overflow-wrap:anywhere]">{e.name}</p>
                <p className="break-words text-sm [overflow-wrap:anywhere]">{e.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null) }} title={t('admin.add')}>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          {(['id', 'name', 'reason'] as const).map((k) => (
            <label key={k} className="grid gap-1 text-sm font-semibold">
              {t(`admin.f.${k}`)}
              <input
                className="min-h-11 rounded-lg border border-ink/30 px-3 text-base font-normal transition-[border-color,box-shadow] duration-150 focus:border-turquoise focus:shadow-[0_0_0_3px_rgb(17_95_102/0.18)] focus:outline-none"
                value={form[k]}
                inputMode={k === 'id' ? 'numeric' : undefined}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              />
            </label>
          ))}
          {error && <p role="alert" className="rounded-lg bg-error/20 p-2 font-semibold" data-admin-error>{error}</p>}
          <Button type="submit">{t('admin.save')}</Button>
        </form>
      </Dialog>
      </div>
    </main>
  )
}
