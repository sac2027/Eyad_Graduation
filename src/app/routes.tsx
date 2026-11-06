import { lazy, Suspense } from 'react'
import { Link, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { DemoConsole } from '@/features/demo-console/DemoConsole'
import { GuestHome } from '@/features/guest/GuestHome'
import { useLocale, useT } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { PERSONAS } from '@/data/fixtures/graduates'
import { Logo } from '@/brand/logo/Logo'
import { Button } from '@/ui/Button'
import { RootPhase } from './RootPhase'
import { PhaseBanner } from './PhaseBanner'
import { CertificateMomentHost } from '@/features/moment/CertificateMoment'

const HonorPage = lazy(() => import('@/features/honors/HonorPage'))
const Guide = lazy(() => import('@/features/guest/Guide').then((m) => ({ default: m.Guide })))
const Dashboard = lazy(() => import('@/features/graduate/Dashboard').then((m) => ({ default: m.Dashboard })))
const Attire = lazy(() => import('@/features/graduate/Attire').then((m) => ({ default: m.Attire })))
const Tickets = lazy(() => import('@/features/graduate/Tickets').then((m) => ({ default: m.Tickets })))
const AdminPage = lazy(() => import('@/features/admin/AdminPage').then((m) => ({ default: m.AdminPage })))
const KitPage = lazy(() => import('@/features/kit/KitPage').then((m) => ({ default: m.KitPage })))

function Layout() {
  const t = useT()
  const { locale, setLocale, dir } = useLocale()
  const { persona, setPersona } = useSession()
  const nav = useNavigate()
  const signIn = () => {
    setPersona(PERSONAS.find((p) => p.role === 'graduate')!.id)
    nav('/me')
  }
  const link = 'inline-flex min-h-11 items-center px-3 font-semibold text-[var(--header-fg)] aria-[current=page]:underline underline-offset-4'
  return (
    <>
      <RootPhase />
      <a href="#practical" className="absolute -translate-y-20 focus:translate-y-0 bg-yellow px-4 py-2 font-semibold text-turquoise">
        {t('nav.skip')}
      </a>
      <header className="flex flex-wrap items-center justify-between gap-x-2 bg-[var(--header-bg)] px-4 py-1 text-[var(--header-fg)]">
        <Link to="/" className="inline-flex min-h-11 items-center [--logo-h:22px] sm:[--logo-h:30px]" aria-label="KFUPM">
          <Logo height={30} />
        </Link>
        <nav aria-label="Main" className="order-3 flex w-full flex-wrap items-center sm:order-none sm:w-auto">
          <NavLink to="/" end className={link}>{t('nav.home')}</NavLink>
          <NavLink to="/guide" className={link}>{t('nav.guide')}</NavLink>
          {persona.role === 'graduate' && <NavLink to="/me" className={link}>{t('nav.me')}</NavLink>}
          <NavLink to="/honors" className={link}>{t('nav.honors')}</NavLink>
          {persona.role === 'admin' && <NavLink to="/admin" className={link}>{t('nav.admin')}</NavLink>}
        </nav>
        <div className="order-2 flex items-center gap-2 sm:order-none">
          {persona.role !== 'graduate' && (
            <Button variant="ghost" size="md" onClick={signIn} className="text-[var(--header-fg)]! outline-[var(--header-fg)]!" data-signin>
              {t('nav.signin')}
            </Button>
          )}
          <Button variant="ghost" size="md" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} className="text-[var(--header-fg)]! outline-[var(--header-fg)]!" lang={locale === 'ar' ? 'en' : 'ar'}>
            {t('nav.language')}
          </Button>
        </div>
      </header>
      <PhaseBanner />
      <Suspense fallback={<main className="min-h-[40dvh]" aria-busy="true" />}>
        <Outlet />
      </Suspense>
      <DemoConsole />
      <CertificateMomentHost />
      <Toaster position="top-center" dir={dir} />
    </>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<GuestHome />} />
        <Route path="guide" element={<Guide />} />
        <Route path="me" element={<Dashboard />} />
        <Route path="me/attire" element={<Attire />} />
        <Route path="me/tickets" element={<Tickets />} />
        <Route
          path="honors"
          element={
            <Suspense fallback={<main className="p-10">…</main>}>
              <HonorPage />
            </Suspense>
          }
        />
        <Route path="admin" element={<AdminPage />} />
        <Route path="kit" element={<KitPage />} />
      </Route>
    </Routes>
  )
}
