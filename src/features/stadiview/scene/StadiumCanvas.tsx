import { useEffect, useMemo } from 'react'
import { NeutralToneMapping, SpotLight } from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { VENUE } from '@/features/stadiview/config/venue'
import { extendDebugHook } from '@/features/stadiview/debugHook'
import { ORBIT_HOME } from '@/features/stadiview/engine/cameraMath'
import { TIER_SETTINGS } from '@/features/stadiview/engine/tiers'
import type { Tier } from '@/features/stadiview/engine/tiers'
import { CameraRig } from '@/features/stadiview/scene/CameraRig'
import { Floodlights } from '@/features/stadiview/scene/Floodlights'
import { Ground } from '@/features/stadiview/scene/Ground'
import { PreviewCamera } from '@/features/stadiview/scene/PreviewCamera'
import { Avatars } from '@/features/stadiview/scene/Avatars'
import { MarchCarpet } from '@/features/stadiview/scene/MarchCarpet'
import { SV } from '@/features/stadiview/scene/palette'
import { SceneDebug } from '@/features/stadiview/scene/SceneDebug'
import { SeatMarker } from '@/features/stadiview/scene/SeatMarker'
import { createSceneKit, disposeSceneKit, SceneKitContext } from '@/features/stadiview/scene/sceneKit'
import { Seats } from '@/features/stadiview/scene/Seats'
import { Sky, SKY_RADIUS } from '@/features/stadiview/scene/Sky'
import { Stage } from '@/features/stadiview/scene/Stage'
import { Stands } from '@/features/stadiview/scene/Stands'
import { usePointerPicking } from '@/features/stadiview/scene/usePointerPicking'

export interface StadiumCanvasProps {
  /** The 3D tiers only: tier 0 never loads this file. */
  tier: Exclude<Tier, 0>
  /** No movement of its own: reduced motion or the low-end switch. The scene is then drawn only when something changes. */
  still: boolean
  /** What the picture shows, for people who cannot see it. */
  label: string
  /** Called once, after the first frame has been drawn. */
  onReady(): void
  /** Called when the graphics context was lost and did not come back. */
  onLost(): void
}

/** A lost graphics context usually comes back within a moment. Only after this long is it treated as gone. */
const LOST_GRACE_MS = 2000

/** In the overview nothing is nearer to the camera than this, and a far near-plane keeps distant surfaces from flickering. */
const OVERVIEW_NEAR = 2

/** The fog thickens from this distance to that one, so the campus fades into the night. */
const FOG: [number, number] = [170, 680]

function Lights({ spots }: { spots: boolean }) {
  // Real lamps on the four masts, for devices that can afford them. They have no distance
  // fall-off: the baked floodlight already carries that, and these only add direction.
  const lamps = useMemo(() => {
    if (!spots) return []
    const { masts, height, aim } = VENUE.floodlights
    return masts.map((foot) => {
      const lamp = new SpotLight('#fff1d6', 0.3, 0, 0.62, 0.9, 0)
      lamp.position.set(foot[0], foot[1] + height, foot[2])
      lamp.target.position.set(aim[0], aim[1], aim[2])
      lamp.target.updateMatrixWorld()
      return lamp
    })
  }, [spots])
  useEffect(() => () => lamps.forEach((l) => l.dispose()), [lamps])

  return (
    <>
      {/* The sky's own light: a cool wash from above, almost nothing from below. */}
      <hemisphereLight args={['#9fc8bd', '#0b1714', 0.9]} />
      {/* The four masts taken together, as one light from high over the pitch. */}
      <directionalLight position={[-20, 150, 30]} intensity={1.0} color="#fff3dc" />
      {lamps.map((lamp, i) => (
        <primitive key={i} object={lamp} />
      ))}
    </>
  )
}

/** Reports the first frame, watches for a lost graphics context, and feeds the debug hook. */
function Lifecycle({ onReady, onLost }: Pick<StadiumCanvasProps, 'onReady' | 'onLost'>) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    let reported = false
    scene.onAfterRender = () => {
      if (reported) return
      reported = true
      onReady()
    }
    return () => {
      scene.onAfterRender = () => {}
    }
  }, [scene, onReady])

  useEffect(() => {
    const canvas = gl.domElement
    let timer: number | undefined
    const lost = (event: Event) => {
      // Without this the browser will not try to give the context back.
      event.preventDefault()
      window.clearTimeout(timer)
      timer = window.setTimeout(onLost, LOST_GRACE_MS)
    }
    const restored = () => window.clearTimeout(timer)
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', restored)
    return () => {
      window.clearTimeout(timer)
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', restored)
    }
  }, [gl, onLost])

  useEffect(() => {
    extendDebugHook({ info: () => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles }) })
  }, [gl])

  return null
}

/** Runs the seat search for the pointer. A component of its own so its frame callback sits beside the scene's others. */
function Pointer() {
  usePointerPicking()
  return null
}

function Scene({ tier, still, onReady, onLost }: Omit<StadiumCanvasProps, 'label'>) {
  const kit = useMemo(() => createSceneKit(), [])
  useEffect(() => () => disposeSceneKit(kit), [kit])
  const settings = TIER_SETTINGS[tier]
  return (
    <SceneKitContext.Provider value={kit}>
      <color attach="background" args={[SV.night]} />
      <fog attach="fog" args={[SV.night, FOG[0], FOG[1]]} />
      <Lights spots={settings.spotLights} />
      <Sky />
      <Ground />
      <Stands animate={!still} />
      <Stage animate={!still} />
      <Floodlights cones={tier >= 2} />
      <MarchCarpet still={still} />
      <Seats />
      {settings.crowd > 0 && <Avatars crowd={settings.crowd} />}
      <SeatMarker still={still} />
      <PreviewCamera />
      <Pointer />
      <CameraRig still={still} />
      <Lifecycle onReady={onReady} onLost={onLost} />
      <SceneDebug />
    </SceneKitContext.Provider>
  )
}

/** The 3D stadium. This file and everything it imports is fetched only when a device can draw it. */
export default function StadiumCanvas({ tier, still, label, onReady, onLost }: StadiumCanvasProps) {
  const settings = TIER_SETTINGS[tier]
  return (
    <Canvas
      role="img"
      aria-label={label}
      dpr={[1, settings.maxDpr]}
      frameloop={still ? 'demand' : 'always'}
      // Neutral tone mapping shows a colour as painted until it nears white. The usual filmic curve
      // would darken and grey the brand greens.
      gl={{ antialias: settings.antialias, powerPreference: 'high-performance', toneMapping: NeutralToneMapping }}
      camera={{ position: ORBIT_HOME.position, fov: ORBIT_HOME.fov, near: OVERVIEW_NEAR, far: SKY_RADIUS * 2.2 }}
      style={{ touchAction: 'none' }}
    >
      <Scene tier={tier} still={still} onReady={onReady} onLost={onLost} />
    </Canvas>
  )
}
