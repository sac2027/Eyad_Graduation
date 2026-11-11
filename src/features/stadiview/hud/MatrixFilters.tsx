import { COLLEGE_NAMES } from '@/domain/types'
import { COLLEGE_ID } from '@/features/stadiview/config/venue'
import type { CollegeCode, Degree } from '@/features/stadiview/config/venue'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useLocale, useT } from '@/i18n'

const COLLEGES = Object.keys(COLLEGE_ID) as CollegeCode[]

/** The filters under the seat map. They dim what does not match, in the map and in the 3D scene alike. */
export function MatrixFilters() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const filters = useHud((s) => s.filters)
  const setFilters = useHud((s) => s.setFilters)
  return (
    <div className="sv-mx__filters" data-sv-filters>
      <select className="sv-field" aria-label={t('sv.mx.filter.college')} value={filters.college ?? ''} onChange={(e) => setFilters({ college: (e.target.value || null) as CollegeCode | null })} data-sv-filter="college">
        <option value="">{t('sv.mx.filter.allColleges')}</option>
        {COLLEGES.map((c) => (
          <option key={c} value={c}>
            {COLLEGE_NAMES[COLLEGE_ID[c]][locale]}
          </option>
        ))}
      </select>
      <select className="sv-field" aria-label={t('sv.mx.filter.degree')} value={filters.degree ?? ''} onChange={(e) => setFilters({ degree: (e.target.value || null) as Degree | null })} data-sv-filter="degree">
        <option value="">{t('sv.mx.filter.allDegrees')}</option>
        <option value="B">{t('sv.degree.B')}</option>
        <option value="G">{t('sv.degree.G')}</option>
      </select>
      <label className="sv-check">
        <input type="checkbox" checked={filters.availableOnly} onChange={(e) => setFilters({ availableOnly: e.target.checked })} data-sv-filter="available" />
        <span>{t('sv.mx.filter.available')}</span>
      </label>
      <label className="sv-check">
        <input type="checkbox" checked={filters.accessibleOnly} onChange={(e) => setFilters({ accessibleOnly: e.target.checked })} data-sv-filter="accessible" />
        <span>{t('sv.mx.filter.accessible')}</span>
      </label>
    </div>
  )
}
