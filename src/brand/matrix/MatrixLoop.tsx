import { useEffect, useRef, useState } from 'react'
import { MatrixField, type MatrixFieldProps } from './MatrixField'
import { MATRIX_LOOPS } from './manifest'
import { useReducedMotion } from '@/ui/motionPrefs'
import { useDemoFlags } from '@/features/demo-console/flags'

interface MatrixLoopProps extends Omit<MatrixFieldProps, 'animate'> {
  id: string
  /** 0..1. Speeds up the loop (or densifies the placeholder) as the day approaches. */
  intensity?: number
}

/** Plays a generator loop when one exists for this id, otherwise draws the placeholder. */
export function MatrixLoop({ id, intensity, ...fallback }: MatrixLoopProps) {
  const def = MATRIX_LOOPS.find((l) => l.id === id)
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(true)
  const reduced = useReducedMotion()
  const lowEnd = useDemoFlags((s) => s.lowEnd)
  const ref = useRef<HTMLVideoElement>(null)
  const shouldPlay = !reduced && !lowEnd && visible

  useEffect(() => {
    if (ref.current && intensity !== undefined) ref.current.playbackRate = 0.6 + Math.min(1, Math.max(0, intensity)) * 1.4
  }, [intensity])

  // The toggles and the system setting can change after the video has started, so drive play and pause directly.
  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (shouldPlay) void Promise.resolve(v.play?.()).catch(() => {})
    else v.pause?.()
  }, [shouldPlay, failed])

  useEffect(() => {
    const v = ref.current
    if (!v || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting))
    io.observe(v)
    return () => io.disconnect()
  }, [failed])

  if (!def || failed) {
    const i = intensity ?? 0.5
    return <MatrixField {...fallback} density={fallback.density ?? 0.35 + 0.5 * i} frequency={fallback.frequency ?? 0.03 + 0.1 * i} animate />
  }
  return (
    <video
      ref={ref}
      aria-hidden
      data-matrix-loop={id}
      className={`${fallback.className ?? ''} object-cover`}
      src={def.src}
      muted
      loop
      playsInline
      autoPlay={shouldPlay}
      onError={() => setFailed(true)}
    />
  )
}
