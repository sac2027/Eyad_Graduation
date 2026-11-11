import { createContext, useContext } from 'react'
import { DataTexture, LinearFilter, MeshBasicMaterial, MeshLambertMaterial, RGBAFormat, UnsignedByteType } from 'three'
import { POOL_SPAN } from '@/features/stadiview/scene/meshBuilder'

/**
 * The few materials the whole static stadium is drawn with. Sharing them keeps the number of
 * shader programs, and of state changes per frame, as low as it can be.
 */
export interface SceneKit {
  /** The floodlight that falls on the venue, baked into a small texture (see `floodlightPool`). */
  pool: DataTexture
  /** Every lit surface: corner colours, the sky and key lights, plus the baked floodlight. */
  lit: MeshLambertMaterial
  /** Self-lit surfaces, drawn exactly as painted: lamps, gold trim, lit windows. */
  glow: MeshBasicMaterial
}

const POOL_TEXELS = 128

/**
 * The share of full floodlight that reaches the point (x, z) of the venue, from 1 in the middle of
 * the pitch down to a faint 0.05 outside the stadium. The stands get about half.
 *
 * It is an oval a little larger than the bowl. The seat colours use the same function, so chairs
 * and the concrete they stand on are lit alike.
 */
export function poolAt(x: number, z: number): number {
  const d = Math.hypot(x / 98, z / 80)
  const t = Math.min(Math.max((d - 0.12) / (1.3 - 0.12), 0), 1)
  return 0.05 + 0.95 * (1 - t * t * (3 - 2 * t))
}

/**
 * How much floodlight reaches each spot of the venue, as a picture seen from above.
 *
 * Four masts light a stadium unevenly: bright on the pitch, falling away over the stands, nearly
 * dark outside. Working that out per pixel with four real lamps is costly on a phone, so it is
 * painted once into this small texture and every surface reads its own spot from it. The texture
 * is smooth, so 128 texels across 360 metres is plenty.
 */
export function floodlightPool(): DataTexture {
  const data = new Uint8Array(POOL_TEXELS * POOL_TEXELS * 4)
  for (let j = 0; j < POOL_TEXELS; j++) {
    for (let i = 0; i < POOL_TEXELS; i++) {
      const x = ((i + 0.5) / POOL_TEXELS) * 2 * POOL_SPAN - POOL_SPAN
      const z = ((j + 0.5) / POOL_TEXELS) * 2 * POOL_SPAN - POOL_SPAN
      const light = poolAt(x, z)
      const k = (j * POOL_TEXELS + i) * 4
      // A touch warm, like metal-halide lamps.
      data[k] = Math.round(255 * light)
      data[k + 1] = Math.round(255 * light * 0.97)
      data[k + 2] = Math.round(255 * light * 0.88)
      data[k + 3] = 255
    }
  }
  const texture = new DataTexture(data, POOL_TEXELS, POOL_TEXELS, RGBAFormat, UnsignedByteType)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

/**
 * How strongly the baked floodlight adds to a surface. A lit surface shows its paint at full strength
 * when the light on it adds up to pi; with the sky and key lights in StadiumCanvas this brings a level
 * surface in the middle of the pitch to about that.
 */
export const POOL_INTENSITY = 1.75

export function createSceneKit(): SceneKit {
  const pool = floodlightPool()
  return {
    pool,
    lit: new MeshLambertMaterial({ vertexColors: true, lightMap: pool, lightMapIntensity: POOL_INTENSITY }),
    glow: new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  }
}

export function disposeSceneKit(kit: SceneKit): void {
  kit.pool.dispose()
  kit.lit.dispose()
  kit.glow.dispose()
}

export const SceneKitContext = createContext<SceneKit | null>(null)

/** The shared materials. Only valid inside the stadium canvas. */
export function useSceneKit(): SceneKit {
  const kit = useContext(SceneKitContext)
  if (!kit) throw new Error('useSceneKit must be used inside the stadium canvas')
  return kit
}
