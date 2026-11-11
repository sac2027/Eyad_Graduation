import { useEffect, useMemo, useRef } from 'react'
import { Color, InstancedBufferAttribute, InstancedMesh, MeshBasicMaterial } from 'three'
import { useThree } from '@react-three/fiber'
import { pitchSeats, usePitchSeats } from '@/features/stadiview/data/pitchSeatService'
import type { SeatStatus } from '@/features/stadiview/data/pitchSeatService'
import { SeatKind } from '@/features/stadiview/layout/types'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { colorFor, FILTER_DIM, SEAT_COLORS, ZONE_DIM } from '@/features/stadiview/scene/seatColors'
import { chairGeometry, seatMatrix } from '@/features/stadiview/scene/seatGeometry'
import { poolAt } from '@/features/stadiview/scene/sceneKit'
import { filtersOff, seatMatches, useHud } from '@/features/stadiview/state/hudStore'
import type { SeatFilters } from '@/features/stadiview/state/hudStore'
import { useStadium } from '@/features/stadiview/state/stadiumStore'
import { useViewer } from '@/features/stadiview/state/useViewer'

/** A highlighted chair is drawn this much larger, so one gold seat can be found among thousands. */
const ACTIVE_SCALE = 1.3

/**
 * How bright a seat is drawn, from the floodlight that reaches it: full in the middle of the pitch,
 * about three quarters at the back of the stands. Seats are kept brighter than the concrete under
 * them so their colours stay readable everywhere.
 */
function seatLight(x: number, z: number): number {
  return 0.6 + 0.4 * poolAt(x, z)
}

/** Everything outside the camera store that decides how a seat looks. */
interface View {
  /** The viewer's directory entry and zone, when a graduate is signed in. */
  graduate: ReturnType<typeof useViewer>['graduate']
  now: number
  filters: SeatFilters
  /** A guest's own stand seat, from their ticket; -1 for none. */
  ticketSeat: number
  inspected: number
}

/**
 * All 7,998 seats, drawn as two instanced meshes: the pitch chairs with the wheelchair bays, and
 * the stand seats. Each mesh is one draw call however many chairs it holds.
 *
 * Hover and selection arrive through a store subscription and repaint only the seats that
 * changed. A change of time, of bookings, of viewer or of filters repaints them all, which is a
 * few milliseconds and happens at most once a minute unless someone acts.
 */
export function Seats() {
  const invalidate = useThree((s) => s.invalidate)
  const viewer = useViewer()
  const bookings = usePitchSeats()
  const filters = useHud((s) => s.filters)
  const ticketSeat = useHud((s) => s.guest.ticketSeat)
  const inspected = useHud((s) => s.inspected)

  const view = useRef<View>({ graduate: null, now: 0, filters, ticketSeat: -1, inspected: -1 })

  const built = useMemo(() => {
    const v = getVenue()
    // Venue indexes below `split` are in the first mesh, the rest in the second.
    const split = v.ranges.stands[0]
    const geometry = chairGeometry()
    // The chairs carry their own shading and floodlight, so they need no lamps: the cheapest material there is.
    const material = new MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    const meshes = [new InstancedMesh(geometry, material, split), new InstancedMesh(geometry, material, v.count - split)]
    meshes[0].instanceColor = new InstancedBufferAttribute(new Float32Array(split * 3), 3)
    meshes[1].instanceColor = new InstancedBufferAttribute(new Float32Array((v.count - split) * 3), 3)

    // The palette as linear light, worked out once.
    const linear = new Map<string, Color>()
    for (const hex of Object.values(SEAT_COLORS)) linear.set(hex, new Color(hex))

    /** Writes seat i's colour and size. Returns the mesh it lives in. */
    const paint = (i: number, camera: { hover: number; selected: number; mode: string }): 0 | 1 => {
      const which = i < split ? 0 : 1
      const slot = which === 0 ? i : i - split
      const mesh = meshes[which]
      const w = view.current
      const stand = v.kind[i] === SeatKind.Stand
      const status: SeatStatus = stand ? (i === w.ticketSeat ? 'mine' : 'available') : pitchSeats().statusOf(i, w.graduate, w.now)
      const active = i === camera.hover || i === camera.selected || i === w.inspected
      const x = v.position[i * 3]
      const y = v.position[i * 3 + 1]
      const z = v.position[i * 3 + 2]
      const c = linear.get(colorFor(i, v, { hover: camera.hover, selected: camera.selected, inspected: w.inspected, status }))!

      // A highlighted seat and the viewer's own are shown at full strength wherever they are.
      // Seats the filters leave out, and graduate seats outside the viewer's own zone, are drawn faint.
      let light = active || status === 'mine' ? 1 : seatLight(x, z)
      if (!active && status !== 'mine') {
        if (!filtersOff(w.filters) && !seatMatches(i, v, w.filters, status)) light *= FILTER_DIM
        else if (w.graduate && v.kind[i] === SeatKind.Pitch && v.zone[i] !== w.graduate.zone) light *= ZONE_DIM
      }
      const colors = mesh.instanceColor!.array as Float32Array
      colors[slot * 3] = c.r * light
      colors[slot * 3 + 1] = c.g * light
      colors[slot * 3 + 2] = c.b * light
      // The larger size helps find a seat from far away. Up close, flying in or sitting in it, a swollen chair would only look wrong.
      const large = (active || status === 'mine') && camera.mode === 'orbit'
      seatMatrix(mesh.instanceMatrix.array as Float32Array, slot, x, y, z, v.yaw[i], large ? ACTIVE_SCALE : 1)
      return which
    }

    for (const mesh of meshes) {
      // The chairs never move as a whole; their matrices are written by `paint`.
      mesh.matrixAutoUpdate = false
    }
    return { v, split, geometry, material, meshes, paint }
  }, [])

  // Everything: on the first frame, and whenever time, bookings, the viewer or the filters change.
  const graduateIndex = viewer.graduate?.index ?? -1
  const minute = Math.floor(viewer.now / 60_000)
  useEffect(() => {
    const { v, meshes, paint } = built
    view.current = { graduate: viewer.graduate, now: viewer.now, filters, ticketSeat, inspected: useHud.getState().inspected }
    const camera = useStadium.getState()
    for (let i = 0; i < v.count; i++) paint(i, camera)
    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor!.needsUpdate = true
      if (!mesh.boundingSphere) mesh.computeBoundingSphere()
    }
    invalidate()
    // viewer.graduate and viewer.now are covered by graduateIndex and minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, graduateIndex, minute, bookings, filters, ticketSeat, invalidate])

  // A few seats: when the pointer, the selection, the camera mode or the inspected seat changes.
  useEffect(() => {
    const { split, meshes, paint } = built
    const repaint = (seats: number[]) => {
      const camera = useStadium.getState()
      let any = false
      for (const i of new Set(seats)) {
        if (i < 0) continue
        const which = paint(i, camera)
        const slot = which === 0 ? i : i - split
        const mesh = meshes[which]
        mesh.instanceColor!.addUpdateRange(slot * 3, 3)
        mesh.instanceColor!.needsUpdate = true
        mesh.instanceMatrix.addUpdateRange(slot * 16, 16)
        mesh.instanceMatrix.needsUpdate = true
        any = true
      }
      if (any) invalidate()
    }
    const stopCamera = useStadium.subscribe((now, before) => {
      const mine = view.current.graduate ? pitchSeats().seatOf(view.current.graduate, view.current.now) : -1
      // The viewer's own seat changes size with the camera mode, like a highlighted one.
      repaint([before.hover, before.selected, now.hover, now.selected, view.current.inspected, now.mode !== before.mode ? mine : -1, now.mode !== before.mode ? view.current.ticketSeat : -1])
    })
    const stopHud = useHud.subscribe((now, before) => {
      if (now.inspected === before.inspected) return
      view.current.inspected = now.inspected
      repaint([before.inspected, now.inspected])
    })
    return () => {
      stopCamera()
      stopHud()
    }
  }, [built, invalidate])

  // `inspected` is read by the subscription above; naming it here keeps this component in step if it ever renders first.
  view.current.inspected = inspected

  useEffect(
    () => () => {
      built.geometry.dispose()
      built.material.dispose()
      for (const mesh of built.meshes) mesh.dispose()
    },
    [built],
  )

  return (
    <>
      <primitive object={built.meshes[0]} />
      <primitive object={built.meshes[1]} />
    </>
  )
}
