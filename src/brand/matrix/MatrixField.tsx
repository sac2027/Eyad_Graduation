import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from '@/ui/motionPrefs'
import { useDemoFlags } from '@/features/demo-console/flags'
import { assertAllowedPair, MATRIX_HEX, type MatrixColor } from './pairs'

// REPLACE: this is a placeholder that follows the published construction rules (5 degree skew, Bold/Medium/Light units).
// Swap for FAST Matrix Generator exports (SVG or .webm loops in public/matrix/) when they are available.

const SKEW_DEG = 5
const CELL = 40

function hash(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function smoothNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = hash(x0, y0, seed)
  const b = hash(x0 + 1, y0, seed)
  const c = hash(x0, y0 + 1, seed)
  const d = hash(x0 + 1, y0 + 1, seed)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

type Unit = 'light' | 'medium' | 'bold'
const UNIT_WIDTHS: Record<Unit, number[]> = {
  light: [0.05, 0.05, 0.05],
  medium: [0.11, 0.11, 0.11],
  bold: [0.2, 0.2, 0.2],
}

export interface MatrixRect {
  x: number
  y: number
  w: number
  h: number
}

/** Pure and deterministic: the same inputs always give the same rectangles. */
export function buildMatrix(opts: { seed: number; density: number; frequency: number; cols: number; rows: number; time?: number }): MatrixRect[] {
  const { seed, density, frequency, cols, rows, time = 0 } = opts
  const rects: MatrixRect[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Rows drift sideways with time, quantised to cells, so the pattern steps instead of fading.
      const n = smoothNoise(c * frequency * 8 + time * 0.6, r * frequency * 14 - time * 0.2, seed)
      const cut = 1 - density
      if (n < cut) continue
      const k = (n - cut) / Math.max(density, 0.0001)
      const unit: Unit = k < 0.34 ? 'light' : k < 0.67 ? 'medium' : 'bold'
      const widths = UNIT_WIDTHS[unit]
      const gap = (1 - widths.reduce((a, b) => a + b, 0)) / (widths.length + 0)
      let x = c * CELL + gap * CELL * 0.5
      for (const w of widths) {
        rects.push({ x, y: r * CELL, w: w * CELL, h: CELL })
        x += (w + gap) * CELL
      }
    }
  }
  return rects
}

export interface MatrixFieldProps {
  background: MatrixColor
  stripes: MatrixColor
  seed?: number
  /** 0..1, share of cells that carry stripes. */
  density?: number
  /** Spatial variation, about 0.01 (smooth) to 0.3 (busy). */
  frequency?: number
  animate?: boolean
  cols?: number
  rows?: number
  className?: string
  /** Draw only the stripes and keep the background transparent. */
  transparent?: boolean
}

export function MatrixField({
  background,
  stripes,
  seed = 10,
  density = 0.55,
  frequency = 0.06,
  animate = false,
  cols = 24,
  rows = 12,
  className,
  transparent = false,
}: MatrixFieldProps) {
  assertAllowedPair(background, stripes)
  const reduced = useReducedMotion()
  const lowEnd = useDemoFlags((s) => s.lowEnd)
  const [time, setTime] = useState(0)
  const ref = useRef<SVGSVGElement>(null)
  const [visible, setVisible] = useState(true)
  const run = animate && !reduced && !lowEnd && visible

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!run) return
    const id = setInterval(() => setTime((t) => t + 0.08), 110)
    return () => clearInterval(id)
  }, [run])

  const rects = useMemo(() => buildMatrix({ seed, density, frequency, cols, rows, time }), [seed, density, frequency, cols, rows, time])
  const W = cols * CELL
  const H = rows * CELL
  const shift = Math.tan((SKEW_DEG * Math.PI) / 180) * H

  return (
    <svg
      ref={ref}
      aria-hidden
      focusable="false"
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      data-matrix
      data-skew={SKEW_DEG}
    >
      {!transparent && <rect x="0" y="0" width={W} height={H} fill={MATRIX_HEX[background]} />}
      <g transform={`translate(${shift} 0) skewX(-${SKEW_DEG})`} fill={MATRIX_HEX[stripes]}>
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
        ))}
      </g>
    </svg>
  )
}
