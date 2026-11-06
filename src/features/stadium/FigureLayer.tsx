import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { FIGURE_BOX, Graduate, type GraduateMode } from './figure/Graduate'
import type { Outfit } from './figure/frames'

interface Spot {
  x: number
  y: number
  scale: number
}

interface Props {
  target: Spot
  figureH: number
  outfit: Outfit
  mode: GraduateMode
  aura: 'soft' | 'bright'
  /** Jump straight to the target (reduced motion, low-end). */
  instant: boolean
}

/** The graduate in the scene. When time moves, he walks to his new place over 1.2 s instead of jumping. */
export function FigureLayer({ target, figureH, outfit, mode, aura, instant }: Props) {
  const [pos, setPos] = useState<Spot>(target)
  const [settled, setSettled] = useState(true)
  const live = useRef<Spot>({ ...target })
  const { x, y, scale } = target

  useEffect(() => {
    const p = live.current
    if (p.x === x && p.y === y && p.scale === scale) return
    const tween = gsap.to(p, {
      x,
      y,
      scale,
      duration: instant ? 0 : 1.2,
      ease: 'power2.inOut',
      overwrite: true,
      onStart: () => setSettled(false),
      onUpdate: () => setPos({ ...p }),
      onComplete: () => {
        setPos({ ...p })
        setSettled(true)
      },
    })
    return () => {
      tween.kill()
    }
  }, [x, y, scale, instant])

  const boxH = figureH * pos.scale * (FIGURE_BOX.h / FIGURE_BOX.bodyH)
  const boxW = (boxH * FIGURE_BOX.w) / FIGURE_BOX.h
  const top = pos.y - boxH * (FIGURE_BOX.feetY / FIGURE_BOX.h)
  return (
    <g data-figure-layer data-settled={settled}>
      <Graduate outfit={outfit} height={boxH} x={pos.x - boxW / 2} y={top} mode={mode} aura={aura} />
    </g>
  )
}
