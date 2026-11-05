import type { Phase } from './schedule'

export interface Preset {
  id: string
  label: { ar: string; en: string }
  at: number
  expectedPhase: Phase
}

const at = (iso: string): number => Date.parse(`${iso}+03:00`)

export const PRESETS: Preset[] = [
  { id: 'today', label: { ar: 'اليوم', en: 'Today' }, at: at('2026-11-05T09:00:00'), expectedPhase: 'pre-launch' },
  { id: 'launch', label: { ar: 'إطلاق الموقع', en: 'Site launch' }, at: at('2027-01-31T09:00:00'), expectedPhase: 'journey' },
  { id: 'details-due', label: { ar: 'آخر موعد لتأكيد البيانات', en: 'Details due' }, at: at('2027-02-11T20:00:00'), expectedPhase: 'journey' },
  { id: 'lists-locked', label: { ar: 'إغلاق القوائم', en: 'Lists locked' }, at: at('2027-03-04T12:00:00'), expectedPhase: 'journey' },
  { id: 'attire-opens', label: { ar: 'فتح الزي والتذاكر', en: 'Attire opens' }, at: at('2027-03-14T09:00:00'), expectedPhase: 'journey' },
  { id: 'sizes-due', label: { ar: 'آخر موعد للمقاسات', en: 'Sizes due' }, at: at('2027-03-25T20:00:00'), expectedPhase: 'journey' },
  { id: 'seats-released', label: { ar: 'إطلاق المقاعد غير المحجوزة', en: 'Seats released' }, at: at('2027-03-28T09:00:00'), expectedPhase: 'journey' },
  { id: 'pickup', label: { ar: 'استلام الزي', en: 'Gown pickup' }, at: at('2027-03-30T10:00:00'), expectedPhase: 'journey' },
  { id: 'final-lock', label: { ar: 'الإغلاق النهائي للتذاكر', en: 'Final ticket lock' }, at: at('2027-04-01T12:00:00'), expectedPhase: 'final-week' },
  { id: 'rehearsal', label: { ar: 'البروفة', en: 'Rehearsal' }, at: at('2027-04-04T10:00:00'), expectedPhase: 'final-week' },
  { id: 'honors-day', label: { ar: 'حفل التكريم', en: 'Honors day' }, at: at('2027-04-06T19:30:00'), expectedPhase: 'honors-day' },
  { id: 'ceremony-morning', label: { ar: 'صباح الحفل', en: 'Ceremony morning' }, at: at('2027-04-07T09:00:00'), expectedPhase: 'ceremony-day' },
  { id: 'ceremony-arrival', label: { ar: 'الوصول', en: 'Arrival' }, at: at('2027-04-07T16:00:00'), expectedPhase: 'ceremony-day' },
  { id: 'ceremony-seated', label: { ar: 'الجلوس', en: 'Seated' }, at: at('2027-04-07T19:00:00'), expectedPhase: 'ceremony-day' },
  { id: 'ceremony-live', label: { ar: 'الحفل', en: 'Ceremony live' }, at: at('2027-04-07T20:20:00'), expectedPhase: 'ceremony-day' },
  { id: 'ceremony-photos', label: { ar: 'التصوير', en: 'Photos' }, at: at('2027-04-07T21:10:00'), expectedPhase: 'ceremony-day' },
  { id: 'after', label: { ar: 'بعد الحفل', en: 'After' }, at: at('2027-04-09T10:00:00'), expectedPhase: 'afterglow' },
]
