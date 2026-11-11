import { err, ok } from '@/domain/types'
import type { Result } from '@/domain/types'
import { registerReset } from '@/features/demo-console/resetData'
import { getDirectory } from '@/features/stadiview/data/graduateDirectory'
import type { Graduate } from '@/features/stadiview/data/graduateDirectory'
import { pitchSeats } from '@/features/stadiview/data/pitchSeatService'

/**
 * The family seat locator: who may be found, and how.
 *
 * - A Family Share Code always finds its graduate: giving the code is the graduate's consent.
 * - A search by name or ID finds a graduate only while their locator is switched on.
 *
 * In this demo every graduate starts with the locator on, so that a search has something to show.
 * A real system would start with it off.
 */
const switchedOff = new Set<number>()
const listeners = new Set<() => void>()
let version = 0
const changed = () => {
  version++
  for (const fn of listeners) fn()
}

registerReset(() => {
  switchedOff.clear()
  changed()
})

export const locatorService = {
  isAllowed: (graduate: Graduate): boolean => !switchedOff.has(graduate.index),
  setAllowed(graduate: Graduate, allowed: boolean): void {
    if (allowed === !switchedOff.has(graduate.index)) return
    if (allowed) switchedOff.delete(graduate.index)
    else switchedOff.add(graduate.index)
    changed()
  },
  /**
   * Where a graduate sits right now.
   * - 'unknown-code': no graduate has that share code
   * - 'locator-off': found by name or ID, but they have not allowed that
   * - 'no-seat-yet': they may be found but have not booked
   */
  locate(by: { graduate: Graduate } | { shareCode: string }, now: number): Result<{ graduate: Graduate; seat: number }, 'locator-off' | 'no-seat-yet' | 'unknown-code'> {
    let graduate: Graduate | null
    if ('shareCode' in by) {
      graduate = getDirectory().byShareCode(by.shareCode)
      if (!graduate) return err('unknown-code')
    } else {
      graduate = by.graduate
      // Checked before the seat, so that a refusal says nothing about whether they have booked.
      if (switchedOff.has(graduate.index)) return err('locator-off')
    }
    const seat = pitchSeats().seatOf(graduate, now)
    return seat === -1 ? err('no-seat-yet') : ok({ graduate, seat })
  },
  reset(): void {
    switchedOff.clear()
    changed()
  },
  version: () => version,
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}
