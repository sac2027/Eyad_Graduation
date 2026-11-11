import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/brand/logo/Logo'
import { useDemoFlags } from '@/features/demo-console/flags'
import { extendDebugHook, installDebugHook, removeDebugHook } from '@/features/stadiview/debugHook'
import { useStadium } from '@/features/stadiview/state/stadiumStore'
import { useTier } from '@/features/stadiview/useTier'
import { useLocale, useT } from '@/i18n'
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

  // The store outlives the page; leave it as a new visitor should find it.
  useEffect(() => () => useStadium.setState(useStadium.getInitialState(), true), [])

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

  return (
    <main data-stadiview data-theme="stadiview" data-tier={tier}>
      <div className="sv-stage" data-stadium-canvas>
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
        <button type="button" className="sv-plate sv-button" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} lang={locale === 'ar' ? 'en' : 'ar'} data-sv-language>
          {t('nav.language')}
        </button>
      </header>

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
