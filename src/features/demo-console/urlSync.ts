import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { formatTimeParam, parseTimeParam } from '@/time/urlState'
import { useClock } from '@/time/clockStore'
import { useSessionStore } from '@/session/sessionStore'
import { useLocale } from '@/i18n'
import { useMotionOverride } from '@/ui/motionPrefs'
import { useDemoFlags } from './flags'

/** Reads the demo state from the URL once, then mirrors changes back (throttled while time is playing). */
export function useUrlSync() {
  const location = useLocation()
  const writeNow = useRef<(() => void) | null>(null)

  // In-app navigation drops the query string, so put the demo state back on the new URL.
  useEffect(() => {
    writeNow.current?.()
  }, [location.pathname, location.hash])

  useEffect(() => {
    const t = parseTimeParam(window.location.search)
    if (t !== null) useClock.getState().setSimulated(t)

    let queued: ReturnType<typeof setTimeout> | null = null
    const write = () => {
      queued = null
      const url = new URL(window.location.href)
      const c = useClock.getState()
      if (c.mode === 'real') url.searchParams.delete('t')
      else url.searchParams.set('t', formatTimeParam(c.simulated))
      url.searchParams.set('persona', useSessionStore.getState().personaId)
      const lang = useLocale.getState().locale
      if (lang === 'en') url.searchParams.set('lang', 'en')
      else url.searchParams.delete('lang')
      const f = useDemoFlags.getState()
      if (f.lowEnd) url.searchParams.set('lowend', '1')
      else url.searchParams.delete('lowend')
      if (f.worstCase) url.searchParams.set('worst', '1')
      else url.searchParams.delete('worst')
      if (f.dateStatus === 'tbc') url.searchParams.set('tbc', '1')
      else url.searchParams.delete('tbc')
      if (f.gpaOverride !== null) url.searchParams.set('gpa', String(f.gpaOverride))
      else url.searchParams.delete('gpa')
      if (useMotionOverride.getState().reduced === true) url.searchParams.set('reduced', '1')
      else url.searchParams.delete('reduced')
      try {
        window.history.replaceState(window.history.state, '', url)
      } catch {
        /* Safari rate-limits history changes; the next change will retry */
      }
    }
    writeNow.current = write
    const schedule = () => {
      if (queued === null) queued = setTimeout(write, 300)
    }
    const unsubs = [
      useClock.subscribe(schedule),
      useSessionStore.subscribe(schedule),
      useLocale.subscribe(schedule),
      useDemoFlags.subscribe(schedule),
      useMotionOverride.subscribe(schedule),
    ]
    write()
    return () => {
      unsubs.forEach((u) => u())
      if (queued !== null) clearTimeout(queued)
      writeNow.current = null
    }
  }, [])
}
