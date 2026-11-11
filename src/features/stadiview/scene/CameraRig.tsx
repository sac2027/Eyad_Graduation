import { useEffect, useRef } from 'react'
import { CatmullRomCurve3, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { VENUE } from '@/features/stadiview/config/venue'
import type { Vec3 } from '@/features/stadiview/config/venue'
import { debugEnabled, extendDebugHook } from '@/features/stadiview/debugHook'
import {
  FLIGHT_CURVE_TYPE,
  ORBIT_HOME,
  POV_FOV,
  clampLook,
  clampOrbit,
  flightPath,
  frontFlightPath,
  frontPoint,
  frontReturnPath,
  lookAngles,
  orbitFromPosition,
  orbitPosition,
  overviewFov,
  returnPath,
  seatEye,
  seatLook,
} from '@/features/stadiview/engine/cameraMath'
import type { Look, Orbit } from '@/features/stadiview/engine/cameraMath'
import { overviewPoints, overviewRadius } from '@/features/stadiview/engine/framing'
import { seatBack, seatFacing } from '@/features/stadiview/engine/seatFrame'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useStadium } from '@/features/stadiview/state/stadiumStore'

gsap.registerPlugin(CustomEase)
/**
 * The project's strong ease-in-out: a slow start, a quick middle, a soft landing. GSAP supplies
 * the curve; the rig keeps the time itself (see MAX_FLIGHT_STEP), so a flight is tied to the
 * frames that are really drawn.
 */
const FLIGHT_EASE = CustomEase.create('sv-flight', '0.77,0,0.175,1')

const rad = (deg: number) => (deg * Math.PI) / 180

/** Seconds a flight takes into a seat, and back out to the overview. */
const FLY_IN = 2.6
const FLY_OUT = 1.8
/** With reduced motion a flight is a cut: the picture fades out, the camera moves, the picture fades in. Milliseconds for each half. */
const CUT_HALF_MS = 200
/** Turning the view back to the stage when the viewer picks the seat they are already in. */
const RELOOK = 0.5

/** How fast the overview turns on its own before anyone touches it, in radians per second. */
const IDLE_SPEED = rad(2)
/** A full drag across the screen's height turns the overview this far. */
const ORBIT_TURN = Math.PI * 0.7
/** How quickly a released drag coasts to a stop: its speed falls to about a third in this many seconds. */
const COAST = 0.22
/** A drag that ended more than this long after its last movement was a stop, not a throw. Milliseconds. */
const THROW_WINDOW_MS = 80

/**
 * For looking at a flight frame by frame: `?svslow=8` makes every flight take eight times as long.
 * Only where the debug hook is available (development, automation, or `?svdebug=1`).
 */
function flightStretch(): number {
  if (!debugEnabled()) return 1
  try {
    const n = Number(new URLSearchParams(window.location.search).get('svslow'))
    return n >= 1 && n <= 60 ? n : 1
  } catch {
    return 1
  }
}

/** First-person field of view limits, in degrees. */
const FOV_MIN = 40
const FOV_MAX = 75

/**
 * How near the camera can see. In the overview nothing is closer than a few metres and a far
 * near-plane keeps distant layers from flickering; in a seat the next chair is an arm's length away.
 */
const NEAR_OVERVIEW = 2
const NEAR_SEAT = 0.12
/** How far ahead of a seated viewer the point they are "looking at" is taken to be, when a flight has to start from it. */
const GAZE = 30

interface Flight {
  /** How far along the flight is, 0 to 1, after easing. */
  t: number
  /** Seconds flown so far, and seconds the whole flight takes. A cut has no duration. */
  elapsed: number
  duration: number
  /** The path, or null when only the view turns. */
  curve: CatmullRomCurve3 | null
  fromLook: Vector3
  toLook: Vector3
  fromFov: number
  toFov: number
  fromNear: number
  toNear: number
  /** The seat being flown to, or -1 for the flight back to the overview. */
  seat: number
}

/**
 * The longest step a flight may take in one frame, in seconds of flight time. A slow frame then
 * makes the flight last a little longer instead of making the camera jump.
 */
const MAX_FLIGHT_STEP = 0.25

/**
 * The one camera of the stadium, in three modes that share a single state machine:
 *
 * - **orbit**: the overview. Drag turns it, wheel or pinch zooms, and it turns slowly by itself
 *   until first touched.
 * - **fly**: a flight along a curve into a seat, or back out to the overview pose it left.
 * - **pov**: first person from the seat. Drag looks around, wheel or pinch changes the field of view.
 *
 * The store says which mode to be in; this component makes the camera do it and tells the store
 * when a flight has landed. Every pose comes from the tested functions in engine/cameraMath.
 */
export function CameraRig({ still }: { still: boolean }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  const rig = useRef<{
    orbit: Orbit
    /** The distance chosen for this screen's shape, and whether the user has changed it since. */
    autoRadius: number
    zoomed: boolean
    /** The overview pose to fly back to. */
    saved: Orbit | null
    look: Look
    povFov: number
    /** The seat the viewer is sitting in, -1 in the overview. */
    seat: number
    /** Turning speed left over from a drag, in radians per second: round and up-down. */
    spin: [number, number]
    idle: boolean
    dragging: boolean
    flight: Flight | null
    /** What the camera is looking at, kept so a new flight can start from the current view. */
    lookPoint: Vector3
    lastFlightStart: Vec3 | null
    cut: number | undefined
    still: boolean
    aspect: number
  } | null>(null)

  if (!rig.current) {
    const home = orbitFromPosition(ORBIT_HOME.position, ORBIT_HOME.target)
    let wantsIdle: boolean
    try {
      // A turning camera would make automated checks chase a moving picture; they ask for it with ?idle=1.
      wantsIdle = !navigator.webdriver || new URLSearchParams(window.location.search).get('idle') === '1'
    } catch {
      wantsIdle = false
    }
    rig.current = {
      orbit: home,
      autoRadius: home.radius,
      zoomed: false,
      saved: null,
      look: { yaw: 0, pitch: 0 },
      povFov: POV_FOV,
      seat: -1,
      spin: [0, 0],
      idle: wantsIdle,
      dragging: false,
      flight: null,
      lookPoint: new Vector3(...ORBIT_HOME.target),
      lastFlightStart: null,
      cut: undefined,
      still,
      aspect: 1,
    }
  }
  rig.current.still = still

  /** Changes the field of view and the near plane, and rebuilds the projection only when one of them moved. */
  const setLens = (fov: number, near: number) => {
    if (Math.abs(camera.fov - fov) < 1e-4 && Math.abs(camera.near - near) < 1e-5) return
    camera.fov = fov
    camera.near = near
    camera.updateProjectionMatrix()
  }

  /** Set by the flight effect below: how to put the camera where a flight is, and what to do when it lands. */
  const flying = useRef<{ pose(f: Flight): void; land(seat: number): void } | null>(null)

  // The screen's shape decides how far back the overview sits (see engine/framing).
  useEffect(() => {
    const s = rig.current!
    s.aspect = size.height > 0 ? size.width / size.height : 1
    s.autoRadius = overviewRadius(s.aspect, overviewPoints(getVenue()))
    if (!s.zoomed) {
      s.orbit = { ...s.orbit, radius: s.autoRadius }
      // A saved pose that was never zoomed follows the screen too, so turning a phone in a seat returns to a fitting overview.
      if (s.saved) s.saved = { ...s.saved, radius: s.autoRadius }
    }
    invalidate()
  }, [size, invalidate])

  // Flights: start one whenever the store enters 'fly' or changes its target mid-flight.
  useEffect(() => {
    const s = rig.current!
    const v = getVenue()
    const stage = gl.domElement.closest<HTMLElement>('[data-stadium-canvas]')
    const scratch = new Vector3()
    const stretch = flightStretch()

    /** Whether a seat is in the stand under the canopy. */
    const roofed = (i: number) => i >= 0 && v.sections[v.section[i]].id === VENUE.canopy.over

    const stopFlight = () => {
      s.flight = null
      window.clearTimeout(s.cut)
      s.cut = undefined
      stage?.removeAttribute('data-cut')
    }

    /** The flight has arrived: settle into the seat, or back into the overview. */
    const land = (seat: number) => {
      s.flight = null
      s.spin = [0, 0]
      if (seat >= 0) {
        const eye = seatEye(seat, v)
        s.seat = seat
        const ahead = lookAngles(eye, seatLook(seat, v))
        s.look = clampLook(ahead.yaw, ahead.pitch)
        s.povFov = POV_FOV
        useStadium.getState().setMode('pov')
      } else {
        s.seat = -1
        if (s.saved) s.orbit = s.saved
        s.saved = null
        s.lookPoint.set(...ORBIT_HOME.target)
        useStadium.getState().setMode('orbit')
      }
      invalidate()
    }

    const start = (seat: number, from: 'orbit' | 'fly' | 'pov') => {
      const here: Vec3 = [camera.position.x, camera.position.y, camera.position.z]
      // Where the eye is resting now, before the old flight is dropped.
      if (from === 'pov') {
        const { yaw, pitch } = s.look
        s.lookPoint.set(here[0] - GAZE * Math.cos(pitch) * Math.sin(yaw), here[1] + GAZE * Math.sin(pitch), here[2] - GAZE * Math.cos(pitch) * Math.cos(yaw))
      } else if (from === 'orbit') {
        s.lookPoint.set(...ORBIT_HOME.target)
        // The pose to come back to is the one the first flight leaves.
        s.saved = { ...s.orbit }
      }
      stopFlight()
      s.lastFlightStart = here
      s.idle = false
      s.spin = [0, 0]
      s.dragging = false

      // A seat under the canopy is closed in behind and above. Flights reach it, and leave it,
      // through the open front (see frontFlightPath in engine/cameraMath).
      const leavingRoofed = from === 'pov' && roofed(s.seat)

      let path: Vec3[] | null
      let toLook: Vec3
      let duration: number
      let toFov: number
      let toNear: number
      if (seat >= 0) {
        const eye = seatEye(seat, v)
        const alreadyThere = Math.hypot(here[0] - eye[0], here[1] - eye[1], here[2] - eye[2]) < 0.01
        if (alreadyThere) {
          // Picking the seat one is sitting in only turns the view back to the stage.
          path = null
        } else {
          // Out from under the roof first, when the flight starts there.
          const exit = leavingRoofed ? frontPoint(here, seatFacing(s.seat, v)) : null
          const way = roofed(seat) ? frontFlightPath(exit ?? here, eye, seatFacing(seat, v)) : flightPath(exit ?? here, eye, seatBack(seat, v))
          path = exit ? [here, ...way] : way
        }
        toLook = seatLook(seat, v)
        duration = alreadyThere ? RELOOK : FLY_IN
        toFov = POV_FOV
        toNear = NEAR_SEAT
      } else {
        const home = orbitPosition(s.saved ?? s.orbit, ORBIT_HOME.target)
        path = leavingRoofed ? frontReturnPath(here, home, seatFacing(s.seat, v)) : returnPath(here, home)
        toLook = ORBIT_HOME.target
        duration = FLY_OUT
        toFov = overviewFov(s.aspect)
        toNear = NEAR_OVERVIEW
      }

      const flight: Flight = {
        t: 0,
        curve: path ? new CatmullRomCurve3(path.map((p) => new Vector3(...p)), false, FLIGHT_CURVE_TYPE) : null,
        fromLook: s.lookPoint.clone(),
        toLook: scratch.set(...toLook).clone(),
        fromFov: camera.fov,
        toFov,
        fromNear: camera.near,
        toNear,
        seat,
        elapsed: 0,
        duration: s.still ? 0 : duration * stretch,
      }
      s.flight = flight

      if (s.still) {
        // No travel: fade the picture out, move, fade it in.
        stage?.setAttribute('data-cut', '')
        s.cut = window.setTimeout(() => {
          s.cut = undefined
          flight.t = 1
          pose(flight)
          stage?.removeAttribute('data-cut')
          land(seat)
        }, CUT_HALF_MS)
      }
      // Otherwise the frame loop below flies it.
      invalidate()
    }

    /** Puts the camera where the flight is at its current `t`. */
    const pose = (f: Flight) => {
      if (f.curve) f.curve.getPointAt(Math.min(Math.max(f.t, 0), 1), camera.position)
      s.lookPoint.lerpVectors(f.fromLook, f.toLook, f.t)
      const angles = lookAngles([camera.position.x, camera.position.y, camera.position.z], [s.lookPoint.x, s.lookPoint.y, s.lookPoint.z])
      camera.rotation.set(angles.pitch, angles.yaw, 0, 'YXZ')
      setLens(f.fromFov + (f.toFov - f.fromFov) * f.t, f.fromNear * Math.pow(f.toNear / f.fromNear, f.t))
    }
    flying.current = { pose, land }

    const unsubscribe = useStadium.subscribe((now, before) => {
      if (now.mode === 'fly' && (before.mode !== 'fly' || now.selected !== before.selected)) start(now.selected, before.mode)
    })

    extendDebugHook({
      camera: () => {
        camera.updateMatrixWorld()
        const d = camera.getWorldDirection(scratch)
        return { position: [camera.position.x, camera.position.y, camera.position.z], fov: camera.fov, direction: [d.x, d.y, d.z] }
      },
      lastFlightStart: () => s.lastFlightStart,
    })

    return () => {
      unsubscribe()
      stopFlight()
    }
    // setLens is stable for the life of the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, invalidate])

  // Pointer, wheel and keyboard.
  useEffect(() => {
    const s = rig.current!
    const el = gl.domElement
    const stage = el.closest<HTMLElement>('[data-stadium-canvas]')
    const pointers = new Map<number, { x: number; y: number }>()
    let lastMove = 0
    let pinch: { distance: number; value: number } | null = null

    const touched = () => {
      s.idle = false
    }
    const mode = () => useStadium.getState().mode

    /** Turns the view by a pointer movement, and remembers the speed for the coast after release. */
    const turn = (dx: number, dy: number, seconds: number) => {
      const height = Math.max(el.clientHeight, 1)
      let a: number
      let b: number
      if (mode() === 'orbit') {
        const k = ORBIT_TURN / height
        a = -dx * k
        b = -dy * k
        s.orbit = clampOrbit({ theta: s.orbit.theta + a, phi: s.orbit.phi + b, radius: s.orbit.radius })
      } else if (mode() === 'pov') {
        // One pixel turns the view by one pixel's worth of angle, so the scene stays under the finger.
        const k = rad(camera.fov) / height
        a = dx * k
        b = dy * k
        s.look = clampLook(s.look.yaw + a, s.look.pitch + b)
      } else return
      s.spin = seconds > 0 ? [a / seconds, b / seconds] : [0, 0]
      invalidate()
    }

    const zoom = (factor: number) => {
      if (mode() === 'orbit') {
        s.orbit = clampOrbit({ ...s.orbit, radius: s.orbit.radius * factor })
        s.zoomed = true
      } else if (mode() === 'pov') {
        s.povFov = Math.min(Math.max(s.povFov * factor, FOV_MIN), FOV_MAX)
      }
      invalidate()
    }

    const spread = () => {
      const [p, q] = [...pointers.values()]
      return Math.hypot(p.x - q.x, p.y - q.y)
    }

    const down = (e: PointerEvent) => {
      touched()
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture?.(e.pointerId)
      s.spin = [0, 0]
      lastMove = e.timeStamp
      if (pointers.size === 1) {
        s.dragging = true
        stage?.setAttribute('data-dragging', '')
      } else if (pointers.size === 2) {
        pinch = { distance: spread(), value: mode() === 'pov' ? s.povFov : s.orbit.radius }
      }
    }
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (pointers.size === 1) {
        turn(dx, dy, Math.max((e.timeStamp - lastMove) / 1000, 1 / 240))
        lastMove = e.timeStamp
      } else if (pointers.size === 2 && pinch && pinch.distance > 0) {
        // Fingers moving apart bring the scene closer.
        const factor = pinch.distance / Math.max(spread(), 1)
        if (mode() === 'orbit') {
          s.orbit = clampOrbit({ ...s.orbit, radius: pinch.value * factor })
          s.zoomed = true
        } else if (mode() === 'pov') s.povFov = Math.min(Math.max(pinch.value * factor, FOV_MIN), FOV_MAX)
        invalidate()
      }
    }
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return
      el.releasePointerCapture?.(e.pointerId)
      pinch = null
      if (pointers.size === 0) {
        s.dragging = false
        stage?.removeAttribute('data-dragging')
        // A pointer that paused before letting go was placing the view, not throwing it.
        if (s.still || e.timeStamp - lastMove > THROW_WINDOW_MS) s.spin = [0, 0]
        invalidate()
      }
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      touched()
      // Browsers report the wheel in pixels, lines or pages; bring them to pixels.
      const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1)
      zoom(Math.exp(Math.min(Math.max(pixels, -240), 240) * 0.0011))
    }
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const m = mode()
      let handled = true
      if (e.key === 'Escape') useStadium.getState().back()
      else if (m === 'fly') handled = false
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const sign = e.key === 'ArrowLeft' ? 1 : -1
        if (m === 'orbit') s.orbit = clampOrbit({ ...s.orbit, theta: s.orbit.theta + sign * rad(5) })
        else s.look = clampLook(s.look.yaw + sign * rad(6), s.look.pitch)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const sign = e.key === 'ArrowUp' ? 1 : -1
        // Up raises the overview camera (a smaller angle from overhead) and tilts a seated view upward.
        if (m === 'orbit') s.orbit = clampOrbit({ ...s.orbit, phi: s.orbit.phi - sign * rad(4) })
        else s.look = clampLook(s.look.yaw, s.look.pitch + sign * rad(4))
      } else if (e.key === '+' || e.key === '=') zoom(0.9)
      else if (e.key === '-' || e.key === '_') zoom(1 / 0.9)
      else handled = false
      if (handled) {
        touched()
        s.spin = [0, 0]
        e.preventDefault()
        invalidate()
      }
    }
    // Escape works from anywhere on the page while the viewer is away from the overview, unless they are typing.
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || mode() === 'orbit') return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      useStadium.getState().back()
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    stage?.addEventListener('keydown', key)
    window.addEventListener('keydown', escape)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      stage?.removeEventListener('keydown', key)
      window.removeEventListener('keydown', escape)
      stage?.removeAttribute('data-dragging')
    }
  }, [camera, gl, invalidate])

  useFrame((_, delta) => {
    const s = rig.current!
    // A long pause (a hidden tab, a slow frame) must not fling the camera.
    const dt = Math.min(delta, 0.1)
    const mode = useStadium.getState().mode

    if (s.flight) {
      const f = s.flight
      // A cut has no duration: the camera waits where it is until the picture has faded out.
      if (f.duration > 0 && flying.current) {
        // Flight time follows the frames actually drawn, a step at a time, through the flight ease.
        f.elapsed += Math.min(delta, MAX_FLIGHT_STEP)
        f.t = FLIGHT_EASE(Math.min(f.elapsed / f.duration, 1))
        flying.current.pose(f)
        if (f.elapsed >= f.duration) flying.current.land(f.seat)
      }
      return
    }

    // The coast after a drag, and the slow turn before anyone has touched the overview.
    const coasting = !s.dragging && (Math.abs(s.spin[0]) > 1e-4 || Math.abs(s.spin[1]) > 1e-4)
    if (coasting) {
      const decay = Math.exp(-dt / COAST)
      if (mode === 'orbit') s.orbit = clampOrbit({ theta: s.orbit.theta + s.spin[0] * dt, phi: s.orbit.phi + s.spin[1] * dt, radius: s.orbit.radius })
      else if (mode === 'pov') s.look = clampLook(s.look.yaw + s.spin[0] * dt, s.look.pitch + s.spin[1] * dt)
      s.spin = [s.spin[0] * decay, s.spin[1] * decay]
    }

    if (mode === 'pov' && s.seat >= 0) {
      const v = getVenue()
      camera.position.set(v.position[s.seat * 3], seatEye(s.seat, v)[1], v.position[s.seat * 3 + 2])
      camera.rotation.set(s.look.pitch, s.look.yaw, 0, 'YXZ')
      setLens(s.povFov, NEAR_SEAT)
      return
    }

    if (mode === 'orbit') {
      if (s.idle && !s.still && !s.dragging) s.orbit = { ...s.orbit, theta: s.orbit.theta + IDLE_SPEED * dt }
      const p = orbitPosition(s.orbit, ORBIT_HOME.target)
      camera.position.set(p[0], p[1], p[2])
      const angles = lookAngles(p, ORBIT_HOME.target)
      camera.rotation.set(angles.pitch, angles.yaw, 0, 'YXZ')
      setLens(overviewFov(s.aspect), NEAR_OVERVIEW)
    }
  })

  // Under reduced motion the scene is drawn on demand, and a coast or idle turn never runs; one
  // frame after every change is enough, and the handlers above ask for it.
  useEffect(() => {
    invalidate()
  }, [still, invalidate])

  return null
}
