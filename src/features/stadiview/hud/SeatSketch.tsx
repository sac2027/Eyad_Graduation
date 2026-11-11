import { VENUE } from '@/features/stadiview/config/venue'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useT } from '@/i18n'

/**
 * A drawing that stands in for the view from a seat when the 3D picture cannot run: the stage, the
 * seat, and the line of sight between them, seen from above. The numbers beside it (distance,
 * angle, gate) say the rest.
 */
export function SeatSketch({ seat }: { seat: number }) {
  const t = useT()
  const v = getVenue()
  const x = v.position[seat * 3]
  const z = v.position[seat * 3 + 2]
  const [px, , pz] = VENUE.stage.podium
  // Fit the stage and the seat in the box with room around them. One metre is `k` units of the drawing.
  const minX = Math.min(x, px) - 8
  const maxX = Math.max(x, px) + 8
  const minZ = Math.min(z, pz) - 14
  const maxZ = Math.max(z, pz) + 14
  const k = Math.min(300 / (maxX - minX), 150 / (maxZ - minZ))
  const ox = (320 - (maxX - minX) * k) / 2
  const oz = (170 - (maxZ - minZ) * k) / 2
  const sx = (m: number) => ox + (m - minX) * k
  const sz = (m: number) => oz + (m - minZ) * k
  const half = 13 * k

  return (
    <figure className="sv-sketch" data-sv-sketch>
      <svg viewBox="0 0 320 170" role="img" aria-label={t('sv.sketch.label')}>
        <rect x="0" y="0" width="320" height="170" fill="#0a2119" />
        {/* The stage: a bar, facing east. */}
        <rect x={sx(px) - 5} y={sz(pz) - half} width="6" height={half * 2} fill="#e7a614" />
        <text x={sx(px) - 10} y={sz(pz)} fill="#e8dec3" fontSize="11" textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90 ${sx(px) - 10} ${sz(pz)})`}>
          {t('sv.mx.stage')}
        </text>
        {/* The line of sight. */}
        <line x1={sx(x)} y1={sz(z)} x2={sx(px)} y2={sz(pz)} stroke="#e7a614" strokeWidth="1.5" strokeDasharray="5 4" />
        {/* The seat. */}
        <rect x={sx(x) - 5} y={sz(z) - 5} width="10" height="10" fill="#ffffff" stroke="#e7a614" strokeWidth="2" />
      </svg>
      <figcaption>{t('sv.sketch.caption')}</figcaption>
    </figure>
  )
}
