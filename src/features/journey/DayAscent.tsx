import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import clsx from 'clsx'
import { MatrixLoop } from '@/brand/matrix/MatrixLoop'
import { useLocale, useT, formatDate } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { SCHEDULE, SLOT_ORDER, type DaySlot } from '@/time/schedule'
import { getSlotProgress } from '@/time/stageEngine'
import { useReducedMotion } from '@/ui/motionPrefs'
import { useJourney } from './useJourney'
import { Walker } from './Walker'

const LIGHTS: Record<DaySlot, number> = { morning: 0, arrival: 0.35, seated: 0.65, ceremony: 1, photos: 0.8 }
const NIGHT: Record<DaySlot, number> = { morning: 0, arrival: 0.08, seated: 0.2, ceremony: 0.32, photos: 0.22 }

/** The Journey Bar on ceremony day: the days collapse into one chip and the five hours of the day become the path. */
export function DayBar({ className }: { className?: string }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const reduced = useReducedMotion()
  const { persona } = useSession()
  const j = useJourney()
  const sp = getSlotProgress(j.now)
  const slotIdx = sp?.index ?? SLOT_ORDER.length - 1
  const p = sp ? sp.p : 1
  const pos = (slotIdx + p) / SLOT_ORDER.length
  const chip = useRef<HTMLDivElement>(null)
  const steps = useRef<HTMLDivElement>(null)

  // The zoom: days collapse to one chip while the hours open up.
  useLayoutEffect(() => {
    if (reduced || !chip.current || !steps.current) return
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'power3.inOut', duration: 1.1 } })
        .fromTo(chip.current, { flexBasis: '100%' }, { flexBasis: '24%' })
        .fromTo(steps.current, { flexGrow: 0, opacity: 0 }, { flexGrow: 1, opacity: 1 }, 0)
    })
    return () => ctx.revert()
  }, [reduced])

  const time = (ms: number) => formatDate(ms, locale, { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div
      data-day-bar
      data-slot={sp?.slot ?? 'photos'}
      data-progress={pos.toFixed(4)}
      role="progressbar"
      aria-label={t('day.aria')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos * 100)}
      className={clsx('flex items-end gap-3', className)}
    >
      <div ref={chip} data-journey-so-far className="flex min-h-14 items-center gap-2 self-stretch overflow-hidden rounded-xl bg-black/25 px-3 text-sm font-semibold [flex-basis:24%]">
        <span aria-hidden className="grid size-6 shrink-0 place-items-center bg-green font-black text-white [clip-path:polygon(25%_0,75%_0,100%_25%,100%_75%,75%_100%,25%_100%,0_75%,0_25%)]">✓</span>
        <span>{t('day.so-far')}</span>
      </div>
      <div ref={steps} className="relative flex-1 [flex-grow:1]">
        <div
          className="absolute bottom-10 -translate-x-1/2 rtl:translate-x-1/2"
          style={{ insetInlineStart: `${pos * 100}%`, transition: reduced ? 'none' : 'inset-inline-start 900ms var(--ease-out-strong)' }}
          data-day-walker
        >
          <div className={clsx(locale === 'ar' && '-scale-x-100')}>
            <Walker gender={persona.gender} college={persona.college} size={52} />
          </div>
          {sp?.slot === 'photos' && <span aria-hidden className="absolute -bottom-1 start-full ms-1 block h-5 w-7 rounded-sm bg-[#1d5a3d] outline outline-2 outline-yellow" data-certificate-held />}
        </div>
        <div className="flex gap-1.5">
          {SLOT_ORDER.map((slot, i) => {
            const state = i < slotIdx || !sp ? 'done' : i === slotIdx ? 'current' : 'upcoming'
            const w = SCHEDULE.ceremonyDay[slot]
            return (
              <div key={slot} data-step={slot} data-state={state} className="min-w-0 flex-1">
                <div className="relative h-3 -skew-x-[5deg] overflow-hidden rounded-sm bg-black/25">
                  <div
                    className="absolute inset-y-0 start-0 bg-yellow"
                    style={{ width: state === 'done' ? '100%' : state === 'current' ? `${p * 100}%` : '0%', transition: reduced ? 'none' : 'width 700ms var(--ease-out-strong)' }}
                  />
                </div>
                <div className={clsx('mt-1 truncate text-xs sm:text-sm', state === 'current' ? 'font-black' : 'opacity-80')}>{t(`slot.${slot}`)}</div>
                <div className="hidden text-xs opacity-70 sm:block" dir="ltr">{time(w.start)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function DayAscent() {
  const t = useT()
  const j = useJourney()
  const reduced = useReducedMotion()
  const sp = getSlotProgress(j.now)
  const slot = sp?.slot ?? 'photos'
  return (
    <section id="journey" data-journey-mode="ascent" data-day-ascent data-slot={slot} className="relative overflow-hidden bg-turquoise text-beige">
      <MatrixLoop id="ascent" background="turquoise" stripes="yellow" intensity={j.dayProgress} className="absolute inset-0 h-full w-full" />
      <div aria-hidden className="absolute inset-0 bg-black" style={{ opacity: NIGHT[slot], transition: reduced ? 'none' : 'opacity 1200ms ease' }} data-night />
      <div aria-hidden className="pointer-events-none absolute inset-0" data-floodlights style={{ opacity: LIGHTS[slot], transition: reduced ? 'none' : 'opacity 1200ms ease' }}>
        {['12%', '42%', '72%'].map((left, k) => (
          <div key={k} className="absolute top-0 h-full w-[16%] bg-beige [transform:skewX(-5deg)]" style={{ left, opacity: 0.1 + k * 0.02 }} />
        ))}
      </div>
      <div className="relative mx-auto max-w-5xl px-4 py-14">
        <div className="bg-turquoise px-5 py-7 [transform:skewX(-5deg)] sm:px-8">
          <div className="[transform:skewX(5deg)]">
            {slot === 'ceremony' && (
              <p className="mb-4 inline-flex items-center gap-2 bg-yellow px-3 py-1 text-sm font-black text-turquoise" data-live>
                <span aria-hidden className="size-2 rounded-full bg-turquoise" />
                {t('day.live')}
              </p>
            )}
            <DayBar />
            <div className="mt-8" aria-live="polite">
              <h2 className="text-4xl font-black sm:text-5xl" data-story-stage={slot}>{t(`slot.${slot}`)}</h2>
              <p className="mt-2 max-w-xl text-lg">{t(`slot.${slot}.note`)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
