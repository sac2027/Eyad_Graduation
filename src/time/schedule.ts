export type StageId =
  | 'candidacy'
  | 'information'
  | 'attire'
  | 'tickets'
  | 'rehearsal'
  | 'ceremony'
  | 'celebration'
  | 'certificate'

export type Phase = 'pre-launch' | 'journey' | 'final-week' | 'honors-day' | 'ceremony-day' | 'afterglow'
export type DaySlot = 'morning' | 'arrival' | 'seated' | 'ceremony' | 'photos'
export type StageStatus = 'upcoming' | 'open' | 'due-soon' | 'closed'

export interface StageWindow {
  opens: number
  due?: number
  closes?: number
}

export interface Schedule {
  launch: number
  ceremonyDateStatus: 'confirmed' | 'tbc'
  stages: Record<StageId, StageWindow>
  milestones: { id: StageId; at: number }[]
  honorsCeremony: { start: number; end: number }
  ceremonyDay: Record<DaySlot, { start: number; end: number }>
  finalWeekStart: number
  honorsDayStart: number
  ceremonyDayStart: number
  afterglowStart: number
  seatsReleased: number
  pickupOpens: number
  pickupCloses: number
  certificateCollection: number
  gownReturnOpens: number
  gownReturnDue: number
}

export const STAGE_ORDER: StageId[] = [
  'candidacy',
  'information',
  'attire',
  'tickets',
  'rehearsal',
  'ceremony',
  'celebration',
  'certificate',
]

export const SLOT_ORDER: DaySlot[] = ['morning', 'arrival', 'seated', 'ceremony', 'photos']

const at = (iso: string): number => Date.parse(`${iso}+03:00`)

/** Mock schedule for Class 57. Times are Asia/Riyadh (UTC+3). Change a date here and the whole demo follows. */
export const SCHEDULE: Schedule = {
  launch: at('2027-01-31T00:00:00'),
  ceremonyDateStatus: 'confirmed',
  stages: {
    candidacy: { opens: at('2027-01-31T00:00:00'), due: at('2027-02-11T23:59:59'), closes: at('2027-03-04T23:59:59') },
    information: { opens: at('2027-01-31T00:00:00') },
    attire: { opens: at('2027-03-14T00:00:00'), due: at('2027-03-25T23:59:59'), closes: at('2027-04-01T23:59:59') },
    tickets: { opens: at('2027-03-14T00:00:00'), due: at('2027-03-25T23:59:59'), closes: at('2027-04-01T23:59:59') },
    rehearsal: { opens: at('2027-04-04T00:00:00'), closes: at('2027-04-05T23:59:59') },
    ceremony: { opens: at('2027-04-07T00:00:00'), closes: at('2027-04-07T21:30:00') },
    celebration: { opens: at('2027-04-07T21:00:00'), closes: at('2027-04-07T23:59:59') },
    certificate: { opens: at('2027-04-07T21:30:00'), due: at('2027-04-15T23:59:59') },
  },
  milestones: [
    { id: 'candidacy', at: at('2027-01-31T00:00:00') },
    { id: 'information', at: at('2027-02-14T00:00:00') },
    { id: 'attire', at: at('2027-03-14T00:00:00') },
    { id: 'tickets', at: at('2027-03-21T00:00:00') },
    { id: 'rehearsal', at: at('2027-04-04T00:00:00') },
    { id: 'ceremony', at: at('2027-04-07T15:00:00') },
    { id: 'celebration', at: at('2027-04-07T21:00:00') },
    { id: 'certificate', at: at('2027-04-07T21:30:00') },
  ],
  honorsCeremony: { start: at('2027-04-06T19:00:00'), end: at('2027-04-06T21:00:00') },
  ceremonyDay: {
    morning: { start: at('2027-04-07T00:00:00'), end: at('2027-04-07T15:00:00') },
    arrival: { start: at('2027-04-07T15:00:00'), end: at('2027-04-07T18:45:00') },
    seated: { start: at('2027-04-07T18:45:00'), end: at('2027-04-07T20:00:00') },
    ceremony: { start: at('2027-04-07T20:00:00'), end: at('2027-04-07T21:00:00') },
    photos: { start: at('2027-04-07T21:00:00'), end: at('2027-04-07T21:30:00') },
  },
  finalWeekStart: at('2027-03-31T00:00:00'),
  honorsDayStart: at('2027-04-06T00:00:00'),
  ceremonyDayStart: at('2027-04-07T00:00:00'),
  afterglowStart: at('2027-04-07T21:30:00'),
  seatsReleased: at('2027-03-28T00:00:00'),
  pickupOpens: at('2027-03-28T00:00:00'),
  pickupCloses: at('2027-04-01T23:59:59'),
  certificateCollection: at('2027-04-11T00:00:00'),
  gownReturnOpens: at('2027-04-11T00:00:00'),
  gownReturnDue: at('2027-04-15T23:59:59'),
}
