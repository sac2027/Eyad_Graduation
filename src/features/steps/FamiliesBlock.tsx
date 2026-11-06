import { Link } from 'react-router-dom'
import { useT } from '@/i18n'

const CARDS = [
  { key: 'gates', to: '/guide#gates' },
  { key: 'parking', to: '/guide#map' },
  { key: 'seat', to: '/me/tickets' },
  { key: 'access', to: '/guide#access' },
] as const

/** Plain, practical answers for families, after the journey. */
export function FamiliesBlock() {
  const t = useT()
  return (
    <section aria-labelledby="families-h" className="mx-auto max-w-5xl px-4 py-12" data-families-block>
      <h2 id="families-h" className="font-display text-3xl font-black text-turquoise">{t('families.title')}</h2>
      <p className="mt-2 text-lg">{t('families.note')}</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => (
          <li key={c.key}>
            <Link to={c.to} className="block min-h-11 rounded-2xl bg-white p-5 transition-transform hover:-translate-y-0.5">
              <span className="block text-lg font-bold text-turquoise">{t(`families.${c.key}`)}</span>
              <span className="mt-1 block">{t(`families.${c.key}.note`)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/guide#faq" className="mt-6 inline-flex min-h-11 items-center font-semibold text-turquoise underline underline-offset-4">
        {t('families.faq')}
      </Link>
    </section>
  )
}
