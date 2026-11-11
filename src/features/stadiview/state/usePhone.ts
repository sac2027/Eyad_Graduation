import { useSyncExternalStore } from 'react'

/** Below this width the HUD's cards become bottom sheets and the dock appears. The style sheet uses the same number. */
const QUERY = '(max-width: 640px)'

const media = (): MediaQueryList | null => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null)

/** Whether the screen is phone-sized right now. For code outside React (a store action, an event handler). */
export function isPhone(): boolean {
  return media()?.matches ?? false
}

function subscribe(fn: () => void): () => void {
  const m = media()
  m?.addEventListener('change', fn)
  return () => m?.removeEventListener('change', fn)
}

/** Whether the screen is phone-sized; re-renders when that changes (a rotated phone, a resized window). */
export function usePhone(): boolean {
  return useSyncExternalStore(subscribe, isPhone, () => false)
}
