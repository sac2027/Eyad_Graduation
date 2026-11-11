import { getDirectory } from '@/features/stadiview/data/graduateDirectory'
import type { Graduate } from '@/features/stadiview/data/graduateDirectory'
import { useHud } from '@/features/stadiview/state/hudStore'
import type { Role } from '@/features/stadiview/state/hudStore'
import { useSession } from '@/session/sessionStore'
import { useNow } from '@/time/clockStore'

export interface Viewer {
  role: Role
  /** The signed-in graduate, when the page is in graduate mode; null for a guest. */
  graduate: Graduate | null
  /** The graduate's display name in both languages (the demo's worst-case switch can lengthen it). */
  name: { ar: string; en: string } | null
  /** The simulated time, refreshed once a minute: seats do not change faster than that. */
  now: number
}

/** Who is looking at the stadium right now. */
export function useViewer(): Viewer {
  const role = useHud((s) => s.role)
  const { persona } = useSession()
  const now = useNow(60_000)
  const graduate = role === 'graduate' && persona.role === 'graduate' ? getDirectory().byPersona(persona.id) : null
  return { role: graduate ? 'graduate' : 'guest', graduate, name: graduate ? persona.name : null, now }
}
