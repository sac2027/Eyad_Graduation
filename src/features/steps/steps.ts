import { SCHEDULE, STAGE_ORDER, type StageId } from '@/time/schedule'

export interface StepInfo {
  id: StageId
  n: number
  /** Where the graduate acts on this step, when there is something to do. */
  to?: string
}

const LINKS: Partial<Record<StageId, string>> = {
  candidacy: '/me',
  information: '/guide',
  attire: '/me/attire',
  tickets: '/me/tickets',
  arrival: '/guide#gates',
  ceremony: '/guide#map',
  certificate: '/me',
}

export const STEPS: StepInfo[] = STAGE_ORDER.map((id, i) => ({ id, n: i + 1, to: LINKS[id] }))

export interface GraduateFacts {
  confirmed: boolean
  gownDone: boolean
  hasSeat: boolean
}

export type PersonalStatus = 'done' | 'pending' | 'late'

const TASK_DONE: Partial<Record<StageId, (f: GraduateFacts) => boolean>> = {
  candidacy: (f) => f.confirmed,
  attire: (f) => f.gownDone,
  tickets: (f) => f.hasSeat,
}

/** A graduate's own status on a step: tasks are done, pending or late; other steps are done once their time has passed. */
export function personalStatus(id: StageId, facts: GraduateFacts, now: number): PersonalStatus | null {
  const w = SCHEDULE.stages[id]
  const task = TASK_DONE[id]
  if (task) {
    if (task(facts)) return 'done'
    if (now < w.opens) return null
    if (w.due !== undefined && now > w.due) return 'late'
    return 'pending'
  }
  const end = w.closes ?? w.due ?? w.opens
  return now > end ? 'done' : null
}
