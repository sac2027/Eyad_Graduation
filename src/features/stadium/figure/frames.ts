/**
 * Hand-built walk cycle for the graduate silhouette, seen from behind (no face, no skin).
 * Each frame is one SVG path in a 100 x 240 box, generated from a few body shapes so the
 * motion stays consistent: weight shifts over the stance foot, the body rises at mid-stance,
 * the shoulders tilt, the bisht or abaya hem swings a beat behind the legs, and the swing
 * foot's heel lifts and recedes.
 */

export type Outfit = 'bisht' | 'abaya'
export const STRIDE_MS = 1600
const FRAMES = 12

type Pt = [number, number]

function orient(points: Pt[]): Pt[] {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    area += x1 * y2 - x2 * y1
  }
  return area < 0 ? [...points].reverse() : points
}

const f = (n: number) => (Math.round(n * 10) / 10).toString()

/** Closed Catmull-Rom spline through the points, as cubic Beziers, so outlines read as cloth, not polygons. */
function smooth(input: Pt[], tension = 1): string {
  const p = orient(input)
  const n = p.length
  let d = `M${f(p[0][0])} ${f(p[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n]
    const p1 = p[i]
    const p2 = p[(i + 1) % n]
    const p3 = p[(i + 2) % n]
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension]
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension]
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + 'Z'
}

function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5523
  const p = (x: number, y: number) => `${f(x)} ${f(y)}`
  return (
    `M${p(cx, cy - ry)}` +
    `C${p(cx + rx * k, cy - ry)} ${p(cx + rx, cy - ry * k)} ${p(cx + rx, cy)}` +
    `C${p(cx + rx, cy + ry * k)} ${p(cx + rx * k, cy + ry)} ${p(cx, cy + ry)}` +
    `C${p(cx - rx * k, cy + ry)} ${p(cx - rx, cy + ry * k)} ${p(cx - rx, cy)}` +
    `C${p(cx - rx, cy - ry * k)} ${p(cx - rx * k, cy - ry)} ${p(cx, cy - ry)}Z`
  )
}

function transform(points: Pt[], dx: number, dy: number, deg = 0, origin: Pt = [50, 120]): Pt[] {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return points.map(([x, y]) => {
    const rx = x - origin[0]
    const ry = y - origin[1]
    return [origin[0] + rx * c - ry * s + dx, origin[1] + rx * s + ry * c + dy]
  })
}

interface Pose {
  /** Weight shift (+ = toward the viewer's right). */
  dx: number
  /** Vertical bob (negative = up). */
  dy: number
  /** Shoulder tilt in degrees. */
  tilt: number
  /** Hem swing, lagging the legs. */
  hem: number
  /** How far each foot is through its swing (0 = planted). */
  swingL: number
  swingR: number
  /** Sleeve swing per side (-1..1). */
  armL: number
  armR: number
}

function poseAt(i: number): Pose {
  const phi = (2 * Math.PI * i) / FRAMES
  const s = Math.sin(phi)
  return {
    dx: 1.4 * s,
    dy: -1.6 * Math.abs(s),
    tilt: 1.8 * s,
    hem: Math.sin(phi - 0.6),
    swingL: Math.max(0, s),
    swingR: Math.max(0, -s),
    armL: Math.cos(phi),
    armR: -Math.cos(phi),
  }
}

/* ---------- bisht: thobe, ghutra and agal, bisht ---------- */

function ghutra(): Pt[] {
  // Round crown, the agal as a double band, then the cloth falling onto the shoulders and down the back.
  return [
    [50, 5.5], [56.5, 6.6], [60.6, 10.2], [62, 14.6], [63.6, 16.2], [63.2, 18.6], [63.8, 20.4], [62.8, 22.6],
    [64.2, 28], [66.6, 36], [71, 43.5], [72, 48], [64, 58], [50, 70], [36, 58], [28, 48], [29, 43.5], [33.4, 36],
    [35.8, 28], [37.2, 22.6], [36.2, 20.4], [36.8, 18.6], [36.4, 16.2], [38, 14.6], [39.4, 10.2], [43.5, 6.6],
  ]
}

function bishtBody(p: Pose, raised = false): Pt[] {
  const h = 2.8 * p.hem
  const flareL = 1.4 * p.hem
  const flareR = -1.4 * p.hem
  const sleeveL = raised ? 0 : 1.6 * p.armL
  const sleeveR = raised ? 0 : 1.6 * p.armR
  // A stiff, square shoulder line, then a full A-line drape to mid-calf.
  return [
    [50, 44.5], [64, 45.5], [75, 47.5], [80.6, 51], [82.6, 58], [83.6, 76], [85 + sleeveR * 0.5, 102], [87 + sleeveR, 128],
    [88.4, 154], [89.8 + flareR, 174], [90.6 + h, 187.5], [70 + h, 191.5], [50 + h, 192.5], [30 + h, 191.5], [9.4 + h, 187.5],
    [10.2 + flareL, 174], [11.6, 154], [13 - sleeveL, 128], [15 - sleeveL * 0.5, 102], [16.4, 76], [17.4, 58], [19.4, 51], [25, 47.5], [36, 45.5],
  ]
}

function thobe(p: Pose): Pt[] {
  const t = 1.8 * p.hem
  // The white thobe below the bisht: straight, falling to the ankles with a slight flare.
  return [
    [33.5, 184], [66.5, 184], [67 + t * 0.6, 204], [68 + t, 222.6 - 2 * p.swingR], [58 + t, 224.6], [50 + t, 224.2],
    [42 + t, 224.6], [32 + t, 222.6 - 2 * p.swingL], [33 + t * 0.6, 204],
  ]
}

function shoe(cx: number, swing: number): string {
  const lift = 5 * swing
  const scale = 1 - 0.22 * swing
  return ellipse(cx, 228 - lift, 5.2 * scale, 3.8)
}

/* ---------- abaya: shayla, abaya ---------- */

function shayla(): Pt[] {
  // Rounded head under the shayla, the cloth settling over the shoulders and falling down the back.
  return [
    [50, 7], [56.4, 8.2], [60.6, 12], [62, 18], [61.6, 25], [63.6, 33], [68, 41], [71, 47.5],
    [64, 58], [50, 68], [36, 58], [29, 47.5], [32, 41], [36.4, 33], [38.4, 25], [38, 18], [39.4, 12], [43.6, 8.2],
  ]
}

function abayaBody(p: Pose, raised = false): Pt[] {
  const h = 3.2 * p.hem
  const sleeveL = raised ? 0 : 1.4 * p.armL
  const sleeveR = raised ? 0 : 1.4 * p.armR
  // Soft rounded shoulders, then a long flowing A-line to the ground.
  return [
    [50, 46.5], [61, 47.4], [69.5, 50], [74, 55], [75.6, 66], [77 + sleeveR * 0.4, 94], [78.6 + sleeveR, 122], [80.4, 160],
    [82.4 - 1.4 * p.hem, 196], [84.4 + h, 226.6 - 2.6 * p.swingR], [67 + h, 229], [50 + h, 229.4], [33 + h, 229],
    [15.6 + h, 226.6 - 2.6 * p.swingL], [17.6 + 1.4 * p.hem, 196], [19.6, 160], [21.4 - sleeveL, 122], [23 - sleeveL * 0.4, 94],
    [24.4, 66], [26, 55], [30.5, 50], [39, 47.4],
  ]
}

function abayaShoe(cx: number, swing: number): string {
  return ellipse(cx, 230.5 - 3.5 * swing, 4 * (1 - 0.3 * swing), 2.6)
}

/* ---------- frames ---------- */

function walkFrame(outfit: Outfit, i: number): string {
  const p = poseAt(i)
  if (outfit === 'bisht') {
    const upper = (pts: Pt[]) => transform(pts, p.dx, p.dy, p.tilt)
    return [
      smooth(upper(bishtBody(p))),
      smooth(upper(ghutra())),
      smooth(transform(thobe(p), p.dx * 0.5, p.dy * 0.4)),
      shoe(43, p.swingL),
      shoe(57, p.swingR),
    ].join('')
  }
  const upper = (pts: Pt[]) => transform(pts, p.dx, p.dy, p.tilt * 0.8)
  return [
    smooth(upper(abayaBody(p))),
    smooth(upper(shayla())),
    abayaShoe(44, p.swingL),
    abayaShoe(56, p.swingR),
  ].join('')
}

/** Arms raised overhead in wide sleeves, hands meeting where the certificate is held. */
function raisedArms(sleeveDrop: number): string {
  const left: Pt[] = [[24, 62], [13, 52 + sleeveDrop], [15, 34], [30, 6], [38.5, 8.5], [30.5, 34], [35, 56]]
  const right = left.map(([x, y]) => [100 - x, y] as Pt)
  return smooth(left) + smooth(right)
}

function holdFrame(outfit: Outfit): string {
  const still: Pose = { dx: 0, dy: 0, tilt: 0, hem: 0, swingL: 0, swingR: 0, armL: 0, armR: 0 }
  if (outfit === 'bisht') {
    return [smooth(bishtBody(still, true)), smooth(ghutra()), smooth(thobe(still)), shoe(43, 0), shoe(57, 0), raisedArms(4)].join('')
  }
  return [smooth(abayaBody(still, true)), smooth(shayla()), abayaShoe(44, 0), abayaShoe(56, 0), raisedArms(2)].join('')
}

export const WALK_FRAMES: Record<Outfit, string[]> = {
  bisht: Array.from({ length: FRAMES }, (_, i) => walkFrame('bisht', i)),
  abaya: Array.from({ length: FRAMES }, (_, i) => walkFrame('abaya', i)),
}

export const HOLD_FRAMES: Record<Outfit, string> = {
  bisht: holdFrame('bisht'),
  abaya: holdFrame('abaya'),
}

/** Where the hands meet in the hold pose, for placing the certificate (viewBox units). */
export const HOLD_HANDS = { x: 50, y: 6 }
