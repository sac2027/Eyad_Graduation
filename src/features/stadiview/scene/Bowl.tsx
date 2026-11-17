import { useEffect, useMemo } from 'react'
import { buildBowlGeometry } from '@/features/stadiview/scene/bowlGeometry'
import { useStatic } from '@/features/stadiview/scene/staticWorld'

/** The terraces round the bends that close the bowl: one static mesh, lit like the stands. */
export function Bowl() {
  const geometry = useMemo(() => buildBowlGeometry(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useStatic('lit', geometry)
  return null
}
