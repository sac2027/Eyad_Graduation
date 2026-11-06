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

function readGpa(): number | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('gpa')
    const n = raw === null ? NaN : Number(raw)
    return Number.isFinite(n) && n >= 0 && n <= 4 ? n : null
  } catch {
    return null
  }
}

function initialDateStatus(): 'confirmed' | 'tbc' {
  const tbc = readFlag('tbc')
  if (tbc) SCHEDULE.ceremonyDateStatus = 'tbc'
  return tbc ? 'tbc' : 'confirmed'
}

/** Demo-only switches. The date status also mutates the shared schedule so the pure engines see it. */
export const useDemoFlags = create<DemoFlags>((set) => ({
  lowEnd: readFlag('lowend'),
  worstCase: readFlag('worst'),
  dateStatus: initialDateStatus(),
  gpaOverride: readGpa(),
  setLowEnd: (lowEnd) => set({ lowEnd }),
  setWorstCase: (worstCase) => set({ worstCase }),
  setDateStatus(dateStatus) {
    SCHEDULE.ceremonyDateStatus = dateStatus
    set({ dateStatus })
  },
  setGpaOverride: (gpaOverride) => set({ gpaOverride }),
}))
