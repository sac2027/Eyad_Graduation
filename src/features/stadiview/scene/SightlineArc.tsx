import { useEffect, useMemo } from 'react'
import { AdditiveBlending, CatmullRomCurve3, ShaderMaterial, TubeGeometry, Vector3 } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { extendDebugHook } from '@/features/stadiview/debugHook'
import { arcPoints } from '@/features/stadiview/engine/arcPath'
import { seatEye } from '@/features/stadiview/engine/cameraMath'
import { seatAim } from '@/features/stadiview/engine/seatFrame'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useSightline } from '@/features/stadiview/state/useLocated'

/** Light flowing along the arc toward the graduate, in arc lengths per second. */
const FLOW = 0.35

function arcMaterial(core: boolean): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying float vAlong;
      void main() {
        vAlong = uv.x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: core
      ? /* glsl */ `
        uniform float uTime;
        varying float vAlong;
        void main() {
          // Brighter pulses travelling from the guest to the graduate.
          float pulse = 0.65 + 0.35 * smoothstep(0.7, 1.0, sin((vAlong - uTime) * 37.7) * 0.5 + 0.5);
          gl_FragColor = vec4(vec3(0.906, 0.651, 0.078) * 1.6 * pulse, 0.95);
        }`
      : /* glsl */ `
        varying float vAlong;
        void main() {
          gl_FragColor = vec4(vec3(0.906, 0.651, 0.078), 0.16);
        }`,
  })
}

/** The gold sightline arc (#E7A614) from a guest's seat to their located graduate's seat. */
export function SightlineArc({ still }: { still: boolean }) {
  const line = useSightline()
  const invalidate = useThree((s) => s.invalidate)
  const materials = useMemo(() => ({ core: arcMaterial(true), halo: arcMaterial(false) }), [])
  useEffect(
    () => () => {
      materials.core.dispose()
      materials.halo.dispose()
    },
    [materials],
  )

  const from = line?.from ?? -1
  const to = line?.to ?? -1
  const geometry = useMemo(() => {
    if (from < 0 || to < 0) return null
    const v = getVenue()
    const points = arcPoints(seatEye(from, v), seatAim(to, v))
    const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)))
    return { points, core: new TubeGeometry(curve, 96, 0.07, 6, false), halo: new TubeGeometry(curve, 96, 0.3, 8, false) }
  }, [from, to])
  useEffect(() => {
    invalidate()
    return () => {
      geometry?.core.dispose()
      geometry?.halo.dispose()
    }
  }, [geometry, invalidate])

  useEffect(() => {
    const v = getVenue()
    extendDebugHook({ arc: () => (geometry ? { from: v.idOf(from), to: v.idOf(to), points: geometry.points.map((p) => [...p] as [number, number, number]) } : null) })
  }, [geometry, from, to])

  useFrame((_, dt) => {
    if (still || !geometry) return
    materials.core.uniforms.uTime.value = (materials.core.uniforms.uTime.value + dt * FLOW) % 1000
  })

  if (!geometry) return null
  return (
    <group name="sightline-arc">
      <mesh geometry={geometry.halo} material={materials.halo} renderOrder={7} />
      <mesh geometry={geometry.core} material={materials.core} renderOrder={8} />
    </group>
  )
}
