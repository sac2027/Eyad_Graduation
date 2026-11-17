import { Link } from 'react-router-dom'
import { useT } from '@/i18n'
import { Reveal } from '@/ui/Reveal'

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
      <Reveal>
        <h2 id="families-h" className="font-display text-3xl font-black text-turquoise sm:text-4xl">{t('families.title')}</h2>
        <p className="mt-2 text-lg">{t('families.note')}</p>
      </Reveal>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {CARDS.map((c, i) => (
          <Reveal as="li" key={c.key} i={i}>
            <Link to={c.to} className="panel panel-link h-full min-h-11 p-5">
              <span className="flex items-center justify-between gap-3 text-lg font-bold text-turquoise">{t(`families.${c.key}`)}<span className="go" aria-hidden>→</span></span>
              <span className="mt-1 block">{t(`families.${c.key}.note`)}</span>
            </Link>
          </Reveal>
        ))}
      </ul>
      <Link to="/guide#faq" className="text-link mt-6 text-turquoise">
        {t('families.faq')} <span className="go" aria-hidden>→</span>
      </Link>
    </section>
  )
}
