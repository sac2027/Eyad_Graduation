import { useEffect, useState } from 'react'
import { create } from 'zustand'

export type ClockMode = 'real' | 'frozen' | 'playing'

interface ClockState {
  mode: ClockMode
  simulated: number
  /** Simulated milliseconds per real second while playing. */
  speed: number
  setSimulated(ms: number): void
  play(simMsPerRealSecond: number): void
  pause(): void
  useReal(): void
}

let timer: ReturnType<typeof setInterval> | null = null
let lastTick = 0

function stop() {
  if (timer !== null) clearInterval(timer)
  timer = null
}

/** The only place in the app allowed to read the real clock. */
export const useClock = create<ClockState>((set, get) => ({
  mode: 'real',
  simulated: Date.now(),
  speed: 0,
  setSimulated(ms) {
    stop()
    set({ mode: 'frozen', simulated: ms, speed: 0 })
  },
  play(simMsPerRealSecond) {
    stop()
    const start = get().mode === 'real' ? Date.now() : get().simulated
    set({ mode: 'playing', simulated: start, speed: simMsPerRealSecond })
    lastTick = Date.now()
    timer = setInterval(() => {
      const t = Date.now()
      const dt = t - lastTick
      lastTick = t
      set((s) => ({ simulated: s.simulated + (dt / 1000) * s.speed }))
    }, 250)
  },
  pause() {
    stop()
    if (get().mode === 'playing') set({ mode: 'frozen', speed: 0 })
  },
  useReal() {
    stop()
    set({ mode: 'real', speed: 0 })
  },
}))

export function getNow(): number {
  const s = useClock.getState()
  return s.mode === 'real' ? Date.now() : s.simulated
}

/** Current (possibly simulated) time. Re-renders at most once per `granularityMs`, except on explicit changes. */
export function useNow(granularityMs = 1000): number {
  const [now, setNow] = useState(getNow)
  useEffect(() => {
    let last = getNow()
    setNow(last)
    const update = (force: boolean) => {
      const n = getNow()
      if (force || Math.abs(n - last) >= granularityMs) {
        last = n
        setNow(n)
      }
    }
    let prevMode = useClock.getState().mode
    const unsub = useClock.subscribe((s) => {
      const modeChanged = s.mode !== prevMode
      prevMode = s.mode
      update(modeChanged || s.mode === 'frozen')
    })
    const id = setInterval(() => update(false), Math.min(granularityMs, 1000))
    return () => {
      unsub()
      clearInterval(id)
    }
  }, [granularityMs])
  return now
}
