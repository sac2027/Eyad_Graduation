import { STAGE_ORDER } from '@/time/schedule'
import { useDemoFlags } from '@/features/demo-console/flags'
import { useT } from '@/i18n'
import { useReducedMotion } from '@/ui/motionPrefs'
import { JourneyBar } from './JourneyBar'
import { JourneyStory } from './JourneyStory'
import { useJourney } from './useJourney'

function StaticJourney() {
  const t = useT()
  const j = useJourney()
  return (
    <section id="journey" data-journey-mode="static" className="bg-turquoise px-4 py-10 text-beige">
      <div className="mx-auto max-w-3xl">
        <JourneyBar variant="story" />
        <ol className="mt-6 grid gap-3">
          {STAGE_ORDER.map((id) => (
            <li key={id} className={`rounded-xl p-4 ${id === j.stageId ? 'bg-yellow text-turquoise' : 'bg-black/20'}`} aria-current={id === j.stageId ? 'step' : undefined}>
              <h3 className="text-xl font-black">{t(`stage.${id}`)}</h3>
              <p>{t(`stage.${id}.note`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** The scroll story needs motion and a capable device. Everyone else gets the same content as a list. */
export function JourneySection() {
  const reduced = useReducedMotion()
  const lowEnd = useDemoFlags((s) => s.lowEnd)
  return reduced || lowEnd ? <StaticJourney /> : <JourneyStory />
}
