import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { isHoldActive, type Seat, type SectionSummary } from '@/domain/seats'
import { seatService, useSeatVersion } from '@/data'
import { useLocale, useT } from '@/i18n'
import { seatsLabel } from '@/i18n/plurals'
import { useNow } from '@/time/clockStore'
import { HOLD_TTL_MS } from '@/data/services/seatService'
import { Button } from '@/ui/Button'
import { toast } from '@/ui/toast'
import { celebrate } from '@/features/celebrate/celebrate'

/** Where each section sits on the overview: reserved blocks by hand, general sections around the ring. */
function layout(sections: SectionSummary[]) {
  const pos = new Map<string, { x: number; y: number; rot: number }>()
  const general = sections.filter((s) => s.zone === 'general')
  general.forEach((s, i) => {
    const a = ((i / general.length) * 360 - 90) * (Math.PI / 180)
    pos.set(s.id, { x: 500 + 385 * Math.cos(a), y: 275 + 205 * Math.sin(a), rot: (a * 180) / Math.PI + 90 })
  })
  pos.set('V1', { x: 440, y: 105, rot: 0 })
  pos.set('V2', { x: 560, y: 105, rot: 0 })
  pos.set('E1', { x: 60, y: 235, rot: 0 })
  pos.set('E2', { x: 60, y: 305, rot: 0 })
  pos.set('O1', { x: 500, y: 440, rot: 0 })
  return pos
}

function Overview({ sections, selected, onPick, canEasy }: { sections: SectionSummary[]; selected?: string; onPick: (id: string) => void; canEasy: boolean }) {
  const t = useT()
  const pos = useMemo(() => layout(sections), [sections])
  return (
    <svg viewBox="0 0 1000 560" role="group" aria-label={t('seat.overview')} className="h-auto w-full rounded-2xl bg-white" data-seat-overview>
      <ellipse cx="500" cy="270" rx="250" ry="120" fill="#ece0c7" />
      <rect x="455" y="150" width="90" height="24" fill="#115f66" />
      {sections.map((s) => {
        const p = pos.get(s.id)!
        const locked = s.zone === 'vip' || s.zone === 'ops' || (s.zone === 'easy-access' && !canEasy)
        const fill = s.zone === 'general' ? '#009767' : s.zone === 'easy-access' ? '#115f66' : '#aa8c6d'
        const share = s.total ? s.available / s.total : 0
        return (
          <g
            key={s.id}
            role="button"
            tabIndex={locked ? -1 : 0}
            aria-disabled={locked}
            aria-label={`${t('seat.section', { id: s.id })}, ${t(`seat.zone.${s.zone}`)}, ${t('seat.available', { n: s.available })}`}
            data-section={s.id}
            data-locked={locked || undefined}
            transform={`translate(${p.x} ${p.y}) rotate(${p.rot})`}
            className={locked ? 'cursor-not-allowed' : 'cursor-pointer'}
            onClick={() => !locked && onPick(s.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !locked && (e.preventDefault(), onPick(s.id))}
          >
            <rect x="-34" y="-19" width="68" height="38" rx="6" fill={fill} opacity={locked ? 0.35 : 0.3 + 0.7 * share} stroke={selected === s.id ? '#f0ba4f' : 'none'} strokeWidth="5" />
            <text textAnchor="middle" y="6" fontSize="15" fontWeight="800" fill="#fff" transform={`rotate(${-p.rot})`}>{s.id}</text>
          </g>
        )
      })}
    </svg>
  )
}

function seatState(seat: Seat, userId: string, now: number): 'available' | 'mine' | 'held' | 'confirmed' | 'blocked' {
  if (seat.status === 'confirmed') return seat.confirmedBy === userId ? 'mine' : 'confirmed'
  if (isHoldActive(seat, now)) return seat.heldBy === userId ? 'mine' : 'held'
  return seat.status === 'blocked' ? 'blocked' : 'available'
}

const SEAT_STYLE: Record<string, string> = {
  available: 'bg-green text-black',
  mine: 'bg-yellow text-black outline outline-2 outline-turquoise',
  held: 'bg-sand text-black',
  confirmed: 'bg-gray text-black',
  blocked: 'bg-black/20 text-black',
}

interface SeatMapProps {
  userId: string
  /** How many seats this graduate may hold in total. */
  allowance: number
  canEasy: boolean
  onConfirmed?: () => void
}

export function SeatMap({ userId, allowance, canEasy, onConfirmed }: SeatMapProps) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const now = useNow(1000)
  useSeatVersion()
  const [section, setSection] = useState<string | undefined>()
  const [picked, setPicked] = useState<string | undefined>()
  const [conflict, setConflict] = useState<{ seatId: string; suggestion: Seat | null } | null>(null)
  const [expired, setExpired] = useState(false)
  const grid = useRef<HTMLDivElement>(null)

  useEffect(() => {
    seatService.expireHolds(now)
  }, [now])

  const sections = seatService.listSections()
  const mine = seatService.listUserSeats(userId).filter((s) => seatState(s, userId, now) === 'mine')
  const held = mine.filter((s) => s.status === 'held')
  const seats = section ? seatService.listSeats(section) : []
  const rows = [...new Set(seats.map((s) => s.row))]
  // Roving tabindex: one tab stop for the grid, on the picked seat or the first free one.
  const tabStop = (picked && seats.some((s) => s.id === picked) ? picked : seats.find((s) => seatState(s, userId, now) === 'available')?.id) ?? seats[0]?.id
  const pickedSeat = picked ? seatService.getSeat(picked) : undefined
  const label = (s: Seat) => t('seat.label', { section: s.section, row: s.row, number: s.number })
  const soonest = held.length ? Math.min(...held.map((s) => s.heldUntil ?? 0)) : null

  useEffect(() => {
    if (held.length === 0 && mine.length === 0) return
    setExpired(false)
  }, [held.length, mine.length])

  const doHold = (seatId: string) => {
    const r = seatService.hold(seatId, userId, now)
    if (r.ok) {
      setConflict(null)
      setExpired(false)
      return
    }
    if (r.error === 'taken') setConflict({ seatId, suggestion: seatService.suggest(seatId, userId) })
    else toast.error(t(r.error === 'limit' ? 'seat.limit' : 'seat.blocked'))
  }

  const onKey = (e: React.KeyboardEvent) => {
    const el = document.activeElement as HTMLElement | null
    const row = Number(el?.dataset.row)
    const num = Number(el?.dataset.num)
    if (!row || !num) return
    const move = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key] as [number, number] | undefined
    if (!move) return
    e.preventDefault()
    grid.current?.querySelector<HTMLElement>(`[data-row="${row + move[0]}"][data-num="${num + move[1]}"]`)?.focus()
  }

  const left = soonest !== null ? Math.max(0, soonest - now) : 0
  const mm = String(Math.floor(left / 60000)).padStart(2, '0')
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')

  return (
    <div data-seat-map className="grid gap-4 [&>*]:min-w-0">
      <Overview sections={sections} selected={section} canEasy={canEasy} onPick={(id) => { setSection(id); setPicked(undefined) }} />

      <details className="rounded-xl bg-white p-3">
        <summary className="min-h-11 cursor-pointer font-bold">{t('seat.list')}</summary>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {sections.filter((s) => s.zone === 'general' || (s.zone === 'easy-access' && canEasy)).map((s) => (
            <li key={s.id}>
              <Button variant="ghost" className="w-full justify-between" onClick={() => { setSection(s.id); setPicked(undefined) }}>
                <span>{t('seat.section', { id: s.id })} · {t(`seat.zone.${s.zone}`)}</span>
                <span>{t('seat.available', { n: s.available })}</span>
              </Button>
            </li>
          ))}
        </ul>
      </details>

      {section && (
        <section aria-labelledby="grid-h" className="rounded-2xl bg-white p-4" data-seat-grid-section={section}>
          <h3 id="grid-h" className="mb-2 text-lg font-bold">{t('seat.grid', { id: section })}</h3>
          <div ref={grid} dir="ltr" className="overflow-x-auto" onKeyDown={onKey} role="group" aria-label={t('seat.grid', { id: section })}>
            {rows.map((r) => (
              <div key={r} className="mb-1 flex items-center gap-1">
                <span aria-hidden className="w-5 text-xs">{r}</span>
                {seats.filter((s) => s.row === r).map((s) => {
                  const st = seatState(s, userId, now)
                  const disabled = st === 'held' || st === 'confirmed' || st === 'blocked'
                  return (
                    <button
                      key={s.id}
                      type="button"
                      data-seat={s.id}
                      data-state={st}
                      data-row={s.row}
                      data-num={s.number}
                      tabIndex={s.id === tabStop ? 0 : -1}
                      aria-disabled={disabled || undefined}
                      aria-label={`${label(s)}, ${t(`seat.state.${st === 'mine' ? 'mine' : st}`)}`}
                      aria-pressed={picked === s.id}
                      onClick={() => { if (disabled) return; setPicked(s.id); setConflict(null) }}
                      className={clsx('size-6 shrink-0 rounded-sm text-[9px] font-bold transition-transform duration-150 active:scale-95', SEAT_STYLE[st], picked === s.id && 'ring-2 ring-turquoise ring-offset-1')}
                    >
                      {s.number}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      {pickedSeat && (
        <div className="rounded-2xl bg-white p-4" data-picked={pickedSeat.id} aria-live="polite">
          <p className="font-bold">{t('seat.selected')}: {label(pickedSeat)}</p>
          {conflict && (
            <div className="mt-3 rounded-xl bg-error/20 p-3" role="alert" data-conflict>
              <p className="font-bold">{t('seat.conflict')}</p>
              {conflict.suggestion && (
                <>
                  <p className="mt-1">{t('seat.suggest', { label: label(conflict.suggestion) })}</p>
                  <Button className="mt-2" variant="secondary" onClick={() => { setPicked(conflict.suggestion!.id); setConflict(null) }}>{t('seat.use-suggest')}</Button>
                </>
              )}
            </div>
          )}
          {!conflict && pickedSeat.status === 'confirmed' && pickedSeat.confirmedBy === userId && (
            <p className="mt-3 font-bold text-turquoise" data-picked-confirmed>{t('tickets.confirmed')} ✓</p>
          )}
          {!conflict && !(pickedSeat.status === 'confirmed' && pickedSeat.confirmedBy === userId) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {seatState(pickedSeat, userId, now) === 'mine' ? (
                <Button variant="ghost" onClick={() => seatService.release(pickedSeat.id, userId)}>{t('seat.release')}</Button>
              ) : (
                <Button onClick={() => doHold(pickedSeat.id)} disabled={mine.length >= allowance}>{t('seat.hold')}</Button>
              )}
              <Button variant="ghost" onClick={() => { if (seatService.rivalTake(pickedSeat.id)) toast.info(t('seat.conflict')) }} data-demo-rival>{t('tickets.demo.rival')}</Button>
            </div>
          )}
          {mine.length >= allowance && <p className="mt-2 text-sm">{t('tickets.used-up', { seats: seatsLabel(locale, allowance) })}</p>}
        </div>
      )}

      {held.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-turquoise p-4 text-beige" data-hold-bar>
          <div>
            <p className="font-bold">{held.map(label).join(' · ')}</p>
            <p className="text-sm">{t('tickets.hold-left')}: <span role="timer" data-hold-left={Math.round(left / 1000)} className="font-black tabular-nums" dir="ltr">{mm}:{ss}</span> / {Math.round(HOLD_TTL_MS / 60000)}:00</p>
          </div>
          <Button
            variant="gold"
            onClick={() => {
              const r = seatService.confirm(userId, now)
              if (r.ok) {
                toast.success(t('tickets.confirmed'))
                celebrate('task', `seats:${userId}`)
                onConfirmed?.()
              } else {
                setExpired(true)
              }
            }}
          >
            {t('tickets.confirm')}
          </Button>
        </div>
      )}
      {expired && <p role="alert" data-expired className="rounded-xl bg-warning/40 p-3 font-bold">{t('tickets.expired')}</p>}
      <span className="sr-only" data-locale={locale} />
    </div>
  )
}
