import { SCHEDULE, type Schedule } from '@/time/schedule'

/** True only when time moves forward across the end of the ceremony. Never on re-renders or when scrubbing backwards. */
export function shouldPlayCompletion(prev: number, next: number, s: Schedule = SCHEDULE): boolean {
  return prev < s.afterglowStart && s.afterglowStart <= next
}

const DAY = 24 * 3_600_000

/** Whole calendar days since ceremony day began (9 April is day 2). */
export function daysSinceCeremony(now: number, s: Schedule = SCHEDULE): number {
  return Math.max(0, Math.floor((now - s.ceremonyDayStart) / DAY))
}
