import { useRef, useState } from 'react'
import { useNow } from '@/time/clockStore'
import { useReducedMotion } from '@/ui/motionPrefs'
import { useDemoFlags } from '@/features/demo-console/flags'
import { Completion } from './Completion'
import { shouldPlayCompletion } from './completion'

/** Watches the clock. Plays the completion sequence once each time time moves forward across the end of the ceremony. */
export function CompletionHost() {
  const now = useNow(1000)
  const reduced = useReducedMotion()
  const lowEnd = useDemoFlags((s) => s.lowEnd)
  const prev = useRef(now)
  const [playing, setPlaying] = useState(false)
  if (prev.current !== now) {
    const crossed = shouldPlayCompletion(prev.current, now)
    prev.current = now
    if (crossed && !reduced && !lowEnd && !playing) setPlaying(true)
  }
  return playing ? <Completion onDone={() => setPlaying(false)} /> : null
}
