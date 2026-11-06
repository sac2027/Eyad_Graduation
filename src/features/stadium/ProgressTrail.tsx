import { formatNumber, useLocale, useT } from '@/i18n'
import { checkpointStates, type CheckpointState } from '@/time/pathEngine'
import { STAGE_ORDER, type StageId } from '@/time/schedule'

const DOT: Record<CheckpointState, string> = {
  passed: 'bg-green text-black',
  current: 'bg-yellow text-black ring-4 ring-yellow/40',
  next: 'bg-turquoise text-beige outline outline-2 outline-beige',
  future: 'bg-turquoise text-beige/70 outline outline-2 outline-beige/40',
  late: 'bg-error text-black',
}

/** The nine checkpoints in a row, in the same colours as the stadium scene. */
export function ProgressTrail({ now, late }: { now: number; late?: Partial<Record<StageId, boolean>> }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const states = checkpointStates(now, { late })
  const current = STAGE_ORDER.find((id) => states[id] === 'current')
  return (
    <div data-progress-trail>
      <ol className="relative flex items-center justify-between gap-1" aria-label={t('me.trail')}>
        <span aria-hidden className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-beige/40" />
        {STAGE_ORDER.map((id, i) => (
          <li key={id} className="relative" data-trail={id} data-trail-state={states[id]}>
            <span className={`grid size-7 place-items-center rounded-full text-xs font-black sm:size-8 sm:text-sm ${DOT[states[id]]}`}>{formatNumber(i + 1, locale)}</span>
            <span className="sr-only">{`${t(`stage.${id}`)}, ${t(`scene.state.${states[id]}`)}`}</span>
          </li>
        ))}
      </ol>
      {current && (
        <p className="mt-3 text-sm font-semibold">
          {t('scene.here')}: {t(`stage.${current}`)}
        </p>
      )}
    </div>
  )
}
