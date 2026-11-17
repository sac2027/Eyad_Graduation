import clsx from 'clsx'
import { useT } from '@/i18n'
import type { StageStatus } from '@/time/schedule'

const STYLE: Record<StageStatus, string> = {
  upcoming: 'bg-ink/10 text-ink',
  open: 'bg-green text-black',
  'due-soon': 'bg-yellow text-black',
  closed: 'bg-ink/20 text-ink',
}

export function StatusChip({ status }: { status: StageStatus }) {
  const t = useT()
  return (
    <span data-status={status} className={clsx('inline-flex min-h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-bold', STYLE[status])}>
      <span aria-hidden className={clsx('size-1.5 rounded-full bg-black/60', (status === 'open' || status === 'due-soon') && 'animate-pulse')} />
      {t(`status.${status}`)}
    </span>
  )
}
