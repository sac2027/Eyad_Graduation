import { useHud } from '@/features/stadiview/state/hudStore'
import type { Panel } from '@/features/stadiview/state/hudStore'
import { usePhone } from '@/features/stadiview/state/usePhone'
import { useViewer } from '@/features/stadiview/state/useViewer'
import { useT } from '@/i18n'

const ICONS: Record<'matrix' | 'mine' | 'guest' | 'inspector', string> = {
  // A grid of seats, a person, a magnifier, a single seat.
  matrix: 'M4 5h4v4H4zM10 5h4v4h-4zM16 5h4v4h-4zM4 11h4v4H4zM10 11h4v4h-4zM16 11h4v4h-4zM4 17h4v2H4zM10 17h4v2h-4zM16 17h4v2h-4z',
  mine: 'M12 4a4 4 0 110 8 4 4 0 010-8zM4 20c0-3.5 3.6-6 8-6s8 2.5 8 6',
  guest: 'M10.5 4a6.5 6.5 0 110 13 6.5 6.5 0 010-13zM15.5 15.5L21 21',
  inspector: 'M7 4h10v9H7zM5 13h14v4H5zM7 17v3M17 17v3',
}

/**
 * The phone's row of buttons along the bottom edge. Each opens one sheet; opening one closes the
 * other, because a phone has room for one thing at a time.
 *
 * Without the 3D picture the seat map is the page itself, so "Seats" there means "put the sheets away".
 */
export function Dock({ flat }: { flat: boolean }) {
  const t = useT()
  const phone = usePhone()
  const viewer = useViewer()
  const panel = useHud((s) => s.panel)
  const inspected = useHud((s) => s.inspected)
  if (!phone) return null

  const mine: Panel = viewer.role === 'graduate' ? 'mine' : 'guest'
  const button = (key: 'matrix' | 'mine' | 'guest' | 'inspector', label: string) => {
    const on = key === 'matrix' && flat ? panel === 'none' || panel === 'matrix' : panel === key
    const press = () => {
      const hud = useHud.getState()
      if (key === 'matrix' && flat) hud.setPanel('none')
      else hud.setPanel(on ? 'none' : key)
    }
    return (
      <button key={key} type="button" aria-pressed={on} onClick={press} data-sv-dock-button={key}>
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="square" strokeLinejoin="miter">
          <path d={ICONS[key]} />
        </svg>
        <span>{label}</span>
      </button>
    )
  }

  return (
    <nav className="sv-bar" aria-label={t('sv.dock.label')} data-sv-dock>
      {button('matrix', t('sv.dock.seats'))}
      {button(mine, t(mine === 'mine' ? 'sv.mine.title' : 'sv.guest.title'))}
      {inspected >= 0 && button('inspector', t('sv.dock.seat'))}
    </nav>
  )
}
