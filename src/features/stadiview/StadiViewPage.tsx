import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
// First, so the page's words are registered before any component asks for them.
import '@/features/stadiview/i18n'
import { Link } from 'react-router-dom'
import { Logo } from '@/brand/logo/Logo'
import { useDemoFlags } from '@/features/demo-console/flags'
import { extendDebugHook, installDebugHook, removeDebugHook } from '@/features/stadiview/debugHook'
import { BackButton } from '@/features/stadiview/hud/BackButton'
import { GuestPanel, GuestToggle } from '@/features/stadiview/hud/GuestPanel'
import { Inspector } from '@/features/stadiview/hud/Inspector'
import { MySeatPanel, MySeatToggle } from '@/features/stadiview/hud/MySeatPanel'
import { PovHint } from '@/features/stadiview/hud/PovHint'
import { RoleSwitch } from '@/features/stadiview/hud/RoleSwitch'
import { SeatCardDialog } from '@/features/stadiview/hud/SeatCardDialog'
import { SeatMatrix } from '@/features/stadiview/hud/SeatMatrix'
import { SeatTooltip } from '@/features/stadiview/hud/SeatTooltip'
import { pitchSeats } from '@/features/stadiview/data/pitchSeatService'
import { getDirectory } from '@/features/stadiview/data/graduateDirectory'
import { guestTicketService } from '@/features/stadiview/data/guestTicketService'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { useHud } from '@/features/stadiview/state/hudStore'
import { useStadium } from '@/features/stadiview/state/stadiumStore'
import { TIER_SETTINGS } from '@/features/stadiview/engine/tiers'
import { useTier } from '@/features/stadiview/useTier'
import { useLocale, useT } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { getNow } from '@/time/clockStore'
import { useReducedMotion } from '@/ui/motionPrefs'
import './stadiview.css'

// The 3D code is a separate download, so a device that cannot draw it never pays for it.
const StadiumCanvas = lazy(() => import('./scene/StadiumCanvas'))

/** The stadium page: a full-screen 3D stadium with the HUD floating over it. */
export default function StadiViewPage() {
  const t = useT()
  const { locale, setLocale } = useLocale()
  const tier = useTier()
  const reduced = useReducedMotion()
  const lowEnd = useDemoFlags((s) => s.lowEnd)

  const [ready, setReady] = useState(false)
  const [lost, setLost] = useState(false)
  // Trying again after a lost context builds a completely fresh scene.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    installDebugHook(tier)
    return removeDebugHook
    // The hook is created once per visit; a later change of tier is written into it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    extendDebugHook({ tier })
  }, [tier])

  // The page is one screen. While it is open the document must not scroll, or the wheel would
  // move the page instead of the camera.
  useEffect(() => {
    document.documentElement.classList.add('sv-locked')
    return () => document.documentElement.classList.remove('sv-locked')
  }, [])

  // The stores outlive the page; leave them as a new visitor should find them.
  useEffect(
    () => () => {
      useStadium.setState(useStadium.getInitialState(), true)
      useHud.getState().reset()
    },
    [],
  )

  // The role follows the persona: a graduate opens in graduate mode, anyone else as a guest. A
  // change of persona also drops the inspected seat, so nobody is shown the previous person's seat as theirs.
  const { persona } = useSession()
  useEffect(() => {
    const hud = useHud.getState()
    hud.inspect(-1)
    hud.setPanel('none')
    hud.setGuest({ ticketSeat: -1, graduate: -1, byCode: false })
    hud.setCardOpen(false)
    useHud.setState({ role: persona.role === 'graduate' ? 'graduate' : 'guest' })
  }, [persona.id, persona.role])

  useEffect(() => {
    const v = getVenue()
    const viewerNow = () => {
      const hud = useHud.getState()
      return hud.role === 'graduate' && persona.role === 'graduate' ? getDirectory().byPersona(persona.id) : null
    }
    const seatInZone = (like: number, wanted: 'available' | 'taken', skip: number): string | null => {
      const zone = like >= 0 ? v.zones[v.zone[like]] : undefined
      if (!zone) return null
      let seen = 0
      for (let k = zone.start; k < zone.start + zone.count; k++) {
        if (pitchSeats().statusOf(k, viewerNow(), getNow()) === wanted && seen++ === skip) return v.idOf(k)
      }
      return null
    }
    extendDebugHook({
      inspect: (seatId) => useHud.getState().inspect(v.indexOf(seatId)),
      hud: () => {
        const h = useHud.getState()
        return { role: h.role, inspected: v.idOf(h.inspected) || null, panel: h.panel }
      },
      status: (seatId) => pitchSeats().statusOf(v.indexOf(seatId), viewerNow(), getNow()),
      // For tests: a free or a taken seat in the same zone as the seat named, and the viewer's own seat.
      freeSeat: (zoneOf, skip = 0) => seatInZone(v.indexOf(zoneOf), 'available', skip),
      takenSeat: (zoneOf) => seatInZone(v.indexOf(zoneOf), 'taken', 0),
      sampleGraduate: (booked, skip = 0) => {
        let seen = 0
        for (const g of getDirectory().all) {
          if (g.personaId) continue
          const seat = pitchSeats().seatOf(g, getNow())
          if (seat >= 0 === booked && seen++ === skip) {
            return { index: g.index, name: g.name, studentId: g.studentId, shareCode: g.shareCode, seat: seat >= 0 ? v.idOf(seat) : null, tickets: guestTicketService.ticketsOf(g).map((k) => k.ticket) }
          }
        }
        return null
      },
      me: () => {
        const g = viewerNow()
        return g ? { index: g.index, studentId: g.studentId, shareCode: g.shareCode } : null
      },
      myZone: () => {
        const g = viewerNow()
        return g ? v.idOf(v.zones[g.zone].start) : null
      },
      mySeat: () => {
        const g = viewerNow()
        return g ? v.idOf(pitchSeats().seatOf(g, getNow())) || null : null
      },
    })
  }, [persona])

  const onReady = useCallback(() => {
    setReady(true)
    extendDebugHook({ ready: true })
  }, [])
  const onLost = useCallback(() => {
    setLost(true)
    setReady(false)
    extendDebugHook({ ready: false })
  }, [])
  const retry = () => {
    setLost(false)
    setAttempt((n) => n + 1)
  }

  const show3d = tier !== 0 && !lost
  const mode = useStadium((s) => s.mode)

  return (
    <main data-stadiview data-theme="stadiview" data-tier={tier} data-mode={mode}>
      {/* The wrapper takes the keyboard: arrows turn the view, plus and minus zoom, Escape goes back. */}
      <div className="sv-stage" data-stadium-canvas tabIndex={show3d ? 0 : undefined} role={show3d ? 'application' : undefined} aria-label={show3d ? t('sv.canvas.keys') : undefined}>
        {show3d && (
          <Suspense fallback={null}>
            <StadiumCanvas key={attempt} tier={tier} still={reduced || lowEnd} label={t('sv.canvas.label')} onReady={onReady} onLost={onLost} />
          </Suspense>
        )}
      </div>

      <header className="sv-top">
        <div className="sv-plate sv-title">
          <Link to="/" className="sv-title__home" aria-label={t('sv.home')} data-sv-home>
            <Logo tone="negative" height={22} />
          </Link>
          <span className="sv-title__rule" aria-hidden />
          <div className="sv-title__words">
            <h1>{t('sv.title')}</h1>
            <p>{t('sv.tagline')}</p>
          </div>
        </div>
        <RoleSwitch />
        <MySeatToggle />
        <GuestToggle />
        <button type="button" className="sv-plate sv-button sv-top__language" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} lang={locale === 'ar' ? 'en' : 'ar'} data-sv-language>
          {t('nav.language')}
        </button>
      </header>

      <SeatTooltip />
      <SeatMatrix canFly={show3d} />
      <Inspector canFly={show3d} livePreview={TIER_SETTINGS[tier].livePreview} />
      <MySeatPanel canFly={show3d} />
      <GuestPanel canFly={show3d} />
      <SeatCardDialog />
      {show3d && <PovHint />}
      {show3d && <BackButton />}

      {show3d && !ready && (
        <div className="sv-centre">
          <p className="sv-plate sv-loading" role="status">
            <span className="sv-loading__bars" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            {t('sv.loading')}
          </p>
        </div>
      )}

      {!show3d && (
        <div className="sv-centre">
          <section className="sv-card sv-fallback" data-stadium-fallback role={lost ? 'alert' : undefined}>
            <div className="sv-matrix" aria-hidden />
            <div className="sv-fallback__body">
              <h2>{t(lost ? 'sv.lost.title' : 'sv.fallback.title')}</h2>
              <p>{t(lost ? 'sv.lost.body' : 'sv.fallback.body')}</p>
              <div className="sv-fallback__actions">
                {lost && (
                  <button type="button" className="sv-plate sv-button sv-button--gold" onClick={retry}>
                    {t('sv.lost.retry')}
                  </button>
                )}
                <Link to="/" className="sv-plate sv-button">
                  {t('sv.fallback.home')}
                </Link>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
