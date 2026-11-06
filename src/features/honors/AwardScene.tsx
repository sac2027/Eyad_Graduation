import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useStore, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { gsap } from 'gsap'
import * as THREE from 'three'
import type { HonorTier } from '@/domain/types'
import type { Locale } from '@/i18n'
import { buildAwardGeometry, buildWindowShape, windowPlacements, WINDOW_Y } from './awardGeometry'
import { createNamePlaqueTexture } from './namePlaque'
import { TIER_MATERIALS } from './tierMaterials'

export type Beat = 'message' | 'cta' | 'end'

interface Props {
  tier: HonorTier
  name: string
  locale: Locale
  /** College colour for the case trim. */
  trim: string
  /** Show the final pose straight away (reduced motion). */
  instant: boolean
  /** Increment to skip the sequence. */
  skipToken: number
  /** Increment to play it again. */
  replayToken: number
  onBeat: (b: Beat) => void
}

interface Prog {
  caseIn: number
  ribbon: number
  lid: number
  glow: number
  rise: number
  turn: number
  engrave: number
}

const FRESH: Prog = { caseIn: 0, ribbon: 0, lid: 0, glow: 0, rise: 0, turn: 0, engrave: 0 }
const DONE: Prog = { caseIn: 1, ribbon: 1, lid: 1, glow: 1, rise: 1, turn: 1, engrave: 1 }
const CASE_H = 2.7
const CASE_W = 1.7
const WALL = 0.08

function Scene({ tier, name, locale, trim, instant, skipToken, replayToken, onBeat }: Props) {
  const mat = TIER_MATERIALS[tier]
  const invalidate = useThree((s) => s.invalidate)
  const P = useRef<Prog>({ ...FRESH })
  const idle = useRef({ v: 0 })
  const user = useRef(0)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const idleTween = useRef<gsap.core.Tween | null>(null)
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null)

  const caseGroup = useRef<THREE.Group>(null)
  const lidPivot = useRef<THREE.Group>(null)
  const ribbonFront = useRef<THREE.Mesh>(null)
  const ribbonTop = useRef<THREE.Mesh>(null)
  const award = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const inner = useRef<THREE.PointLight>(null)
  const key = useRef<THREE.SpotLight>(null)
  const plaqueMat = useRef<THREE.MeshBasicMaterial>(null)

  const geo = useMemo(() => buildAwardGeometry(), [])
  const windowShape = useMemo(() => buildWindowShape(), [])
  const places = useMemo(() => windowPlacements(), [])

  // The plaque is swapped in place when the name or language changes; the opening sequence is not replayed.
  const texRef = useRef<THREE.CanvasTexture | null>(null)
  const skipRequested = useRef(false)
  useEffect(() => {
    let alive = true
    void createNamePlaqueTexture(name, locale).then((x) => {
      if (!alive) return x.dispose()
      const old = texRef.current
      texRef.current = x
      setTex(x)
      invalidate()
      old?.dispose()
    })
    return () => {
      alive = false
    }
  }, [name, locale, invalidate])
  useEffect(
    () => () => {
      texRef.current?.dispose()
      texRef.current = null
    },
    [],
  )

  const finish = () => {
    tl.current?.progress(1, true)
    Object.assign(P.current, DONE)
    onBeat('message')
    onBeat('cta')
    onBeat('end')
    startIdle()
    invalidate()
  }

  const startIdle = () => {
    if (instant || idleTween.current) return
    idleTween.current = gsap.to(idle.current, { v: Math.PI * 2, duration: 28, ease: 'none', repeat: -1, onUpdate: () => !document.hidden && invalidate() })
  }

  const ready = tex !== null
  useEffect(() => {
    if (!ready) return
    idleTween.current?.kill()
    idleTween.current = null
    tl.current?.kill()
    if (instant) {
      Object.assign(P.current, DONE)
      onBeat('message')
      onBeat('cta')
      onBeat('end')
      invalidate()
      return
    }
    Object.assign(P.current, FRESH)
    invalidate()
    const p = P.current
    const t = gsap.timeline({ onUpdate: invalidate, onComplete: () => { onBeat('end'); startIdle() } })
    t.to(p, { caseIn: 1, duration: 1.3, ease: 'power3.out' }, 0.2)
      .to(p, { ribbon: 1, duration: 1.0, ease: 'power2.inOut' }, 1.8)
      .to(p, { lid: 1, duration: 1.6, ease: 'power2.inOut' }, 3.0)
      .to(p, { glow: 1, duration: 1.6, ease: 'power1.out' }, 3.4)
      .to(p, { rise: 1, duration: 2.4, ease: 'back.out(1.05)' }, 4.8)
      .to(p, { turn: 1, duration: 3.4, ease: 'power2.inOut' }, 6.2)
      .to(p, { engrave: 1, duration: 1.6, ease: 'power1.inOut' }, 8.6)
      .call(() => onBeat('message'), [], 9.8)
      .call(() => onBeat('cta'), [], 11.4)
      .to({}, { duration: 0.4 }, 12.6)
    tl.current = t
    // A Skip pressed while the plaque was still being drawn applies as soon as the sequence exists.
    if (skipRequested.current) {
      skipRequested.current = false
      finish()
    }
    return () => {
      t.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, instant, replayToken])

  useEffect(() => {
    if (skipToken === 0) return
    if (!tl.current) {
      skipRequested.current = true
      return
    }
    finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipToken])

  useEffect(
    () => () => {
      tl.current?.kill()
      idleTween.current?.kill()
    },
    [],
  )

  useFrame(() => {
    const p = P.current
    if (caseGroup.current) caseGroup.current.position.y = (1 - p.caseIn) * -4.5
    if (lidPivot.current) lidPivot.current.rotation.x = -2.1 * p.lid
    if (ribbonFront.current) {
      ribbonFront.current.scale.x = Math.max(0.0001, 1 - p.ribbon)
      ribbonFront.current.position.y = CASE_H * 0.5 + p.ribbon * 0.4
    }
    if (ribbonTop.current) ribbonTop.current.scale.x = Math.max(0.0001, 1 - p.ribbon)
    if (award.current) award.current.position.y = 0.12 + 2.78 * p.rise
    if (spin.current) spin.current.rotation.y = p.turn * Math.PI * 1.75 + idle.current.v + user.current
    if (inner.current) inner.current.intensity = p.glow * 9
    if (key.current) key.current.intensity = mat.lightIntensity * (0.5 + 0.5 * p.glow) * 7
    if (plaqueMat.current) plaqueMat.current.opacity = p.engrave
  })

  const velvet = { color: '#0e3b26', roughness: 1, metalness: 0, sheen: 0.4, sheenColor: new THREE.Color('#2f7a55'), sheenRoughness: 0.7, envMapIntensity: 0.05 } as const
  const metal = { color: mat.color, metalness: mat.metalness, roughness: mat.roughness, envMapIntensity: 1.4 }

  return (
    <>
      <StudioEnvironment />
      <spotLight ref={key} position={[2.5, 9, 6]} angle={0.45} penumbra={0.7} color={mat.lightColor} intensity={0} />
      <pointLight ref={inner} position={[0, CASE_H - 0.3, 0.2]} color={mat.lightColor} intensity={0} distance={7} decay={1.6} />

      <group
        onPointerDown={(e) => { (e.target as Element)?.setPointerCapture?.(e.pointerId) }}
        onPointerMove={(e) => {
          if (e.buttons !== 1 || P.current.rise < 1) return
          user.current += e.movementX * 0.012
          invalidate()
        }}
      >
        <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
          <circleGeometry args={[2.4, 48]} />
          <meshBasicMaterial color="#000" transparent opacity={0.3} />
        </mesh>

        <group ref={caseGroup}>
          {/* case: floor, four walls, rim trim in the college colour */}
          <RoundedBox args={[CASE_W, 0.06, CASE_W]} radius={0.02} position={[0, 0.03, 0]}><meshPhysicalMaterial {...velvet} /></RoundedBox>
          <RoundedBox args={[CASE_W, CASE_H, WALL]} radius={0.02} position={[0, CASE_H / 2, CASE_W / 2 - WALL / 2]}><meshPhysicalMaterial {...velvet} /></RoundedBox>
          <RoundedBox args={[CASE_W, CASE_H, WALL]} radius={0.02} position={[0, CASE_H / 2, -CASE_W / 2 + WALL / 2]}><meshPhysicalMaterial {...velvet} /></RoundedBox>
          <RoundedBox args={[WALL, CASE_H, CASE_W]} radius={0.02} position={[-CASE_W / 2 + WALL / 2, CASE_H / 2, 0]}><meshPhysicalMaterial {...velvet} /></RoundedBox>
          <RoundedBox args={[WALL, CASE_H, CASE_W]} radius={0.02} position={[CASE_W / 2 - WALL / 2, CASE_H / 2, 0]}><meshPhysicalMaterial {...velvet} /></RoundedBox>
          <mesh position={[0, CASE_H + 0.005, CASE_W / 2 - 0.02]}><boxGeometry args={[CASE_W, 0.03, 0.04]} /><meshStandardMaterial color={trim} roughness={0.5} /></mesh>
          <mesh position={[0, CASE_H + 0.005, -CASE_W / 2 + 0.02]}><boxGeometry args={[CASE_W, 0.03, 0.04]} /><meshStandardMaterial color={trim} roughness={0.5} /></mesh>
          <mesh position={[-CASE_W / 2 + 0.02, CASE_H + 0.005, 0]}><boxGeometry args={[0.04, 0.03, CASE_W]} /><meshStandardMaterial color={trim} roughness={0.5} /></mesh>
          <mesh position={[CASE_W / 2 - 0.02, CASE_H + 0.005, 0]}><boxGeometry args={[0.04, 0.03, CASE_W]} /><meshStandardMaterial color={trim} roughness={0.5} /></mesh>
          {/* inner lining ring so the opening reads against the dark */}
          <mesh position={[0, CASE_H - 0.02, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.6, 0.78, 8]} /><meshStandardMaterial color="#ece0c7" side={THREE.DoubleSide} roughness={0.9} /></mesh>

          {/* ribbon */}
          <mesh ref={ribbonFront} position={[0, CASE_H * 0.5, CASE_W / 2 + 0.012]}><boxGeometry args={[0.22, CASE_H, 0.02]} /><meshStandardMaterial color="#f0ba4f" roughness={0.45} /></mesh>

          {/* lid, hinged at the back edge */}
          <group ref={lidPivot} position={[0, CASE_H + 0.04, -CASE_W / 2]}>
            <RoundedBox args={[CASE_W + 0.04, 0.08, CASE_W + 0.04]} radius={0.02} position={[0, 0, CASE_W / 2 + 0.02]}><meshPhysicalMaterial {...velvet} /></RoundedBox>
            <mesh position={[0, 0.045, CASE_W / 2]} rotation-x={0}><cylinderGeometry args={[0.42, 0.42, 0.02, 8]} /><meshStandardMaterial color="#f0ba4f" metalness={0.6} roughness={0.4} /></mesh>
            <mesh ref={ribbonTop} position={[0, 0.05, CASE_W / 2]}><boxGeometry args={[0.22, 0.02, CASE_W + 0.06]} /><meshStandardMaterial color="#f0ba4f" roughness={0.45} /></mesh>
          </group>

          {/* the award */}
          <group ref={award} position={[0, 0.12, 0]}>
            <group ref={spin}>
              <RoundedBox args={[1.3, 0.16, 0.9]} radius={0.02} position={[0, 0.08, 0]}><meshStandardMaterial {...metal} /></RoundedBox>
              <mesh position={[0, 0.08, 0.452]}><planeGeometry args={[1.1, 0.12]} /><meshStandardMaterial color={mat.plaque} metalness={0.8} roughness={0.35} /></mesh>
              {tex && (
                <mesh position={[0, 0.08, 0.454]} data-plaque>
                  <planeGeometry args={[1.1, 0.12]} />
                  <meshBasicMaterial ref={plaqueMat} map={tex} transparent opacity={0} depthWrite={false} />
                </mesh>
              )}
              <group position={[0, 0.16, 0]} scale={0.5}>
                <mesh geometry={geo}><meshStandardMaterial {...metal} flatShading /></mesh>
                {places.map((w, i) => (
                  <mesh key={i} position={[w.radius * Math.sin(w.angle), WINDOW_Y, w.radius * Math.cos(w.angle)]} rotation-y={w.angle}>
                    <extrudeGeometry args={[windowShape, { depth: 0.02, bevelEnabled: false }]} />
                    <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.6} />
                  </mesh>
                ))}
              </group>
            </group>
          </group>
        </group>
      </group>
      <CameraRig />
    </>
  )
}

/** A procedural studio (no files to download) so the metal has something to reflect. */
function StudioEnvironment() {
  const store = useStore()
  useEffect(() => {
    const { gl, scene, invalidate } = store.getState()
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 1.1
    invalidate()
    return () => {
      scene.environment = null
      room.dispose()
      env.dispose()
      pmrem.dispose()
    }
  }, [store])
  return null
}

function CameraRig() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.position.set(0, 3.1, 9.6)
    camera.lookAt(0, 2.75, 0)
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

export default function AwardScene(props: Props) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop="demand"
      camera={{ position: [0, 3.1, 9.6], fov: 32 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      className="touch-pan-y"
      data-award-canvas={props.tier}
    >
      <Scene {...props} />
    </Canvas>
  )
}
