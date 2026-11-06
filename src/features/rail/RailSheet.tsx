import { useEffect, useRef } from 'react'
import { formatNumber, useLocale, useT } from '@/i18n'
import type { CheckpointState } from '@/time/pathEngine'
import { STAGE_ORDER, type StageId } from '@/time/schedule'

const DOT: Record<CheckpointState, string> = {
  passed: 'bg-green text-black',
  current: 'bg-yellow text-black',
  next: 'bg-ink text-beige outline outline-2 outline-beige',
  future: 'bg-ink text-gray outline outline-2 outline-gray/50',
  late: 'bg-error text-black',
}

/** On phones, tapping the rail opens the nine steps as a list. */
export function RailSheet({ states, reading, onPick, onClose }: { states: Record<StageId, CheckpointState>; reading: number; onPick: (i: number) => void; onClose: () => void }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/50" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('rail.label')} className="w-full rounded-t-3xl bg-beige p-4 pb-6" onClick={(e) => e.stopPropagation()} data-rail-sheet>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl font-black text-turquoise">{t('me.trail')}</h2>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-full font-bold text-turquoise" aria-label={t('rail.close')}>✕</button>
        </div>
        <ol className="grid gap-1">
          {STAGE_ORDER.map((id, i) => (
            <li key={id}>
              <button
                ref={i === 0 ? first : undefined}
                type="button"
                onClick={() => onPick(i)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-start ${reading === i ? 'bg-white' : ''}`}
              >
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-black ${DOT[states[id]]}`}>{formatNumber(i + 1, locale)}</span>
                <span className="font-semibold">{t(`stage.${id}`)}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
