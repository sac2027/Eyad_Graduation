import { useT } from '@/i18n'

export function Guide() {
  const t = useT()
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-4xl font-black text-turquoise">{t('nav.guide')}</h1>
    </main>
  )
}
