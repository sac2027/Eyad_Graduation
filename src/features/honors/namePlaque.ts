import * as THREE from 'three'
import type { Locale } from '@/i18n'

interface Measurer {
  font: string
  measureText(text: string): { width: number }
}

/** Largest font size (px) at which the text fits the width. Long names shrink, short names stay big. */
export function fitFontSize(ctx: Measurer, text: string, maxWidth: number, start: number, min: number, family: string): number {
  let size = start
  while (size > min) {
    ctx.font = `900 ${size}px ${family}`
    if (ctx.measureText(text).width <= maxWidth) return size
    size -= 2
  }
  return min
}

/** Splits very long names over two lines at a space near the middle. */
export function splitName(text: string): string[] {
  if (text.length <= 22) return [text]
  const mid = Math.floor(text.length / 2)
  let best = -1
  for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i
  return best === -1 ? [text] : [text.slice(0, best), text.slice(best + 1)]
}

const FAMILY = '"KFUPM Display", "IBM Plex Sans Arabic", sans-serif'

/** Draws the name with Canvas2D so Arabic letters join correctly. Transparent background, engraved look. */
export async function createNamePlaqueTexture(name: string, locale: Locale): Promise<THREE.CanvasTexture> {
  try {
    await document.fonts.load(`900 64px ${FAMILY}`)
    await document.fonts.ready
  } catch {
    /* fall back to whatever is available */
  }
  const W = 1024
  const H = 256
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.direction = locale === 'ar' ? 'rtl' : 'ltr'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lines = splitName(name)
  const size = Math.min(...lines.map((l) => fitFontSize(ctx, l, W - 96, lines.length > 1 ? 92 : 120, 36, FAMILY)))
  ctx.font = `900 ${size}px ${FAMILY}`
  const lh = size * 1.15
  lines.forEach((l, i) => {
    const y = H / 2 + (i - (lines.length - 1) / 2) * lh
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText(l, W / 2 + 1.5, y + 2)
    ctx.fillStyle = '#2a1d08'
    ctx.fillText(l, W / 2, y)
  })
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
