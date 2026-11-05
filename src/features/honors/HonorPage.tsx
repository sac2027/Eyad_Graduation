import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { MatrixLoop } from '@/brand/matrix/MatrixLoop'
import { honorTier } from '@/domain/honorTier'
import { COLLEGE_COLORS, type HonorTier } from '@/domain/types'
import { useDemoFlags } from '@/features/demo-console/flags'
import { useLocale, useT, genderForm } from '@/i18n'
import { useSession, type Persona } from '@/session/sessionStore'
import { Button } from '@/ui/Button'
import { useReducedMotion } from '@/ui/motionPrefs'
import { toast } from '@/ui/toast'
import { AwardFallback } from './AwardFallback'
import { detectCapability, probeEnv } from './capability'
import { HonorDetails } from './HonorDetails'
import type { Beat } from './AwardScene'

const AwardScene = lazy(() => import('./AwardScene'))

function tierOf(p: Persona): HonorTier | null {
  if (p.role !== 'graduate') return null
  try {
    return honorTier(p.gpa)
  } catch {
    return null
  }
}

const RANK: Record<'playing' | Beat, number> = { playing: 0, message: 1, cta: 2, end: 3 }

export default function HonorPage() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const { persona } = useSession()
  const lowEnd = useDemoFlags((s) => s.lowEnd)
  const reduced = useReducedMotion()
  const tier = tierOf(persona)
  const cap = useMemo(() => detectCapability(probeEnv(lowEnd)), [lowEnd])
  const [beat, setBeat] = useState<'playing' | Beat>('playing')
  const [skipToken, setSkipToken] = useState(0)
  const [replayToken, setReplayToken] = useState(0)
  const [away, setAway] = useState(false)
  const hero = useRef<HTMLElement>(null)

  const onBeat = (b: Beat) => setBeat((cur) => (RANK[b] > RANK[cur] ? b : cur))

  // The 2D version plays the same beats on a timer.
  useEffect(() => {
    if (!tier || cap === 'full') return
    setBeat('playing')
    if (reduced) {
      setBeat('end')
      return
    }
    const ids = [setTimeout(() => onBeat('message'), 1600), setTimeout(() => onBeat('cta'), 2600), setTimeout(() => onBeat('end'), 3200)]
    return () => ids.forEach(clearTimeout)
  }, [tier, cap, reduced, replayToken])

  useEffect(() => {
    const el = hero.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setAway(!e.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [tier])

  if (!tier) {
    return (
      <main data-honor-page data-tier="none">
        <HonorDetails standalone />
      </main>
    )
  }

  const message = t(`honors.msg.${tier}.${persona.gender}`, { name: persona.name[locale] })
  const shown = RANK[beat] >= 1
  const ctaShown = RANK[beat] >= 2
  const goDetails = () => document.getElementById('details')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })

  return (
    <main data-honor-page data-tier={tier} data-capability={cap}>
      <section ref={hero} data-honor-hero data-beat={beat} aria-label={t('honors.aria', { tier: t(`honors.tier.${tier}`) })} className="relative isolate h-[calc(100dvh-9rem)] min-h-[36rem] overflow-hidden bg-turquoise text-beige sm:h-[calc(100dvh-3.5rem)]">
        <MatrixLoop id="honors" background="turquoise" stripes="yellow" intensity={0.3} className="absolute inset-0 -z-20 h-full w-full" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-black/60" />
        <div className="absolute inset-x-0 top-0 bottom-[32%] sm:bottom-[27%]">
          {cap === 'full' ? (
            <Suspense fallback={<div className="grid h-full place-items-center">…</div>}>
              <AwardScene
                tier={tier}
                name={persona.name[locale]}
                locale={locale}
                trim={COLLEGE_COLORS[persona.college]}
                instant={reduced}
                skipToken={skipToken}
                replayToken={replayToken}
                onBeat={onBeat}
              />
            </Suspense>
          ) : (
            <div className="grid h-full place-items-center pt-6">
              <AwardFallback tier={tier} name={persona.name[locale]} animate={!reduced} />
            </div>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 px-4 pb-6">
          <div className="mx-auto max-w-3xl px-6 py-5 transition-[background-color,opacity] duration-500 [transform:skewX(-5deg)]" style={{ backgroundColor: shown ? 'var(--color-turquoise)' : 'transparent' }}>
            <div className="[transform:skewX(5deg)]" aria-live="polite">
              <div className="transition-[opacity,transform] duration-500 ease-[var(--ease-out-strong)]" style={{ opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(12px)' }} data-honor-copy={shown ? 'on' : 'off'}>
                <p className="mb-1 inline-block bg-yellow px-3 py-0.5 text-sm font-black text-turquoise" data-honor-tier>{t(`honors.tier.${tier}`)}</p>
                <h1 className="break-words text-balance text-3xl font-black [overflow-wrap:anywhere] sm:text-5xl" data-honor-name>{persona.name[locale]}</h1>
                <p className="mt-1 text-base sm:text-lg" data-honor-message>{genderForm(locale, persona.gender, { m: message, f: message })}</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 transition-opacity duration-500" style={{ opacity: ctaShown ? 1 : 0, pointerEvents: ctaShown ? 'auto' : 'none' }} data-honor-cta={ctaShown ? 'on' : 'off'}>
                <Button variant="gold" size="lg" onClick={goDetails} tabIndex={ctaShown ? 0 : -1}>{t('honors.cta')}</Button>
                <Button variant="ghost" onClick={() => toast.info(t('honors.shared'))} className="text-beige outline-beige" tabIndex={ctaShown ? 0 : -1}>{t('honors.share')}</Button>
              </div>
            </div>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-xs opacity-80">{t('honors.private')}</p>
        </div>

        <div className="absolute end-4 top-4 flex gap-2">
          {beat !== 'end' ? (
            <Button variant="gold" onClick={() => setSkipToken((n) => n + 1)} data-honor-skip>{t('honors.skip')}</Button>
          ) : (
            <Button variant="gold" onClick={() => { setBeat('playing'); setReplayToken((n) => n + 1) }} data-honor-replay>{t('honors.replay')}</Button>
          )}
        </div>
      </section>

      <div data-mini-award aria-hidden className="fixed bottom-4 end-4 z-40 size-16 rounded-full bg-turquoise p-2 outline outline-2 outline-yellow transition-[opacity,transform] duration-300 ease-[var(--ease-out-strong)]" style={{ opacity: away ? 1 : 0, transform: away ? 'scale(1)' : 'scale(0.9)', pointerEvents: 'none' }}>
        <AwardFallback tier={tier} name="" animate={false} />
      </div>

      <HonorDetails />
    </main>
  )
}
