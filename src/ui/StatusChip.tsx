import clsx from 'clsx'
import { useT } from '@/i18n'
import type { StageStatus } from '@/time/schedule'

const STYLE: Record<StageStatus, string> = {
  upcoming: 'bg-gray text-black',
  open: 'bg-green text-white',
  'due-soon': 'bg-yellow text-turquoise',
  closed: 'bg-black/15 text-black',
}

export function StatusChip({ status }: { status: StageStatus }) {
  const t = useT()
  return (
    <span data-status={status} className={clsx('inline-flex min-h-7 items-center rounded-full px-3 text-sm font-bold', STYLE[status])}>
      {t(`status.${status}`)}
    </span>
  )
}
