import { SCHEDULE, type Schedule } from '@/time/schedule'

/** True only when time moves forward across the end of the ceremony. Never on re-renders or when scrubbing backwards. */
export function shouldPlayCompletion(prev: number, next: number, s: Schedule = SCHEDULE): boolean {
  return prev < s.afterglowStart && s.afterglowStart <= next
}

const DAY = 24 * 3_600_000

/** Whole calendar days since ceremony day began (9 April is day 2). */
export function daysSinceCeremony(now: number, s: Schedule = SCHEDULE): number {
  return Math.max(0, Math.floor((now - s.ceremonyDayStart) / DAY))
}

/** Bar x positions and their octagon vertical extent, used for the seal the Matrix settles into. */
export function octagonSpans(cx: number, cy: number, r: number, bars: number): { x: number; y: number; h: number }[] {
  const pts = Array.from({ length: 8 }, (_, k) => {
    const a = ((22.5 + 45 * k) * Math.PI) / 180
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
  const left = Math.min(...pts.map((p) => p.x))
  const right = Math.max(...pts.map((p) => p.x))
  const out: { x: number; y: number; h: number }[] = []
  for (let i = 0; i < bars; i++) {
    const x = left + ((i + 0.5) / bars) * (right - left)
    const ys: number[] = []
    for (let k = 0; k < 8; k++) {
      const a = pts[k]
      const b = pts[(k + 1) % 8]
      if ((a.x <= x && x <= b.x) || (b.x <= x && x <= a.x)) {
        if (a.x === b.x) ys.push(a.y, b.y)
        else ys.push(a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x))
      }
    }
    const top = Math.min(...ys)
    const bottom = Math.max(...ys)
    out.push({ x, y: top, h: bottom - top })
  }
  return out
}
