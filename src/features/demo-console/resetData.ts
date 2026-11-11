import { adminService } from '@/data/services/adminService'
import { gownService } from '@/data/services/gownService'
import { seatService } from '@/data/services/seatService'
import { ticketService } from '@/data/services/ticketService'
import { useAttending, useConfirmed } from '@/features/graduate/checklist'

const extra: (() => void)[] = []

/**
 * Lets a feature that is loaded on demand add its own mock data to the reset, without this file
 * (which every page downloads) having to import that feature.
 */
export function registerReset(fn: () => void): void {
  if (!extra.includes(fn)) extra.push(fn)
}

/** Demo only: scrubbing time backwards cannot undo earlier actions, so this wipes all mock user data. */
export function resetDemoData() {
  seatService.reset()
  ticketService.reset()
  gownService.reset()
  adminService.reset()
  useConfirmed.setState({ confirmed: {} })
  useAttending.setState({ attending: {} })
  for (const fn of extra) fn()
}
