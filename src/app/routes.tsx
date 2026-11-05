import { lazy, Suspense } from 'react'
import { Link, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { DemoConsole } from '@/features/demo-console/DemoConsole'
import { GuestHome } from '@/features/guest/GuestHome'
import { Guide } from '@/features/guest/Guide'
import { Dashboard } from '@/features/graduate/Dashboard'
import { Attire } from '@/features/graduate/Attire'
import { Tickets } from '@/features/graduate/Tickets'
import { AdminPage } from '@/features/admin/AdminPage'
import { KitPage } from '@/features/kit/KitPage'
import { useLocale, useT } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { Button } from '@/ui/Button'
import { RootPhase } from './RootPhase'
import { PhaseBanner } from './PhaseBanner'

const HonorPage = lazy(() => import('@/features/honors/HonorPage'))

function Layout() {
  const t = useT()
  const { locale, setLocale, dir } = useLocale()
  const { persona } = useSession()
  const link = 'inline-flex min-h-11 items-center px-3 font-semibold text-[var(--header-fg)] aria-[current=page]:underline underline-offset-4'
  return (
    <>
      <RootPhase />
      <a href="#practical" className="absolute -translate-y-20 focus:translate-y-0 bg-yellow px-4 py-2 font-semibold text-turquoise">
        {t('nav.skip')}
      </a>
      <header className="flex flex-wrap items-center justify-between gap-x-2 bg-[var(--header-bg)] px-4 py-1 text-[var(--header-fg)]">
        <Link to="/" className="font-display text-2xl font-black text-[var(--header-fg)]" aria-label="KFUPM">
          KFUPM
        </Link>
        <nav aria-label="Main" className="order-3 flex w-full flex-wrap items-center sm:order-none sm:w-auto">
          <NavLink to="/" end className={link}>{t('nav.home')}</NavLink>
          <NavLink to="/guide" className={link}>{t('nav.guide')}</NavLink>
          {persona.role === 'graduate' && <NavLink to="/me" className={link}>{t('nav.me')}</NavLink>}
          <NavLink to="/honors" className={link}>{t('nav.honors')}</NavLink>
          {persona.role === 'admin' && <NavLink to="/admin" className={link}>{t('nav.admin')}</NavLink>}
        </nav>
        <Button variant="ghost" size="md" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} className="order-2 text-[var(--header-fg)] outline-[var(--header-fg)] sm:order-none" lang={locale === 'ar' ? 'en' : 'ar'}>
          {t('nav.language')}
        </Button>
      </header>
      <PhaseBanner />
      <Outlet />
      <DemoConsole />
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
