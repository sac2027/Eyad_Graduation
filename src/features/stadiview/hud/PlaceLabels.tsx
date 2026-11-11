import { useEffect, useRef } from 'react'
import { onPlaces, PLACES } from '@/features/stadiview/hud/placeAnchors'
import type { PlaceId } from '@/features/stadiview/hud/placeAnchors'
import { useT } from '@/i18n'

/**
 * Small plates naming the Procession Gate (بوابة المسيرة), the Procession Start (نقطة بداية
 * المسيرة) and the Procession Exit (بوابة الخروج) in the overview. They follow their places as
 * the camera turns, and are gone in first person (the landmark chips take over there).
 * They are for the eye; the same places are named on the 2D map and in the plan's words.
 */
export function PlaceLabels() {
  const t = useT()
  const refs = useRef<Partial<Record<PlaceId, HTMLSpanElement | null>>>({})
  useEffect(
    () =>
      onPlaces((at) => {
        for (const p of PLACES) {
          const el = refs.current[p.id]
          if (!el) continue
          const pos = at[p.id]
          if (!pos) {
            el.style.visibility = 'hidden'
            continue
          }
          el.style.visibility = 'visible'
          el.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px) translate(-50%, -100%)`
        }
      }),
    [],
  )
  return (
    <div className="sv-places" aria-hidden data-sv-places>
      {PLACES.map((p) => (
        <span
          key={p.id}
          ref={(el) => {
            refs.current[p.id] = el
          }}
          className={`sv-place sv-place--${p.id}`}
          style={{ visibility: 'hidden' }}
          data-sv-place={p.id}
        >
          {t(`sv.place.${p.id}`)}
        </span>
      ))}
    </div>
  )
}
