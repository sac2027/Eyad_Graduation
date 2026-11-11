import { SV } from '@/features/stadiview/scene/palette'

/**
 * The pictures shown on the stage's LED screens and on the backdrop's centre panel, drawn on 2D
 * canvases. They are drawings, not photographs: flat brand colours, the official logo unmodified,
 * and a band of FAST Matrix bars.
 */

const DISPLAY = '"KFUPM Display", "IBM Plex Sans Arabic", system-ui, sans-serif'

/** Makes sure the display typeface is ready before text is drawn with it; resolves either way. */
export async function fontsReady(sample: string): Promise<void> {
  try {
    await Promise.all([document.fonts.load(`700 80px ${DISPLAY}`, sample), document.fonts.load(`400 40px ${DISPLAY}`, sample)])
  } catch {
    /* the fallback faces in the stack will do */
  }
}

/** Loads a picture; resolves to null when it cannot be loaded, so the art is drawn without it. */
export function loadPicture(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return [c, c.getContext('2d')!]
}

/**
 * A band of FAST Matrix bars along the bottom of a picture: cells of three bars in one of three
 * weights, leaning 5 degrees. The weights follow a fixed list so the band is the same every time.
 */
function matrixBand(ctx: CanvasRenderingContext2D, width: number, top: number, height: number, color: string): void {
  const weights = [0.2, 0.05, 0.11, 0, 0.2, 0.11, 0.05, 0.2, 0, 0.11, 0.2, 0.05, 0.11, 0.2, 0, 0.05, 0.2, 0.11]
  const cell = height
  const lean = Math.tan((5 * Math.PI) / 180) * height
  ctx.fillStyle = color
  for (let c = -1; c * cell < width + cell; c++) {
    const w = weights[((c % weights.length) + weights.length) % weights.length] * cell
    if (w === 0) continue
    for (let k = 0; k < 3; k++) {
      const x = c * cell + (k + 0.5) * (cell / 3) - w / 2
      ctx.beginPath()
      ctx.moveTo(x, top + height)
      ctx.lineTo(x + w, top + height)
      ctx.lineTo(x + w + lean, top)
      ctx.lineTo(x + lean, top)
      ctx.closePath()
      ctx.fill()
    }
  }
}

/** Draws the logo centred on (cx, cy) at the given height, keeping its proportions. */
function logoAt(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, cx: number, cy: number, height: number): void {
  if (!logo || !logo.naturalHeight) return
  const width = (logo.naturalWidth / logo.naturalHeight) * height
  ctx.drawImage(logo, cx - width / 2, cy - height / 2, width, height)
}

/** Shrinks the type until the line fits the width. */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number): void {
  let px = size
  do {
    ctx.font = `${weight} ${px}px ${DISPLAY}`
    px -= 4
  } while (ctx.measureText(text).width > maxWidth && px > 24)
}

export interface ScreenWords {
  /** The headline, for example "Class of 57 graduation". */
  title: string
  /** The line under it: the ceremony date, or that it is still to be announced. */
  date: string
  /** The second slide. */
  congrats: string
  rtl: boolean
}

/** The first LED slide: the logo, the ceremony's name and its date, on deep green with gold bars. */
export function drawTitleSlide(words: ScreenWords, logo: HTMLImageElement | null): HTMLCanvasElement {
  const [c, ctx] = canvas(1024, 576)
  ctx.fillStyle = SV.deep
  ctx.fillRect(0, 0, c.width, c.height)
  matrixBand(ctx, c.width, c.height - 84, 84, SV.gold)
  logoAt(ctx, logo, c.width / 2, 104, 58)
  ctx.direction = words.rtl ? 'rtl' : 'ltr'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = SV.white
  fitText(ctx, words.title, 700, 104, c.width - 120)
  ctx.fillText(words.title, c.width / 2, 268)
  ctx.fillStyle = SV.sand
  fitText(ctx, words.date, 400, 46, c.width - 160)
  ctx.fillText(words.date, c.width / 2, 384)
  return c
}

/** The second LED slide: the congratulation, night on gold. */
export function drawCongratsSlide(words: ScreenWords): HTMLCanvasElement {
  const [c, ctx] = canvas(1024, 576)
  ctx.fillStyle = SV.gold
  ctx.fillRect(0, 0, c.width, c.height)
  matrixBand(ctx, c.width, c.height - 84, 84, SV.deep)
  ctx.direction = words.rtl ? 'rtl' : 'ltr'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = SV.night
  fitText(ctx, words.congrats, 700, 112, c.width - 120)
  ctx.fillText(words.congrats, c.width / 2, 232)
  // The white logo would vanish on gold, so this slide carries the university's name in type instead.
  ctx.font = `700 44px ${DISPLAY}`
  ctx.direction = 'ltr'
  ctx.fillText('KFUPM', c.width / 2, 372)
  return c
}

/** The panel in the middle of the stage backdrop: the logo on night, in a thin gold frame. */
export function drawCrestPanel(logo: HTMLImageElement | null): HTMLCanvasElement {
  const [c, ctx] = canvas(1024, 320)
  ctx.fillStyle = SV.night
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.strokeStyle = SV.gold
  ctx.lineWidth = 6
  ctx.strokeRect(9, 9, c.width - 18, c.height - 18)
  if (logo && logo.naturalHeight) logoAt(ctx, logo, c.width / 2, c.height / 2, 132)
  else {
    ctx.fillStyle = SV.white
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `900 150px ${DISPLAY}`
    ctx.fillText('KFUPM', c.width / 2, c.height / 2 + 6)
  }
  return c
}
