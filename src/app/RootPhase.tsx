import { useEffect } from 'react'
import { getPhase } from '@/time/phaseEngine'
import { useNow } from '@/time/clockStore'
import { useDemoFlags } from '@/features/demo-console/flags'
import { seatService } from '@/data/services/seatService'

/** Mirrors the site phase onto <html> so CSS can theme the whole site. */
export function RootPhase() {
  const now = useNow(1000)
  const dateStatus = useDemoFlags((s) => s.dateStatus)
  const { phase, slot } = getPhase(now)
  // Holds follow simulated time everywhere, not just on the seat page.
  useEffect(() => {
    seatService.expireHolds(now)
  }, [now])
  useEffect(() => {
    const el = document.documentElement
    el.dataset.phase = phase
    if (slot) el.dataset.slot = slot
    else delete el.dataset.slot
    el.dataset.dateStatus = dateStatus
  }, [phase, slot, dateStatus])
  return null
}
