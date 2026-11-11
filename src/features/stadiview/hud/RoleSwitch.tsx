import { PERSONAS } from '@/data/fixtures/graduates'
import { useHud } from '@/features/stadiview/state/hudStore'
import type { Role } from '@/features/stadiview/state/hudStore'
import { useViewer } from '@/features/stadiview/state/useViewer'
import { useLocale, useT } from '@/i18n'
import { useSession } from '@/session/sessionStore'

/**
 * The switch between the two ways of using the stadium: as a signed-in graduate, who may book a
 * seat, and as a family member or guest, who may only look things up.
 *
 * In this demo "signing in" is choosing a mock graduate, as the site header's Sign in does.
 */
export function RoleSwitch() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const viewer = useViewer()
  const setRole = useHud((s) => s.setRole)
  const { persona, setPersona } = useSession()

  const choose = (role: Role) => {
    if (role === 'graduate' && persona.role !== 'graduate') setPersona(PERSONAS.find((p) => p.role === 'graduate')!.id)
    setRole(role)
  }

  return (
    <div className="sv-role" role="group" aria-label={t('sv.role.label')} data-sv-role={viewer.role}>
      {(['graduate', 'guest'] as const).map((role) => (
        <button key={role} type="button" className="sv-plate sv-button sv-role__option" aria-pressed={viewer.role === role} onClick={() => choose(role)} data-sv-role-option={role}>
          {t(`sv.role.${role}`)}
        </button>
      ))}
      {viewer.name && (
        <span className="sv-role__name" data-sv-viewer-name>
          {viewer.name[locale]}
        </span>
      )}
    </div>
  )
}
