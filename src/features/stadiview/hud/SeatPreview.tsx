import { useEffect, useRef, useState } from 'react'
import { clampLook, lookAngles, seatEye, seatLook } from '@/features/stadiview/engine/cameraMath'
import type { Look } from '@/features/stadiview/engine/cameraMath'
import { onPreview, PREVIEW_SIZE, requestPreview } from '@/features/stadiview/hud/previewChannel'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useT } from '@/i18n'

/** One pixel of drag turns the view by this many radians. */
const TURN = 0.006

/**
 * A small picture of the view from a seat, drawn by the 3D scene. Dragging on it turns the view.
 * On a strong device it follows the drag live; otherwise it redraws when the drag ends.
 */
export function SeatPreview({ seat, live }: { seat: number; live: boolean }) {
  const t = useT()
  const canvas = useRef<HTMLCanvasElement>(null)
  const look = useRef<Look>({ yaw: 0, pitch: 0 })
  const [shownSeat, setShownSeat] = useState(-1)

  useEffect(() => {
    const v = getVenue()
    look.current = lookAngles(seatEye(seat, v), seatLook(seat, v))
    const stop = onPreview((image, of) => {
      if (of !== seat) return
      canvas.current?.getContext('2d')?.putImageData(image, 0, 0)
      setShownSeat(of)
    })
    // A beat after the seat changes, so sweeping across the map does not ask for a picture per seat.
    const timer = window.setTimeout(() => requestPreview(seat), 140)
    return () => {
      stop()
      window.clearTimeout(timer)
    }
  }, [seat])

  // Drag to look around.
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    let last: { x: number; y: number } | null = null
    let queued = false
    const ask = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        requestPreview(seat, look.current)
      })
    }
    const down = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY }
      el.setPointerCapture?.(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!last) return
      look.current = clampLook(look.current.yaw + (e.clientX - last.x) * TURN, look.current.pitch + (e.clientY - last.y) * TURN)
      last = { x: e.clientX, y: e.clientY }
      if (live) ask()
    }
    const up = () => {
      if (!last) return
      last = null
      ask()
    }
    const key = (e: KeyboardEvent) => {
      const step = e.key === 'ArrowLeft' ? [0.12, 0] : e.key === 'ArrowRight' ? [-0.12, 0] : e.key === 'ArrowUp' ? [0, 0.08] : e.key === 'ArrowDown' ? [0, -0.08] : null
      if (!step) return
      e.preventDefault()
      look.current = clampLook(look.current.yaw + step[0], look.current.pitch + step[1])
      ask()
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('keydown', key)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('keydown', key)
    }
  }, [seat, live])

  return (
    <figure className="sv-preview" data-preview-seat={shownSeat >= 0 ? getVenue().idOf(shownSeat) : ''} data-ready={shownSeat === seat ? '' : undefined}>
      <canvas ref={canvas} width={PREVIEW_SIZE.width} height={PREVIEW_SIZE.height} tabIndex={0} role="img" aria-label={t('sv.preview.label')} />
      <figcaption>{t('sv.preview.hint')}</figcaption>
    </figure>
  )
}
