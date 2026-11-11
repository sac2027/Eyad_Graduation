import { useState } from 'react'
import { guestTicketService } from '@/features/stadiview/data/guestTicketService'
import { seatsOfGate, ticketGate } from '@/features/stadiview/data/ticketCodec'
import type { GateId } from '@/features/stadiview/config/venue'
import { RouteToggle } from '@/features/stadiview/hud/RouteToggle'
import { seatWords } from '@/features/stadiview/hud/SeatTooltip'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useStadium } from '@/features/stadiview/state/stadiumStore'
import { formatDate, formatNumber, useLocale, useT } from '@/i18n'

const EXAMPLE = 'TICKET-G1-204'

type Problem = { kind: 'format' } | { kind: 'gate'; gate: number } | { kind: 'range'; gate: number; max: number }

/**
 * "My ticket": a family member types the number on their ticket and is shown their seat in the
 * stands, with the gate, the parking and when to arrive. A wrong number is told apart: not a ticket
 * at all, a gate that does not exist, or a number past the last seat of its gate.
 */
export function TicketLookup({ canFly, onFindGraduate }: { canFly: boolean; onFindGraduate(index: number): void }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const ticketSeat = useHud((s) => s.guest.ticketSeat)
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<Problem | null>(null)
  const ticket = ticketSeat >= 0 ? guestTicketService.forSeat(ticketSeat) : null
  const n = (value: number) => formatNumber(value, locale)

  const find = (value: string) => {
    const hud = useHud.getState()
    const found = guestTicketService.lookup(value)
    if (!found.ok) {
      const gate = ticketGate(value) ?? 0
      setProblem(found.error === 'format' ? { kind: 'format' } : found.error === 'gate' ? { kind: 'gate', gate } : { kind: 'range', gate, max: seatsOfGate(gate as GateId).length })
      hud.setGuest({ ticketSeat: -1 })
      return
    }
    setProblem(null)
    setText(found.value.ticket)
    hud.setGuest({ ticketSeat: found.value.seat })
    // The seat is marked in 3D and on the map; this panel stays open to show the ticket's details.
    hud.inspect(found.value.seat, true)
  }

  const words = ticket ? seatWords(ticket.seat, t, locale) : null

  return (
    <section className="sv-guest__part" aria-labelledby="sv-ticket-title">
      <h3 id="sv-ticket-title">{t('sv.guest.ticket')}</h3>
      <form
        className="sv-guest__row"
        onSubmit={(e) => {
          e.preventDefault()
          find(text)
        }}
      >
        <input
          className="sv-field"
          dir="ltr"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setProblem(null)
          }}
          placeholder={EXAMPLE}
          aria-label={t('sv.guest.ticketLabel')}
          aria-invalid={problem ? true : undefined}
          aria-describedby="sv-ticket-help"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          data-sv-ticket-input
        />
        <button type="submit" className="sv-plate sv-button" data-sv-ticket-find>
          {t('sv.guest.find')}
        </button>
      </form>
      <p id="sv-ticket-help" className="sv-guest__help">
        {problem ? (
          <span role="alert" className="sv-guest__problem" data-sv-ticket-error={problem.kind}>
            {problem.kind === 'format' && t('sv.guest.err.format', { example: EXAMPLE })}
            {problem.kind === 'gate' && t('sv.guest.err.gate', { n: n(problem.gate) })}
            {problem.kind === 'range' && t('sv.guest.err.range', { n: n(problem.gate), max: n(problem.max) })}
          </span>
        ) : (
          t('sv.guest.ticketHint', { example: EXAMPLE })
        )}
      </p>

      {!ticket && (
        <div className="sv-guest__chips">
          <span className="sv-guest__demo">{t('sv.demo')}</span>
          {guestTicketService.demoTickets().map((code) => (
            <button key={code} type="button" className="sv-chip" dir="ltr" onClick={() => find(code)} data-sv-demo-ticket={code}>
              {code}
            </button>
          ))}
        </div>
      )}

      {ticket && words && (
        <div className="sv-guest__found" data-sv-ticket-result={ticket.ticket}>
          <b>
            {words.place} · {words.detail}
          </b>
          <ul>
            <li data-sv-ticket-gate>{t('sv.fact.gate', { n: n(ticket.gate) })}</li>
            <li>{t('sv.guest.parking', { lot: ticket.parking })}</li>
            <li>{t('sv.guest.arriveBy', { time: formatDate(ticket.arriveBy, locale, { hour: 'numeric', minute: '2-digit', hour12: true }) })}</li>
          </ul>
          <div className="sv-guest__buttons">
            {canFly && (
              <button type="button" className="sv-plate sv-button sv-button--gold" onClick={() => useStadium.getState().select(ticket.seat)} data-sv-ticket-view>
                {t('sv.guest.viewMine')}
              </button>
            )}
            <RouteToggle seat={ticket.seat} place="ticket" />
            {ticket.graduate && (
              <button type="button" className="sv-plate sv-button" onClick={() => onFindGraduate(ticket.graduate!.index)} data-sv-ticket-graduate>
                {t('sv.guest.findMyGraduate')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
