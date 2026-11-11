import { SCHEDULE } from '@/time/schedule'
import type { Schedule } from '@/time/schedule'

/** When graduates may book and change their pitch seat: the ticket stage of the ceremony schedule. */
export function bookingWindow(schedule: Schedule = SCHEDULE): { opens: number; closes: number } {
  const stage = schedule.stages.tickets
  return { opens: stage.opens, closes: stage.closes ?? stage.due ?? stage.opens }
}

export type BookingPhase = 'before' | 'open' | 'closed'

/** Where a moment falls: before booking opens, while it is open, or after it has closed. */
export function bookingPhase(now: number, schedule: Schedule = SCHEDULE): BookingPhase {
  const { opens, closes } = bookingWindow(schedule)
  return now < opens ? 'before' : now > closes ? 'closed' : 'open'
}
