import type { CSSProperties, ReactNode } from 'react'
import { MatrixField } from '@/brand/matrix/MatrixField'

interface PageHeroProps {
  eyebrow?: ReactNode
  title: ReactNode
  /** Extra attributes for the heading, such as a test hook. */
  titleProps?: Record<string, string>
  sub?: ReactNode
  /** Sits beside the title on wide screens: a status, a number. */
  aside?: ReactNode
  children?: ReactNode
  seed?: number
  width?: 'narrow' | 'wide'
}

const step = (i: number) => ({ '--i': i }) as CSSProperties

/** The band every inner page opens with: the brand's turquoise, its slanted bars, and a title that rises in. */
export function PageHero({ eyebrow, title, titleProps, sub, aside, children, seed = 57, width = 'wide' }: PageHeroProps) {
  return (
    <div className="page-hero" data-page-hero>
      <div className="page-hero-art" aria-hidden>
        <MatrixField background="turquoise" stripes="green" seed={seed} density={0.6} cols={20} rows={8} transparent />
      </div>
      <div className={`mx-auto px-4 pb-14 pt-9 sm:pt-12 ${width === 'narrow' ? 'max-w-3xl' : 'max-w-5xl'}`}>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0 max-w-3xl">
            {eyebrow && <p className="eyebrow rise mb-3" style={step(0)}>{eyebrow}</p>}
            <h1 {...titleProps} className="rise text-balance break-words text-4xl font-black leading-[1.08] [overflow-wrap:anywhere] sm:text-5xl" style={step(1)}>
              {title}
            </h1>
            {sub && <p className="rise mt-3 max-w-prose text-lg text-beige/90" style={step(2)}>{sub}</p>}
          </div>
          {aside && <div className="rise" style={step(3)}>{aside}</div>}
        </div>
        {children && <div className="rise mt-6" style={step(3)}>{children}</div>}
      </div>
    </div>
  )
}
