import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLocale, useT, formatDate } from '@/i18n'
import { SCHEDULE, SLOT_ORDER } from '@/time/schedule'
import { AccessibilityFlow } from './AccessibilityFlow'
import { GateMap } from './GateMap'

const SECTIONS = ['gates', 'map', 'access', 'schedule', 'dress', 'faq'] as const

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 py-8">
      <h2 id={`${id}-h`} className="mb-4 text-3xl font-black text-turquoise">{title}</h2>
      {children}
    </section>
  )
}

export function Guide() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])
  const time = (ms: number) => formatDate(ms, locale, { hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <main className="mx-auto max-w-5xl px-4 py-10" data-guide>
      <h1 className="text-5xl font-black text-turquoise">{t('guide.title')}</h1>
      <p className="mt-2 text-lg">{t('guide.sub')}</p>
      <nav aria-label={t('guide.title')} className="mt-5 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a key={s} href={`#${s}`} className="inline-flex min-h-11 items-center rounded-full bg-turquoise px-4 font-semibold text-beige">{t(`guide.nav.${s}`)}</a>
        ))}
      </nav>

      <Section id="gates" title={t('gates.title')}>
        <GateMap />
      </Section>
      <Section id="map" title={t('map.title')}>
        <GateMap showFacilities />
        <span id="photos" />
      </Section>
      <Section id="access" title={t('access.title')}>
        <AccessibilityFlow />
      </Section>
      <Section id="schedule" title={t('schedule.title')}>
        <div className="overflow-hidden rounded-2xl bg-white">
          <table className="w-full text-start">
            <caption className="p-3 text-start text-sm">{t('schedule.mock')} {t('schedule.prayer')}</caption>
            <tbody>
              <tr className="bg-beige">
                <th scope="row" className="p-3 text-start">{t('schedule.honors')}</th>
                <td className="p-3" dir="ltr">{formatDate(SCHEDULE.honorsCeremony.start, locale, { dateStyle: 'medium' })} {time(SCHEDULE.honorsCeremony.start)}</td>
              </tr>
              {SLOT_ORDER.slice(1).map((slot) => (
                <tr key={slot}>
                  <th scope="row" className="p-3 text-start">{t(`slot.${slot}`)}</th>
                  <td className="p-3" dir="ltr">{time(SCHEDULE.ceremonyDay[slot].start)} – {time(SCHEDULE.ceremonyDay[slot].end)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section id="dress" title={t('dress.title')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-6">
            <h3 className="mb-2 text-xl font-bold">{t('dress.m.title')}</h3>
            <ul className="list-disc ps-5">{[1, 2, 3, 4].map((n) => <li key={n}>{t(`dress.m.${n}`)}</li>)}</ul>
          </div>
          <div className="rounded-2xl bg-white p-6">
            <h3 className="mb-2 text-xl font-bold">{t('dress.f.title')}</h3>
            <ul className="list-disc ps-5">{[1, 2, 3].map((n) => <li key={n}>{t(`dress.f.${n}`)}</li>)}</ul>
          </div>
        </div>
        <p className="mt-3 text-sm">{t('dress.avoid')}</p>
      </Section>
      <Section id="faq" title={t('faq.title')}>
        <div className="grid gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <details key={n} className="rounded-xl bg-white p-4">
              <summary className="min-h-11 cursor-pointer font-bold">{t(`faq.q${n}`)}</summary>
              <p className="mt-2">{t(`faq.a${n}`)}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 rounded-xl bg-turquoise p-6 text-beige">{t('faq.video')}</p>
      </Section>
    </main>
  )
}
