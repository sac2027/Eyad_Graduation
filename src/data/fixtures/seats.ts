import type { SectionDef } from '@/domain/seats'

/** 5,000 seats: vip 300, easy-access 300, ops 100, general 4,300. */
export const SECTION_DEFS: SectionDef[] = [
  { id: 'V1', zone: 'vip', rows: 6, perRow: 25 },
  { id: 'V2', zone: 'vip', rows: 6, perRow: 25 },
  { id: 'E1', zone: 'easy-access', rows: 6, perRow: 25 },
  { id: 'E2', zone: 'easy-access', rows: 6, perRow: 25 },
  { id: 'O1', zone: 'ops', rows: 4, perRow: 25 },
  ...Array.from({ length: 20 }, (_, i): SectionDef => ({
    id: `G${String(i + 1).padStart(2, '0')}`,
    zone: 'general',
    rows: 5,
    perRow: 43,
  })),
]

export const TOTAL_SEATS = 5000
export const GRADUATES = 3000
export const RESERVED = { vip: 300, easyAccess: 300, ops: 100 }
