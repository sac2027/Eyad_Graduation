/**
 * Adaptive resolution: when frames run slow the picture is drawn with fewer pixels, and when there
 * is room to spare it is sharpened again. Pure arithmetic, so it can be tested without a canvas.
 */
export const RESOLUTION = {
  /** Frames averaged before a decision. */
  window: 45,
  /** Average frame time, in ms, above which the picture is softened (below about 40 frames a second). */
  slow: 25,
  /** Average frame time, in ms, below which the picture may be sharpened (about 70 frames a second). */
  fast: 14,
  /** The size of one step in pixel ratio. */
  step: 0.25,
  /** The softest the picture is ever drawn. */
  floor: 0.6,
  /** Fast windows in a row needed before sharpening, so the picture does not flicker between two steps. */
  patience: 4,
} as const

export interface ResolutionState {
  ratio: number
  /** Fast windows seen in a row. */
  calm: number
  /** How many times the picture was softened after being sharpened: each makes sharpening slower. */
  relapses: number
}

export function startResolution(ratio: number): ResolutionState {
  return { ratio, calm: 0, relapses: 0 }
}

/** The next state after a window of frames that averaged `ms` each. `max` is the device's own ratio cap. */
export function nextResolution(state: ResolutionState, ms: number, max: number): ResolutionState {
  const floor = Math.min(RESOLUTION.floor, max)
  if (ms > RESOLUTION.slow && state.ratio > floor) {
    // Very slow frames drop two steps at once.
    const drop = ms > RESOLUTION.slow * 1.8 ? RESOLUTION.step * 2 : RESOLUTION.step
    return { ratio: Math.max(floor, state.ratio - drop), calm: 0, relapses: state.relapses + (state.calm > 0 || state.relapses > 0 ? 1 : 0) }
  }
  if (ms < RESOLUTION.fast && state.ratio < max) {
    const calm = state.calm + 1
    if (calm >= RESOLUTION.patience * (1 + state.relapses)) return { ratio: Math.min(max, state.ratio + RESOLUTION.step), calm: 0, relapses: state.relapses }
    return { ...state, calm }
  }
  return { ...state, calm: 0 }
}
