import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CylinderGeometry, DoubleSide, MeshBasicMaterial, RingGeometry } from 'three'
import type { Group, Mesh } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { extendDebugHook } from '@/features/stadiview/debugHook'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { SV } from '@/features/stadiview/scene/palette'
import { useBeaconSeat } from '@/features/stadiview/state/useLocated'

/** The beam over a located graduate's seat: 12 m of gold light. */
export const BEACON_HEIGHT = 12
/** One pulse of the ring, in seconds. */
const PULSE = 1.6

/**
 * Marks the seat of the graduate a guest has located: a 12 m gold beam and a ring that pulses
 * outward once every 1.6 s. Standing still, the ring is drawn at rest.
 */
export function GraduateBeacon({ still }: { still: boolean }) {
  const seat = useBeaconSeat()
  const invalidate = useThree((s) => s.invalidate)
  const group = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const parts = useMemo(() => {
    const beam = new CylinderGeometry(0.12, 0.3, BEACON_HEIGHT, 10, 1, true)
    beam.translate(0, BEACON_HEIGHT / 2 + 1, 0)
    const circle = new RingGeometry(0.6, 0.85, 40)
    circle.rotateX(-Math.PI / 2)
    const glow = new MeshBasicMaterial({ color: SV.gold, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false, fog: false })
    const line = new MeshBasicMaterial({ color: SV.gold, transparent: true, opacity: 1, depthWrite: false, side: DoubleSide, toneMapped: false, fog: false })
    return { beam, circle, glow, line }
  }, [])
  useEffect(
    () => () => {
      parts.beam.dispose()
      parts.circle.dispose()
      parts.glow.dispose()
      parts.line.dispose()
    },
    [parts],
  )

  useEffect(() => {
    const v = getVenue()
    if (seat >= 0 && group.current) group.current.position.set(v.position[seat * 3], v.position[seat * 3 + 1], v.position[seat * 3 + 2])
    extendDebugHook({ beacon: () => (seat >= 0 ? { seat: v.idOf(seat), height: BEACON_HEIGHT } : null) })
    invalidate()
  }, [seat, invalidate])

  useFrame((state) => {
    if (seat < 0 || !ring.current) return
    if (still) {
      ring.current.scale.set(1, 1, 1)
      parts.line.opacity = 1
      return
    }
    const t = (state.clock.elapsedTime % PULSE) / PULSE
    const k = 1 + 1.4 * t
    ring.current.scale.set(k, 1, k)
    parts.line.opacity = 1 - t
  })

  return (
    <group ref={group} name="graduate-beacon" visible={seat >= 0}>
      <mesh geometry={parts.beam} material={parts.glow} renderOrder={6} />
      <mesh ref={ring} geometry={parts.circle} material={parts.line} position={[0, 0.06, 0]} renderOrder={6} />
    </group>
  )
}
