import { useMemo, type ReactNode } from 'react'
import { useDemoFlags } from '@/features/demo-console/flags'
import { useReducedMotion } from '@/ui/motionPrefs'
import { FigureLayer } from './FigureLayer'
import './stadium.css'
import { formatDate, formatNumber, useLocale, useT } from '@/i18n'
import { checkpointStates, pathProgress, type CheckpointState } from '@/time/pathEngine'
import { SCHEDULE, STAGE_ORDER, type StageId } from '@/time/schedule'
import { daysSinceCeremony } from '@/features/journey/completion'
import { daysSinceLabel } from '@/i18n/plurals'
import { countdownParts } from './countdown'
import type { Outfit } from './figure/frames'
import { figureAt, geometryFor, type SceneGeom } from './geometry'
import { Aisle, certHeight, certWidth, ChairBlocks, GoldSparkles, Posts, Sky, Skyline, StageLayer, Stands, postAt } from './layers'
import { sceneState } from './sceneState'
import { useWideAspect } from './useWideAspect'

interface Props {
  now: number
  outfit: Outfit
  mode: 'still' | 'live'
  dateStatus?: 'confirmed' | 'tbc'
  late?: Partial<Record<StageId, boolean>>
  onCheckpoint?: (id: StageId) => void
  /** The opening line and ways in, placed in the sky above the stadium. */
  headline?: ReactNode
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`

/** The landing journey: a night stadium, the aisle to the stage, nine checkpoints and the graduate, set by time only. */
export function StadiumScene({ now, outfit, mode, dateStatus = 'confirmed', late, onCheckpoint, headline }: Props) {
  const wide = useWideAspect()
  const g = geometryFor(wide ? 'wide' : 'tall')
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const s = sceneState(now)
  const states = checkpointStates(now, { late })
  const ordered = STAGE_ORDER.map((id) => states[id])
  const progress = dateStatus === 'tbc' ? 0 : pathProgress(now)
  const reduced = useReducedMotion()
  const lowEnd = useDemoFlags((f) => f.lowEnd)
  const calm = reduced || lowEnd
  const at = s.figure === 'holding' ? figureAt(1, g) : figureAt(progress, g)
  // Holding the certificate he steps forward into the light: drawn larger so the moment reads.
  const fig = s.figure === 'holding' ? { ...at, scale: at.scale * 1.7 } : at
  const figMode = s.figure === 'holding' ? 'hold-certificate' : mode === 'live' && !calm ? 'walk' : 'still'
  const current = ordered.lastIndexOf('current')
  const litTo = current >= 0 ? g.aisle[Math.min(current, 5)].y : null
  const figRow = Math.round(at.y)
  // The artwork only changes when the scene state does, not every second.
  const sKey = JSON.stringify(s)
  const statesKey = ordered.join()
  const back = useMemo(
    () => (
      <>
        <Sky g={g} />
        <Skyline g={g} />
        <Stands g={g} s={s} />
        <StageLayer g={g} s={s} showCertificate={s.figure !== 'holding'} />
        {s.goldAccents && <GoldSparkles g={g} />}
        <ChairBlocks g={g} s={s} />
        <Aisle g={g} litTo={litTo} />
        <Posts g={g} states={ordered} only={(i) => postAt(g, i).y <= at.y} />
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wide, sKey, statesKey, litTo, figRow],
  )
  const front = useMemo(
    () => <Posts g={g} states={ordered} only={(i) => postAt(g, i).y > at.y} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wide, statesKey, figRow],
  )

  return (
    <div
      className="relative mx-auto w-full"
      style={{ aspectRatio: `${g.w} / ${g.h}`, maxHeight: wide ? 'calc(100dvh - 9.5rem)' : undefined, maxWidth: wide ? `calc((100dvh - 9.5rem) * ${g.w / g.h})` : undefined }}
      data-scene={wide ? 'wide' : 'tall'}
      data-figure={s.figure}
      data-progress={progress.toFixed(3)}
      data-beams={s.beams}
      role="group"
      aria-label={t('scene.label', { n: formatNumber(s.lampsLit, locale) })}
    >
      <svg viewBox={`0 0 ${g.w} ${g.h}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {back}
        <FigureLayer target={fig} figureH={g.figureH} outfit={outfit} mode={figMode} aura={s.figure === 'holding' ? 'bright' : 'soft'} instant={calm} />
        {s.figure === 'holding' && <circle cx={at.x} cy={at.y - 8} r={g.figureH * at.scale * 1.5} fill="#F0BA4F" opacity="0.12" />}
        {front}
      </svg>

      <Screens g={g} now={now} tbc={dateStatus === 'tbc'} />

      {/* the certificate on the podium, announced for screen readers (its visible name is checkpoint 9's label) */}
      {s.figure !== 'holding' && (
        <div
          role="img"
          aria-label={t('cert.label')}
          className="absolute -translate-x-1/2"
          style={{ left: pct(g.podium.x, g.w), top: pct(g.podium.y - 34 - certHeight(g), g.h), width: pct(certWidth(g), g.w), height: pct(certHeight(g), g.h) }}
        />
      )}

      {STAGE_ORDER.map((id, i) => (
        <CheckpointLabel key={id} g={g} i={i} id={id} state={ordered[i]} wide={wide} onPick={onCheckpoint} />
      ))}

      {headline && (
        <div
          className="absolute"
          style={{ left: pct(g.headline.x, g.w), top: pct(g.headline.y, g.h), width: pct(g.headline.w, g.w), height: pct(g.headline.h, g.h) }}
        >
          {headline}
        </div>
      )}
    </div>
  )
}

function Screens({ g, now, tbc }: { g: SceneGeom; now: number; tbc: boolean }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const c = countdownParts(now, SCHEDULE.afterglowStart)
  const since = daysSinceCeremony(now)
  const two = (n: number) => String(n).padStart(2, '0')
  const [l, r] = g.screens
  const box = (rect: typeof l) => ({ left: pct(rect.x, g.w), top: pct(rect.y, g.h), width: pct(rect.w, g.w), height: pct(rect.h, g.h) })
  return (
    <>
      <div className="absolute grid place-content-center gap-0.5 px-1 text-center text-beige" style={box(l)} data-screen="left">
        {tbc ? (
          <span className="px-2 text-[10px] font-bold leading-tight sm:text-sm">{t('count.tbc')}</span>
        ) : c.done ? (
          <span className="text-balance px-2 font-display text-[clamp(0.85rem,2vw,1.6rem)] font-black leading-tight text-yellow" data-screen-congrats>{t('screens.congrats')}</span>
        ) : (
          <>
            <span className="font-display text-[clamp(1.3rem,3.6vw,3rem)] font-black leading-none tabular-nums text-yellow">
              {formatNumber(c.days, locale)} <span className="text-[0.45em] font-bold text-beige">{t('screens.days')}</span>
            </span>
            <span className="text-balance text-[9px] font-semibold leading-tight sm:text-xs" data-screens-label>{t('screens.until')}</span>
          </>
        )}
      </div>
      <div className="absolute grid place-content-center gap-0.5 text-center text-beige" style={box(r)} data-screen="right">
        {!tbc && c.done && <span className="text-balance px-2 text-[10px] font-bold leading-tight sm:text-base">{daysSinceLabel(locale, since)}</span>}
        {!tbc && !c.done && (
          <>
            <span dir="ltr" className="font-display text-[clamp(1rem,2.8vw,2.3rem)] font-black leading-none tabular-nums text-yellow">
              {two(c.h)}:{two(c.m)}:{two(c.s)}
            </span>
            <span className="text-[9px] font-semibold sm:text-xs">{t('screens.hms')}</span>
          </>
        )}
      </div>
    </>
  )
}

const BADGE: Record<CheckpointState, string> = {
  passed: 'bg-green text-black',
  current: 'bg-yellow text-black ring-4 ring-yellow/40',
  next: 'bg-ink text-beige outline outline-2 outline-beige',
  future: 'bg-ink text-gray outline outline-2 outline-gray/50',
  late: 'bg-error text-black',
}

function CheckpointLabel({ g, i, id, state, wide, onPick }: { g: SceneGeom; i: number; id: StageId; state: CheckpointState; wide: boolean; onPick?: (id: StageId) => void }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const p = postAt(g, i)
  const podium = i === 8
  const top = podium ? p.y : i >= 6 ? p.y - 24 * p.scale - 10 : p.y - 120 * p.scale
  const side = p.side
  const w = SCHEDULE.stages[id]
  // On phones only the current step shows its name, as a pill above its lamp so it never runs off screen.
  // The podium's label sits above the certificate and names it.
  const above = podium || (!wide && state === 'current')
  // Stage checkpoints on phones open their pill below the lamp, clear of the countdown screens.
  const below = above && !podium && i >= 6
  const showName = wide || state === 'current'
  const name = podium ? t('cert.label') : t(`stage.${id}`)
  // The pill above a lamp grows away from the aisle so it never covers the graduate.
  const transform = podium
    ? 'translate(-50%, -100%)'
    : above
      ? side < 0
        ? `translate(calc(-100% + 14px), ${below ? '-14px' : 'calc(-100% + 14px)'})`
        : `translate(-14px, ${below ? '-14px' : 'calc(-100% + 14px)'})`
      : side < 0 ? 'translate(calc(-100% + 14px), -50%)' : 'translate(-14px, -50%)'
  return (
    <button
      type="button"
      onClick={() => onPick?.(id)}
      data-checkpoint={id}
      data-checkpoint-state={state}
      className="absolute flex min-h-11 min-w-11 items-center gap-1.5 text-start"
      style={{
        left: pct(p.x, g.w),
        top: pct(top, g.h),
        transform,
        // Physical layout: the badge sits on its lamp whatever the reading direction.
        direction: 'ltr',
        flexDirection: podium ? 'row' : below ? 'column' : above ? 'column-reverse' : side < 0 ? 'row-reverse' : 'row',
        alignItems: above && !podium ? (side < 0 ? 'flex-end' : 'flex-start') : 'center',
        maxWidth: above ? '46vw' : undefined,
      }}
    >
      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-black ${BADGE[state]}`}>{formatNumber(i + 1, locale)}</span>
      {!showName && <span className="sr-only">{name}</span>}
      <span className="sr-only">{`, ${t(`scene.state.${state}`)}`}</span>
      {showName && (
        <span dir={locale === 'ar' ? 'rtl' : 'ltr'} className={`rounded-md px-2 py-1 text-xs leading-tight sm:text-sm ${state === 'current' ? 'bg-yellow text-black' : 'bg-ink/80 text-beige'}`} style={{ textAlign: side < 0 ? 'right' : 'left' }}>
          <span className="block font-bold">{name}</span>
          {podium ? null : state === 'current' ? (
            <span className="block text-[11px] font-semibold sm:text-xs">
              {t('scene.here')}
              {w.due ? ` · ${t('scene.deadline', { date: formatDate(w.due, locale, { day: 'numeric', month: 'short' }) })}` : ''}
            </span>
          ) : (
            wide && <span className="block text-[11px] opacity-85">{formatDate(SCHEDULE.milestones[i].at, locale, { day: 'numeric', month: 'short' })}</span>
          )}
        </span>
      )}
    </button>
  )
}
