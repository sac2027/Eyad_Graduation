import { useEffect, useMemo } from 'react'
import { AdditiveBlending, CanvasTexture, CylinderGeometry, DoubleSide, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry, ShaderMaterial } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { extendDebugHook } from '@/features/stadiview/debugHook'
import { edgeLights, getMarchPath } from '@/features/stadiview/engine/marchPath'
import { buildArrowRibbon, buildCarpetGeometry, CARPET_Y } from '@/features/stadiview/scene/carpetGeometry'
import { useSceneKit } from '@/features/stadiview/scene/sceneKit'

/** The arrows: one every this many metres along the carpet, flowing this fast in march direction. */
const ARROW_EVERY = 4
const ARROW_SPEED = 1.2
/** The marker lights: warm gold, a little brighter than the brand gold so they read as lamps. */
const LAMP = '#FFC861'

/** A soft round glow, drawn once into a small picture. */
function glowTexture(): CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255, 200, 97, 0.85)')
  g.addColorStop(0.35, 'rgba(255, 190, 80, 0.32)')
  g.addColorStop(1, 'rgba(255, 180, 60, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

/**
 * The march carpet (مسار المسيرة): the crimson runner round the blocks, gold lights along both of
 * its edges, and gold arrows flowing the way the graduates walk. The arrows stand still under
 * reduced motion and on low-end devices; they still point the way.
 */
export function MarchCarpet({ still }: { still: boolean }) {
  const kit = useSceneKit()
  const invalidate = useThree((s) => s.invalidate)

  const built = useMemo(() => {
    const path = getMarchPath()
    const carpet = buildCarpetGeometry(path)
    const lights = edgeLights(path)

    const puck = new CylinderGeometry(0.12, 0.13, 0.05, 8)
    puck.translate(0, CARPET_Y + 0.025, 0)
    const lampMaterial = new MeshBasicMaterial({ color: LAMP, toneMapped: false })
    const pucks = new InstancedMesh(puck, lampMaterial, lights.length)
    const glowMap = glowTexture()
    const glowMaterial = new MeshBasicMaterial({ map: glowMap, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false, side: DoubleSide })
    const glowPlane = new PlaneGeometry(1.6, 1.6)
    glowPlane.rotateX(-Math.PI / 2)
    glowPlane.translate(0, CARPET_Y + 0.03, 0)
    const glows = new InstancedMesh(glowPlane, glowMaterial, lights.length)
    const dummy = new Object3D()
    lights.forEach((p, k) => {
      dummy.position.set(p[0], 0, p[2])
      dummy.updateMatrix()
      pucks.setMatrixAt(k, dummy.matrix)
      glows.setMatrixAt(k, dummy.matrix)
    })
    for (const m of [pucks, glows]) {
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
      m.matrixAutoUpdate = false
    }
    glows.renderOrder = 2

    const arrows = buildArrowRibbon(path, 1.7)
    const arrowMaterial = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uEvery: { value: ARROW_EVERY } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uEvery;
        varying vec2 vUv;
        void main() {
          // Metres along the arrow's own repeat, and across the ribbon from its middle.
          float s = mod(vUv.x - uTime, uEvery);
          float y = abs(vUv.y - 0.5) * 1.7;
          // A chevron: its point leads, its arms trail back toward the edges.
          float d = abs(s - 1.2 + y * 0.9);
          float body = 1.0 - smoothstep(0.16, 0.24, d);
          float inside = 1.0 - smoothstep(0.62, 0.7, y);
          float a = body * inside * 0.9;
          if (a < 0.02) discard;
          gl_FragColor = vec4(vec3(1.0, 0.78, 0.33) * 1.15, a);
        }`,
    })
    const ribbon = { geometry: arrows, material: arrowMaterial }
    return { path, carpet, lights, pucks, glows, glowMap, lampMaterial, glowMaterial, puck, glowPlane, ribbon }
  }, [])

  useEffect(
    () => () => {
      const b = built
      for (const x of [b.carpet, b.puck, b.glowPlane, b.ribbon.geometry]) x.dispose()
      for (const x of [b.lampMaterial, b.glowMaterial, b.ribbon.material]) x.dispose()
      b.glowMap.dispose()
    },
    [built],
  )

  useFrame((_, dt) => {
    if (still) return
    built.ribbon.material.uniforms.uTime.value = (built.ribbon.material.uniforms.uTime.value + dt * ARROW_SPEED) % 1000
  })
  useEffect(() => {
    invalidate()
    extendDebugHook({ march: () => ({ length: Math.round(built.path.length), lights: built.lights.length, arrowsMoving: !still }) })
  }, [built, still, invalidate])

  return (
    <group name="march-carpet">
      <mesh geometry={built.carpet} material={kit.lit} />
      <mesh geometry={built.ribbon.geometry} material={built.ribbon.material} renderOrder={1} />
      <primitive object={built.pucks} />
      <primitive object={built.glows} />
    </group>
  )
}
