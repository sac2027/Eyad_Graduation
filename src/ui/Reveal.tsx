import { useEffect, useRef } from 'react'
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'

interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  /** Position in a group, for a short stagger. */
  i?: number
  children: ReactNode
}

/**
 * Brings its content in the first time it scrolls into view, and never again.
 * The content is hidden by script only, so it is always there without it, and anything already on
 * screen when the page opens is shown at once.
 */
export function Reveal({ as, i = 0, children, style, ...rest }: RevealProps) {
  const Tag = (as ?? 'div') as ElementType
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const box = el.getBoundingClientRect()
    if (box.top < window.innerHeight * 0.92) return
    el.dataset.reveal = 'wait'
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        el.dataset.reveal = 'shown'
        io.disconnect()
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <Tag ref={ref} {...rest} style={{ '--i': i, ...style } as CSSProperties}>
      {children}
    </Tag>
  )
}
