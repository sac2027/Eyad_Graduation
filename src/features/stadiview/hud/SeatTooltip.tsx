import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { COLLEGE_NAMES } from '@/domain/types'
import { COLLEGE_ID } from '@/features/stadiview/config/venue'
import { onPointerAnchor, pointerAnchor } from '@/features/stadiview/hud/pointerAnchor'
import { pitchSeats, usePitchSeats } from '@/features/stadiview/data/pitchSeatService'
import type { SeatStatus } from '@/features/stadiview/data/pitchSeatService'
import { NO_ZONE, SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useStadium } from '@/features/stadiview/state/stadiumStore'
import { useViewer } from '@/features/stadiview/state/useViewer'
import { formatNumber, useLocale, useT } from '@/i18n'
import type { Locale, TFn } from '@/i18n'

/** Distance between the pointer and the tooltip, and between the tooltip and the edge of the screen. */
const GAP = 12
const MARGIN = 8

interface SeatWords {
  /** Where the seat is: block, row and seat, or the stand's name. */
  place: string
  /** Who or what it is for: college and degree, or the row and seat of a stand. */
  detail: string
  /** Shown for seats a graduate can book. */
  status: string | null
}

/** The words for one seat, in the brief's order: block, college, row, seat, status. */
export function seatWords(i: number, t: TFn, locale: Locale, status: SeatStatus = 'available'): SeatWords {
  const v = getVenue()
  const n = (value: number) => formatNumber(value, locale)
  const section = v.sections[v.section[i]]
  const row = t('sv.tip.row', { n: n(v.row[i]) })
  const seat = t('sv.tip.seat', { n: n(v.number[i]) })

  if (v.kind[i] === SeatKind.Stand) {
    return { place: t(`sv.section.${section.id}`), detail: `${row} · ${seat}`, status: null }
  }
  // A pitch block's id is "P" and its number.
  const block = t('sv.tip.block', { n: n(Number(section.id.slice(1))) })
  if (v.kind[i] === SeatKind.AccessBay) {
    return { place: block, detail: t('sv.tip.bay', { n: n(v.number[i]) }), status: t(`sv.status.${status}`) }
  }
  const zone = v.zone[i] === NO_ZONE ? null : v.zones[v.zone[i]]
  const college = zone ? `${COLLEGE_NAMES[COLLEGE_ID[zone.college]][locale]} · ${t(`sv.degree.${zone.degree}`)}` : ''
  return { place: `${block} · ${row} · ${seat}`, detail: college, status: t(`sv.status.${status}`) }
}

/**
 * The small plate that names the seat under the pointer.
 *
 * It follows the pointer without React: the scene reports the pointer's position through a
 * channel and this component moves its element directly. React only renders when the seat changes.
 * The tooltip is for the eye alone (`aria-hidden`); the same facts reach keyboard and screen-reader
 * users through the seat finder.
 */
export function SeatTooltip() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const hover = useStadium((s) => s.hover)
  // The last seat shown stays in place while the tooltip fades out, so it never empties before it is gone.
  const [shown, setShown] = useState(-1)
  if (hover >= 0 && hover !== shown) setShown(hover)

  const outer = useRef<HTMLDivElement>(null)
  const size = useRef({ w: 0, h: 0 })

  const place = useCallback((x: number, y: number) => {
    const el = outer.current
    if (!el) return
    const { w, h } = size.current
    const vw = window.innerWidth
    const vh = window.innerHeight
    const rtl = document.documentElement.dir === 'rtl'
    // The tooltip opens on the side the text runs toward, and flips when that side has no room.
    let left = rtl ? x - GAP - w : x + GAP
    let flippedX = false
    if (!rtl && left + w > vw - MARGIN) {
      left = x - GAP - w
      flippedX = true
    } else if (rtl && left < MARGIN) {
      left = x + GAP
      flippedX = true
    }
    left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - w - MARGIN))
    let top = y + GAP + 4
    const above = top + h > vh - MARGIN
    if (above) top = y - GAP - h
    top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - h - MARGIN))
    el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`
    // It grows out of the corner nearest the pointer.
    const onLeft = rtl !== flippedX
    el.style.setProperty('--sv-tip-origin', `${onLeft ? 'right' : 'left'} ${above ? 'bottom' : 'top'}`)
  }, [])

  useEffect(() => onPointerAnchor(place), [place])

  // The words change the tooltip's size, so measure after each change and put it back in place.
  useLayoutEffect(() => {
    const el = outer.current
    if (!el) return
    size.current = { w: el.offsetWidth, h: el.offsetHeight }
    const at = pointerAnchor()
    place(at.x, at.y)
  }, [shown, locale, place])

  const viewer = useViewer()
  usePitchSeats()
  const status = shown >= 0 ? pitchSeats().statusOf(shown, viewer.graduate, viewer.now) : 'available'
  const words = shown >= 0 ? seatWords(shown, t, locale, status) : null

  return (
    <div ref={outer} className="sv-tip" data-seat-tooltip data-open={hover >= 0 ? '' : undefined} aria-hidden="true">
      <div className="sv-plate sv-tip__plate">
        {words && (
          <>
            <div className="sv-tip__text">
              <strong>{words.place}</strong>
              {words.detail && <span>{words.detail}</span>}
            </div>
            {words.status && (
              <span className="sv-tip__status" data-status={status}>
                <i />
                {words.status}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
