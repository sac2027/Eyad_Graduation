import { COLLEGE_NAMES } from '@/domain/types'
import { COLLEGE_ID } from '@/features/stadiview/config/venue'
import type { Graduate } from '@/features/stadiview/data/graduateDirectory'
import { passCode } from '@/features/stadiview/data/passCode'
import { SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { formatDate, formatNumber } from '@/i18n'
import type { Locale, TFn } from '@/i18n'
import { SCHEDULE } from '@/time/schedule'

/** Everything written on a seat pass, in one language. The on-screen card and the downloaded picture both draw from this. */
export interface PassWords {
  title: string
  subtitle: string
  name: string
  /** College and degree. */
  zone: string
  /** The large boxes: block, row and seat, or block and bay. */
  cells: { label: string; value: string }[]
  /** The smaller facts: gate, when the gates open, the place in the procession. */
  rows: { label: string; value: string }[]
  /** The seat's id, as printed under the QR code: always Latin, always left to right. */
  seatId: string
  /** What the QR code says, and how a screen reader names it. */
  code: string
  qrLabel: string
  mock: string
}

export function passWords(graduate: Graduate, name: string, seat: number, t: TFn, locale: Locale): PassWords {
  const v = getVenue()
  const n = (value: number) => formatNumber(value, locale)
  const zone = v.zones[graduate.zone]
  const section = v.sections[v.section[seat]]
  const block = { label: t('sv.card.block'), value: n(Number(section.id.slice(1))) }
  const bay = v.kind[seat] === SeatKind.AccessBay
  const cells = bay
    ? [block, { label: t('sv.card.bay'), value: n(v.number[seat]) }]
    : [block, { label: t('sv.card.row'), value: n(v.row[seat]) }, { label: t('sv.card.seat'), value: n(v.number[seat]) }]

  const opens = SCHEDULE.stages.arrival.opens
  const rows = [
    { label: t('sv.card.gate'), value: t('sv.card.gateN', { n: n(section.gate) }) },
    {
      label: t('sv.card.opens'),
      value: `${formatDate(opens, locale, { weekday: 'long', day: 'numeric', month: 'long' })} · ${formatDate(opens, locale, { hour: 'numeric', minute: '2-digit', hour12: true })}`,
    },
  ]
  // A wheelchair bay has no number in the line: an usher brings its graduate in with the college.
  if (!bay && v.lineup[seat] > 0) rows.push({ label: t('sv.card.lineup'), value: t('sv.card.lineupOf', { n: n(v.lineup[seat]), total: n(zone.count) }) })

  const seatId = v.idOf(seat)
  return {
    title: t('sv.card.kind'),
    subtitle: t('sv.card.class'),
    name,
    zone: `${COLLEGE_NAMES[COLLEGE_ID[zone.college]][locale]} · ${t(`sv.degree.${zone.degree}`)}`,
    cells,
    rows,
    seatId,
    code: passCode(graduate, seat),
    qrLabel: t('sv.card.qr', { seat: seatId }),
    mock: t('sv.card.mock'),
  }
}
