import { cva, type VariantProps } from 'class-variance-authority'
import clsx from 'clsx'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { useReducedMotion } from './motionPrefs'

const button = cva(
  [
    'relative isolate inline-flex min-h-11 min-w-11 select-none items-center justify-center gap-2 overflow-hidden',
    'rounded-xl px-5 font-display font-bold leading-none',
    'transition-[transform,opacity] duration-150 ease-[var(--ease-out-strong)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-green text-white [--wipe:var(--color-turquoise)]',
        secondary: 'bg-turquoise text-beige [--wipe:var(--color-green)]',
        ghost: 'bg-transparent text-turquoise outline outline-2 -outline-offset-2 outline-turquoise [--wipe:var(--color-beige)]',
        gold: 'bg-yellow text-turquoise [--wipe:var(--color-beige)]',
        destructive: 'bg-error text-ink [--wipe:var(--color-warning)]',
      },
      size: { md: 'h-11 text-base', lg: 'h-14 px-7 text-lg' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  state?: 'loading' | 'success'
}

const BARS = 7

export function Button({ variant, size, state, className, children, disabled, onClick, type = 'button', ...rest }: ButtonProps) {
  const reduced = useReducedMotion()
  const busy = state === 'loading'
  const inert = disabled || busy
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-busy={busy || undefined}
      data-state={state}
      data-reduced={reduced || undefined}
      onClick={(e) => {
        if (inert) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      className={clsx(
        button({ variant, size }),
        !reduced && !inert && 'active:scale-[0.97]',
        !reduced && 'matrix-btn',
        className,
      )}
    >
      {!reduced && (
        <span aria-hidden className="matrix-wipe" dir="ltr">
          {Array.from({ length: BARS }, (_, i) => (
            <i key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </span>
      )}
      <span className={clsx('btn-content relative z-10 inline-flex items-center gap-2', state && 'is-swapping')}>
        {state === 'loading' ? <Spinner /> : state === 'success' ? <Check /> : null}
        <span>{children}</span>
      </span>
    </button>
  )
}

function Spinner() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" className="animate-spin">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="42 20" strokeLinecap="round" />
    </svg>
  )
}

function Check() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>,
    VariantProps<typeof button> {
  to: LinkProps['to']
  children: ReactNode
}

/** A router link that looks and moves like a Button. */
export function ButtonLink({ to, variant, size, className, children, ...rest }: ButtonLinkProps) {
  const reduced = useReducedMotion()
  return (
    <Link
      {...rest}
      to={to}
      className={clsx(button({ variant, size }), !reduced && 'active:scale-[0.97] matrix-btn', className)}
    >
      {!reduced && (
        <span aria-hidden className="matrix-wipe" dir="ltr">
          {Array.from({ length: BARS }, (_, i) => (
            <i key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </span>
      )}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Link>
  )
}
