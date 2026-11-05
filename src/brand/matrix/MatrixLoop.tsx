import { useState } from 'react'
import { MatrixField, type MatrixFieldProps } from './MatrixField'
import { MATRIX_LOOPS } from './manifest'
import { useReducedMotion } from '@/ui/motionPrefs'
import { useDemoFlags } from '@/features/demo-console/flags'

interface MatrixLoopProps extends Omit<MatrixFieldProps, 'animate'> {
  id: string
}

/** Plays a generator loop when one exists for this id, otherwise draws the placeholder. */
export function MatrixLoop({ id, ...fallback }: MatrixLoopProps) {
  const def = MATRIX_LOOPS.find((l) => l.id === id)
  const [failed, setFailed] = useState(false)
  const reduced = useReducedMotion()
  const lowEnd = useDemoFlags((s) => s.lowEnd)
  if (!def || failed) return <MatrixField {...fallback} animate />
  return (
    <video
      aria-hidden
      className={`${fallback.className ?? ''} object-cover`}
      src={def.src}
      muted
      loop
      playsInline
      autoPlay={!reduced && !lowEnd}
      onError={() => setFailed(true)}
    />
  )
}
