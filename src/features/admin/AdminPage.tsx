import { useState } from 'react'
import { adminService, GRADUATES, PERSONAS, RESERVED, seatService, ticketService, TOTAL_SEATS, useExceptions, useSeatVersion, useTicketClaims } from '@/data'
import { computeCapacity } from '@/domain/capacity'
import { useLocale, useT, formatNumber } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { useNow } from '@/time/clockStore'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { toast } from '@/ui/toast'

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const locale = useLocale((s) => s.locale)
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between gap-3 text-sm"><span>{label}</span><strong dir="ltr">{formatNumber(value, locale)}</strong></div>
      <div className="h-3 overflow-hidden rounded-full bg-black/10" role="presentation">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
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
      <main className="mx-auto max-w-3xl px-4 py-14">
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
    <main className="mx-auto max-w-5xl px-4 py-8" data-admin>
      <h1 className="text-4xl font-black text-turquoise">{t('admin.title')}</h1>
      <p className="mt-1 text-sm" data-admin-mock>{t('admin.mock')}</p>

      <section className="mt-6 grid gap-4 md:grid-cols-2" aria-labelledby="cap-h">
        <div className="rounded-2xl bg-white p-5">
          <h2 id="cap-h" className="mb-3 text-xl font-black">{t('admin.capacity')}</h2>
          <Bar label={t('admin.total')} value={TOTAL_SEATS} max={TOTAL_SEATS} color="#115f66" />
          <Bar label={`${t('admin.reserved')}: ${t('admin.vip')}`} value={RESERVED.vip} max={TOTAL_SEATS} color="#aa8c6d" />
          <Bar label={`${t('admin.reserved')}: ${t('admin.easy')}`} value={RESERVED.easyAccess} max={TOTAL_SEATS} color="#71b8d4" />
          <Bar label={`${t('admin.reserved')}: ${t('admin.ops')}`} value={RESERVED.ops} max={TOTAL_SEATS} color="#adacad" />
          <Bar label={t('admin.pool')} value={cap.pool} max={TOTAL_SEATS} color="#009767" />
        </div>
        <dl className="grid content-start gap-3 rounded-2xl bg-white p-5" data-admin-capacity>
          {[
            ['graduates', t('admin.graduates'), fmt(GRADUATES)],
            ['guaranteed', t('admin.guaranteed'), fmt(cap.guaranteed)],
            ['second', t('admin.second'), fmt(cap.secondPool)],
            ['second-left', t('admin.second-left'), fmt(ticketService.remaining(now))],
            ['per-grad', t('admin.per-grad'), cap.perGraduate.toFixed(2)],
            ['break-even', t('admin.break-even'), `${Math.round(cap.breakEvenTakeUp * 100)}%`],
            ['confirmed', t('admin.seats-confirmed'), fmt(confirmed)],
          ].map(([k, label, value]) => (
            <div key={k} className="flex items-baseline justify-between gap-3" data-cap={k}>
              <dt>{label}</dt>
              <dd className="font-display text-2xl font-black text-turquoise" dir="ltr">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8" aria-labelledby="ex-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="ex-h" className="text-2xl font-black text-turquoise">{t('admin.exceptions')}</h2>
            <p className="text-sm">{t('admin.exceptions.note')}</p>
          </div>
          <Button onClick={() => setOpen(true)}>{t('admin.add')}</Button>
        </div>
        {exceptions.length === 0 ? (
          <p className="mt-4 rounded-xl bg-white p-4">{t('admin.empty')}</p>
        ) : (
          <ul className="mt-4 grid gap-3" data-exceptions>
            {exceptions.map((e) => (
              <li key={e.id} data-exception={e.id} className="rounded-2xl bg-white p-4">
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
                className="min-h-11 rounded-lg border border-gray px-3 text-base font-normal"
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
    </main>
  )
}
