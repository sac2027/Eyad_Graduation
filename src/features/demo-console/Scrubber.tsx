import type { KeyboardEvent } from 'react'
import { SCHEDULE, STAGE_ORDER } from '@/time/schedule'

export const SCRUB_MIN = Date.parse('2026-11-05T00:00:00+03:00')
export const SCRUB_MAX = Date.parse('2027-04-30T23:59:59+03:00')
const HOUR = 3_600_000
const DAY = 24 * HOUR

export function deadlineTicks(): { id: string; at: number }[] {
  const out: { id: string; at: number }[] = []
  for (const id of STAGE_ORDER) {
    const due = SCHEDULE.stages[id].due
    if (due !== undefined) out.push({ id: `${id}-due`, at: due })
  }
  out.push({ id: 'launch', at: SCHEDULE.launch })
  out.push({ id: 'honors', at: SCHEDULE.honorsDayStart })
  out.push({ id: 'ceremony', at: SCHEDULE.ceremonyDay.ceremony.start })
  return out
}

interface ScrubberProps {
  value: number
  onChange: (ms: number) => void
  min?: number
  max?: number
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export function Scrubber({ value, onChange, min = SCRUB_MIN, max = SCRUB_MAX }: ScrubberProps) {
  const ticks = deadlineTicks()
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const step = e.shiftKey ? DAY : HOUR
    onChange(clamp(value + (e.key === 'ArrowRight' ? step : -step), min, max))
  }
  return (
    <div className="relative pt-5" dir="ltr">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-5" aria-hidden>
        {ticks.map((t) => (
          <span
            key={t.id}
            data-tick={t.id}
            title={t.id}
            className="absolute top-0 h-5 w-0.5 bg-green"
            style={{ left: `${((clamp(t.at, min, max) - min) / (max - min)) * 100}%` }}
          />
        ))}
      </div>
      <input
        type="range"
        aria-label="Simulated date and time"
        className="w-full accent-green"
        min={min}
        max={max}
        step={HOUR}
        value={clamp(value, min, max)}
        onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
        onKeyDown={onKey}
      />
    </div>
  )
}
