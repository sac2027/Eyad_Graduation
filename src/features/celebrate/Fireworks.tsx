import { useEffect, useRef, useState } from 'react'
import { useDemoFlags } from '@/features/demo-console/flags'
import { useReducedMotion } from '@/ui/motionPrefs'
import { useCelebrations, type Burst, type CelebrationKind } from './celebrate'

/** Brand colours only: Yellow, Beige, Green, Blue, Sand. */
const BRAND = ['#F0BA4F', '#ECE0C7', '#009767', '#71B8D4', '#AA8C6D']
const PALETTE: Partial<Record<CelebrationKind, string[]>> = {
  'honor-gold': ['#F0BA4F', '#ECE0C7'],
  'honor-silver': ['#ADACAD', '#71B8D4', '#ECE0C7'],
  'honor-bronze': ['#AA8C6D', '#ECE0C7'],
}

/** Each kind as a list of bursts: when (s), where (fractions of the screen), how many sparks. */
const SHOW: Record<CelebrationKind, { at: number; x: number; y: number; n: number; confetti?: boolean }[]> = {
  welcome: [
    { at: 0.2, x: 0.5, y: 0.22, n: 80 },
    { at: 0.8, x: 0.36, y: 0.28, n: 60 },
    { at: 1.3, x: 0.64, y: 0.26, n: 60 },
  ],
  'ceremony-entry': [
    { at: 0.1, x: 0.5, y: 0.2, n: 90 },
    { at: 0.6, x: 0.3, y: 0.26, n: 70 },
    { at: 1.0, x: 0.7, y: 0.24, n: 70 },
    { at: 1.6, x: 0.45, y: 0.18, n: 80 },
    { at: 2.1, x: 0.58, y: 0.3, n: 70 },
  ],
  certificate: [
    { at: 0.3, x: 0.5, y: 0.2, n: 100 },
    { at: 0.9, x: 0.25, y: 0.3, n: 80 },
    { at: 1.4, x: 0.75, y: 0.28, n: 80 },
    { at: 2.0, x: 0.4, y: 0.22, n: 90 },
    { at: 2.5, x: 0.6, y: 0.18, n: 90 },
    { at: 3.1, x: 0.5, y: 0.3, n: 110 },
  ],
  task: [{ at: 0, x: 0.5, y: 0.75, n: 70, confetti: true }],
  'certificate-small': [],
  'honor-gold': [
    { at: 0.1, x: 0.5, y: 0.25, n: 90 },
    { at: 0.7, x: 0.3, y: 0.3, n: 70 },
    { at: 1.2, x: 0.7, y: 0.3, n: 70 },
    { at: 1.8, x: 0.5, y: 0.2, n: 90 },
  ],
  'honor-silver': [],
  'honor-bronze': [],
}
SHOW['honor-silver'] = SHOW['honor-gold']
SHOW['honor-bronze'] = SHOW['honor-gold']

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
  spin?: number
  /** Where the spark was a frame ago, so it is drawn as a streak. */
  px: number
  py: number
  /** A rocket climbing to where it bursts: what it carries. */
  shell?: { n: number; colors: string[]; ring: boolean }
}

/**
 * One canvas for every celebration. It runs only while there are sparks to draw, then stops and clears.
 * Under reduced motion or on a low-end device nothing is drawn.
 */
export function Fireworks() {
  const bursts = useCelebrations((s) => s.bursts)
  const done = useCelebrations((s) => s.done)
  const stopToken = useCelebrations((s) => s.stopToken)
  const reduced = useReducedMotion()
  const lowEnd = useDemoFlags((s) => s.lowEnd)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [active, setActive] = useState<CelebrationKind | null>(null)
  const queue = useRef<{ t: number; x: number; y: number; n: number; confetti?: boolean; colors: string[] }[]>([])
  const sparks = useRef<Spark[]>([])
  const raf = useRef(0)
  const clock = useRef(0)
  const launched = useRef(0)

  function schedule(b: Burst) {
    const plan = SHOW[b.kind]
    if (plan.length === 0) return
    const colors = PALETTE[b.kind] ?? BRAND
    for (const p of plan) queue.current.push({ t: clock.current + p.at * 1000, x: p.x, y: p.y, n: p.n, confetti: p.confetti, colors })
    setActive(b.kind)
    start()
  }

  function start() {
    if (raf.current) return
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      c.width = Math.round(window.innerWidth * dpr)
      c.height = Math.round(window.innerHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    let last: number | null = null
    const step = (ts: number) => {
      const dt = last === null ? 16 : Math.min(48, ts - last)
      last = ts
      clock.current += dt
      const w = window.innerWidth
      const h = window.innerHeight
      // launch due bursts
      queue.current = queue.current.filter((q) => {
        if (q.t > clock.current) return true
        if (!q.confetti) {
          // A rocket climbs from the foot of the screen and bursts where the show says.
          const from = h + 10
          const climb = 26
          sparks.current.push({
            x: q.x * w + (Math.random() - 0.5) * 30, y: from, px: q.x * w, py: from,
            vx: 0, vy: (q.y * h - from) / climb, life: 0, max: climb,
            color: q.colors[0], size: 2.4, shell: { n: q.n, colors: q.colors, ring: launched.current++ % 3 === 2 },
          })
          return false
        }
        for (let i = 0; i < q.n; i++) {
          const a = (i / q.n) * Math.PI * 2 + Math.random() * 0.2
          const speed = q.confetti ? 3 + Math.random() * 5 : 1.6 + Math.random() * 3.4
          const vy = q.confetti ? -Math.abs(Math.sin(a)) * speed - 3 : Math.sin(a) * speed
          sparks.current.push({
            x: q.x * w,
            y: q.y * h,
            px: q.x * w,
            py: q.y * h,
            vx: Math.cos(a) * speed,
            vy,
            life: 0,
            max: q.confetti ? 90 + Math.random() * 40 : 55 + Math.random() * 35,
            color: q.colors[i % q.colors.length],
            size: q.confetti ? 5 + Math.random() * 5 : 2.2,
            spin: q.confetti ? Math.random() * Math.PI : undefined,
          })
        }
        return false
      })
      // fade the previous frame for trails
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
      const k = dt / 16
      const born: Spark[] = []
      sparks.current = sparks.current.filter((s) => {
        s.life += k
        s.px = s.x
        s.py = s.y
        if (s.shell) {
          // A rocket: steady climb, slowing at the top, then it becomes its sparks.
          const left = 1 - s.life / s.max
          s.x += s.vx * k
          s.y += s.vy * k * (0.55 + left)
          ctx.globalAlpha = 0.9
          ctx.strokeStyle = '#ECE0C7'
          ctx.lineWidth = 2
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(s.px, s.py + 14)
          ctx.lineTo(s.x, s.y)
          ctx.stroke()
          if (s.life < s.max) return true
          const { n, colors, ring } = s.shell
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + Math.random() * 0.2
            // A ring bursts at one speed; a chrysanthemum at many, with a bright slow core.
            const speed = ring ? 4.2 + Math.random() * 0.5 : i % 4 === 0 ? 0.8 + Math.random() * 1.2 : 1.8 + Math.random() * 3.6
            born.push({
              x: s.x, y: s.y, px: s.x, py: s.y,
              vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
              life: 0, max: 60 + Math.random() * 45,
              color: colors[i % colors.length], size: i % 4 === 0 ? 1.4 : 2.2,
            })
          }
          // The flash at the heart of the burst.
          ctx.globalAlpha = 0.5
          ctx.fillStyle = '#ECE0C7'
          ctx.beginPath()
          ctx.arc(s.x, s.y, 26, 0, Math.PI * 2)
          ctx.fill()
          return false
        }
        s.vy += (s.spin !== undefined ? 0.07 : 0.045) * k
        s.vx *= s.spin !== undefined ? 0.985 : 0.975
        if (s.spin === undefined) s.vy *= 0.985
        s.x += s.vx * k
        s.y += s.vy * k
        const age = s.life / s.max
        // Sparks twinkle as they die.
        const alpha = Math.max(0, 1 - age) * (age > 0.6 && s.spin === undefined ? 0.55 + 0.45 * Math.sin(s.life * 1.7 + s.max) : 1)
        ctx.globalAlpha = alpha
        if (s.spin !== undefined) {
          // Confetti is cut like the brand's bars: slanted slips that tumble as they fall.
          s.spin += 0.2 * k
          s.vx += Math.sin(s.life * 0.12 + s.max) * 0.05 * k
          ctx.fillStyle = s.color
          ctx.save()
          ctx.translate(s.x, s.y)
          ctx.rotate(s.spin)
          ctx.transform(1, 0, -0.0875, Math.cos(s.spin * 1.3), 0, 0)
          ctx.fillRect(-s.size / 4, -s.size / 2, s.size / 2, s.size)
          ctx.restore()
        } else {
          ctx.strokeStyle = s.color
          ctx.lineWidth = s.size * (1 - age * 0.5)
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(s.px, s.py)
          ctx.lineTo(s.x, s.y)
          ctx.stroke()
        }
        return s.life < s.max && s.y < h + 20
      })
      if (born.length) sparks.current.push(...born)
      ctx.globalAlpha = 1
      if (sparks.current.length === 0 && queue.current.length === 0) {
        ctx.clearRect(0, 0, w, h)
        raf.current = 0
        setActive(null)
        return
      }
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // A tap on the welcome moment stops the show at once.
  useEffect(() => {
    if (stopToken === 0) return
    queue.current = []
    sparks.current = []
  }, [stopToken])

  useEffect(() => {
    if (bursts.length === 0) return
    const calm = reduced || lowEnd
    for (const b of bursts) {
      if (!calm) schedule(b)
      done(b.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bursts])


  return (
    <canvas
      ref={canvas}
      aria-hidden
      data-fx
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
      data-fireworks={active ?? undefined}
      style={{ display: active ? 'block' : 'none' }}
    />
  )
}
