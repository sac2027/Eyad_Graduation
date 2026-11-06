import { getPhase } from '@/time/phaseEngine'
import { SCHEDULE, type Schedule } from '@/time/schedule'

export interface SceneState {
  /** Lamps lit along the aisle: one for every checkpoint reached (0..9). */
  lampsLit: number
  /** 0 dark, 1 warming (final week), 2 bright (honors day and ceremony day), 3 full (the ceremony and after). */
  stageGlow: 0 | 1 | 2 | 3
  beams: boolean
  /** 0 empty stands, 1 arriving, 2 full. */
  crowd: 0 | 1 | 2
  chairsFilled: boolean
  flags: boolean
  goldAccents: boolean
  figure: 'gate' | 'path' | 'stage' | 'holding'
}

/** What the stadium looks like at a moment in (simulated) time. */
export function sceneState(now: number, s: Schedule = SCHEDULE): SceneState {
  const { phase, slot } = getPhase(now, s)
  const marchAt = s.milestones.find((m) => m.id === 'ceremony')!.at
  const lampsLit = s.milestones.filter((m) => m.at <= now).length
  const onCeremonyDay = phase === 'ceremony-day'
  const seated = onCeremonyDay && (slot === 'seated' || slot === 'ceremony' || slot === 'photos')

  let stageGlow: SceneState['stageGlow'] = 0
  if (phase === 'final-week') stageGlow = 1
  if (phase === 'honors-day' || onCeremonyDay) stageGlow = 2
  if (now >= marchAt) stageGlow = 3

  let figure: SceneState['figure'] = 'path'
  if (phase === 'pre-launch') figure = 'gate'
  else if (now >= s.afterglowStart) figure = 'holding'
  else if (now >= marchAt) figure = 'stage'

  return {
    lampsLit,
    stageGlow,
    beams: (onCeremonyDay && slot !== 'morning') || phase === 'afterglow',
    crowd: onCeremonyDay ? (slot === 'arrival' ? 1 : seated ? 2 : 0) : 0,
    chairsFilled: seated,
    flags: phase === 'final-week' || phase === 'honors-day' || onCeremonyDay || phase === 'afterglow',
    goldAccents: phase === 'honors-day',
    figure,
  }
}
