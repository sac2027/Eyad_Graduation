import { adminService } from '@/data/services/adminService'
import { gownService } from '@/data/services/gownService'
import { seatService } from '@/data/services/seatService'
import { ticketService } from '@/data/services/ticketService'
import { useAttending, useConfirmed } from '@/features/graduate/checklist'

/** Demo only: scrubbing time backwards cannot undo earlier actions, so this wipes all mock user data. */
export function resetDemoData() {
  seatService.reset()
  ticketService.reset()
  gownService.reset()
  adminService.reset()
  useConfirmed.setState({ confirmed: {} })
  useAttending.setState({ attending: {} })
}
