import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { celebrate } from '@/features/celebrate/celebrate'
import { useDemoFlags } from '@/features/demo-console/flags'
import { shouldPlayCompletion } from '@/features/journey/completion'
import { Certificate } from '@/features/stadium/Certificate'
import { useLocale, useT } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { useNow } from '@/time/clockStore'
import { useReducedMotion } from '@/ui/motionPrefs'

const SHOW_MS = 5200

/** Watches the clock; when time moves forward across 21:30 on ceremony night, the certificate moment plays once. */
export function CertificateMomentHost() {
  const now = useNow(1000)
  const reduced = useReducedMotion()
  const lowEnd = useDemoFlags((s) => s.lowEnd)
  const prev = useRef(now)
  const [playing, setPlaying] = useState(false)
  if (prev.current !== now) {
    const crossed = shouldPlayCompletion(prev.current, now)
    prev.current = now
    if (crossed && !reduced && !lowEnd && !playing) setPlaying(true)
  }
  return playing ? <CertificateMoment onDone={() => setPlaying(false)} /> : null
}

function CertificateMoment({ onDone }: { onDone: () => void }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const { persona } = useSession()
  const root = useRef<HTMLDivElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const isGrad = persona.role === 'graduate'
  const line = isGrad ? t(`landing.done.named.${persona.gender}`, { name: persona.name[locale] }) : t('landing.done.anon')

  useEffect(() => {
    celebrate('certificate')
    const el = root.current!
    const tl = gsap.timeline()
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4 })
      .fromTo(el.querySelector('[data-moment-cert]'), { scale: 0.4, rotate: -8, y: 60 }, { scale: 1, rotate: 0, y: 0, duration: 1.1, ease: 'back.out(1.6)' }, 0.1)
      .fromTo(el.querySelector('[data-moment-line]'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, 0.8)
    const out = window.setTimeout(() => {
      gsap.to(el, { opacity: 0, duration: 0.5, onComplete: () => doneRef.current() })
    }, SHOW_MS)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && doneRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      tl.kill()
      window.clearTimeout(out)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="false"
      aria-label={t('cert.label')}
      onClick={() => doneRef.current()}
      className="fixed inset-0 z-40 grid cursor-pointer place-items-center bg-ink/70 p-6 text-center text-beige"
      data-certificate-moment
    >
      <div className="grid justify-items-center gap-5">
        <div data-moment-cert className="drop-shadow-[0_0_40px_rgba(240,186,79,0.55)]">
          <Certificate size={Math.min(360, window.innerWidth * 0.78)} />
        </div>
        <p data-moment-line className="max-w-2xl text-balance font-display text-[clamp(1.4rem,4vw,2.8rem)] font-black leading-tight">{line}</p>
      </div>
    </div>
  )
}
