import { useEffect, useState, type RefObject } from 'react'
import { STRIDE_MS } from './frames'

const FRAME_MS = STRIDE_MS / 12

/**
 * Advances the walk cycle on animation frames (rAF timestamps, not the domain clock).
 * Pauses while the tab is hidden or the figure is off screen; returns frame 0 when inactive.
 */
export function useWalkFrame(active: boolean, el: RefObject<Element | null>): number {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf = 0
    let visible = true
    let last: number | null = null
    let acc = 0
    let f = 0
    const io = typeof IntersectionObserver !== 'undefined' && el.current ? new IntersectionObserver(([e]) => (visible = e.isIntersecting)) : null
    if (io && el.current) io.observe(el.current)
    const step = (t: number) => {
      raf = requestAnimationFrame(step)
      const dt = last === null ? 0 : t - last
      last = t
      if (document.hidden || !visible) return
      acc += Math.min(dt, 250)
      if (acc >= FRAME_MS) {
        const n = Math.floor(acc / FRAME_MS)
        acc -= n * FRAME_MS
        f = (f + n) % 12
        setFrame(f)
      }
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      io?.disconnect()
    }
  }, [active, el])
  return active ? frame : 0
}
