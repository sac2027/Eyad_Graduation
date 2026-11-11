import { useCallback, useEffect, useRef, useState } from 'react'
import { extendDebugHook } from '@/features/stadiview/debugHook'
import { parseSeatQuery, planBounds, seatAtPlan } from '@/features/stadiview/engine/planIndex'
import { fitView, panBy, toPlan, toScreen, zoomAt } from '@/features/stadiview/engine/planView'
import type { PlanView } from '@/features/stadiview/engine/planView'
import { MatrixFilters } from '@/features/stadiview/hud/MatrixFilters'
import { drawMatrix } from '@/features/stadiview/hud/matrixDraw'
import { setPointerAnchor } from '@/features/stadiview/hud/pointerAnchor'
import { useSeatStyles } from '@/features/stadiview/hud/useSeatStyles'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { cameraOnPlan, onCameraOnPlan } from '@/features/stadiview/state/cameraOnPlan'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useStadium } from '@/features/stadiview/state/stadiumStore'
import { useViewer } from '@/features/stadiview/state/useViewer'
import { formatNumber, useLocale, useT } from '@/i18n'

/** A press that moves further than this is a drag of the map, not a click on a seat. */
const DRAG = 4
/** On the map a finger or a pointer may be this far from a seat's centre and still mean it, in metres at most and in pixels at least. */
const REACH_METRES = 0.45
const REACH_PIXELS = 7

/**
 * The 2D seat matrix: the whole stadium from above, with every seat.
 *
 * It is drawn from the same layout as the 3D scene and shares its hover, its inspected seat and
 * its filters, so the two always agree. A click inspects a seat; a double click flies into it.
 */
export function SeatMatrix({ canFly }: { canFly: boolean }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const viewer = useViewer()
  const { styles, booked, total } = useSeatStyles()
  const inspected = useHud((s) => s.inspected)

  const card = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const view = useRef<PlanView | null>(null)
  const size = useRef({ w: 0, h: 0 })
  const frame = useRef(0)
  const scene = useRef({ styles, inspected, labels: { stage: '', north: '', gate: (n: number) => String(n) } })
  scene.current = { styles, inspected, labels: { stage: t('sv.mx.stage'), north: t('sv.mx.north'), gate: (n) => formatNumber(n, locale) } }

  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 640)
  const [query, setQuery] = useState('')
  const [missing, setMissing] = useState(false)

  /** Draws on the next animation frame; any number of requests before then make one drawing. */
  const redraw = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const el = canvas.current
      const ctx = el?.getContext('2d')
      if (!el || !ctx || !view.current || size.current.w === 0) return
      const ratio = el.width / size.current.w
      drawMatrix(ctx, {
        v: getVenue(),
        styles: scene.current.styles,
        view: view.current,
        width: size.current.w,
        height: size.current.h,
        ratio,
        hover: useStadium.getState().hover,
        inspected: scene.current.inspected,
        camera: cameraOnPlan(),
        labels: scene.current.labels,
      })
      card.current?.setAttribute('data-scale', view.current.scale.toFixed(3))
    })
  }, [])

  const fit = useCallback(
    (what: 'all' | 'pitch' | { zone: number }) => {
      if (size.current.w === 0) return
      view.current = fitView(planBounds(getVenue(), what), size.current.w, size.current.h, what === 'all' ? 8 : 18)
      redraw()
    },
    [redraw],
  )

  // Other panels can ask the matrix to show a part of the venue ("Change seat" shows the graduate's zone).
  const fitRequest = useHud((s) => s.matrixFit)
  const answered = useRef(fitRequest.token)
  useEffect(() => {
    if (fitRequest.token === answered.current) return
    answered.current = fitRequest.token
    setOpen(true)
    // The card may have been closed: its canvas gets a size one frame after it opens.
    const frame = requestAnimationFrame(() => fit(fitRequest.what))
    return () => cancelAnimationFrame(frame)
  }, [fitRequest, fit])

  // The canvas follows the size of its box, at the screen's own sharpness.
  useEffect(() => {
    const el = canvas.current
    if (!el || !open) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w === 0 || h === 0) return
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      el.width = Math.round(w * ratio)
      el.height = Math.round(h * ratio)
      const first = size.current.w === 0 || !view.current
      size.current = { w, h }
      if (first) view.current = fitView(planBounds(getVenue(), 'pitch'), w, h, 18)
      redraw()
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(el)
    return () => observer?.disconnect()
  }, [open, redraw])

  // Anything that changes the picture asks for one redraw.
  useEffect(redraw, [styles, inspected, locale, redraw])
  useEffect(() => {
    const stopHover = useStadium.subscribe((now, before) => {
      if (now.hover === before.hover) return
      card.current?.setAttribute('data-hover', getVenue().idOf(now.hover))
      redraw()
    })
    const stopCamera = onCameraOnPlan(redraw)
    return () => {
      stopHover()
      stopCamera()
      if (frame.current) cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [redraw])

  // The seat under a point of the canvas, with a reach that suits the zoom.
  const seatAt = (clientX: number, clientY: number): number => {
    const el = canvas.current
    if (!el || !view.current) return -1
    const rect = el.getBoundingClientRect()
    const [x, z] = toPlan(view.current, clientX - rect.left, clientY - rect.top, size.current.w, size.current.h)
    return seatAtPlan(x, z, getVenue(), Math.max(REACH_METRES, REACH_PIXELS / view.current.scale))
  }

  // Pointer: drag pans, pinch and wheel zoom, a still pointer hovers, a click inspects.
  useEffect(() => {
    const el = canvas.current
    if (!el || !open) return
    const pointers = new Map<number, { x: number; y: number }>()
    let press: { x: number; y: number; dragged: boolean } | null = null
    let spread = 0

    const local = (e: { clientX: number; clientY: number }) => {
      const rect = el.getBoundingClientRect()
      return [e.clientX - rect.left, e.clientY - rect.top] as const
    }
    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture?.(e.pointerId)
      press = pointers.size === 1 ? { x: e.clientX, y: e.clientY, dragged: false } : null
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        spread = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId)
      if (!p) {
        // Not pressed: the pointer is only passing over.
        if (e.pointerType !== 'touch') {
          setPointerAnchor(e.clientX, e.clientY)
          useStadium.getState().setHover(seatAt(e.clientX, e.clientY))
        }
        return
      }
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (!view.current) return
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const now = Math.hypot(a.x - b.x, a.y - b.y)
        if (spread > 0 && now > 0) {
          const [mx, my] = local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 })
          view.current = zoomAt(view.current, now / spread, mx, my, size.current.w, size.current.h)
        }
        spread = now
        redraw()
        return
      }
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG) press.dragged = true
      if (press?.dragged) {
        view.current = panBy(view.current, dx, dy)
        useStadium.getState().setHover(-1)
        redraw()
      }
    }
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return
      el.releasePointerCapture?.(e.pointerId)
      const was = press
      press = null
      if (!was || was.dragged || pointers.size > 0) return
      const seat = seatAt(e.clientX, e.clientY)
      if (seat >= 0) useHud.getState().inspect(seat)
    }
    const cancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      press = null
    }
    const leave = () => {
      if (pointers.size === 0) useStadium.getState().setHover(-1)
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!view.current) return
      const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1)
      const [px, py] = local(e)
      view.current = zoomAt(view.current, Math.exp(-Math.min(Math.max(pixels, -240), 240) * 0.0022), px, py, size.current.w, size.current.h)
      redraw()
    }
    const double = () => {
      // The two clicks of a double click have each inspected the seat under the pointer; fly to that
      // one, not to a second guess (a double-click event reports whole pixels, a pointer event does not).
      const seat = useHud.getState().inspected
      if (seat >= 0 && canFly) useStadium.getState().select(seat)
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', cancel)
    el.addEventListener('pointerleave', leave)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('dblclick', double)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', cancel)
      el.removeEventListener('pointerleave', leave)
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('dblclick', double)
    }
    // seatAt reads only refs.
     
  }, [open, canFly, redraw])

  // For tests: where a seat is on the map, in viewport pixels.
  useEffect(() => {
    extendDebugHook({
      matrixPoint: (seatId) => {
        const v = getVenue()
        const i = v.indexOf(seatId)
        const el = canvas.current
        if (i < 0 || !el || !view.current) return null
        const [x, y] = toScreen(view.current, v.position[i * 3], v.position[i * 3 + 2], size.current.w, size.current.h)
        if (x < 0 || y < 0 || x > size.current.w || y > size.current.h) return null
        const rect = el.getBoundingClientRect()
        return { x: rect.left + x, y: rect.top + y }
      },
    })
  }, [])

  const zoom = (factor: number) => {
    if (!view.current) return
    view.current = zoomAt(view.current, factor, size.current.w / 2, size.current.h / 2, size.current.w, size.current.h)
    redraw()
  }

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    const v = getVenue()
    const seat = parseSeatQuery(query, v)
    setMissing(seat < 0 && query.trim() !== '')
    if (seat < 0) return
    useHud.getState().inspect(seat)
    // Bring the seat into view, close enough to tell it from its neighbours.
    if (view.current) {
      view.current = { cx: v.position[seat * 3], cz: v.position[seat * 3 + 2], scale: Math.max(view.current.scale, 9) }
      redraw()
    }
  }

  const count = { booked: formatNumber(booked, locale), total: formatNumber(total, locale) }

  return (
    <section ref={card} className="sv-card sv-mx" data-seat-matrix data-open={open ? '' : undefined} data-inspected={getVenue().idOf(inspected)} data-hover="" aria-label={t('sv.mx.title')}>
      <div className="sv-matrix" aria-hidden />
      <header className="sv-mx__head">
        <h2>{t('sv.mx.title')}</h2>
        <p data-sv-count>{t('sv.mx.count', count)}</p>
        <button type="button" className="sv-icon" aria-expanded={open} aria-label={t(open ? 'sv.mx.hide' : 'sv.mx.show')} onClick={() => setOpen((o) => !o)} data-sv-matrix-toggle>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
            <path d={open ? 'M5 9l7 7 7-7' : 'M5 15l7-7 7 7'} />
          </svg>
        </button>
      </header>
      {open && (
        <>
          <div className="sv-mx__tools">
            <form onSubmit={search} role="search">
              <input
                className="sv-field"
                type="search"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setMissing(false)
                }}
                aria-label={t('sv.mx.search.label')}
                aria-invalid={missing || undefined}
                aria-describedby={missing ? 'sv-mx-missing' : undefined}
                placeholder={t('sv.mx.search.hint', { example: 'P3-12-07' })}
                data-sv-seat-search
              />
            </form>
            <div className="sv-mx__zoom">
              <button type="button" className="sv-icon" aria-label={t('sv.mx.zoomOut')} onClick={() => zoom(1 / 1.5)}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square"><path d="M5 12h14" /></svg>
              </button>
              <button type="button" className="sv-icon" aria-label={t('sv.mx.zoomIn')} onClick={() => zoom(1.5)}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square"><path d="M5 12h14M12 5v14" /></svg>
              </button>
            </div>
          </div>
          {missing && (
            <p id="sv-mx-missing" className="sv-mx__missing" role="alert">
              {t('sv.mx.search.none')}
            </p>
          )}
          <div className="sv-mx__map">
            <canvas ref={canvas} role="img" aria-label={t('sv.mx.summary', count)} />
          </div>
          <div className="sv-mx__fit" role="group" aria-label={t('sv.mx.fit.label')}>
            <button type="button" className="sv-chip" onClick={() => fit('all')} data-sv-fit="all">{t('sv.mx.fit.all')}</button>
            <button type="button" className="sv-chip" onClick={() => fit('pitch')} data-sv-fit="pitch">{t('sv.mx.fit.pitch')}</button>
            {viewer.graduate && (
              <button type="button" className="sv-chip" onClick={() => fit({ zone: viewer.graduate!.zone })} data-sv-fit="zone">{t('sv.mx.fit.zone')}</button>
            )}
          </div>
          <MatrixFilters />
          <ul className="sv-mx__legend" aria-label={t('sv.mx.legend')}>
            <li><i style={{ background: '#009C5A' }} />{t('sv.status.available')}</li>
            <li><i style={{ background: '#1F3F38', outline: '1px solid rgb(232 222 195 / 0.35)' }} />{t('sv.status.taken')}</li>
            <li><i style={{ background: '#E7A614' }} />{t('sv.mx.legend.gold')}</li>
          </ul>
        </>
      )}
    </section>
  )
}
