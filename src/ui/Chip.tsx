import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onToggle'> {
  selected?: boolean
  onToggle?: (next: boolean) => void
}

export function Chip({ selected = false, onToggle, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      {...rest}
      aria-pressed={selected}
      onClick={() => onToggle?.(!selected)}
      className={clsx(
        'chip inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium',
        selected ? 'bg-turquoise text-beige' : 'bg-white text-turquoise outline outline-1 -outline-offset-1 outline-turquoise/40',
        className,
      )}
    >
      {children}
    </button>
  )
}
