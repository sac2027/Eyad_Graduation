import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { pickSeat } from '@/features/stadiview/engine/picking'
import type { Ray } from '@/features/stadiview/engine/picking'
import { setPointerAnchor } from '@/features/stadiview/hud/pointerAnchor'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useStadium } from '@/features/stadiview/state/stadiumStore'

/** A press that travels further than this before it is released is a drag, not a click. In CSS pixels. */
export const DRAG_THRESHOLD = 5

/**
 * Finds the seat under the pointer and turns clicks into selections.
 *
 * - Hover is live only in the overview, and only for a mouse or pen: a finger has no hover.
 * - A click (a press released within a few pixels of where it began) selects the seat under it, in
 *   the overview and during a flight. In first person the pointer turns the view and picks nothing.
 * - At most one seat search runs per frame, however many pointer events arrive.
 * - A still pointer is searched again when the camera moves under it, so the highlight stays true
 *   while the stadium turns.
 */
export function usePointerPicking(): void {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)

  const live = useRef({
    /** Pointer position in CSS pixels. */
    x: 0,
    y: 0,
    /** Whether a hovering pointer is over the canvas. */
    over: false,
    /** Whether the pointer moved since the last search. */
    moved: false,
    /** The press in progress, if any. */
    press: null as { id: number; x: number; y: number; dragged: boolean } | null,
    /** How many pointers are down; more than one is a pinch, never a click. */
    down: 0,
    /** The camera's pose at the last search. */
    pose: new Float64Array(7),
  })

  // One ray and one vector, reused for every search so nothing is allocated per frame.
  const ray = useRef<Ray>({ ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: -1 })
  const point = useRef(new Vector3())

  /** The index of the seat under a point of the viewport, or -1. */
  const seatAt = (clientX: number, clientY: number): number => {
    const rect = gl.domElement.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return -1
    camera.updateMatrixWorld()
    const p = point.current.set(((clientX - rect.left) / rect.width) * 2 - 1, 1 - ((clientY - rect.top) / rect.height) * 2, 0.5).unproject(camera)
    const r = ray.current
    r.ox = camera.position.x
    r.oy = camera.position.y
    r.oz = camera.position.z
    const dx = p.x - r.ox
    const dy = p.y - r.oy
    const dz = p.z - r.oz
    const length = Math.hypot(dx, dy, dz)
    if (length === 0) return -1
    r.dx = dx / length
    r.dy = dy / length
    r.dz = dz / length
    return pickSeat(r, getVenue())
  }

  useEffect(() => {
    const el = gl.domElement
    const s = live.current

    const move = (e: PointerEvent) => {
      s.x = e.clientX
      s.y = e.clientY
      if (s.press && e.pointerId === s.press.id && Math.hypot(e.clientX - s.press.x, e.clientY - s.press.y) > DRAG_THRESHOLD) s.press.dragged = true
      if (e.pointerType === 'touch') return
      s.over = true
      s.moved = true
      // Under reduced motion the scene is drawn only on demand, so ask for the frame that will run the search.
      invalidate()
    }
    const down = (e: PointerEvent) => {
      s.down++
      // Only a plain press of the main button, or a single finger, can become a click.
      s.press = s.down === 1 && e.button === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY, dragged: false } : null
    }
    const up = (e: PointerEvent) => {
      s.down = Math.max(0, s.down - 1)
      const press = s.press
      s.press = null
      if (!press || press.id !== e.pointerId || press.dragged) return
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_THRESHOLD) return
      const store = useStadium.getState()
      if (store.mode === 'pov') return
      const i = seatAt(e.clientX, e.clientY)
      if (i >= 0) store.select(i)
    }
    const cancel = () => {
      s.down = 0
      s.press = null
    }
    const leave = () => {
      s.over = false
      s.moved = false
      useStadium.getState().setHover(-1)
      el.style.cursor = ''
    }

    el.addEventListener('pointermove', move)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', cancel)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', cancel)
      el.removeEventListener('pointerleave', leave)
      el.style.cursor = ''
    }
    // seatAt reads only refs and the stable renderer and camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera, invalidate])

  useFrame(() => {
    const s = live.current
    if (!s.over) return
    const store = useStadium.getState()
    if (store.mode !== 'orbit' || s.down > 0) {
      // Dragging the view, flying, or sitting in a seat: nothing is under the pointer, and the
      // cursor goes back to the hand the stylesheet gives the canvas.
      if (store.hover !== -1) store.setHover(-1)
      if (gl.domElement.style.cursor) gl.domElement.style.cursor = ''
      return
    }
    // Search again when the pointer moved, or when the camera moved under a still pointer.
    const e = camera.matrixWorld.elements
    const p = s.pose
    const cameraMoved = p[0] !== e[12] || p[1] !== e[13] || p[2] !== e[14] || p[3] !== e[0] || p[4] !== e[5] || p[5] !== e[10] || p[6] !== e[8]
    if (!s.moved && !cameraMoved) return
    s.moved = false
    p[0] = e[12]
    p[1] = e[13]
    p[2] = e[14]
    p[3] = e[0]
    p[4] = e[5]
    p[5] = e[10]
    p[6] = e[8]

    const i = seatAt(s.x, s.y)
    // The position first, so the tooltip is already in place when the seat changes.
    setPointerAnchor(s.x, s.y)
    store.setHover(i)
    gl.domElement.style.cursor = i >= 0 ? 'pointer' : ''
  })
}
