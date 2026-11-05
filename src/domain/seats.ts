export type SeatStatus = 'available' | 'held' | 'confirmed' | 'blocked'
export type SeatZone = 'general' | 'easy-access' | 'vip' | 'ops'

export interface Seat {
  id: string
  section: string
  row: number
  number: number
  zone: SeatZone
  status: SeatStatus
  heldBy?: string
  heldUntil?: number
  confirmedBy?: string
}

export interface SectionSummary {
  id: string
  zone: SeatZone
  total: number
  available: number
}

export interface SectionDef {
  id: string
  zone: SeatZone
  rows: number
  perRow: number
}
