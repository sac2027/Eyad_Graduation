import { create } from 'zustand'
import { SCHEDULE } from '@/time/schedule'

interface DemoFlags {
  lowEnd: boolean
  worstCase: boolean
  dateStatus: 'confirmed' | 'tbc'
  gpaOverride: number | null
  setLowEnd(v: boolean): void
  setWorstCase(v: boolean): void
  setDateStatus(v: 'confirmed' | 'tbc'): void
  setGpaOverride(v: number | null): void
}

function readFlag(name: string): boolean {
  try {
    return new URLSearchParams(window.location.search).get(name) === '1'
  } catch {
    return false
  }
}

/** Demo-only switches. The date status also mutates the shared schedule so the pure engines see it. */
export const useDemoFlags = create<DemoFlags>((set) => ({
  lowEnd: readFlag('lowend'),
  worstCase: readFlag('worst'),
  dateStatus: 'confirmed',
  gpaOverride: null,
  setLowEnd: (lowEnd) => set({ lowEnd }),
  setWorstCase: (worstCase) => set({ worstCase }),
  setDateStatus(dateStatus) {
    SCHEDULE.ceremonyDateStatus = dateStatus
    set({ dateStatus })
  },
  setGpaOverride: (gpaOverride) => set({ gpaOverride }),
}))
