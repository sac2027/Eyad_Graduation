import { useEffect, useState } from 'react'
import { create } from 'zustand'

/** Demo-console override: null follows the system setting. */
export const useMotionOverride = create<{ reduced: boolean | null; setReduced(v: boolean | null): void }>((set) => ({
  reduced: null,
  setReduced: (reduced) => set({ reduced }),
}))

function systemPrefersReduced(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useReducedMotion(): boolean {
  const override = useMotionOverride((s) => s.reduced)
  const [system, setSystem] = useState(systemPrefersReduced)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setSystem(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return override ?? system
}
