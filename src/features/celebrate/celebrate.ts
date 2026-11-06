import { create } from 'zustand'
import { sessionStore, shouldCelebrate } from './gate'

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
export const useCelebrations = create<{ bursts: Burst[]; stopToken: number; done(id: number): void; stop(): void }>((set) => ({
  bursts: [],
  stopToken: 0,
  done: (id) => set((s) => ({ bursts: s.bursts.filter((b) => b.id !== id) })),
  /** Skip whatever is playing. */
  stop: () => set((s) => ({ bursts: [], stopToken: s.stopToken + 1 })),
}))

let nextId = 1

/**
 * Ask for a celebration. With a key it plays at most once per session for that key.
 * The canvas decides how to draw it, and draws nothing under reduced motion or on a low-end device.
 */
export function celebrate(kind: CelebrationKind, key?: string): void {
  if (key !== undefined && !shouldCelebrate(kind, key, sessionStore())) return
  useCelebrations.setState((s) => ({ bursts: [...s.bursts, { id: nextId++, kind }] }))
}
