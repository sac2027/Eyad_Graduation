import { useState } from 'react'
import { ABAYA_SIZES, BISHT_SIZES, gownService, useGownRecord } from '@/data'
import { PERSONAS } from '@/data'
import { useLocale, useT, formatDate, plural } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { useNow } from '@/time/clockStore'
import { SCHEDULE } from '@/time/schedule'
import { getStageStatus } from '@/time/stageEngine'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { QrCard } from '@/ui/QrCard'
import { StatusChip } from '@/ui/StatusChip'
import { toast } from '@/ui/toast'

const FLOW = ['none', 'requested', 'slot-booked', 'picked-up', 'returned'] as const

export function Attire() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const now = useNow(1000)
  const { persona, setPersona } = useSession()
  const rec = useGownRecord(persona.id)
  const [size, setSize] = useState<string | undefined>(rec.size)
  const [slotId, setSlotId] = useState<string | undefined>()
  const [saving, setSaving] = useState<'loading' | 'success' | undefined>()

  if (persona.role !== 'graduate') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-4xl font-black text-turquoise">{t('attire.title')}</h1>
        <p className="mt-3">{t('me.not-grad')}</p>
        <Button className="mt-5" onClick={() => setPersona(PERSONAS.find((p) => p.role === 'graduate')!.id)}>{t('me.sign-in')}</Button>
      </main>
    )
  }

  const status = getStageStatus('attire', now)
  const sizes = persona.gender === 'm' ? BISHT_SIZES : ABAYA_SIZES
  const due = SCHEDULE.stages.attire.due!
  const stepIdx = FLOW.indexOf(rec.status)
  const editable = status !== 'upcoming' && status !== 'closed' && (rec.status === 'none' || rec.status === 'requested')

  const save = () => {
    if (!size) return
    setSaving('loading')
    setTimeout(() => {
      const r = gownService.requestSize(persona.id, size, persona.gender, now)
      if (r.ok) {
        setSaving('success')
        toast.success(t('attire.saved'))
      } else {
        setSaving(undefined)
        toast.error(t('attire.error.closed'))
      }
      setTimeout(() => setSaving(undefined), 1200)
    }, 350)
  }
  const book = () => {
    if (!slotId) return
    const r = gownService.bookPickup(persona.id, slotId, now)
    if (!r.ok) toast.error(r.error === 'full' ? t('attire.error.full') : t('attire.error.closed'))
    else toast.success(t('attire.booked'))
  }
  const slot = gownService.slots.find((s) => s.id === rec.slotId)

  return (
    <main className="mx-auto max-w-3xl px-4 py-8" data-attire>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-4xl font-black text-turquoise">{t('attire.title')}</h1>
        <StatusChip status={status} />
      </div>

      <ol className="my-5 grid grid-cols-5 gap-1 text-center text-xs" aria-label={t('attire.title')}>
        {FLOW.map((s, i) => (
          <li key={s} data-flow={s} data-reached={i <= stepIdx} className={`rounded-lg px-1 py-2 ${i <= stepIdx ? 'bg-green font-bold text-white' : 'bg-white'}`}>
            {t(`gown.${s}`)}
          </li>
        ))}
      </ol>

      <section className="rounded-2xl bg-white p-5" aria-labelledby="size-h">
        <h2 id="size-h" className="mb-3 text-xl font-bold">{t(`attire.size.${persona.gender}`)}</h2>
        {status === 'upcoming' && <p data-attire-msg="upcoming">{t('attire.upcoming', { date: formatDate(SCHEDULE.stages.attire.opens, locale) })}</p>}
        {status === 'closed' && rec.status === 'none' && <p data-attire-msg="closed" role="status">{t('attire.closed', { date: formatDate(due, locale) })}</p>}
        {(status === 'open' || status === 'due-soon' || rec.status !== 'none') && (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t(`attire.size.${persona.gender}`)}>
              {sizes.map((s) => (
                <Chip key={s} selected={(size ?? rec.size) === s} onToggle={() => editable && setSize(s)} disabled={!editable} data-size={s}>{s}</Chip>
              ))}
            </div>
            {persona.gender === 'f' && <p className="mt-2 text-sm">{t('attire.sash')}</p>}
            {editable && <Button className="mt-4" state={saving} onClick={save} disabled={!size}>{saving === 'success' ? t('attire.saved') : t('attire.save')}</Button>}
          </>
        )}
      </section>

      {rec.status !== 'none' && rec.status !== 'returned' && (
        <section className="mt-5 rounded-2xl bg-white p-5" aria-labelledby="slot-h">
          <h2 id="slot-h" className="mb-3 text-xl font-bold">{t('attire.slots')}</h2>
          {rec.status === 'requested' ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {gownService.slots.map((s) => {
                  const left = s.capacity - gownService.slotLoad(s.id)
                  return (
                    <Chip key={s.id} selected={slotId === s.id} onToggle={() => left > 0 && setSlotId(s.id)} disabled={left <= 0} data-slot={s.id} className="justify-between">
                      <span dir="ltr">{formatDate(s.start, locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      <span className="ms-2 text-xs">
                        {left > 0
                          ? plural(locale, left, locale === 'ar'
                            ? { one: 'مكان واحد متبقٍ', two: 'مكانان متبقيان', few: `${left} أماكن متبقية`, many: `${left} مكانًا متبقيًا`, other: `${left} مكان متبقٍ` }
                            : { one: 'one place left', other: `${left} places left` })
                          : t('attire.full')}
                      </span>
                    </Chip>
                  )
                })}
              </div>
              <Button className="mt-4" onClick={book} disabled={!slotId}>{t('attire.book')}</Button>
            </>
          ) : (
            slot && (
              <div className="grid gap-4">
                <p className="font-bold" data-slot-booked dir="ltr">{formatDate(slot.start, locale, { dateStyle: 'full', timeStyle: 'short', hour12: false })}</p>
                <QrCard name={persona.name[locale]} label={t('attire.qr')} code={`KFUPM57-GOWN-${persona.id}-${rec.size}`} rows={[{ label: t(`attire.size.${persona.gender}`), value: rec.size ?? '' }]} note={t('attire.qr.note')} />
                {rec.status === 'slot-booked' && (
                  <Button variant="ghost" onClick={() => gownService.markPickedUp(persona.id)}>{t('attire.pickup-demo')}</Button>
                )}
                {rec.status === 'picked-up' && (
                  <Button variant="ghost" onClick={() => gownService.markReturned(persona.id)}>{t('attire.return-demo')}</Button>
                )}
              </div>
            )
          )}
        </section>
      )}
    </main>
  )
}
