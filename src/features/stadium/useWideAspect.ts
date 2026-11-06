import { useEffect, useState } from 'react'

const QUERY = '(min-aspect-ratio: 1/1)'

/** True on landscape screens (desktop, tablets sideways), false on portrait phones. */
export function useWideAspect(): boolean {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}
