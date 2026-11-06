import { SCHEDULE, STAGE_ORDER, type Schedule, type StageId } from './schedule'
import { getJourneyProgress } from './stageEngine'

export type CheckpointState = 'passed' | 'current' | 'next' | 'future' | 'late'

/** 0..1 along the path: checkpoint i sits at i/8, linear in time between checkpoints, 0 while the date is TBC. */
export function pathProgress(now: number, s: Schedule = SCHEDULE): number {
  return getJourneyProgress(now, s)
}

/** Index of the last checkpoint reached, or -1 before launch. */
function reachedIndex(now: number, s: Schedule): number {
  let idx = -1
  s.milestones.forEach((m, i) => {
    if (m.at <= now) idx = i
  })
  return idx
}

/** The checkpoint the graduate is at now (candidacy before launch). */
export function currentCheckpoint(now: number, s: Schedule = SCHEDULE): StageId {
  return s.milestones[Math.max(0, reachedIndex(now, s))].id
}

export function checkpointStates(
  now: number,
  opts: { late?: Partial<Record<StageId, boolean>>; s?: Schedule } = {},
): Record<StageId, CheckpointState> {
  const s = opts.s ?? SCHEDULE
  const reached = reachedIndex(now, s)
  const out = {} as Record<StageId, CheckpointState>
  s.milestones.forEach((m, i) => {
    let st: CheckpointState = i < reached ? 'passed' : i === reached ? 'current' : i === reached + 1 ? 'next' : 'future'
    if (opts.late?.[m.id] && st !== 'current') st = 'late'
    out[m.id] = st
  })
  for (const id of STAGE_ORDER) out[id] ??= 'future'
  return out
}
