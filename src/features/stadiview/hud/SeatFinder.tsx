import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { bookingPhase } from '@/features/stadiview/data/bookingWindow'
import { pitchSeats, usePitchSeats } from '@/features/stadiview/data/pitchSeatService'
import { seatWords } from '@/features/stadiview/hud/SeatTooltip'
import { SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useViewer } from '@/features/stadiview/state/useViewer'
import { formatNumber, useLocale, useT } from '@/i18n'

/** Per section: its rows in order, each with its seats in order. Bays are filed under row 0. */
type Rows = Map<number, number[]>
let table: Rows[] | undefined
function rowsOf(section: number): Rows {
  if (!table) {
    const v = getVenue()
    table = v.sections.map(() => new Map<number, number[]>())
    for (let i = 0; i < v.count; i++) {
      const rows = table[v.section[i]]
      const row = v.kind[i] === SeatKind.AccessBay ? 0 : v.row[i]
      let list = rows.get(row)
      if (!list) rows.set(row, (list = []))
      list.push(i)
    }
    // A pitch block's seats are stored in line-up order; a picker lists them by seat number.
    for (const rows of table) for (const list of rows.values()) list.sort((a, b) => v.number[a] - v.number[b])
  }
  return table[section]
}

/**
 * The seat finder: every seat of the stadium, reachable without the map and without a pointer.
 *
 * Three pickers (block or stand, row, seat) name any seat. A signed-in graduate also gets the free
 * seats of their own zone as a list by row, which arrow keys move along.
 */
export function SeatFinder() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const viewer = useViewer()
  // Changes with every booking, so the list of free seats is rebuilt.
  const bookings = usePitchSeats()
  const v = getVenue()
  const n = (value: number) => formatNumber(value, locale)
  const inspected = useHud((s) => s.inspected)

  const start = viewer.graduate ? v.section[v.zones[viewer.graduate.zone].start] : 0
  const [section, setSection] = useState(start)
  const [row, setRow] = useState(-1)
  const [seat, setSeat] = useState(-1)
  const rows = rowsOf(section)
  const rowNumbers = useMemo(() => Array.from(rows.keys()).sort((a, b) => a - b), [rows])
  const seats = row >= 0 ? (rows.get(row) ?? []) : []

  const sectionName = (k: number) => {
    const s = v.sections[k]
    return s.kind === 'stand' ? t(`sv.section.${s.id}`) : t('sv.tip.block', { n: n(Number(s.id.slice(1))) })
  }

  // The free seats of the graduate's own zone, grouped by block and row.
  const graduate = viewer.graduate
  const phase = bookingPhase(viewer.now)
  const free = useMemo(() => {
    if (!graduate) return []
    const zone = v.zones[graduate.zone]
    const groups: { key: string; label: string; seats: number[] }[] = []
    for (let i = zone.start; i < zone.start + zone.count; i++) {
      if (pitchSeats().statusOf(i, graduate, viewer.now) !== 'available') continue
      const key = `${v.section[i]}-${v.row[i]}`
      let group = groups[groups.length - 1]
      if (!group || group.key !== key) {
        group = { key, label: `${t('sv.tip.block', { n: n(Number(v.sections[v.section[i]].id.slice(1))) })} · ${t('sv.tip.row', { n: n(v.row[i]) })}`, seats: [] }
        groups.push(group)
      }
      group.seats.push(i)
    }
    return groups
    // `t` and `n` follow the locale; `v` never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graduate, viewer.now, locale, bookings])

  // Arrow keys walk the list of free seats: along a row, and between rows keeping the place in the row.
  const list = useRef<HTMLDivElement>(null)
  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = e.target instanceof HTMLButtonElement ? e.target : null
    if (!at || !list.current) return
    const rowEls = Array.from(list.current.querySelectorAll<HTMLElement>('[data-free-row]'))
    const r = rowEls.findIndex((el) => el.contains(at))
    const inRow = Array.from(rowEls[r].querySelectorAll<HTMLButtonElement>('button'))
    const c = inRow.indexOf(at)
    const forward = document.documentElement.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    const back = forward === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight'
    const all = Array.from(list.current.querySelectorAll<HTMLButtonElement>('button'))
    const flat = all.indexOf(at)
    let to: HTMLButtonElement | undefined
    if (e.key === forward) to = all[flat + 1]
    else if (e.key === back) to = all[flat - 1]
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const next = rowEls[r + (e.key === 'ArrowDown' ? 1 : -1)]
      const buttons = next ? Array.from(next.querySelectorAll<HTMLButtonElement>('button')) : []
      to = buttons[Math.min(c, buttons.length - 1)]
    } else if (e.key === 'Home') to = all[0]
    else if (e.key === 'End') to = all[all.length - 1]
    else return
    e.preventDefault()
    if (!to) return
    for (const b of all) b.tabIndex = -1
    to.tabIndex = 0
    to.focus()
  }

  const firstFree = free[0]?.seats[0] ?? -1
  // One stop in the Tab order for the whole list: the inspected seat when it is in the list, else the first.
  const stop = free.some((g) => g.seats.includes(inspected)) ? inspected : firstFree

  return (
    <div className="sv-finder" data-sv-finder>
      <form
        className="sv-finder__pick"
        onSubmit={(e) => {
          e.preventDefault()
          if (seat >= 0) useHud.getState().inspect(seat)
        }}
      >
        <label>
          <span>{t('sv.finder.section')}</span>
          <select
            className="sv-field"
            value={section}
            onChange={(e) => {
              setSection(Number(e.target.value))
              setRow(-1)
              setSeat(-1)
            }}
            data-sv-finder-section
          >
            {v.sections.map((s, k) => (
              <option key={s.id} value={k}>
                {sectionName(k)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('sv.finder.row')}</span>
          <select
            className="sv-field"
            value={row}
            onChange={(e) => {
              setRow(Number(e.target.value))
              setSeat(-1)
            }}
            data-sv-finder-row
          >
            <option value={-1}>{t('sv.finder.choose')}</option>
            {rowNumbers.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? t('sv.finder.bays') : n(r)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('sv.finder.seat')}</span>
          <select className="sv-field" value={seat} onChange={(e) => setSeat(Number(e.target.value))} disabled={row < 0} data-sv-finder-seat>
            <option value={-1}>{t('sv.finder.choose')}</option>
            {seats.map((i) => (
              <option key={i} value={i}>
                {n(v.number[i])}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="sv-plate sv-button sv-button--gold" disabled={seat < 0} data-sv-finder-show>
          {t('sv.finder.show')}
        </button>
      </form>

      {graduate && (
        <section className="sv-finder__free" aria-labelledby="sv-free-title">
          <h3 id="sv-free-title">{t('sv.finder.free')}</h3>
          {phase !== 'open' && <p>{t(phase === 'before' ? 'sv.mine.noneBefore' : 'sv.book.err.closed')}</p>}
          {free.length === 0 ? (
            <p data-sv-finder-none>{t('sv.finder.none')}</p>
          ) : (
            <>
              <p className="sv-sr">{t('sv.finder.keys')}</p>
              <div ref={list} className="sv-finder__list" onKeyDown={onKeys} data-sv-finder-free>
                {free.map((group) => (
                  <div key={group.key} role="group" aria-label={group.label} data-free-row>
                    <span aria-hidden>{group.label}</span>
                    <div>
                      {group.seats.map((i) => (
                        <button
                          key={i}
                          type="button"
                          tabIndex={i === stop ? 0 : -1}
                          aria-label={seatWords(i, t, locale).place}
                          aria-pressed={i === inspected}
                          onClick={() => useHud.getState().inspect(i)}
                          data-seat={v.idOf(i)}
                        >
                          {n(v.number[i])}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

/**
 * Says the inspected seat and its state aloud, for people who cannot see the gold marker move.
 * It is in the page at all times, so a screen reader hears the change wherever the seat was chosen.
 */
export function LiveSeat() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const viewer = useViewer()
  usePitchSeats()
  const inspected = useHud((s) => s.inspected)
  let text = ''
  if (inspected >= 0) {
    const v = getVenue()
    const status = v.kind[inspected] === SeatKind.Stand ? 'available' : pitchSeats().statusOf(inspected, viewer.graduate, viewer.now)
    const words = seatWords(inspected, t, locale, status)
    text = [words.place, words.detail, words.status].filter(Boolean).join(', ')
  }
  return (
    <p className="sv-sr" role="status" aria-live="polite" data-sv-live>
      {text}
    </p>
  )
}
