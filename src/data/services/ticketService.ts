import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { err, ok, type Result } from '@/domain/types'
import { SCHEDULE, type Schedule } from '@/time/schedule'

export type SecondState = 'unclaimed' | 'claimed' | 'waitlist'

export function createTicketService(opts: { poolSize?: number; schedule?: Schedule } = {}) {
  const poolSize = opts.poolSize ?? 1300
  const s = opts.schedule ?? SCHEDULE
  const store = createStore<{ claims: Record<string, SecondState> }>(() => ({ claims: {} }))

  const ticketsWin = s.stages.tickets
  /** Simulated demand from other graduates: grows to 90% of the pool by the deadline. */
  const claimedByOthers = (now: number) => {
    const span = ticketsWin.due! - ticketsWin.opens
    const f = Math.min(1, Math.max(0, (now - ticketsWin.opens) / span))
    return Math.round(poolSize * 0.9 * f)
  }
  const userClaimed = () => Object.values(store.getState().claims).filter((c) => c === 'claimed').length

  return {
    store,
    poolSize,
    getEntitlement(userId: string): { guaranteed: 1; second: SecondState } {
      return { guaranteed: 1, second: store.getState().claims[userId] ?? 'unclaimed' }
    },
    /** Seats left in the second-ticket pool at this simulated time. */
    remaining(now: number): number {
      return Math.max(0, poolSize - claimedByOthers(now) - userClaimed())
    },
    /** Claims are open from the opening date to the deadline, then again after the release date until the final lock. */
    claimsOpen(now: number): boolean {
      if (now < ticketsWin.opens) return false
      if (now <= ticketsWin.due!) return true
      return now >= s.seatsReleased && now <= ticketsWin.closes!
    },
    claimSecond(userId: string, now: number): Result<'claimed' | 'waitlist', 'already-claimed' | 'closed'> {
      const cur = store.getState().claims[userId]
      if (cur === 'claimed') return err('already-claimed')
      if (!this.claimsOpen(now)) return err('closed')
      if (this.remaining(now) > 0) {
        store.setState((st) => ({ claims: { ...st.claims, [userId]: 'claimed' } }))
        return ok('claimed')
      }
      store.setState((st) => ({ claims: { ...st.claims, [userId]: 'waitlist' } }))
      return ok('waitlist')
    },
  }
}

export type TicketService = ReturnType<typeof createTicketService>
export const ticketService = createTicketService()
export function useTicketClaims(service: TicketService = ticketService) {
  return useStore(service.store, (st) => st.claims)
}
