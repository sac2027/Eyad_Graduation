import { useT } from '@/i18n'

export function AdminPage() {
  const t = useT()
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-4xl font-black text-turquoise">{t('nav.admin')}</h1>
    </main>
  )
}
