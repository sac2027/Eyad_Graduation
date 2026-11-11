import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, IcosahedronGeometry, MeshBasicMaterial, ShaderMaterial } from 'three'
import type { Mesh } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { Vec3 } from '@/features/stadiview/config/venue'
import { extendDebugHook } from '@/features/stadiview/debugHook'
import { routeTo, WALK_SPEED } from '@/features/stadiview/engine/routes'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useHud } from '@/features/stadiview/state/hudStore'

/** The route ribbon: this wide, this far above what it lies on. */
const WIDTH = 0.5
const LIFT = 0.04
/** The walker covers the route this many times faster than a person walks, so it does not take minutes. */
const WALKER_SPEEDUP = 18

/** A flat ribbon along a line of points, with its UV running along it in metres. */
function ribbon(points: Vec3[]): { geometry: BufferGeometry; along: number[] } {
  const n = points.length
  const positions = new Float32Array(n * 6)
  const uv = new Float32Array(n * 4)
  const along = [0]
  for (let k = 1; k < n; k++) along.push(along[k - 1] + Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1], points[k][2] - points[k - 1][2]))
  for (let k = 0; k < n; k++) {
    const a = points[Math.max(0, k - 1)]
    const b = points[Math.min(n - 1, k + 1)]
    const dx = b[0] - a[0]
    const dz = b[2] - a[2]
    const l = Math.hypot(dx, dz) || 1
    const nx = (dz / l) * (WIDTH / 2)
    const nz = (-dx / l) * (WIDTH / 2)
    const p = points[k]
    positions.set([p[0] + nx, p[1] + LIFT, p[2] + nz, p[0] - nx, p[1] + LIFT, p[2] - nz], k * 6)
    uv.set([along[k], 0, along[k], 1], k * 4)
  }
  const index: number[] = []
  for (let k = 1; k < n; k++) {
    const p = (k - 1) * 2
    const q = k * 2
    index.push(p, q, p + 1, p + 1, q, q + 1)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  geometry.setIndex(index)
  geometry.computeBoundingSphere()
  return { geometry, along }
}

/**
 * The walking route from the gate to a seat: a dashed gold ribbon over the ground, the stairs and
 * the rows, its dashes flowing from the gate, and a small light walking it. Standing still (reduced
 * motion, low-end devices) the dashes are drawn at rest and the light waits at the seat.
 */
export function WalkRoute({ still }: { still: boolean }) {
  const seat = useHud((s) => s.route)
  const invalidate = useThree((s) => s.invalidate)
  const walker = useRef<Mesh>(null)
  const materials = useMemo(() => {
    const dashes = new ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float dash = step(0.45, fract((vUv.x - uTime) / 1.6));
          float edge = 1.0 - smoothstep(0.35, 0.5, abs(vUv.y - 0.5));
          float a = mix(0.35, 0.95, dash) * edge;
          gl_FragColor = vec4(1.0, 0.86, 0.45, a);
        }`,
    })
    const light = new MeshBasicMaterial({ color: '#FFF3C4', toneMapped: false, transparent: true, blending: AdditiveBlending })
    return { dashes, light, ball: new IcosahedronGeometry(0.35, 1) }
  }, [])
  useEffect(
    () => () => {
      materials.dashes.dispose()
      materials.light.dispose()
      materials.ball.dispose()
    },
    [materials],
  )

  const built = useMemo(() => {
    if (seat < 0) return null
    const route = routeTo(seat)
    return { route, ...ribbon(route.points) }
  }, [seat])
  useEffect(() => {
    invalidate()
    const v = getVenue()
    extendDebugHook({ route: () => (built ? { seat: v.idOf(seat), gate: built.route.gate, length: Math.round(built.route.length), points: built.route.points.length } : null) })
    return () => built?.geometry.dispose()
  }, [built, seat, invalidate])

  useFrame((state, dt) => {
    if (!built) return
    const total = built.along[built.along.length - 1]
    if (still) {
      const end = built.route.points[built.route.points.length - 1]
      walker.current?.position.set(end[0], end[1] + 0.6, end[2])
      return
    }
    materials.dashes.uniforms.uTime.value = (materials.dashes.uniforms.uTime.value + dt * 1.2) % 1000
    // The walker: along the route at a quickened walking pace, then round again.
    const d = (state.clock.elapsedTime * WALK_SPEED * WALKER_SPEEDUP) % total
    let k = 1
    while (k < built.along.length - 1 && built.along[k] < d) k++
    const t = (d - built.along[k - 1]) / (built.along[k] - built.along[k - 1] || 1)
    const a = built.route.points[k - 1]
    const b = built.route.points[k]
    walker.current?.position.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 0.6, a[2] + (b[2] - a[2]) * t)
  })

  if (!built) return null
  return (
    <group name="walk-route">
      <mesh geometry={built.geometry} material={materials.dashes} renderOrder={5} />
      <mesh ref={walker} geometry={materials.ball} material={materials.light} renderOrder={5} />
    </group>
  )
}
