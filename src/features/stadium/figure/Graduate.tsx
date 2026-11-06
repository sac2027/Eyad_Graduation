import { useId, useRef } from 'react'
import { useWalkFrame } from './useWalkFrame'
import { HOLD_FRAMES, HOLD_HANDS, WALK_FRAMES, type Outfit } from './frames'

export type GraduateMode = 'walk' | 'still' | 'hold-certificate'

interface Props {
  outfit: Outfit
  /** Height in px; width follows the 100 x 240 box. */
  height: number
  mode: GraduateMode
  aura?: 'soft' | 'bright'
  /** Walk frame to show (0..11). The walk animation drives this. */
  frame?: number
  /** Top-left position when nested inside another SVG. */
  x?: number
  y?: number
  className?: string
}

const INK = '#0b2f33'

/** Box geometry, for placing the figure by its feet: the box is 160 x 290, feet at y 232 + 30. */
export const FIGURE_BOX = { w: 160, h: 290, feetY: 262, centerX: 80, bodyH: 240 }

/** The graduate: a faceless silhouette from behind, with a soft gold aura and a thin rim of stage light. */
export function Graduate({ outfit, height, mode, aura = 'soft', frame, x, y, className = '' }: Props) {
  const id = useId().replace(/:/g, '')
  const ref = useRef<SVGSVGElement>(null)
  // Without a fixed frame, a walking figure animates itself.
  const live = useWalkFrame(mode === 'walk' && frame === undefined, ref)
  const shown = mode === 'walk' ? (frame ?? live) % 12 : 0
  const d = mode === 'hold-certificate' ? HOLD_FRAMES[outfit] : WALK_FRAMES[outfit][shown]
  const auraOpacity = aura === 'bright' ? 0.6 : 0.35
  return (
    <svg
      ref={ref}
      viewBox="-30 -30 160 290"
      x={x}
      y={y}
      width={(height * 160) / 290}
      height={height}
      className={`overflow-visible ${className}`}
      aria-hidden
      data-graduate={outfit}
      data-mode={mode}
      data-frame={shown}
    >
      <defs>
        <filter id={`aura-${id}`} x="-60%" y="-40%" width="220%" height="180%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <g data-aura className="graduate-aura">
        <ellipse cx="50" cy="120" rx="46" ry="118" fill="#F0BA4F" opacity={auraOpacity} filter={`url(#aura-${id})`} />
        <ellipse cx="50" cy="40" rx="30" ry="34" fill="#ECE0C7" opacity={auraOpacity * 0.5} filter={`url(#aura-${id})`} />
      </g>
      <path d={d} fill={INK} stroke="#ECE0C7" strokeOpacity="0.4" strokeWidth="1.4" paintOrder="stroke" strokeLinejoin="round" />
      {mode === 'hold-certificate' && <HeldCertificate />}
    </svg>
  )
}

/** A small certificate between the raised hands (same design language as the full certificate). */
function HeldCertificate() {
  const w = 40
  const h = 28
  const x = HOLD_HANDS.x - w / 2
  const y = HOLD_HANDS.y - h + 6
  return (
    <g data-held-certificate>
      <rect x={x} y={y} width={w} height={h} rx="1.5" fill="#ECE0C7" />
      <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx="1" fill="none" stroke="#AA8C6D" strokeWidth="1" />
      <rect x={x + 9} y={y + 9} width={w - 18} height="2" rx="1" fill={INK} />
      <rect x={x + 7} y={y + 14} width={w - 14} height="1.2" rx="0.6" fill={INK} opacity="0.7" />
      <circle cx={x + w - 8} cy={y + h - 7} r="4" fill="#009767" />
    </g>
  )
}
