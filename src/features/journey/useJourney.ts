import { useDemoFlags } from '@/features/demo-console/flags'
import { useNow } from '@/time/clockStore'
import { getPhase } from '@/time/phaseEngine'
import { type DaySlot, type Phase, type StageId } from '@/time/schedule'
import { currentCheckpoint } from '@/time/pathEngine'
import { getDayProgress, getJourneyProgress, getNextDeadline } from '@/time/stageEngine'

export interface JourneyState {
  now: number
  phase: Phase
  slot?: DaySlot
  progress: number
  dayProgress: number
  nextDeadline: { id: StageId; due: number } | null
  dateStatus: 'confirmed' | 'tbc'
  /** The stage the marker sits in (milestone index floor). */
  stageId: StageId
}

export function useJourney(): JourneyState {
  const now = useNow(1000)
  const dateStatus = useDemoFlags((s) => s.dateStatus)
  const { phase, slot } = getPhase(now)
  const progress = getJourneyProgress(now)
  return {
    now,
    phase,
    slot,
    progress,
    dayProgress: getDayProgress(now),
    nextDeadline: getNextDeadline(now),
    dateStatus,
    stageId: currentCheckpoint(now),
  }
}
