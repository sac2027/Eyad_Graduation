import { create } from 'zustand'

export type CelebrationKind =
  | 'welcome'
  | 'task'
  | 'certificate'
  | 'certificate-small'
  | 'honor-gold'
  | 'honor-silver'
  | 'honor-bronze'
  | 'ceremony-entry'

export interface Burst {
  id: number
  kind: CelebrationKind
}

/** Queue of celebrations for the fireworks canvas to draw. */
export const useCelebrations = create<{ bursts: Burst[]; done(id: number): void }>((set) => ({
  bursts: [],
  done: (id) => set((s) => ({ bursts: s.bursts.filter((b) => b.id !== id) })),
}))

let nextId = 1

/** Ask for a celebration. The canvas decides how to draw it (and skips it under reduced motion or low-end). */
export function celebrate(kind: CelebrationKind): void {
  useCelebrations.setState((s) => ({ bursts: [...s.bursts, { id: nextId++, kind }] }))
}
