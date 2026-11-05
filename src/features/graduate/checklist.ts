import { create } from 'zustand'

/** Demo-only progress flags per graduate. */
export const useConfirmed = create<{ confirmed: Record<string, boolean>; confirm(id: string): void }>((set) => ({
  confirmed: {},
  confirm: (id) => set((s) => ({ confirmed: { ...s.confirmed, [id]: true } })),
}))

/** Airline model: confirm attendance first, then choose seats. */
export const useAttending = create<{ attending: Record<string, boolean>; attend(id: string): void }>((set) => ({
  attending: {},
  attend: (id) => set((s) => ({ attending: { ...s.attending, [id]: true } })),
}))
