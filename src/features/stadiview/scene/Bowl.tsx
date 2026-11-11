import { useEffect, useMemo } from 'react'
import { buildBowlGeometry } from '@/features/stadiview/scene/bowlGeometry'
import { useSceneKit } from '@/features/stadiview/scene/sceneKit'

/** The terraces round the bends that close the bowl: one static mesh, lit like the stands. */
export function Bowl() {
  const kit = useSceneKit()
  const geometry = useMemo(() => buildBowlGeometry(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={kit.lit} name="bowl" />
}
