import { useEffect } from 'react'
import type { RefObject } from 'react'
import { isPhone } from '@/features/stadiview/state/usePhone'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * On a phone, a HUD card is a bottom sheet: it slides up over the stadium and is the one thing
 * being used. This hook gives a card the behaviour that goes with that, for as long as it is mounted:
 *
 * - focus moves into the sheet when it opens, and goes back to where it was when it closes;
 * - Tab stays inside the sheet;
 * - Escape closes it.
 *
 * On a wider screen the cards sit side by side and none of this applies.
 */
export function useSheet(ref: RefObject<HTMLElement | null>, onClose: () => void, active = true): void {
  useEffect(() => {
    const el = ref.current
    if (!el || !active || !isPhone()) return
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const items = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.offsetParent !== null)
    // The sheet itself takes the focus, so a screen reader starts reading at its title.
    if (!el.contains(document.activeElement)) {
      el.tabIndex = -1
      el.focus({ preventScroll: true })
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const list = items()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      const at = document.activeElement
      if (e.shiftKey && (at === first || at === el)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && at === last) {
        e.preventDefault()
        first.focus()
      }
    }
    el.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('keydown', onKey)
      // Back to the dock button that opened it, unless the focus has already moved on by itself.
      if (before && before.isConnected && (document.activeElement === document.body || el.contains(document.activeElement))) before.focus({ preventScroll: true })
    }
    // The sheet's behaviour belongs to the mount; `onClose` only reads stores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, active])
}
