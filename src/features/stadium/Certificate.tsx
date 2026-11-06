import { ICONMARK_BOX, ICONMARK_D } from '@/brand/logo/iconmark'
import { useT } from '@/i18n'

interface Props {
  /** Width in px; the document is 160 x 112 (landscape, like a degree certificate). */
  size: number
  labelled?: boolean
  className?: string
}

/** Seal edge: a 24-point notched circle, so it reads as an embossed seal, not a dot. */
function sealPath(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2
    const rr = i % 2 === 0 ? r : r * 0.88
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}

/** The graduate's certificate: paper, emblem, lines of text, a green seal and a gold ribbon. */
export function Certificate({ size, labelled = false, className = '' }: Props) {
  const t = useT()
  const label = t('cert.label')
  const s = 22 / ICONMARK_BOX.h
  return (
    <figure className={`inline-flex flex-col items-center ${className}`} role="img" aria-label={label} data-certificate>
      <svg viewBox="0 0 160 124" width={size} height={(size * 124) / 160} aria-hidden>
        {/* ribbon tails behind the seal */}
        <path d="M116 92 L108 122 L116 116 L122 123 L124 94 Z" fill="#F0BA4F" />
        <path d="M128 92 L132 121 L137 114 L145 119 L137 90 Z" fill="#F0BA4F" />
        {/* paper */}
        <rect x="2" y="2" width="156" height="108" rx="3" fill="#ECE0C7" />
        <rect x="7" y="7" width="146" height="98" rx="2" fill="none" stroke="#AA8C6D" strokeWidth="2" />
        <rect x="11" y="11" width="138" height="90" rx="1.5" fill="none" stroke="#AA8C6D" strokeWidth="0.8" />
        {/* emblem */}
        <g transform={`translate(${80 - (ICONMARK_BOX.w * s) / 2} ${16 - ICONMARK_BOX.y * s}) scale(${s})`}>
          <path d={ICONMARK_D} fill="#115F66" />
        </g>
        {/* lines of text */}
        <rect x="38" y="45" width="84" height="5" rx="2.5" fill="#0b2f33" />
        <rect x="30" y="57" width="100" height="2.6" rx="1.3" fill="#0b2f33" opacity="0.7" />
        <rect x="44" y="64" width="72" height="2.6" rx="1.3" fill="#0b2f33" opacity="0.7" />
        <rect x="24" y="86" width="34" height="1.6" rx="0.8" fill="#0b2f33" opacity="0.6" />
        <rect x="24" y="80" width="26" height="4" rx="2" fill="#0b2f33" opacity="0.35" />
        {/* seal */}
        <path d={sealPath(126, 84, 17)} fill="#009767" />
        <circle cx="126" cy="84" r="11.5" fill="none" stroke="#ECE0C7" strokeWidth="1" opacity="0.8" />
        <circle cx="126" cy="84" r="5" fill="#ECE0C7" opacity="0.85" />
      </svg>
      {labelled && <figcaption className="mt-1 text-center text-sm font-bold" aria-hidden>{label}</figcaption>}
    </figure>
  )
}
