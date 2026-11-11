import { useState, useSyncExternalStore } from 'react'
import { COLLEGE_NAMES } from '@/domain/types'
import { COLLEGE_ID } from '@/features/stadiview/config/venue'
import type { CollegeCode } from '@/features/stadiview/config/venue'
import { getDirectory, maskStudentId, searchGraduates } from '@/features/stadiview/data/graduateDirectory'
import type { Graduate } from '@/features/stadiview/data/graduateDirectory'
import { locatorService } from '@/features/stadiview/data/locatorService'
import { usePitchSeats } from '@/features/stadiview/data/pitchSeatService'
import { seatWords } from '@/features/stadiview/hud/SeatTooltip'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useStadium } from '@/features/stadiview/state/stadiumStore'
import { useViewer } from '@/features/stadiview/state/useViewer'
import { formatNumber, useLocale, useT } from '@/i18n'
import type { Locale, TFn } from '@/i18n'
import { getNow } from '@/time/clockStore'

const LIMIT = 8
const COLLEGES = Object.keys(COLLEGE_ID) as CollegeCode[]

/** Where a college-and-degree group sits: its blocks and its rows, in words. */
function zonePlace(zone: number, t: TFn, locale: Locale): string {
  const v = getVenue()
  const z = v.zones[zone]
  let b0 = Infinity
  let b1 = 0
  let r0 = Infinity
  let r1 = 0
  for (let i = z.start; i < z.start + z.count; i++) {
    const block = Number(v.sections[v.section[i]].id.slice(1))
    b0 = Math.min(b0, block)
    b1 = Math.max(b1, block)
    r0 = Math.min(r0, v.row[i])
    r1 = Math.max(r1, v.row[i])
  }
  const n = (value: number) => formatNumber(value, locale)
  const blocks = b0 === b1 ? t('sv.tip.block', { n: n(b0) }) : t('sv.guest.blocks', { a: n(b0), b: n(b1) })
  const rows = r0 === r1 ? t('sv.tip.row', { n: n(r0) }) : t('sv.guest.rows', { a: n(r0), b: n(r1) })
  return t('sv.guest.zonePlace', { blocks, rows })
}

/** The graduate a guest has chosen, and where they are, if the guest may know. */
export function useLocated(): { graduate: Graduate | null; seat: number; state: 'none' | 'found' | 'no-seat-yet' | 'locator-off' } {
  const viewer = useViewer()
  usePitchSeats()
  useSyncExternalStore(locatorService.subscribe, locatorService.version)
  const guest = useHud((s) => s.guest)
  const graduate = guest.graduate >= 0 ? (getDirectory().all[guest.graduate] ?? null) : null
  if (!graduate) return { graduate: null, seat: -1, state: 'none' }
  // The share code is the graduate's own consent, so it finds them whatever the locator says.
  const found = locatorService.locate(guest.byCode ? { shareCode: graduate.shareCode } : { graduate }, viewer.now)
  if (found.ok) return { graduate, seat: found.value.seat, state: 'found' }
  return { graduate, seat: -1, state: found.error === 'locator-off' ? 'locator-off' : 'no-seat-yet' }
}

/**
 * "Locate my graduate": a guest finds a graduate by name or student ID, or with the Family Share
 * Code the graduate gave them, and is shown that graduate's seat on the pitch.
 *
 * A search shows the seat only while the graduate's family locator is on; otherwise it asks for
 * the code, and says nothing about whether they have booked.
 */
export function GraduateSearch({ canFly }: { canFly: boolean }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const located = useLocated()
  const [query, setQuery] = useState('')
  const [college, setCollege] = useState<CollegeCode | null>(null)
  const [codeOpen, setCodeOpen] = useState(false)
  const [code, setCode] = useState('')
  const [codeWrong, setCodeWrong] = useState(false)
  const v = getVenue()

  const results = located.graduate ? { matches: [], total: 0 } : searchGraduates(query, LIMIT, college)
  const searched = query.trim().length >= 2

  /** Shows a graduate: their seat when it may be shown, their zone when they have none yet. */
  const choose = (g: Graduate, byCode: boolean) => {
    const hud = useHud.getState()
    hud.setGuest({ graduate: g.index, byCode })
    const found = locatorService.locate(byCode ? { shareCode: g.shareCode } : { graduate: g }, getNow())
    if (found.ok) {
      hud.inspect(found.value.seat, true)
      hud.setFilters({ college: null, degree: null })
    } else if (found.error === 'no-seat-yet') {
      // No seat to mark yet: the group's zone is lit on the map and in 3D instead.
      const zone = v.zones[g.zone]
      hud.inspect(-1)
      hud.setFilters({ college: zone.college, degree: zone.degree })
      // The map closes in on the zone; on a phone this panel stays in front, since it holds the explanation.
      hud.fitMatrix({ zone: g.zone }, false)
    } else {
      hud.inspect(-1)
      setCodeOpen(true)
    }
  }

  const clear = () => {
    const hud = useHud.getState()
    hud.setGuest({ graduate: -1, byCode: false })
    hud.setFilters({ college: null, degree: null })
    setCode('')
    setCodeWrong(false)
    setCodeOpen(false)
  }

  const submitCode = () => {
    const g = getDirectory().byShareCode(code)
    // A code entered for one graduate must be that graduate's code.
    if (!g || (located.graduate && g.index !== located.graduate.index)) {
      setCodeWrong(true)
      return
    }
    setCodeWrong(false)
    setCode('')
    setCodeOpen(false)
    choose(g, true)
  }

  const codeForm = (
    <form
      className="sv-guest__row"
      onSubmit={(e) => {
        e.preventDefault()
        submitCode()
      }}
    >
      <input
        className="sv-field"
        dir="ltr"
        value={code}
        onChange={(e) => {
          setCode(e.target.value)
          setCodeWrong(false)
        }}
        placeholder="KF-XXXX-XX"
        aria-label={t('sv.mine.share')}
        aria-invalid={codeWrong ? true : undefined}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        data-sv-code-input
      />
      <button type="submit" className="sv-plate sv-button" data-sv-code-find>
        {t('sv.guest.find')}
      </button>
    </form>
  )
  const codeError = codeWrong && (
    <p className="sv-guest__help">
      <span role="alert" className="sv-guest__problem" data-sv-code-error>
        {t('sv.guest.err.code')}
      </span>
    </p>
  )

  const g = located.graduate
  const zone = g ? v.zones[g.zone] : null
  const name = g ? g.name[locale] : ''

  return (
    <section className="sv-guest__part" aria-labelledby="sv-locate-title">
      <h3 id="sv-locate-title">{t('sv.guest.locate')}</h3>

      {g && zone ? (
        <div className="sv-guest__found" data-sv-located={located.state} data-seat={located.seat >= 0 ? v.idOf(located.seat) : ''}>
          <b>{name}</b>
          <span>
            {COLLEGE_NAMES[COLLEGE_ID[zone.college]][locale]} · {t(`sv.degree.${zone.degree}`)}
          </span>
          {located.state === 'found' && (
            <>
              <p data-sv-located-seat>{t('sv.guest.sitsIn', { seat: seatWords(located.seat, t, locale).place })}</p>
              <div className="sv-guest__buttons">
                {canFly && (
                  <button type="button" className="sv-plate sv-button sv-button--gold" onClick={() => useStadium.getState().select(located.seat)} data-sv-fly-graduate>
                    {t('sv.guest.flyTo')}
                  </button>
                )}
              </div>
            </>
          )}
          {located.state === 'no-seat-yet' && <p data-sv-no-seat>{t('sv.guest.noSeat', { name, place: zonePlace(g.zone, t, locale) })}</p>}
          {located.state === 'locator-off' && (
            <>
              <p data-sv-locator-off>{t('sv.guest.locatorOff', { name })}</p>
              {codeForm}
              {codeError}
            </>
          )}
          <button type="button" className="sv-link" onClick={clear} data-sv-clear-graduate>
            {t('sv.guest.another')}
          </button>
        </div>
      ) : (
        <>
          <div className="sv-guest__row sv-guest__row--search">
            <input
              className="sv-field"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('sv.guest.searchPlaceholder')}
              aria-label={t('sv.guest.searchLabel')}
              aria-describedby="sv-search-status"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              data-sv-graduate-search
            />
            <select className="sv-field" aria-label={t('sv.mx.filter.college')} value={college ?? ''} onChange={(e) => setCollege((e.target.value || null) as CollegeCode | null)} data-sv-search-college>
              <option value="">{t('sv.mx.filter.allColleges')}</option>
              {COLLEGES.map((c) => (
                <option key={c} value={c}>
                  {COLLEGE_NAMES[COLLEGE_ID[c]][locale]}
                </option>
              ))}
            </select>
          </div>

          <p id="sv-search-status" className="sv-guest__help" role="status" data-sv-search-status>
            {!searched && t('sv.guest.searchHint')}
            {searched && results.total === 0 && t('sv.guest.noMatch')}
            {searched && results.total > LIMIT && t('sv.guest.more', { n: formatNumber(results.total - LIMIT, locale) })}
          </p>

          {results.matches.length > 0 && (
            <ul className="sv-guest__results">
              {results.matches.map((m) => {
                const z = v.zones[m.zone]
                return (
                  <li key={m.index}>
                    <button type="button" onClick={() => choose(m, false)} data-sv-graduate-result={m.index}>
                      <b>{m.name[locale]}</b>
                      <span>
                        {COLLEGE_NAMES[COLLEGE_ID[z.college]][locale]} · {t(`sv.degree.${z.degree}`)} · <bdi dir="ltr">{maskStudentId(m.studentId)}</bdi>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {codeOpen ? (
            <>
              {codeForm}
              {codeError}
            </>
          ) : (
            <button type="button" className="sv-link" onClick={() => setCodeOpen(true)} data-sv-have-code>
              {t('sv.guest.haveCode')}
            </button>
          )}
        </>
      )}
    </section>
  )
}
