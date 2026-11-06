export type Orientation = 'wide' | 'tall'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface SceneGeom {
  w: number
  h: number
  cx: number
  /** The nine checkpoints on the graduate's line: six along the aisle, then the stage steps, the stage and the podium. */
  aisle: { x: number; y: number; scale: number }[]
  aisleTop: { y: number; half: number }
  aisleBottom: { y: number; half: number }
  /** Top edge of the stadium bowl (where the skyline sits). */
  rim: number
  stage: { x: number; y: number; w: number; depth: number }
  screens: [Rect, Rect]
  podium: { x: number; y: number }
  /** Graduate height in scene units at scale 1. */
  figureH: number
  /** Box kept clear for the opening line. */
  headline: Rect
}

interface Spec {
  w: number
  h: number
  yB: number
  halfB: number
  yT: number
  halfT: number
  rim: number
  stageY: number
  stageW: number
  screens: [Rect, Rect]
  figureH: number
  headline: Rect
}

const SPECS: Record<Orientation, Spec> = {
  wide: {
    w: 1600, h: 900, yB: 872, halfB: 128, yT: 392, halfT: 46, rim: 268, stageY: 346, stageW: 560,
    screens: [{ x: 452, y: 176, w: 210, h: 106 }, { x: 938, y: 176, w: 210, h: 106 }],
    figureH: 250, headline: { x: 180, y: 14, w: 1240, h: 140 },
  },
  tall: {
    w: 800, h: 1200, yB: 1168, halfB: 150, yT: 518, halfT: 54, rim: 330, stageY: 472, stageW: 520,
    screens: [{ x: 70, y: 318, w: 270, h: 110 }, { x: 460, y: 318, w: 270, h: 110 }],
    figureH: 300, headline: { x: 32, y: 24, w: 736, h: 286 },
  },
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function geometryFor(o: Orientation): SceneGeom {
  const s = SPECS[o]
  const cx = s.w / 2
  const halfAt = (y: number) => lerp(s.halfB, s.halfT, (s.yB - y) / (s.yB - s.yT))
  const aisle: SceneGeom['aisle'] = []
  // Six checkpoints along the aisle, spaced so the near ones get more room (a gentle perspective).
  for (let i = 0; i < 6; i++) {
    const u = i / 5
    const y = s.yB - (s.yB - s.yT) * (1 - Math.pow(1 - u, 1.5))
    aisle.push({ x: cx, y, scale: halfAt(y) / s.halfB })
  }
  const top = aisle[5].scale
  // Stage steps, on stage, and the podium.
  aisle.push({ x: cx, y: s.stageY + 18, scale: top * 0.93 })
  aisle.push({ x: cx, y: s.stageY + 4, scale: top * 0.87 })
  aisle.push({ x: cx, y: s.stageY - 6, scale: top * 0.82 })
  return {
    w: s.w,
    h: s.h,
    cx,
    aisle,
    aisleTop: { y: s.yT, half: s.halfT },
    aisleBottom: { y: s.yB, half: s.halfB },
    rim: s.rim,
    stage: { x: cx, y: s.stageY, w: s.stageW, depth: 46 },
    screens: s.screens,
    podium: { x: cx, y: s.stageY - 6 },
    figureH: s.figureH,
    headline: s.headline,
  }
}

/** Where the graduate stands for a path progress (0..1): linear between neighbouring checkpoints. */
export function figureAt(progress: number, g: SceneGeom): { x: number; y: number; scale: number } {
  const k = Math.min(1, Math.max(0, progress)) * (g.aisle.length - 1)
  const i = Math.min(g.aisle.length - 2, Math.floor(k))
  const f = k - i
  const a = g.aisle[i]
  const b = g.aisle[i + 1]
  return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), scale: lerp(a.scale, b.scale, f) }
}
