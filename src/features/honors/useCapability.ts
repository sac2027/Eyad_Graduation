import { useMemo } from 'react'
import { useDemoFlags } from '@/features/demo-console/flags'
import { detectCapability, probeEnv, type Capability } from './capability'

export function useCapability(): Capability {
  const lowEnd = useDemoFlags((s) => s.lowEnd)
  return useMemo(() => detectCapability(probeEnv(lowEnd)), [lowEnd])
}
