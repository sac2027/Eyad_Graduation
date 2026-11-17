import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { extendDebugHook } from '@/features/stadiview/debugHook'
import { RESOLUTION, nextResolution, startResolution } from '@/features/stadiview/engine/resolution'

/**
 * Keeps the stadium smooth by trading sharpness for speed, and back.
 *
 * Automated browsers are left at full sharpness, so stills and tests do not change with the load on
 * the machine; `?svadaptive=1` turns it on for them.
 */
export function Resolution({ max }: { max: number }) {
  const setDpr = useThree((s) => s.setDpr)
  const state = useRef(startResolution(1))
  const frames = useRef({ sum: 0, n: 0 })
  const on = useRef(false)

  useEffect(() => {
    const cap = Math.min(max, window.devicePixelRatio || 1)
    state.current = startResolution(Math.max(1, cap))
    const forced = (() => {
      try {
        return new URLSearchParams(window.location.search).get('svadaptive') === '1'
      } catch {
        return false
      }
    })()
    on.current = forced || !navigator.webdriver
    extendDebugHook({ resolution: () => ({ ratio: state.current.ratio, adaptive: on.current }) })
  }, [max])

  useFrame((_, dt) => {
    if (!on.current) return
    // A long gap is a hidden tab or a stall, not the stadium's own pace.
    if (dt > 0.5) return
    const f = frames.current
    f.sum += dt * 1000
    f.n += 1
    if (f.n < RESOLUTION.window) return
    const ms = f.sum / f.n
    f.sum = 0
    f.n = 0
    const cap = Math.max(1, Math.min(max, window.devicePixelRatio || 1))
    const next = nextResolution(state.current, ms, cap)
    if (next.ratio !== state.current.ratio) setDpr(next.ratio)
    state.current = next
  })
  return null
}
