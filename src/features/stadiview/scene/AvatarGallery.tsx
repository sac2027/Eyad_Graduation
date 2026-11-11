import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { MeshBasicMaterial, NeutralToneMapping } from 'three'
import type { Group } from 'three'
import type { AvatarKind } from '@/features/stadiview/data/occupancy'
import { avatarGeometry } from '@/features/stadiview/scene/avatarGeometry'
import type { Headwear, Lod } from '@/features/stadiview/scene/avatarGeometry'

/**
 * For review only (`/stadium?svavatars=1`): every figure side by side, the detailed model in front
 * and the far silhouette behind it, turning slowly on a dark ground.
 */
const VARIANTS: [AvatarKind, Headwear, string][] = [
  ['grad-m', 'ghutra', 'Graduate (men)'],
  ['grad-f', 'ghutra', 'Graduate (women)'],
  ['bay-m', 'ghutra', 'Bay (men)'],
  ['bay-f', 'ghutra', 'Bay (women)'],
  ['family-m', 'ghutra', 'Family, ghutra'],
  ['family-m', 'shemagh', 'Family, shemagh'],
  ['family-f', 'ghutra', 'Family (women)'],
]

function Figure({ kind, headwear, lod, x, z }: { kind: AvatarKind; headwear: Headwear; lod: Lod; x: number; z: number }) {
  const geometry = useMemo(() => avatarGeometry(kind, lod, headwear), [kind, lod, headwear])
  const material = useMemo(() => new MeshBasicMaterial({ vertexColors: true }), [])
  const turn = useRef<Group>(null)
  useFrame((_, dt) => {
    if (turn.current) turn.current.rotation.y += dt * 0.2
  })
  return (
    <group position={[x, 0, z]}>
      <group ref={turn} rotation={[0, Math.PI * 0.85, 0]}>
        <mesh geometry={geometry} material={material} />
      </group>
    </group>
  )
}

export default function AvatarGallery() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#061A17' }} data-sv-gallery>
      <Canvas gl={{ toneMapping: NeutralToneMapping }} camera={{ position: [0, 1.7, 5.6], fov: 40 }} onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}>
        <color attach="background" args={['#0B2520']} />
        {VARIANTS.map(([kind, headwear], k) => {
          const x = (k - (VARIANTS.length - 1) / 2) * 1.05
          return (
            <group key={`${kind}-${headwear}`}>
              <Figure kind={kind} headwear={headwear} lod="near" x={x} z={0.4} />
              <Figure kind={kind} headwear={headwear} lod="far" x={x} z={-1.2} />
            </group>
          )
        })}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12, 6]} />
          <meshBasicMaterial color="#123A33" />
        </mesh>
      </Canvas>
      <ul dir="ltr" style={{ position: 'absolute', insetInline: 0, bottom: 16, display: 'flex', justifyContent: 'space-around', margin: 0, padding: '0 24px', listStyle: 'none', color: '#E8DEC3', font: '600 12px system-ui' }}>
        {VARIANTS.map(([kind, headwear, label]) => (
          <li key={`${kind}-${headwear}`}>{label}</li>
        ))}
      </ul>
    </div>
  )
}
