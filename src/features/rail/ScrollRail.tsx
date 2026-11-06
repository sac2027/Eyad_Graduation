import { useCallback, useEffect, useRef, useState } from 'react'
import { celebrate } from '@/features/celebrate/celebrate'
import { useDemoFlags } from '@/features/demo-console/flags'
import { Certificate } from '@/features/stadium/Certificate'
import { Graduate } from '@/features/stadium/figure/Graduate'
import type { Outfit } from '@/features/stadium/figure/frames'
import { formatNumber, useLocale, useT } from '@/i18n'
import { checkpointStates, type CheckpointState } from '@/time/pathEngine'
import { STAGE_ORDER, type StageId } from '@/time/schedule'
import { useReducedMotion } from '@/ui/motionPrefs'
import { railProgress, scrollForProgress } from './railMath'
import { RailSheet } from './RailSheet'

const TOP = 50
const BOTTOM = 56
const LAMP: Record<CheckpointState, string> = {
  passed: 'bg-green',
  current: 'bg-yellow',
  next: 'bg-ink outline outline-2 outline-beige',
  future: 'bg-gray/50',
  late: 'bg-error',
}

interface Props {
  now: number
  outfit: Outfit
  late?: Partial<Record<StageId, boolean>>
}

function measure(): number[] {
  return STAGE_ORDER.map((id) => {
    const el = document.getElementById(`step-${id}`)
    return el ? el.getBoundingClientRect().top + window.scrollY : 0
  })
}

const at = (i: number) => `calc(${TOP}px + (100% - ${TOP + BOTTOM}px) * ${i / 8})`

/**
 * The page's scrollbar, drawn as the same aisle: the same nine posts in their time-based colours, and the
 * same graduate, who walks down as the reader scrolls and takes the certificate at the last step.
 */
export function ScrollRail({ now, outfit, late }: Props) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const reduced = useReducedMotion()
  const lowEnd = useDemoFlags((s) => s.lowEnd)
  const states = checkpointStates(now, { late })
  const track = useRef<HTMLDivElement>(null)
  const tops = useRef<number[]>([])
  const [p, setP] = useState(0)
  const [beforeFirst, setBeforeFirst] = useState(true)
  const [sheet, setSheet] = useState(false)
  const drag = useRef<{ id: number; startY: number; moved: boolean } | null>(null)
  const reachedEnd = useRef(false)

  const update = useCallback(() => {
    const vh = window.innerHeight
    if (tops.current.length === 0 || tops.current.every((x) => x === 0)) tops.current = measure()
    setP(railProgress(window.scrollY, tops.current, vh))
    setBeforeFirst(window.scrollY + vh / 2 < tops.current[0])
  }, [])

  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    const remeasure = () => {
      tops.current = measure()
      update()
    }
    remeasure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(remeasure) : null
    ro?.observe(document.body)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', remeasure)
    document.documentElement.classList.add('hide-native-scrollbar')
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', remeasure)
      document.documentElement.classList.remove('hide-native-scrollbar')
    }
  }, [update])

  const atEnd = p >= 0.999
  useEffect(() => {
    if (atEnd && !reachedEnd.current) celebrate('certificate-small')
    reachedEnd.current = atEnd
  }, [atEnd])

  const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth'
  const goTo = (i: number) => {
    if (i < 0) return window.scrollTo({ top: 0, behavior })
    document.getElementById(`step-${STAGE_ORDER[Math.min(8, i)]}`)?.scrollIntoView({ block: 'start', behavior })
  }
  const reading = beforeFirst ? -1 : Math.round(p * 8)

  const progressAt = (clientY: number) => {
    const r = track.current!.getBoundingClientRect()
    return (clientY - r.top - TOP) / (r.height - TOP - BOTTOM)
  }
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { id: e.pointerId, startY: e.clientY, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (Math.abs(e.clientY - d.startY) > 4) d.moved = true
    if (d.moved) window.scrollTo(0, scrollForProgress(progressAt(e.clientY), tops.current, window.innerHeight))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d || d.moved) return
    if (window.innerWidth < 768) return setSheet(true)
    // A click on a post jumps to its section; anywhere else on the rail jumps to that point.
    const post = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-rail-post]')
    if (post) goTo(Number(post.dataset.index))
    else window.scrollTo({ top: scrollForProgress(progressAt(e.clientY), tops.current, window.innerHeight), behavior })
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => goTo(reading + 1),
      ArrowRight: () => goTo(reading + 1),
      ArrowUp: () => goTo(reading - 1),
      ArrowLeft: () => goTo(reading - 1),
      Home: () => goTo(-1),
      End: () => goTo(8),
    }
    const fn = keys[e.key]
    if (!fn) return
    e.preventDefault()
    fn()
  }

  const valueText = reading < 0 ? t('rail.top') : `${formatNumber(reading + 1, locale)}. ${t(`stage.${STAGE_ORDER[reading]}`)}`
  const calm = reduced || lowEnd

  return (
    <>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={t('rail.label')}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p * 100)}
        aria-valuetext={valueText}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="fixed bottom-2 right-0 top-[4.25rem] z-30 w-7 touch-none select-none rounded-s-xl bg-ink/90 outline-offset-2 md:w-16"
        style={{ direction: 'ltr' }}
        data-rail
        data-rail-progress={p.toFixed(3)}
      >
        {/* the aisle */}
        <span aria-hidden className="absolute left-1/2 w-1.5 -translate-x-1/2 bg-sand md:w-2.5" style={{ top: TOP, bottom: BOTTOM - 8 }} />
        <span aria-hidden className="absolute left-1/2 w-1.5 -translate-x-1/2 bg-yellow/60 md:w-2.5" style={{ top: TOP, height: `calc((100% - ${TOP + BOTTOM}px) * ${p})` }} />
        {STAGE_ORDER.map((id, i) => (
          <span
            key={id}
            title={t(`stage.${id}`)}
            data-rail-post={id}
            data-index={i}
            data-state={states[id]}
            data-reading={reading === i || undefined}
            className="group absolute left-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center md:size-7"
            style={{ top: at(i) }}
          >
            <span className={`block size-2.5 rounded-full md:size-3.5 ${LAMP[states[id]]} ${reading === i ? 'ring-2 ring-beige ring-offset-2 ring-offset-ink' : ''}`} />
            <span className="pointer-events-none absolute right-full me-2 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-semibold text-beige md:group-hover:block md:text-sm" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
              {t(`stage.${id}`)}
            </span>
          </span>
        ))}
        {/* podium and certificate */}
        <div aria-hidden className="absolute bottom-1 left-1/2 -translate-x-1/2">
          {!atEnd && <Certificate size={window.innerWidth < 768 ? 22 : 44} />}
        </div>
        {/* the graduate */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-[85%]"
          style={{ top: atEnd ? `calc(100% - ${BOTTOM - 14}px)` : at(p * 8) }}
          data-rail-figure
          data-mode={atEnd ? 'hold-certificate' : calm ? 'still' : 'walk'}
        >
          <Graduate outfit={outfit} height={window.innerWidth < 768 ? 34 : 56} mode={atEnd ? 'hold-certificate' : calm ? 'still' : 'walk'} aura={atEnd ? 'bright' : 'soft'} />
          {atEnd && <span className="rail-burst" data-rail-burst />}
        </div>
      </div>
      {sheet && <RailSheet states={states} reading={reading} onPick={(i) => { setSheet(false); goTo(i) }} onClose={() => setSheet(false)} />}
    </>
  )
}
