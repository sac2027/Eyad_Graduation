import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { gsap } from 'gsap'
import { MatrixLoop } from '@/brand/matrix/MatrixLoop'
import { useT } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { Button } from '@/ui/Button'
import { octagonSpans } from './completion'
import { Walker } from './Walker'

const BARS = 34

function rng(seed: number) {
  let a = seed
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296
    return a / 4294967296
  }
}

/** About six seconds: the walker takes the certificate, the Matrix bars settle into the octagon seal, the bar completes. */
export function Completion({ onDone }: { onDone: () => void }) {
  const t = useT()
  const { persona } = useSession()
  const root = useRef<HTMLDivElement>(null)
  const spans = useMemo(() => octagonSpans(500, 235, 170, BARS), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const ctx = gsap.context(() => {
      const r = rng(57)
      const tl = gsap.timeline({ onComplete: onDone })
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' })
      tl.fromTo('[data-c-walker]', { x: 0 }, { x: 250, duration: 1.4, ease: 'power2.inOut' }, 0.5)
      tl.to('[data-c-folder]', { y: -34, scale: 1.15, transformOrigin: '50% 100%', duration: 0.6, ease: 'back.out(1.6)' }, 1.9)
      el.querySelectorAll<SVGRectElement>('[data-c-bar]').forEach((bar, i) => {
        const s = spans[i]
        tl.fromTo(
          bar,
          { attr: { y: 40 + r() * 380, height: 40 + r() * 260 } },
          { attr: { y: s.y, height: s.h }, duration: 1.3, ease: 'power3.out' },
          2.2 + i * 0.02,
        )
      })
      tl.fromTo('[data-c-text]', { opacity: 0, y: 24, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out' }, 4)
      tl.fromTo('[data-c-fill]', { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', duration: 0.9, ease: 'power3.inOut' }, 4.4)
      tl.to(el, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 5.8)
    }, el)
    return () => ctx.revert()
  }, [onDone, spans])

  return (
    <div ref={root} data-completion role="dialog" aria-label={t('completion.title')} className="fixed inset-0 z-[70] overflow-hidden bg-turquoise text-beige">
      <MatrixLoop id="ascent" background="turquoise" stripes="yellow" intensity={0.3} className="absolute inset-0 h-full w-full opacity-60" />
      <svg viewBox="0 0 1000 560" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g transform="skewX(-5)">
          {spans.map((s, i) => (
            <rect key={i} data-c-bar x={s.x + 26} y={s.y} width={(500 / BARS) * 0.55} height={s.h} fill={i % 7 === 3 ? '#ece0c7' : '#f0ba4f'} />
          ))}
        </g>
        <g transform="translate(120 470)">
          <g data-c-walker>
            <foreignObject x="-30" y="-100" width="70" height="104">
              <Walker gender={persona.gender} college={persona.college} size={100} />
            </foreignObject>
          </g>
        </g>
        <g transform="translate(440 458)">
          <g data-c-folder>
            <rect width="54" height="36" rx="3" fill="#1d5a3d" />
            <polygon points="27,8 34,13 34,23 27,28 20,28 13,23 13,13 20,8" fill="#f0ba4f" />
          </g>
        </g>
      </svg>
      <div data-c-text className="absolute inset-x-0 bottom-[16%] mx-auto w-fit max-w-[92vw] bg-turquoise px-8 py-5 text-center [transform:skewX(-5deg)]">
        <div className="[transform:skewX(5deg)]">
          <h2 className="text-balance text-4xl font-black sm:text-6xl">{t('completion.title')}</h2>
          <p className="mt-1 text-lg">{t('completion.note')}</p>
        </div>
      </div>
      <div className="absolute inset-x-6 bottom-8 h-3 overflow-hidden rounded-full bg-black/30" aria-hidden>
        <div data-c-fill className="h-full w-full origin-left bg-yellow" />
      </div>
      <div className="absolute end-4 top-4">
        <Button variant="gold" onClick={onDone}>{t("completion.skip")}</Button>
      </div>
    </div>
  )
}
