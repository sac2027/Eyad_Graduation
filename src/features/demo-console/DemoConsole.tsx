import { useState } from 'react'
import { PERSONAS } from '@/data/fixtures/graduates'
import { honorTier } from '@/domain/honorTier'
import { useLocale } from '@/i18n'
import { useSession } from '@/session/sessionStore'
import { useClock, useNow } from '@/time/clockStore'
import { PRESETS } from '@/time/presets'
import { formatTimeParam, parseTimeParam } from '@/time/urlState'
import { formatDate } from '@/i18n/format'
import { useMotionOverride } from '@/ui/motionPrefs'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { useDemoFlags } from './flags'
import { Scrubber } from './Scrubber'
import { useUrlSync } from './urlSync'

const DAY_PER_SEC = 86_400_000
const HOUR_PER_SEC = 3_600_000

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-semibold text-turquoise">{label}</div>
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

  return (
    <div dir="ltr" lang="en" className="fixed bottom-3 left-3 z-50 font-body text-sm" data-demo-console>
      {open && (
        <section
          aria-label="Demo console"
          className="mb-2 max-h-[80dvh] w-[min(92vw,26rem)] overflow-auto rounded-2xl bg-white p-4 text-ink shadow-xl"
        >
          <header className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-turquoise">Demo console</h2>
            <span className="text-xs text-gray">mock data</span>
          </header>

          <Row label="Simulated time (Riyadh)">
            <div className="mb-2 font-semibold" data-testid="sim-now">
              {formatDate(now, 'en', { dateStyle: 'full', timeStyle: 'short' })}
              {clock.mode === 'real' ? ' (real time)' : clock.mode === 'playing' ? ' (playing)' : ''}
            </div>
            <input
              type="datetime-local"
              aria-label="Jump to date and time"
              className="mb-2 min-h-11 w-full rounded-lg border border-gray px-2"
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
              className="min-h-11 w-full rounded-lg border border-gray px-2"
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
                className="w-full accent-green"
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
        </section>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="min-h-11 rounded-full bg-white px-4 font-semibold text-turquoise shadow-lg outline outline-2 outline-turquoise"
      >
        {open ? 'Hide demo' : 'Demo'}
      </button>
    </div>
  )
}
