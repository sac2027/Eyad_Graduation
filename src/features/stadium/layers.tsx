import type { CheckpointState } from '@/time/pathEngine'
import { CertificateArt } from './Certificate'
import type { SceneGeom } from './geometry'
import type { SceneState } from './sceneState'

/* Night-stadium artwork in brand colours, built from flat translucent layers (no gradients). */

export const C = {
  night: '#0b2f33',
  deep: '#071d20',
  turquoise: '#115F66',
  green: '#009767',
  beige: '#ECE0C7',
  sand: '#AA8C6D',
  yellow: '#F0BA4F',
  blue: '#71B8D4',
  gray: '#ADACAD',
  error: '#de5e5e',
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** How far the artwork bleeds past the frame, so wide screens never show its edges. */
const BLEED = 900

/** Size of the certificate on the podium. */
export function certWidth(g: SceneGeom): number {
  return g.w > g.h ? 104 : 120
}
export function certHeight(g: SceneGeom): number {
  return (certWidth(g) * 124) / 160
}

/** Half-width of the aisle at a given height. */
export function aisleHalfAt(g: SceneGeom, y: number): number {
  const t = (g.aisleBottom.y - y) / (g.aisleBottom.y - g.aisleTop.y)
  return lerp(g.aisleBottom.half, g.aisleTop.half, t)
}

/** Post position beside the aisle for checkpoints 0..5 (alternating sides); stage checkpoints sit on the stage. */
export function postAt(g: SceneGeom, i: number): { x: number; y: number; scale: number; side: -1 | 1 } {
  const p = g.aisle[i]
  const side: -1 | 1 = i % 2 === 0 ? -1 : 1
  if (i < 6) return { x: p.x + side * (aisleHalfAt(g, p.y) + 30 * p.scale), y: p.y, scale: p.scale, side }
  if (i === 6) return { x: g.cx - g.stage.w * 0.43, y: g.stage.y + g.stage.depth + 4, scale: p.scale, side: -1 }
  if (i === 7) return { x: g.cx + g.stage.w * 0.43, y: g.stage.y + g.stage.depth + 4, scale: p.scale, side: 1 }
  return { x: g.cx, y: g.podium.y - 38 - certHeight(g) - 2, scale: p.scale, side: 1 }
}

export function Sky({ g }: { g: SceneGeom }) {
  const stars = Array.from({ length: 34 }, (_, i) => ({
    x: (i * 467) % g.w,
    y: ((i * 197) % Math.round(g.rim * 0.8)) + 6,
    r: i % 5 === 0 ? 1.8 : 1.1,
  }))
  return (
    <g data-layer="sky">
      <rect x={-BLEED} y={-BLEED} width={g.w + BLEED * 2} height={g.h + BLEED * 2} fill={C.night} />
      <rect x={-BLEED} y={-BLEED} width={g.w + BLEED * 2} height={g.rim * 0.7 + BLEED} fill={C.deep} opacity="0.7" />
      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={C.beige} opacity="0.45" />)}
    </g>
  )
}

/** The campus skyline behind the stadium: dark blocks with green-lit bands, as in the ceremony photos. */
export function Skyline({ g }: { g: SceneGeom }) {
  const blocks = [
    [-0.3, 54, 0.12], [-0.12, 80, 0.07], [0.02, 70, 0.07], [0.1, 46, 0.05], [0.16, 92, 0.06], [0.23, 58, 0.08], [0.33, 36, 0.05],
    [0.62, 40, 0.06], [0.7, 84, 0.07], [0.79, 54, 0.05], [0.86, 104, 0.06], [0.94, 62, 0.05], [1.03, 88, 0.08], [1.16, 50, 0.12],
  ] as const
  const base = g.rim + 10
  return (
    <g data-layer="skyline">
      {blocks.map(([x, h, w], i) => (
        <g key={i}>
          <rect x={x * g.w} y={base - h} width={w * g.w} height={h} fill={C.deep} />
          <rect x={x * g.w} y={base - h + 6} width={w * g.w} height="5" fill={C.green} opacity="0.75" />
          {h > 60 && <rect x={x * g.w} y={base - h + 22} width={w * g.w} height="3" fill={C.green} opacity="0.45" />}
        </g>
      ))}
      {[0.04, 0.96, -0.2, 1.2].map((x, k) => <Floodlight key={x} x={x * g.w} base={g.rim + 40} top={g.rim - (k < 2 ? 190 : 150)} />)}
    </g>
  )
}

/** A stadium light tower: lattice mast, a bank of lamps, and the faint cone it throws. */
function Floodlight({ x, base, top }: { x: number; base: number; top: number }) {
  const lamps = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) lamps.push(<rect key={`${r}${c}`} x={x - 33 + c * 11 + 2} y={top - 26 + r * 9 + 2} width="7" height="5" rx="1" fill={C.beige} />)
  return (
    <g>
      <polygon points={`${x - 30},${top} ${x + 30},${top} ${x + 260},${base + 420} ${x - 260},${base + 420}`} fill={C.beige} opacity="0.035" />
      <rect x={x - 4} y={top} width="8" height={base - top} fill={C.deep} />
      {Array.from({ length: Math.floor((base - top) / 22) }, (_, i) => (
        <line key={i} x1={x - 4} y1={top + i * 22} x2={x + 4} y2={top + i * 22 + 22} stroke={C.turquoise} strokeWidth="1.5" />
      ))}
      <rect x={x - 36} y={top - 30} width="72" height="32" rx="3" fill={C.deep} />
      {lamps}
    </g>
  )
}

/** Stands on both sides, rising toward the edges; crowd lights appear as the day fills them. */
export function Stands({ g, s }: { g: SceneGeom; s: SceneState }) {
  const innerX = g.stage.w / 2 + 70
  const outL = -BLEED
  const outR = g.w + BLEED
  const slope = (g.h * 0.82 - (g.rim + 14)) / (g.cx - innerX)
  const left = `${outL},${g.rim - 20} ${g.cx - innerX},${g.rim + 62} ${g.cx - innerX},${g.rim + 96} ${outL},${g.rim + 96 + slope * (g.cx - innerX - outL)}`
  const right = `${outR},${g.rim - 20} ${g.cx + innerX},${g.rim + 62} ${g.cx + innerX},${g.rim + 96} ${outR},${g.rim + 96 + slope * (outR - g.cx - innerX)}`
  const tiers = Array.from({ length: 9 }, (_, i) => i / 9)
  const crowdOpacity = s.crowd === 0 ? 0 : s.crowd === 1 ? 0.35 : 0.75
  return (
    <g data-layer="stands">
      <rect x={-BLEED} y={g.rim + 10} width={g.w + BLEED * 2} height={g.h - g.rim + BLEED} fill={C.turquoise} opacity="0.32" />
      {[left, right].map((pts, k) => (
        <g key={k}>
          <polygon points={pts} fill={C.turquoise} opacity="0.85" />
          {tiers.map((t, i) => {
            const xIn = k === 0 ? g.cx - innerX : g.cx + innerX
            const xOut = k === 0 ? outL : outR
            const yIn = lerp(g.rim + 62, g.rim + 96, t)
            const yOut = lerp(g.rim - 20, g.rim + 96 + slope * (g.cx - innerX - outL), t)
            const yIn2 = lerp(g.rim + 62, g.rim + 96, t + 1 / 9)
            const yOut2 = lerp(g.rim - 20, g.rim + 96 + slope * (g.cx - innerX - outL), t + 1 / 9)
            return (
              <g key={i}>
                {i % 2 === 0 && <polygon points={`${xIn},${yIn} ${xOut},${yOut} ${xOut},${yOut2} ${xIn},${yIn2}`} fill={C.deep} opacity="0.22" />}
                <line x1={xIn} y1={yIn} x2={xOut} y2={yOut} stroke={C.night} strokeOpacity="0.5" strokeWidth="2" />
              </g>
            )
          })}
          {crowdOpacity > 0 &&
            tiers.slice(1).map((t, i) => {
              const xIn = k === 0 ? g.cx - innerX : g.cx + innerX
              const xOut = k === 0 ? outL : outR
              const yIn = lerp(g.rim + 62, g.rim + 96, t - 0.05)
              const yOut = lerp(g.rim - 20, g.rim + 96 + slope * (g.cx - innerX - outL), t - 0.05)
              return (
                <line key={`c${i}`} className="crowd-twinkle" style={{ animationDelay: `${-i * 0.37}s` }} x1={xIn} y1={yIn} x2={xOut} y2={yOut} stroke={i % 3 === 0 ? C.yellow : C.beige}
                  strokeOpacity={crowdOpacity} strokeWidth="3" strokeLinecap="round" strokeDasharray="0 11" />
              )
            })}
        </g>
      ))}
    </g>
  )
}

/** Blocks of chairs either side of the aisle, row by row in perspective; filled with guests once seated. */
export function ChairBlocks({ g, s }: { g: SceneGeom; s: SceneState }) {
  const rows: { y: number; half: number; scale: number }[] = []
  const n = 24
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1)
    const y = g.aisleTop.y + 10 + (g.h - g.aisleTop.y) * Math.pow(u, 1.35)
    const half = aisleHalfAt(g, y)
    rows.push({ y, half, scale: half / g.aisleBottom.half })
  }
  return (
    <g data-layer="chairs">
      {rows.map((r, i) =>
        [-1, 1].map((side) => {
          const x1 = g.cx + side * (r.half + 34 * r.scale)
          const x2 = g.cx + side * (r.half + (g.stage.w * 0.48 + 120) * r.scale * 1.15)
          return (
            <g key={`${i}${side}`}>
              <line x1={x1} y1={r.y} x2={x2} y2={r.y} stroke={C.sand} strokeOpacity="0.75" strokeWidth={7 * r.scale}
                strokeDasharray={`${11 * r.scale} ${6 * r.scale}`} />
              {s.chairsFilled && (
                <line x1={x1} y1={r.y - 8 * r.scale} x2={x2} y2={r.y - 8 * r.scale} stroke={C.deep} strokeWidth={8 * r.scale}
                  strokeLinecap="round" strokeDasharray={`0 ${17 * r.scale}`} />
              )}
            </g>
          )
        }),
      )}
    </g>
  )
}

/** The aisle: a sand-coloured runner with gold edges; the stretch already walked glows. */
export function Aisle({ g, litTo }: { g: SceneGeom; litTo: number | null }) {
  const { y: yT, half: hT } = g.aisleTop
  const { half: hB } = g.aisleBottom
  const hBot = aisleHalfAt(g, g.h)
  const runner = `${g.cx - hT},${yT} ${g.cx + hT},${yT} ${g.cx + hBot},${g.h} ${g.cx - hBot},${g.h}`
  let lit: string | null = null
  if (litTo !== null) {
    const hy = aisleHalfAt(g, litTo)
    lit = `${g.cx - hy},${litTo} ${g.cx + hy},${litTo} ${g.cx + hBot},${g.h} ${g.cx - hBot},${g.h}`
  }
  void hB
  return (
    <g data-layer="aisle">
      <polygon points={runner} fill={C.sand} opacity="0.9" />
      {lit && <polygon points={lit} fill={C.yellow} opacity="0.22" data-lit-path />}
      <line x1={g.cx - hT} y1={yT} x2={g.cx - hBot} y2={g.h} stroke={C.yellow} strokeWidth="3" />
      <line x1={g.cx + hT} y1={yT} x2={g.cx + hBot} y2={g.h} stroke={C.yellow} strokeWidth="3" />
    </g>
  )
}

const LAMP: Record<CheckpointState, { fill: string; opacity: number; glow: number }> = {
  passed: { fill: C.green, opacity: 1, glow: 0.22 },
  current: { fill: C.yellow, opacity: 1, glow: 0.4 },
  next: { fill: C.beige, opacity: 0.9, glow: 0 },
  future: { fill: C.gray, opacity: 0.4, glow: 0 },
  late: { fill: C.error, opacity: 1, glow: 0.25 },
}

/** Lamp posts marking the checkpoints, coloured by state. */
export function Posts({ g, states, only = () => true }: { g: SceneGeom; states: CheckpointState[]; only?: (i: number) => boolean }) {
  return (
    <g data-layer="posts">
      {states.slice(0, 8).map((st, i) => {
        // checkpoint 9 is the podium itself; it has no lamp
        if (!only(i)) return null
        const p = postAt(g, i)
        const h = 120 * p.scale
        const lamp = LAMP[st]
        const r = 13 * p.scale
        return (
          <g key={i} data-post={i}>
            {lamp.glow > 0 && <circle cx={p.x} cy={p.y - h} r={r * 3.4} fill={lamp.fill} opacity={lamp.glow} />}
            <rect x={p.x - 3.5 * p.scale} y={p.y - h + r} width={7 * p.scale} height={h - r} rx={2 * p.scale} fill={C.beige} opacity="0.85" />
            <ellipse cx={p.x} cy={p.y} rx={14 * p.scale} ry={4 * p.scale} fill={C.deep} opacity="0.6" />
            <circle cx={p.x} cy={p.y - h} r={r} style={{ fill: st === 'next' ? C.night : lamp.fill, stroke: lamp.fill, transition: 'fill 0.9s ease, stroke 0.9s ease' }} strokeWidth={3 * p.scale} opacity={lamp.opacity} />
          </g>
        )
      })}
    </g>
  )
}

/** Stage, backdrop with the KFUPM mark, two LED screens, the podium with the certificate, light and beams. */
export function StageLayer({ g, s, showCertificate }: { g: SceneGeom; s: SceneState; showCertificate: boolean }) {
  const { stage, screens, podium } = g
  const left = stage.x - stage.w / 2
  const backTop = screens[0].y - 26
  const glow = [0.05, 0.14, 0.26, 0.4][s.stageGlow]
  const certW = certWidth(g)
  const certH = certHeight(g)
  const beams = [-0.42, -0.24, -0.08, 0.08, 0.24, 0.42]
  return (
    <g data-layer="stage">
      {/* beams */}
      {s.beams &&
        beams.map((b, i) => {
          const x0 = stage.x + b * stage.w
          const tx = x0 + b * g.w * 1.3
          return (
            <g key={i} data-beam className="beam-sweep" style={{ transformOrigin: `${x0}px ${backTop + 8}px`, animationDelay: `${-i * 1.3}s`, animationDuration: `${5.5 + (i % 3)}s` }}>
              <polygon points={`${x0 - 8},${backTop + 8} ${x0 + 8},${backTop + 8} ${tx + 110},${-BLEED} ${tx - 110},${-BLEED}`} fill={C.blue} opacity="0.12" />
              <polygon points={`${x0 - 3},${backTop + 8} ${x0 + 3},${backTop + 8} ${tx + 34},${-BLEED} ${tx - 34},${-BLEED}`} fill={C.beige} opacity="0.16" />
            </g>
          )
        })}
      {/* backdrop */}
      <rect x={left + 40} y={backTop} width={stage.w - 80} height={stage.y - backTop} fill={C.turquoise} />
      <rect x={left + 40} y={backTop} width={stage.w - 80} height="6" fill={s.goldAccents ? C.yellow : C.green} />
      {/* screens */}
      {screens.map((r, i) => (
        <g key={i} data-screen-frame={i}>
          {s.stageGlow >= 1 && <rect x={r.x - 12} y={r.y - 12} width={r.w + 24} height={r.h + 24} rx="10" fill={C.green} opacity={0.12 * s.stageGlow} />}
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="4" fill={C.deep} stroke={C.green} strokeWidth="4" />
          <rect x={r.x + r.w / 2 - 3} y={r.y + r.h} width="6" height={stage.y - r.y - r.h} fill={C.deep} />
        </g>
      ))}
      {/* light pool on the stage */}
      <ellipse cx={stage.x} cy={stage.y + 4} rx={stage.w * 0.42} ry="22" fill={C.yellow} opacity={glow} />
      {/* platform */}
      <rect x={left} y={stage.y} width={stage.w} height={stage.depth} fill={C.turquoise} />
      <rect x={left} y={stage.y} width={stage.w} height="5" fill={s.goldAccents ? C.yellow : C.green} />
      <rect x={left} y={stage.y + stage.depth - 6} width={stage.w} height="6" fill={C.deep} opacity="0.6" />
      {/* steps up from the aisle */}
      {[0, 1, 2].map((k) => (
        <rect key={k} x={stage.x - g.aisleTop.half - 8 + k * 4} y={stage.y + stage.depth - (k + 1) * 9} width={(g.aisleTop.half + 8 - k * 4) * 2} height="9" fill={C.sand} opacity={0.95 - k * 0.12} />
      ))}
      {/* flags along the stage front */}
      {s.flags &&
        [-0.46, -0.3, 0.3, 0.46].map((f, i) => {
          const pole = Math.min(74, stage.y - (screens[0].y + screens[0].h) - 4)
          const x = stage.x + f * stage.w
          return (
            <g key={i}>
              <rect x={x - 1.5} y={stage.y - pole} width="3" height={pole} fill={C.beige} opacity="0.8" />
              <rect x={x + 1.5} y={stage.y - pole} width="34" height="22" fill={C.green} />
              <rect x={x + 1.5} y={stage.y - pole + 15} width="34" height="7" fill={C.beige} opacity="0.85" />
            </g>
          )
        })}
      {/* spotlight on the podium */}
      <polygon points={`${podium.x - 26},0 ${podium.x + 26},0 ${podium.x + 90},${podium.y + 8} ${podium.x - 90},${podium.y + 8}`} fill={C.beige} opacity={s.stageGlow >= 2 ? 0.14 : 0.07} data-spotlight />
      {/* podium */}
      <polygon points={`${podium.x - 34},${podium.y} ${podium.x + 34},${podium.y} ${podium.x + 26},${podium.y - 34} ${podium.x - 26},${podium.y - 34}`} fill={C.sand} />
      <rect x={podium.x - 30} y={podium.y - 38} width="60" height="6" fill={C.yellow} />
      {showCertificate && (
        <svg x={podium.x - certW / 2} y={podium.y - 38 - certH + 4} width={certW} height={certH} viewBox="0 0 160 124" data-podium-certificate>
          <CertificateArt />
        </svg>
      )}
    </g>
  )
}

/** Gold sparkle points used on honors day. */
export function GoldSparkles({ g }: { g: SceneGeom }) {
  const pts = Array.from({ length: 16 }, (_, i) => ({ x: g.cx + Math.sin(i * 2.4) * g.stage.w * 0.6, y: g.screens[0].y - 20 + ((i * 53) % 120) }))
  return (
    <g data-layer="gold">
      {pts.map((p, i) => <path key={i} d={`M${p.x} ${p.y - 6}L${p.x + 2} ${p.y}L${p.x} ${p.y + 6}L${p.x - 2} ${p.y}Z`} fill={C.yellow} opacity="0.85" />)}
    </g>
  )
}
