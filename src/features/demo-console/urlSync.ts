import { useEffect } from 'react'
import { formatTimeParam, parseTimeParam } from '@/time/urlState'
import { useClock } from '@/time/clockStore'
import { useSessionStore } from '@/session/sessionStore'
import { useLocale } from '@/i18n'
import { useDemoFlags } from './flags'

/** Reads the demo state from the URL once, then mirrors changes back (throttled while time is playing). */
export function useUrlSync() {
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
      window.history.replaceState(null, '', url)
    }
    const schedule = () => {
      if (queued === null) queued = setTimeout(write, 300)
    }
    const unsubs = [
      useClock.subscribe(schedule),
      useSessionStore.subscribe(schedule),
      useLocale.subscribe(schedule),
      useDemoFlags.subscribe(schedule),
    ]
    write()
    return () => {
      unsubs.forEach((u) => u())
      if (queued !== null) clearTimeout(queued)
    }
  }, [])
}
