import { SCHEDULE, SLOT_ORDER, type DaySlot, type Phase, type Schedule } from './schedule'

export function getPhase(now: number, s: Schedule = SCHEDULE): { phase: Phase; slot?: DaySlot } {
  if (now < s.launch) return { phase: 'pre-launch' }
  if (now < s.finalWeekStart) return { phase: 'journey' }
  if (now < s.honorsDayStart) return { phase: 'final-week' }
  if (now < s.ceremonyDayStart) return { phase: 'honors-day' }
  if (now < s.afterglowStart) {
    const slot = SLOT_ORDER.find((k) => now >= s.ceremonyDay[k].start && now < s.ceremonyDay[k].end) ?? 'photos'
    return { phase: 'ceremony-day', slot }
  }
  return { phase: 'afterglow' }
}
