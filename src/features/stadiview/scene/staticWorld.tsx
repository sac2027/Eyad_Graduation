import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'
import { useSceneKit } from '@/features/stadiview/scene/sceneKit'

/**
 * The stadium's still parts, drawn together.
 *
 * The ground, the stands, the stage, the masts, the bowl, the carpet and the campus are built by
 * separate parts of the scene, but they share two materials: the lit one and the self-lit one.
 * Each part hands its geometry in here and the two piles are drawn as two meshes. Every mesh costs
 * the processor a draw; a dozen parts drawn as two is what a phone can afford.
 */
export type StaticKind = 'lit' | 'glow'

interface Registry {
  add(kind: StaticKind, geometry: BufferGeometry): () => void
}

const StaticWorldContext = createContext<Registry | null>(null)

const NAMES = ['position', 'normal', 'color', 'uv'] as const
const SIZES = { position: 3, normal: 3, color: 3, uv: 2 } as const

/** Whether a geometry is the plain kind the piles are made of: no index, and all four attributes. */
function plain(g: BufferGeometry): boolean {
  return g.index === null && NAMES.every((n) => g.getAttribute(n) !== undefined && g.getAttribute(n).itemSize === SIZES[n])
}

function merge(list: BufferGeometry[]): BufferGeometry | null {
  if (list.length === 0) return null
  let count = 0
  for (const g of list) count += g.getAttribute('position').count
  const out = new BufferGeometry()
  for (const n of NAMES) {
    const array = new Float32Array(count * SIZES[n])
    let at = 0
    for (const g of list) {
      const a = g.getAttribute(n).array as Float32Array
      array.set(a, at)
      at += a.length
    }
    out.setAttribute(n, new BufferAttribute(array, SIZES[n]))
  }
  out.computeBoundingSphere()
  return out
}

export function StaticWorld({ children }: { children: ReactNode }) {
  const kit = useSceneKit()
  const [piles, setPiles] = useState<{ lit: BufferGeometry[]; glow: BufferGeometry[] }>({ lit: [], glow: [] })
  const registry = useMemo<Registry>(
    () => ({
      add(kind, geometry) {
        setPiles((p) => ({ ...p, [kind]: [...p[kind], geometry] }))
        return () => setPiles((p) => ({ ...p, [kind]: p[kind].filter((g) => g !== geometry) }))
      },
    }),
    [],
  )
  const lit = useMemo(() => merge(piles.lit.filter(plain)), [piles.lit])
  const glow = useMemo(() => merge(piles.glow.filter(plain)), [piles.glow])
  useEffect(() => () => lit?.dispose(), [lit])
  useEffect(() => () => glow?.dispose(), [glow])
  // Anything that is not the plain kind is drawn by itself, as before.
  const odd = [...piles.lit.filter((g) => !plain(g)).map((g) => [g, kit.lit] as const), ...piles.glow.filter((g) => !plain(g)).map((g) => [g, kit.glow] as const)]

  return (
    <StaticWorldContext.Provider value={registry}>
      {children}
      {lit && <mesh geometry={lit} material={kit.lit} name="static-lit" matrixAutoUpdate={false} />}
      {glow && <mesh geometry={glow} material={kit.glow} name="static-glow" matrixAutoUpdate={false} />}
      {odd.map(([g, m]) => (
        <mesh key={g.uuid} geometry={g} material={m} />
      ))}
    </StaticWorldContext.Provider>
  )
}

/** Hands a still geometry to the pile it is drawn with. Pass null for a part that is not there. */
export function useStatic(kind: StaticKind, geometry: BufferGeometry | null): void {
  const registry = useContext(StaticWorldContext)
  useLayoutEffect(() => {
    if (!registry || !geometry) return
    return registry.add(kind, geometry)
  }, [registry, kind, geometry])
}
