import { useLocale, useT, formatDate } from '@/i18n'
import { SCHEDULE } from '@/time/schedule'
import { Button } from '@/ui/Button'
import { buildIcs } from './ics'

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5">
      <dt className="mb-1 text-sm font-bold text-turquoise">{label}</dt>
      <dd className="text-lg">{children}</dd>
    </div>
  )
}

/** Visible to everyone, honored or not. The honors ceremony is the day before the main ceremony. */
export function HonorDetails({ standalone = false }: { standalone?: boolean }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const { start, end } = SCHEDULE.honorsCeremony
  const time = (ms: number) => formatDate(ms, locale, { hour: '2-digit', minute: '2-digit', hour12: false })

  const download = () => {
    const ics = buildIcs({
      uid: 'honors-57@kfupm-graduation.example',
      title: t('honors.d.ics.title'),
      start,
      end,
      location: t('honors.d.where.value'),
      description: t('honors.d.sub'),
    })
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'honors-ceremony-57.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section id="details" data-honor-details aria-labelledby="hd-title" className="mx-auto max-w-4xl scroll-mt-4 px-4 py-14">
      {standalone ? (
        <h1 id="hd-title" className="text-5xl font-black text-turquoise">{t('honors.d.title')}</h1>
      ) : (
        <h2 id="hd-title" className="text-4xl font-black text-turquoise">{t('honors.d.title')}</h2>
      )}
      <p className="mt-2 max-w-2xl text-lg">{t('honors.d.sub')}</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <Item label={t('honors.d.when')}>
          <span data-honor-when dir="ltr" className="inline-block">{formatDate(start, locale, { dateStyle: 'full' })}, {time(start)} – {time(end)}</span>
        </Item>
        <Item label={t('honors.d.where')}>{t('honors.d.where.value')}</Item>
        <Item label={t('honors.d.arrival')}>{t('honors.d.arrival.value')}</Item>
        <Item label={t('honors.d.tickets')}>{t('honors.d.tickets.value')}</Item>
        <Item label={t('honors.d.dress')}>{t('honors.d.dress.value')}</Item>
        <Item label={t('honors.d.photos')}>{t('honors.d.photos.value')}</Item>
      </dl>
      <Button className="mt-6" variant="secondary" onClick={download}>{t('honors.d.calendar')}</Button>
      <h3 className="mb-3 mt-10 text-2xl font-black text-turquoise">{t('honors.d.faq')}</h3>
      <div className="grid gap-3">
        {[1, 2, 3].map((n) => (
          <details key={n} className="rounded-xl bg-white p-4">
            <summary className="min-h-11 cursor-pointer font-bold">{t(`honors.d.q${n}`)}</summary>
            <p className="mt-2">{t(`honors.d.a${n}`)}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
