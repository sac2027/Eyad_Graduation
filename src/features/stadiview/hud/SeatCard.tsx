import { Logo } from '@/brand/logo/Logo'
import type { PassWords } from '@/features/stadiview/hud/passWords'
import { QrSvg } from '@/ui/QrCard'

/**
 * The Digital Seat Card: what a graduate shows at the gate.
 *
 * It is dark type on white, whatever the page around it looks like: a steward reads it in floodlight
 * and a scanner needs the contrast. The name wraps and is never cut.
 */
export function SeatCard({ words }: { words: PassWords }) {
  return (
    <article className="sv-pass" data-sv-seat-card data-seat={words.seatId}>
      <header className="sv-pass__head">
        <Logo tone="negative" height={20} />
        <p>
          <b>{words.title}</b>
          <span>{words.subtitle}</span>
        </p>
      </header>
      <div className="sv-pass__bars" aria-hidden />
      <div className="sv-pass__body">
        <h3 data-sv-pass-name>{words.name}</h3>
        <p className="sv-pass__zone">{words.zone}</p>
        <dl className="sv-pass__cells">
          {words.cells.map((c) => (
            <div key={c.label}>
              <dt>{c.label}</dt>
              <dd>{c.value}</dd>
            </div>
          ))}
        </dl>
        <div className="sv-pass__lower">
          <dl className="sv-pass__rows">
            {words.rows.map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
          <div className="sv-pass__qr">
            <QrSvg value={words.code} label={words.qrLabel} size={132} />
            <bdi dir="ltr">{words.seatId}</bdi>
          </div>
        </div>
        <p className="sv-pass__mock">{words.mock}</p>
      </div>
    </article>
  )
}
