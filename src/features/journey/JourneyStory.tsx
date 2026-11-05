import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MatrixLoop } from '@/brand/matrix/MatrixLoop'
import { useLocale, useT, formatDate } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { STAGE_ORDER, SCHEDULE } from '@/time/schedule'
import { ButtonLink } from '@/ui/Button'
import { JourneyBar } from './JourneyBar'
import { useJourney } from './useJourney'
import { Walker } from './Walker'

gsap.registerPlugin(ScrollTrigger)

const N = STAGE_ORDER.length
const TAN5 = Math.tan((5 * Math.PI) / 180)

interface Geom {
  vw: number
  vh: number
  x0: number
  dx: number
  topBase: number
  dy: number
  floor: number
  bars: number
  gap: number
  w: [number, number]
  walker: number
  seal: number
}

const GEOM: Record<'wide' | 'tall', Geom> = {
  wide: { vw: 1000, vh: 580, x0: 30, dx: 110, topBase: 500, dy: 46, floor: 540, bars: 8, gap: 13, w: [10, 4], walker: 78, seal: 44 },
  tall: { vw: 420, vh: 640, x0: 14, dx: 43, topBase: 580, dy: 54, floor: 620, bars: 5, gap: 8, w: [6, 3], walker: 86, seal: 34 },
}

const stepTop = (g: Geom, i: number) => g.topBase - i * g.dy
const stepLeft = (g: Geom, i: number) => g.x0 + i * g.dx
const stepWidth = (g: Geom) => (g.bars - 1) * g.gap + g.w[0]
/** Feet position on step i, compensating the 5 degree skew the Matrix bars are drawn with. */
const anchor = (g: Geom, i: number) => ({
  x: stepLeft(g, i) + 10 + stepWidth(g) / 2 - TAN5 * stepTop(g, i),
  y: stepTop(g, i),
})

export function pointAt(g: Geom, s: number) {
  const f = Math.min(N - 1, Math.max(0, s * (N - 1)))
  const i = Math.min(N - 2, Math.floor(f))
  const a = anchor(g, i)
  const b = anchor(g, i + 1)
  const k = f - i
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}

/** Slows the last stretch so the hand-over of the certificate feels held. */
export function easeScroll(p: number): number {
  if (p <= 0.94) return (p / 0.94) * 0.985
  return 0.985 + ((p - 0.94) / 0.06) * 0.015
}

function useWide(): boolean {
  const q = '(min-width: 640px)'
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

function octagon(cx: number, cy: number, r: number): string {
  return Array.from({ length: 8 }, (_, k) => {
    const a = ((22.5 + 45 * k) * Math.PI) / 180
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

function Scene({ g, passedIdx, s }: { g: Geom; passedIdx: number; s: number }) {
  const t = useT()
  const { persona } = useSession()
  const j = useJourney()
  const here = pointAt(g, j.progress)
  const top = anchor(g, N - 1)
  const lights = Math.max(0, (s - 0.7) / 0.3)
  return (
    <svg viewBox={`0 0 ${g.vw} ${g.vh}`} className="relative h-full w-full" role="img" aria-label={t('journey.aria')} data-story-scene data-geom={g.vw}>
      <g data-floodlights opacity={lights}>
        {[-60, 0, 60].map((dxl, k) => (
          <polygon
            key={k}
            points={`${top.x + dxl - 14},0 ${top.x + dxl + 14},0 ${top.x + dxl * 3 + 90},${g.floor} ${top.x + dxl * 3 - 150},${g.floor}`}
            fill="#ece0c7"
            opacity={0.09 + k * 0.02}
          />
        ))}
      </g>
      <g transform="skewX(-5)">
        {Array.from({ length: N }, (_, i) =>
          Array.from({ length: g.bars }, (_, k) => (
            <rect
              key={`${i}-${k}`}
              x={stepLeft(g, i) + 10 + k * g.gap}
              y={stepTop(g, i)}
              width={k % 2 === 0 ? g.w[0] : g.w[1]}
              height={g.floor - stepTop(g, i)}
              fill={i <= passedIdx ? '#ece0c7' : '#009767'}
              data-step={i}
            />
          )),
        )}
      </g>
      <g data-stage-top>
        <polygon points={octagon(top.x + g.seal * 1.5, top.y - g.seal * 1.8, g.seal)} fill="#f0ba4f" />
        {[-2, -1, 0, 1, 2].map((k) => (
          <rect key={k} x={top.x + g.seal * 1.5 + k * (g.seal * 0.28) - 2} y={top.y - g.seal * 1.8 - g.seal * 0.55} width="4" height={g.seal * 1.1} fill="#115f66" />
        ))}
        <g transform={`translate(${top.x + g.walker * 0.4} ${top.y - 30})`}>
          <g data-certificate>
            <rect width="42" height="28" rx="3" fill="#1d5a3d" />
            <polygon points={octagon(21, 14, 8)} fill="#f0ba4f" opacity="0.9" />
          </g>
        </g>
      </g>
      {/* "You are here": the real, simulated time. */}
      <g data-scene-marker transform={`translate(${here.x} ${here.y - g.walker - 14})`}>
        <circle r="8" fill="#f0ba4f" />
        <circle r="8" fill="none" stroke="#f0ba4f" strokeWidth="3" className="marker-pulse" />
        <path d="M0 8v12" stroke="#f0ba4f" strokeWidth="3" />
        <text y="-16" textAnchor="middle" fontSize={g.vw > 500 ? 18 : 15} fontWeight="700" fill="#ece0c7">
          {t('journey.you-are-here')}
        </text>
      </g>
      <g data-walker-wrap>
        <foreignObject x={-g.walker * 0.35} y={-g.walker} width={g.walker * 0.7} height={g.walker + 4}>
          <Walker gender={persona.gender} college={persona.college} size={g.walker} />
        </foreignObject>
      </g>
    </svg>
  )
}

export function JourneyStory() {
  const t = useT()
  const locale = useLocale((st) => st.locale)
  const { persona } = useSession()
  const wide = useWide()
  const g = wide ? GEOM.wide : GEOM.tall
  const host = useRef<HTMLDivElement>(null)
  const [s, setS] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const stageIdx = Math.min(N - 1, Math.floor(s * (N - 1) + 1e-9))
  const passedIdx = Math.floor(s * (N - 1) - 0.0001)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const ctx = gsap.context(() => {
      const walker = el.querySelector<SVGGElement>('[data-walker-wrap]')
      const cert = el.querySelector<SVGGElement>('[data-certificate]')
      let lastQuant = -1
      const place = (sc: number) => {
        const pt = pointAt(g, sc)
        if (walker) gsap.set(walker, { attr: { transform: `translate(${pt.x} ${pt.y})` } })
        if (cert) gsap.set(cert, { y: sc > 0.97 ? -((sc - 0.97) / 0.03) * 12 : 0 })
      }
      place(0)
      ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
        onUpdate: (self) => {
          const sc = easeScroll(self.progress)
          place(sc)
          const q = Math.round(sc * 200)
          if (q !== lastQuant) {
            lastQuant = q
            setS(sc)
          }
          setRevealed(self.progress >= 0.995)
        },
      })
    }, el)
    return () => ctx.revert()
  }, [g])

  const night = Math.max(0, (s - 0.6) / 0.4) * 0.42

  return (
    <div ref={host} id="journey" data-journey-mode="story" className="relative h-[420dvh] bg-turquoise text-beige">
      <div className="sticky top-0 grid h-dvh grid-rows-[auto_1fr_auto] gap-2 overflow-hidden px-4 pb-4 pt-3">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-ink" style={{ opacity: night }} data-night />
        <div className="relative z-10">
          <JourneyBar variant="story" />
        </div>
        <div className="relative z-10 min-h-0">
          <Scene g={g} passedIdx={passedIdx} s={s} />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-3xl pb-1" aria-live="polite">
          <p className="text-sm opacity-80">{t('journey.scene', { n: stageIdx + 1 })}</p>
          <h2 className="text-2xl font-black sm:text-3xl" data-story-stage={STAGE_ORDER[stageIdx]}>
            {t(`stage.${STAGE_ORDER[stageIdx]}`)}
          </h2>
          <p className="text-base">{t(`stage.${STAGE_ORDER[stageIdx]}.note`)}</p>
        </div>

        <div
          data-reveal={revealed ? 'on' : 'off'}
          aria-hidden={!revealed}
          className="absolute inset-0 z-20 grid place-items-center overflow-hidden bg-yellow text-turquoise transition-[clip-path] duration-700 ease-[var(--ease-in-out-strong)] [clip-path:inset(0_0_100%_0)] data-[reveal=on]:[clip-path:inset(0)] data-[reveal=off]:pointer-events-none"
        >
          <MatrixLoop id="completion" background="yellow" stripes="turquoise" className="absolute inset-0 h-full w-full" />
          <div className="relative mx-4 max-w-xl bg-yellow px-8 py-7 text-center [transform:skewX(-5deg)]">
            <div className="[transform:skewX(5deg)]">
              <h2 className="text-balance text-5xl font-black sm:text-7xl">{t('journey.reveal.title')}</h2>
              <p className="mt-3 text-lg">{t('journey.reveal.note')}</p>
              <p className="mt-1 text-sm">{formatDate(SCHEDULE.ceremonyDay.ceremony.start, locale)}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {persona.role === 'graduate' && (
                  <ButtonLink to="/me" variant="secondary" size="lg" tabIndex={revealed ? 0 : -1}>{t('journey.reveal.grad')}</ButtonLink>
                )}
                <ButtonLink to="/guide" variant="ghost" size="lg" tabIndex={revealed ? 0 : -1}>{t('journey.reveal.guest')}</ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
