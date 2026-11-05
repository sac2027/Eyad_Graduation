import { useState } from 'react'
import { useT } from '@/i18n'
import { Chip } from '@/ui/Chip'

const GATES = [
  { n: 1, x: 500, y: 70, color: '#71b8d4' },
  { n: 2, x: 850, y: 230, color: '#009767' },
  { n: 3, x: 150, y: 230, color: '#115f66' },
  { n: 4, x: 760, y: 430, color: '#aa8c6d' },
  { n: 5, x: 500, y: 490, color: '#f0ba4f' },
] as const

const PARKING = [
  { id: 'P1', x: 470, y: 8, w: 60 },
  { id: 'P2', x: 580, y: 8, w: 60 },
  { id: 'P3', x: 20, y: 200, w: 60 },
]

/** A mock stadium map. Every label is real text so it works in Arabic and English. */
export function GateMap({ showFacilities = false }: { showFacilities?: boolean }) {
  const t = useT()
  const [gate, setGate] = useState<number>(1)
  return (
    <div data-gate-map className="grid gap-4 md:grid-cols-[1fr_16rem]">
      <figure className="rounded-2xl bg-white p-3">
        <svg viewBox="0 0 1000 540" role="img" aria-label={t('map.title')} className="h-auto w-full">
          <ellipse cx="500" cy="270" rx="400" ry="215" fill="#ece0c7" />
          <ellipse cx="500" cy="270" rx="290" ry="140" fill="#009767" opacity="0.9" />
          <text x="500" y="285" textAnchor="middle" fontSize="26" fontWeight="700" fill="#ece0c7">{t('map.field')}</text>
          <rect x="455" y="110" width="90" height="26" fill="#115f66" />
          <text x="500" y="129" textAnchor="middle" fontSize="16" fill="#ece0c7">{t('map.stage')}</text>
          {PARKING.map((p) => (
            <g key={p.id}>
              <rect x={p.x} y={p.y} width={p.w} height="42" rx="6" fill="#adacad" />
              <text x={p.x + p.w / 2} y={p.y + 27} textAnchor="middle" fontSize="18" fontWeight="700" fill="#000">{p.id}</text>
            </g>
          ))}
          {showFacilities && (
            <g fontSize="16" fill="#115f66" fontWeight="600">
              <circle cx="260" cy="110" r="9" fill="#71b8d4" /><text x="276" y="116">{t('map.restrooms')}</text>
              <circle cx="640" cy="440" r="9" fill="#f0ba4f" /><text x="656" y="446">{t('map.prayer')}</text>
              <circle cx="300" cy="440" r="9" fill="#de5e5e" /><text x="316" y="446">{t('map.medical')}</text>
              <circle cx="700" cy="110" r="9" fill="#aa8c6d" /><text x="716" y="116">{t('map.photos')}</text>
            </g>
          )}
          {GATES.map((g) => (
            <g key={g.n} data-gate-marker={g.n} opacity={gate === g.n ? 1 : 0.55}>
              <rect x={g.x - 40} y={g.y - 22} width="80" height="44" rx="8" fill={g.color} stroke={gate === g.n ? '#000' : 'none'} strokeWidth="4" />
              <text x={g.x} y={g.y + 8} textAnchor="middle" fontSize="24" fontWeight="900" fill={g.n === 3 ? '#ece0c7' : '#000'}>{g.n}</text>
            </g>
          ))}
        </svg>
        <figcaption className="px-2 pb-1 text-xs text-gray-700">{t('guide.mock-map')}</figcaption>
      </figure>
      <div className="grid content-start gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('gates.title')}>
          {GATES.map((g) => (
            <Chip key={g.n} selected={gate === g.n} onToggle={() => setGate(g.n)} data-gate-chip={g.n}>{t(`gate.${g.n}`)}</Chip>
          ))}
        </div>
        <p className="rounded-xl bg-white p-4 font-semibold" data-gate-note aria-live="polite">{t(`gate.${gate}.note`)}</p>
        <ul className="rounded-xl bg-white p-4 text-sm">
          <li>{t('parking.p1')}</li>
          <li>{t('parking.p3')}</li>
        </ul>
      </div>
    </div>
  )
}
