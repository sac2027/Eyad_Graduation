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
        for (let i = 0; i < q.n; i++) {
          const a = (i / q.n) * Math.PI * 2 + Math.random() * 0.2
          const speed = q.confetti ? 3 + Math.random() * 5 : 1.6 + Math.random() * 3.4
          const vy = q.confetti ? -Math.abs(Math.sin(a)) * speed - 3 : Math.sin(a) * speed
          sparks.current.push({
            x: q.x * w,
            y: q.y * h,
            vx: Math.cos(a) * speed,
            vy,
            life: 0,
            max: q.confetti ? 90 + Math.random() * 40 : 55 + Math.random() * 35,
            color: q.colors[i % q.colors.length],
            size: q.confetti ? 5 : 2.2,
            spin: q.confetti ? Math.random() * Math.PI : undefined,
          })
        }
        return false
      })
      // fade the previous frame for trails
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
      const k = dt / 16
      sparks.current = sparks.current.filter((s) => {
        s.life += k
        s.vy += 0.045 * k
        s.vx *= 0.985
        s.x += s.vx * k
        s.y += s.vy * k
        const alpha = Math.max(0, 1 - s.life / s.max)
        ctx.globalAlpha = alpha
        ctx.fillStyle = s.color
        if (s.spin !== undefined) {
          s.spin += 0.2 * k
          ctx.save()
          ctx.translate(s.x, s.y)
          ctx.rotate(s.spin)
          ctx.fillRect(-s.size / 2, -s.size / 4, s.size, s.size / 2)
          ctx.restore()
        } else {
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
          ctx.fill()
        }
        return s.life < s.max && s.y < h + 20
      })
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
