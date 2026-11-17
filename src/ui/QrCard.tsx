import QRCode from 'qrcode'
import { useMemo } from 'react'
import { useT } from '@/i18n'
import { Button } from './Button'

/** Pure SVG QR code: no canvas, so it renders the same everywhere and prints sharply. */
export function QrSvg({ value, label, size = 224 }: { value: string; label: string; size?: number }) {
  const { n, d } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    let d = ''
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`
    return { n, d }
  }, [value])
  return (
    <svg role="img" aria-label={label} viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} shapeRendering="crispEdges" className="rounded-lg bg-white">
      <path d={d} fill="#000" />
    </svg>
  )
}

interface QrCardProps {
  name: string
  rows: { label: string; value: string }[]
  code: string
  label: string
  onShare?: () => void
  note?: string
}

/** High-contrast card for the gate: name, details and a QR code. Long names wrap, never overflow. */
export function QrCard({ name, rows, code, label, onShare, note }: QrCardProps) {
  const t = useT()
  return (
    <article data-qr-card className="qr-card mx-auto w-full max-w-sm overflow-hidden rounded-3xl bg-white text-black shadow-[var(--shadow-card)]">
      <div className="bg-turquoise px-5 py-4 text-beige"><h3 className="break-words text-2xl font-black [overflow-wrap:anywhere]" data-qr-name>{name}</h3></div>
      <div className="qr-tear" aria-hidden />
      <div className="p-5 pt-3">
      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="font-semibold">{r.label}</dt>
            <dd className="break-words text-lg font-black [overflow-wrap:anywhere]">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid place-items-center">
        <QrSvg value={code} label={label} />
      </div>
      {note && <p className="mt-3 text-xs">{note}</p>}
      <p className="mt-2 text-xs">{t('qr.mock')}</p>
      {onShare && (
        <Button className="mt-3 w-full" variant="secondary" onClick={onShare}>{t('qr.share')}</Button>
      )}
      </div>
    </article>
  )
}
