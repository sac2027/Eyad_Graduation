import type { HonorTier } from '@/domain/types'
import { AWARD_PROFILE } from './awardGeometry'
import { TIER_MATERIALS } from './tierMaterials'

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`
}

/** The same award as a flat picture, for devices without WebGL, low-end devices, or anyone who prefers less. */
export function AwardFallback({ tier, name, animate }: { tier: HonorTier; name: string; animate: boolean }) {
  const m = TIER_MATERIALS[tier]
  const cx = 100
  const k = 118 // px per unit of radius
  const ky = 78
  const base = 372
  const pts = AWARD_PROFILE.filter(([r]) => r > 0)
  const side = (sign: number) => pts.map(([r, y]) => `${(cx + sign * r * k).toFixed(1)},${(base - y * ky).toFixed(1)}`)
  const left = side(-1)
  const right = side(1).reverse()
  const outline = [...left, ...right].join(' ')
  const inner = (f: number) => [...pts.map(([r, y]) => `${(cx - r * k * f).toFixed(1)},${(base - y * ky).toFixed(1)}`), ...pts.map(([r, y]) => `${(cx + r * k * f).toFixed(1)},${(base - y * ky).toFixed(1)}`).reverse()].join(' ')
  return (
    <svg viewBox="0 0 200 420" role="img" aria-label={name} data-award-fallback={tier} className={animate ? 'award-fallback-rise h-full max-h-[70dvh] w-auto' : 'h-full max-h-[70dvh] w-auto'}>
      <polygon points={outline} fill={shade(m.color, 0.72)} />
      <polygon points={inner(0.36)} fill={m.color} />
      <polygon points={inner(0.12)} fill={shade(m.color, 1.15)} />
      <rect x="52" y="372" width="96" height="14" rx="2" fill={shade(m.color, 0.6)} />
      <rect x="62" y="376" width="76" height="7" fill={m.plaque} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={cx - 24 + i * 12} y="86" width="5" height="22" fill="#1a1a1a" opacity="0.8" />
      ))}
    </svg>
  )
}
