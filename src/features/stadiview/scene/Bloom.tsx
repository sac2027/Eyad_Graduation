import { useEffect, useRef, useState } from 'react'
import { Vector2 } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { extendDebugHook } from '@/features/stadiview/debugHook'
import { BLOOM, bloomTooSlow } from '@/features/stadiview/engine/tiers'

/**
 * Bloom on desktop (tier 3): the emissive parts of the night (the LED bars, the arch, the marker
 * lights, the arrows, the gold arc and beacon) glow softly into the dark around them.
 *
 * The post-processing passes are fetched only here, so no other tier downloads them. If frames
 * stay slow, bloom switches itself off and the scene is drawn as on tier 2. `?svbloom=1` keeps it on
 * for review screenshots on machines without a graphics card.
 */
export function Bloom() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const [composer, setComposer] = useState<EffectComposer | null>(null)
  const [stopped, setStopped] = useState(false)

  useEffect(() => {
    let cancelled = false
    let made: EffectComposer | null = null
    Promise.all([
      import('three/examples/jsm/postprocessing/EffectComposer.js'),
      import('three/examples/jsm/postprocessing/RenderPass.js'),
      import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
      import('three/examples/jsm/postprocessing/OutputPass.js'),
    ]).then(([E, R, U, O]) => {
      if (cancelled) return
      made = new E.EffectComposer(gl)
      made.addPass(new R.RenderPass(scene, camera))
      made.addPass(new U.UnrealBloomPass(new Vector2(size.width, size.height), BLOOM.strength, BLOOM.radius, BLOOM.threshold))
      made.addPass(new O.OutputPass())
      setComposer(made)
    })
    return () => {
      cancelled = true
      made?.dispose()
    }
    // One composer for the life of the canvas; its size follows below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera])

  useEffect(() => {
    if (!composer) return
    composer.setPixelRatio(gl.getPixelRatio())
    composer.setSize(size.width, size.height)
  }, [composer, size, gl])

  useEffect(() => {
    extendDebugHook({ postprocessing: () => (composer && !stopped ? 'bloom' : 'none') })
  }, [composer, stopped])

  return composer && !stopped ? <BloomFrame composer={composer} onSlow={() => setStopped(true)} /> : null
}

/** Draws each frame through the composer; while mounted, three.js's own drawing steps aside. */
function BloomFrame({ composer, onSlow }: { composer: EffectComposer; onSlow(): void }) {
  const gl = useThree((s) => s.gl)
  const times = useRef<number[]>([])
  const forced = useRef(false)
  useEffect(() => {
    try {
      forced.current = new URLSearchParams(window.location.search).get('svbloom') === '1'
    } catch {
      forced.current = false
    }
    // Count every pass's drawing in the frame's totals, not only the last pass's.
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
  }, [gl])
  useFrame((_, dt) => {
    gl.info.reset()
    composer.render(dt)
    if (forced.current) return
    times.current.push(dt * 1000)
    if (times.current.length > 90) times.current.shift()
    if (bloomTooSlow(times.current)) onSlow()
  }, 1)
  return null
}

/** On tiers without bloom, says so to the debug hook. */
export function NoPostprocessing() {
  useEffect(() => {
    extendDebugHook({ postprocessing: () => 'none' })
  }, [])
  return null
}
