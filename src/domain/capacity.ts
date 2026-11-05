export interface CapacityInput {
  totalSeats: number
  graduates: number
  reserved: { vip: number; easyAccess: number; ops: number }
}

export interface Capacity {
  pool: number
  guaranteed: number
  secondPool: number
  perGraduate: number
  /** Share of graduates who can claim a second seat before the pool runs out. */
  breakEvenTakeUp: number
}

export function computeCapacity({ totalSeats, graduates, reserved }: CapacityInput): Capacity {
  const pool = Math.max(0, totalSeats - reserved.vip - reserved.easyAccess - reserved.ops)
  const guaranteed = Math.min(graduates, pool)
  const secondPool = Math.max(0, pool - graduates)
  return {
    pool,
    guaranteed,
    secondPool,
    perGraduate: graduates > 0 ? pool / graduates : 0,
    breakEvenTakeUp: graduates > 0 ? secondPool / graduates : 0,
  }
}
