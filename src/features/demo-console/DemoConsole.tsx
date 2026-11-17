import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PERSONAS } from '@/data/fixtures/graduates'
import { honorTier } from '@/domain/honorTier'
import { useLocale } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { useClock, useNow } from '@/time/clockStore'
import { PRESETS } from '@/time/presets'
import { isCeremonyNight } from '@/time/schedule'
import { formatTimeParam, parseTimeParam } from '@/time/urlState'
import { formatDate } from '@/i18n/format'
import { useMotionOverride } from '@/ui/motionPrefs'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { useDemoFlags } from './flags'
import { toast } from '@/ui/toast'
import { resetDemoData } from './resetData'
import { Scrubber } from './Scrubber'
import { useUrlSync } from './urlSync'

const DAY_PER_SEC = 86_400_000
const HOUR_PER_SEC = 3_600_000

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="demo-row">
      <div className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-turquoise">{label}</div>
      {children}
    </div>
  )
}

export function DemoConsole() {
  useUrlSync()
  const [open, setOpen] = useState(false)
  const now = useNow(250)
  const clock = useClock()
  const { persona, setPersona } = useSession()
  const flags = useDemoFlags()
  const { locale, setLocale } = useLocale()
  const reduced = useMotionOverride((s) => s.reduced)
  const setReduced = useMotionOverride((s) => s.setReduced)
  const tier = persona.role === 'graduate' ? honorTier(persona.gpa) : null
  const onStadium = useLocation().pathname === '/stadium'
  const night = isCeremonyNight(now)

  return (
    <div dir="ltr" lang="en" className="fixed bottom-3 left-3 z-50 font-body text-sm" data-demo-console>
      {open && (
        <section
          aria-label="Demo console"
          className="demo-panel mb-2 max-h-[80dvh] w-[min(92vw,26rem)] overflow-auto rounded-[1.25rem] bg-white text-ink"
        >
          <header className="demo-head sticky top-0 z-10 bg-ink px-4 pb-3 pt-3.5 text-beige">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-yellow">Demo console</h2>
              <span className="rounded-full bg-beige/15 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide">mock data</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 font-semibold leading-snug" data-testid="sim-now">
              <span aria-hidden className={`size-2 flex-none rounded-full ${clock.mode === 'playing' ? 'animate-pulse bg-yellow' : clock.mode === 'real' ? 'bg-green' : 'bg-beige/50'}`} />
              <span>
                {formatDate(now, 'en', { dateStyle: 'full', timeStyle: 'short' })}
                {clock.mode === 'real' ? ' (real time)' : clock.mode === 'playing' ? ' (playing)' : ''}
              </span>
            </div>
          </header>
          <div className="px-4 pb-2">

          <Row label="Simulated time (Riyadh)">
            <input
              type="datetime-local"
              aria-label="Jump to date and time"
              className="demo-field mb-2 min-h-11 w-full rounded-lg px-2"
              value={formatTimeParam(now).slice(0, 16)}
              onChange={(e) => {
                const ms = parseTimeParam(`?t=${e.target.value}`)
                if (ms !== null) clock.setSimulated(ms)
              }}
            />
            <Scrubber value={now} onChange={(ms) => clock.setSimulated(ms)} />
          </Row>

          <Row label="Jump to">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Chip key={p.id} data-preset={p.id} onClick={() => clock.setSimulated(p.at)} selected={Math.abs(now - p.at) < 60_000}>
                  {p.label.en}
                </Chip>
              ))}
            </div>
          </Row>

          <Row label="Time lapse">
            <div className="flex flex-wrap gap-2">
              <Button size="md" variant="secondary" onClick={() => clock.play(DAY_PER_SEC)}>1 day / sec</Button>
              <Button size="md" variant="secondary" onClick={() => clock.play(HOUR_PER_SEC)}>1 hour / sec</Button>
              <Button size="md" variant="ghost" onClick={() => clock.pause()}>Pause</Button>
              <Button size="md" variant="ghost" onClick={() => clock.useReal()}>Use real time</Button>
            </div>
          </Row>

          <Row label="Persona">
            <select
              aria-label="Persona"
              className="demo-field min-h-11 w-full rounded-lg px-2"
              value={persona.id}
              onChange={(e) => setPersona(e.target.value)}
            >
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>{p.id}</option>
              ))}
            </select>
          </Row>

          {persona.role === 'graduate' && (
            <Row label={`GPA ${persona.gpa.toFixed(2)} → ${tier ?? 'no honor'}`}>
              <input
                type="range"
                aria-label="GPA"
                className="demo-range w-full"
                min={0}
                max={4}
                step={0.01}
                value={persona.gpa}
                onChange={(e) => flags.setGpaOverride(Number(e.target.value))}
              />
              <div className="mt-1 flex gap-2">
                {[3.9, 3.5, 3.1, 2.7].map((g) => (
                  <Chip key={g} onClick={() => flags.setGpaOverride(g)}>{g.toFixed(2)}</Chip>
                ))}
              </div>
            </Row>
          )}

          <Row label="Switches">
            <div className="flex flex-wrap gap-2">
              <Chip selected={locale === 'en'} onToggle={(v) => setLocale(v ? 'en' : 'ar')}>English</Chip>
              <Chip selected={reduced === true} onToggle={(v) => setReduced(v ? true : null)}>Reduced motion</Chip>
              <Chip selected={flags.lowEnd} onToggle={flags.setLowEnd}>Low-end device</Chip>
              <Chip selected={flags.worstCase} onToggle={flags.setWorstCase}>Worst-case data</Chip>
              <Chip selected={flags.dateStatus === 'tbc'} onToggle={(v) => flags.setDateStatus(v ? 'tbc' : 'confirmed')}>Date TBC</Chip>
            </div>
          </Row>

          {onStadium && (
            <Row label="Stadium">
              <Chip selected={flags.fullHouse || night} disabled={night} onToggle={flags.setFullHouse} data-sv-full>
                Fill the stadium (ceremony night)
              </Chip>
              <p className="mt-1 text-xs" data-sv-full-note>
                {night ? 'On by itself: it is ceremony night, and every seat is taken.' : 'Shows every seat filled. Bookings and the seat map keep the real data.'}
              </p>
            </Row>
          )}

          <Row label="Data">
            <Button variant="ghost" onClick={() => { resetDemoData(); toast.success('Demo data reset') }}>Reset demo data</Button>
          </Row>
          </div>
        </section>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="demo-toggle inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 font-semibold text-beige"
      >
        <span aria-hidden className="relative grid size-2.5 place-items-center">
          <span className="banner-dot absolute inset-0 rounded-full bg-yellow" />
          <span className="relative size-2.5 rounded-full bg-yellow" />
        </span>
        {open ? 'Hide demo' : 'Demo'}
      </button>
    </div>
  )
}
