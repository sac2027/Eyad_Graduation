import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLocale, useT, formatDate, formatNumber } from '@/i18n'
import { SCHEDULE, SLOT_ORDER } from '@/time/schedule'
import { PageHero } from '@/ui/PageHero'
import { Reveal } from '@/ui/Reveal'
import { AccessibilityFlow } from './AccessibilityFlow'
import { GateMap } from './GateMap'

const SECTIONS = ['gates', 'map', 'access', 'schedule', 'dress', 'faq'] as const
type SectionId = (typeof SECTIONS)[number]

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  const locale = useLocale((s) => s.locale)
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 py-9">
      <Reveal>
        <h2 id={`${id}-h`} className="mb-5 flex items-baseline gap-3 text-3xl font-black text-turquoise sm:text-4xl">
          <span aria-hidden className="font-display text-xl font-black text-turquoise/70">{formatNumber(n, locale).padStart(2, formatNumber(0, locale))}</span>
          {title}
        </h2>
        {children}
      </Reveal>
    </section>
  )
}

/** Which section the reader is in, for the pills that follow them down the page. */
function useCurrentSection(): SectionId {
  const [current, setCurrent] = useState<SectionId>('gates')
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(e.target.id as SectionId)
      },
      // A thin band a third of the way down the screen: the section crossing it is the one being read.
      { rootMargin: '-30% 0px -65% 0px' },
    )
    for (const id of SECTIONS) {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [])
  return current
}

export function Guide() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const { hash } = useLocation()
  const current = useCurrentSection()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])
  const time = (ms: number) => formatDate(ms, locale, { hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <main data-guide>
      <PageHero seed={12} eyebrow={t('guide.eyebrow')} title={t('guide.title')} sub={t('guide.sub')}>
        <Link to="/stadium" className="text-link text-yellow" data-stadium-link>{t('stadium.link.see')} <span className="go" aria-hidden>→</span></Link>
      </PageHero>
      <nav aria-label={t('guide.title')} className="pill-nav">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2">
          {SECTIONS.map((s) => (
            <a key={s} href={`#${s}`} className="pill" aria-current={current === s ? 'true' : undefined}>{t(`guide.nav.${s}`)}</a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-4 pb-14">
        <Section id="gates" n={1} title={t('gates.title')}>
          <GateMap />
        </Section>
        <Section id="map" n={2} title={t('map.title')}>
          <GateMap showFacilities />
          <span id="photos" />
        </Section>
        <Section id="access" n={3} title={t('access.title')}>
          <AccessibilityFlow />
        </Section>
        <Section id="schedule" n={4} title={t('schedule.title')}>
          <div className="panel p-5 sm:p-6">
            <p className="mb-4 text-sm text-ink/75">{t('schedule.mock')} {t('schedule.prayer')}</p>
            <ol className="timeline grid gap-1">
              <li className="relative grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 rounded-xl bg-yellow/25 py-3 pe-4">
                <span aria-hidden className="relative z-10 mx-auto size-4 rounded-full bg-yellow ring-4 ring-white" />
                <span className="font-bold">{t('schedule.honors')}</span>
                <span className="font-display font-black tabular-nums text-turquoise" dir="ltr">{formatDate(SCHEDULE.honorsCeremony.start, locale, { dateStyle: 'medium' })} {time(SCHEDULE.honorsCeremony.start)}</span>
              </li>
              {SLOT_ORDER.slice(1).map((slot) => (
                <li key={slot} className="relative grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 py-3 pe-4">
                  <span aria-hidden className="relative z-10 mx-auto size-3 rounded-full bg-turquoise ring-4 ring-white" />
                  <span className="font-bold">{t(`slot.${slot}`)}</span>
                  <span className="font-display font-black tabular-nums text-turquoise" dir="ltr">{time(SCHEDULE.ceremonyDay[slot].start)} – {time(SCHEDULE.ceremonyDay[slot].end)}</span>
                </li>
              ))}
            </ol>
          </div>
        </Section>
        <Section id="dress" n={5} title={t('dress.title')}>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['m', 'f'] as const).map((g) => (
              <div key={g} className="panel p-6">
                <h3 className="mb-3 text-xl font-bold text-turquoise">{t(`dress.${g}.title`)}</h3>
                <ul className="grid gap-2">
                  {(g === 'm' ? [1, 2, 3, 4] : [1, 2, 3]).map((n) => (
                    <li key={n} className="flex items-start gap-3">
                      <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" className="mt-0.5 flex-none rounded-full bg-green/20 p-1 text-turquoise">
                        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {t(`dress.${g}.${n}`)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="panel-quiet mt-4 p-4 text-sm">{t('dress.avoid')}</p>
        </Section>
        <Section id="faq" n={6} title={t('faq.title')}>
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <details key={n} className="faq panel px-5 py-2">
                <summary>{t(`faq.q${n}`)}</summary>
                <p className="pb-3 pt-1 text-ink/85">{t(`faq.a${n}`)}</p>
              </details>
            ))}
          </div>
          <p className="mt-5 rounded-[1.25rem] bg-turquoise p-6 text-beige">{t('faq.video')}</p>
        </Section>
      </div>
    </main>
  )
}
