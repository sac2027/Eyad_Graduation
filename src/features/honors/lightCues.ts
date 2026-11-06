import type { HonorTier } from '@/domain/types'

export type CueId = 'blackout' | 'spot' | 'beams' | 'spill' | 'rim' | 'flash' | 'settle'

export interface LightCue {
  /** Seconds from the start of the unboxing. */
  at: number
  id: CueId
  duration: number
}

/** The lighting script of the unboxing, timed to the award's own beats (case in, ribbon, lid, rise, turn, engrave). */
export const LIGHT_CUES: LightCue[] = [
  { at: 0, id: 'blackout', duration: 0.2 },
  { at: 0.2, id: 'spot', duration: 0.6 },
  { at: 1.8, id: 'beams', duration: 1.2 },
  { at: 3.0, id: 'spill', duration: 1.6 },
  { at: 4.8, id: 'rim', duration: 1.4 },
  { at: 8.6, id: 'flash', duration: 0.18 },
  { at: 9.0, id: 'flash', duration: 0.18 },
  { at: 9.5, id: 'flash', duration: 0.18 },
  { at: 10.4, id: 'settle', duration: 2 },
]

/** The cue in effect at a moment of the sequence. */
export function cueAt(seconds: number): CueId {
  let id: CueId = 'blackout'
  for (const c of LIGHT_CUES) if (c.at <= seconds) id = c.id
  return id
}

/** Beam colour per tier, from the brand palette. */
export function beamColour(tier: HonorTier): string {
  return tier === 'gold' ? '#F0BA4F' : tier === 'silver' ? '#71B8D4' : '#AA8C6D'
}
