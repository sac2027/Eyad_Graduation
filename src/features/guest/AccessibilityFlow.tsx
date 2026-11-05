import { useState } from 'react'
import type { SeatZone } from '@/domain/seats'
import { seatService } from '@/data'
import { useT } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { Button } from '@/ui/Button'

export type Mobility = 'none' | 'walks-slowly' | 'wheelchair'

export function routeForParty(a: { mobility: Mobility; elderly: boolean }): { gate: 'gate-1' | 'gate-3'; zone: SeatZone; parking: string } {
  const easy = a.mobility !== 'none' || a.elderly
  return easy ? { gate: 'gate-3', zone: 'easy-access', parking: 'p3' } : { gate: 'gate-1', zone: 'general', parking: 'p1' }
}

/** One plain question. No map to operate, no login. */
export function AccessibilityFlow() {
  const t = useT()
  const { persona } = useSession()
  const [mobility, setMobility] = useState<Mobility>('none')
  const [elderly, setElderly] = useState(false)
  const [result, setResult] = useState<ReturnType<typeof routeForParty> | null>(null)
  const [applied, setApplied] = useState(false)
  const opts: [Mobility, string][] = [
    ['none', t('access.none')],
    ['walks-slowly', t('access.slow')],
    ['wheelchair', t('access.wheelchair')],
  ]
  return (
    <div data-access-flow className="rounded-2xl bg-white p-6">
      <fieldset>
        <legend className="mb-3 text-xl font-bold text-turquoise">{t('access.q')}</legend>
        <div className="grid gap-2">
          {opts.map(([v, label]) => (
            <label key={v} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 outline outline-1 -outline-offset-1 outline-gray has-[:checked]:bg-turquoise has-[:checked]:text-beige">
              <input type="radio" name="mobility" value={v} checked={mobility === v} onChange={() => { setMobility(v); setResult(null) }} className="size-5 accent-green" />
              {label}
            </label>
          ))}
        </div>
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" checked={elderly} onChange={(e) => { setElderly(e.target.checked); setResult(null) }} className="size-5 accent-green" />
          {t('access.elderly')}
        </label>
      </fieldset>
      <Button className="mt-4" onClick={() => setResult(routeForParty({ mobility, elderly }))}>{t('access.show')}</Button>
      {result && (
        <div className="mt-5 rounded-xl bg-beige p-4" role="status" data-access-result data-gate={result.gate} data-zone={result.zone}>
          <h3 className="text-lg font-bold text-turquoise">{t('access.result')}</h3>
          <dl className="mt-2 grid gap-1">
            <div><dt className="inline font-semibold">{t('access.gate')}: </dt><dd className="inline">{t(`gate.${result.gate === 'gate-3' ? 3 : 1}`)}</dd></div>
            <div><dt className="inline font-semibold">{t('access.zone')}: </dt><dd className="inline">{t(`access.zone.${result.zone}`)}</dd></div>
            <div><dt className="inline font-semibold">{t('access.parking')}: </dt><dd className="inline">{t(`parking.${result.parking}`)}</dd></div>
          </dl>
          {persona.role === 'graduate' && result.zone === 'easy-access' && (
            <Button
              className="mt-3"
              variant="secondary"
              state={applied ? 'success' : undefined}
              onClick={() => {
                seatService.setNeedsEasyAccess(persona.id, true)
                setApplied(true)
              }}
            >
              {applied ? t('access.used') : t('access.use')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
