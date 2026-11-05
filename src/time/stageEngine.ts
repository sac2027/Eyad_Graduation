import { SCHEDULE, STAGE_ORDER, type Schedule, type StageId, type StageStatus } from './schedule'

const HOUR = 3_600_000
const DUE_SOON_MS = 72 * HOUR

export function getStageStatus(id: StageId, now: number, s: Schedule = SCHEDULE): StageStatus {
  const w = s.stages[id]
  if (now < w.opens) return 'upcoming'
  if (w.due !== undefined) {
    if (now > w.due) return 'closed'
    return w.due - now <= DUE_SOON_MS ? 'due-soon' : 'open'
  }
  if (w.closes !== undefined && now > w.closes) return 'closed'
  return 'open'
}

/** 0..1 along the eight milestones (i/7 at milestone i). With the date TBC the walker rests at the start. */
export function getJourneyProgress(now: number, s: Schedule = SCHEDULE): number {
  if (s.ceremonyDateStatus === 'tbc') return 0
  const m = s.milestones
  if (now <= m[0].at) return 0
  const last = m.length - 1
  if (now >= m[last].at) return 1
  for (let i = 0; i < last; i++) {
    if (now < m[i + 1].at) {
      const f = (now - m[i].at) / (m[i + 1].at - m[i].at)
      return (i + f) / last
    }
  }
  return 1
}

/** 0 at 00:00 on ceremony day, 1 when the photos slot ends. */
export function getDayProgress(now: number, s: Schedule = SCHEDULE): number {
  const start = s.ceremonyDay.morning.start
  const end = s.ceremonyDay.photos.end
  return Math.min(1, Math.max(0, (now - start) / (end - start)))
}

export function getNextDeadline(now: number, s: Schedule = SCHEDULE): { id: StageId; due: number } | null {
  let best: { id: StageId; due: number } | null = null
  for (const id of STAGE_ORDER) {
    const due = s.stages[id].due
    if (due !== undefined && due > now && (best === null || due < best.due)) best = { id, due }
  }
  return best
}
