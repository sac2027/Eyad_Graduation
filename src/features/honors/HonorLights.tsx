import type { HonorTier } from '@/domain/types'
import '@/features/stadium/stadium.css'
import { beamColour, type CueId } from './lightCues'

const ORDER: CueId[] = ['blackout', 'spot', 'beams', 'spill', 'rim', 'flash', 'settle']

/** The lighting script for the 2D award: spotlight cone, sweeping beams, a flash, then a calm glow. Flat layers, brand colours. */
export function HonorLights({ tier, cue }: { tier: HonorTier; cue: CueId }) {
  const reached = (c: CueId) => ORDER.indexOf(cue) >= ORDER.indexOf(c)
  const colour = beamColour(tier)
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" data-honor-lights={cue}>
      {/* beams behind the award */}
      {[-28, -10, 10, 28].map((deg, i) => (
        <span
          key={deg}
          className="honor-beam absolute bottom-[10%] left-1/2 h-[140%] w-16 origin-bottom transition-opacity duration-700"
          style={{ background: colour, opacity: reached('beams') ? 0.16 : 0, transform: `translateX(-50%) rotate(${deg}deg)`, animationDelay: `${-i * 1.1}s`, clipPath: 'polygon(42% 100%, 58% 100%, 100% 0, 0 0)' }}
        />
      ))}
      {/* spotlight cone from above */}
      <span
        className="absolute left-1/2 top-0 h-full w-[60%] -translate-x-1/2 transition-opacity duration-300"
        style={{ background: '#ECE0C7', opacity: reached('spot') ? (reached('settle') ? 0.08 : 0.14) : 0, clipPath: 'polygon(44% 0, 56% 0, 100% 100%, 0 100%)' }}
      />
      {/* camera flash */}
      <span className="absolute inset-0 bg-white" style={{ opacity: cue === 'flash' ? 0.35 : 0, transition: cue === 'flash' ? 'none' : 'opacity 220ms ease-in' }} />
    </div>
  )
}
