import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CylinderGeometry, DoubleSide, MeshBasicMaterial, RingGeometry } from 'three'
import type { Group, Mesh } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { SV } from '@/features/stadiview/scene/palette'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useStadium } from '@/features/stadiview/state/stadiumStore'

/** How tall the beam of light over the inspected seat stands, in metres. */
const BEAM_HEIGHT = 16

/**
 * Marks the inspected seat in the overview: a thin beam of gold light standing on it and a ring
 * on the floor around it, so one seat among thousands can be found at a glance. It is hidden in
 * first person, where the viewer is in the seat.
 */
export function SeatMarker({ still }: { still: boolean }) {
  const inspected = useHud((s) => s.inspected)
  const mode = useStadium((s) => s.mode)
  const invalidate = useThree((s) => s.invalidate)
  const group = useRef<Group>(null)
  const ring = useRef<Mesh>(null)

  const parts = useMemo(() => {
    const beam = new CylinderGeometry(0.1, 0.22, BEAM_HEIGHT, 8, 1, true)
    beam.translate(0, BEAM_HEIGHT / 2 + 1, 0)
    const circle = new RingGeometry(0.55, 0.8, 32)
    circle.rotateX(-Math.PI / 2)
    const glow = new MeshBasicMaterial({ color: SV.gold, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false, fog: false })
    const line = new MeshBasicMaterial({ color: SV.gold, transparent: true, opacity: 0.95, depthWrite: false, side: DoubleSide, toneMapped: false, fog: false })
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

  const shown = inspected >= 0 && mode !== 'pov'
  useEffect(() => {
    if (shown && group.current) {
      const v = getVenue()
      group.current.position.set(v.position[inspected * 3], v.position[inspected * 3 + 1], v.position[inspected * 3 + 2])
    }
    invalidate()
  }, [shown, inspected, invalidate])

  // The ring breathes slowly; standing still, it is a plain ring.
  useFrame((state) => {
    if (!shown || still || !ring.current) return
    const k = 1 + 0.18 * Math.sin(state.clock.elapsedTime * 2.6)
    ring.current.scale.set(k, 1, k)
  })

  return (
    <group ref={group} visible={shown} dispose={null}>
      <mesh geometry={parts.beam} material={parts.glow} renderOrder={6} />
      <mesh ref={ring} geometry={parts.circle} material={parts.line} position={[0, 0.06, 0]} renderOrder={6} />
    </group>
  )
}
