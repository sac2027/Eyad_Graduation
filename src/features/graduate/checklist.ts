import { create } from 'zustand'

/** Demo-only: which graduates confirmed their details. */
export const useConfirmed = create<{ confirmed: Record<string, boolean>; confirm(id: string): void }>((set) => ({
  confirmed: {},
  confirm: (id) => set((s) => ({ confirmed: { ...s.confirmed, [id]: true } })),
}))
