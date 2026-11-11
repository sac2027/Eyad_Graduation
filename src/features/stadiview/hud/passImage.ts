import type { PassWords } from '@/features/stadiview/hud/passWords'

/** The modules of a QR code: its size, and whether the module at a column and row is dark. */
export interface QrModules {
  size: number
  get(x: number, y: number): boolean | number
}

export interface PassLook {
  rtl: boolean
  /** CSS font families for headings and for text, as the page uses them. */
  display: string
  body: string
  /** The university's white logo, when it could be loaded. */
  logo?: { image: CanvasImageSource; ratio: number }
}

export const PASS_SIZE = { w: 1080, h: 1500 }

const INK = '#061a17'
const SOFT = '#3d5650'
const DEEP = '#005a50'
const GOLD = '#e7a614'
const MARGIN = 72

/** Breaks text into lines no wider than `width`, at spaces; a single word that is too wide is broken by letter. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  const push = (word: string) => {
    if (ctx.measureText(word).width <= width) return word
    // One unbroken word wider than the card: split it where it stops fitting.
    let part = ''
    for (const ch of word) {
      if (part && ctx.measureText(part + ch).width > width) {
        lines.push(part)
        part = ch
      } else part += ch
    }
    return part
  }
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= width) line = next
    else {
      if (line) lines.push(line)
      line = push(word)
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Draws the seat pass as a picture, 1080 by 1500: the same words as the card on screen, laid out for
 * a phone's photo gallery. Once saved it needs no connection, which is the point of it at a stadium gate.
 */
export function drawPass(words: PassWords, qr: QrModules, look: PassLook): HTMLCanvasElement {
  const { w: W, h: H } = PASS_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const start = look.rtl ? W - MARGIN : MARGIN
  const inner = W - 2 * MARGIN
  ctx.direction = look.rtl ? 'rtl' : 'ltr'
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // The head: the university's green, its logo, and what this is.
  const HEAD = 230
  ctx.fillStyle = DEEP
  ctx.fillRect(0, 0, W, HEAD)
  if (look.logo) {
    const h = 58
    const w = look.logo.ratio * h
    // The logo is never mirrored; it sits on the side the text starts from.
    ctx.drawImage(look.logo.image, look.rtl ? W - MARGIN - w : MARGIN, 52, w, h)
  }
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 40px ${look.display}`
  ctx.fillText(words.title, start, 160, inner)
  ctx.fillStyle = '#e8dec3'
  ctx.font = `500 28px ${look.body}`
  ctx.fillText(words.subtitle, start, 202, inner)

  // A strip of Matrix bars: three weights, leaning the brand's 5 degrees. It is not mirrored.
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, HEAD, W, 26)
  ctx.clip()
  ctx.fillStyle = INK
  ctx.fillRect(0, HEAD, W, 26)
  ctx.fillStyle = GOLD
  ctx.transform(1, 0, -Math.tan((5 * Math.PI) / 180), 1, 0, 0)
  const bars = [22, 8, 14, 8, 22, 14, 8]
  for (let x = -10, k = 0; x < W + 60; k++) {
    const bar = bars[k % bars.length]
    ctx.fillRect(x + 24, HEAD, bar, 26)
    x += bar + 12
  }
  ctx.restore()

  let y = HEAD + 26 + 88

  // The name: as large as fits in three lines.
  let size = 68
  let lines: string[] = []
  for (; size >= 40; size -= 4) {
    ctx.font = `700 ${size}px ${look.display}`
    lines = wrap(ctx, words.name, inner)
    // A name of three lines is set smaller, to leave the QR code its room.
    if (lines.length <= 2 || (lines.length === 3 && size <= 56)) break
  }
  ctx.fillStyle = INK
  for (const line of lines.slice(0, 4)) {
    ctx.fillText(line, start, y)
    y += size * 1.22
  }
  y += 4
  ctx.fillStyle = SOFT
  ctx.font = `500 32px ${look.body}`
  for (const line of wrap(ctx, words.zone, inner).slice(0, 2)) {
    ctx.fillText(line, start, y)
    y += 42
  }
  y += 22

  // The boxes: block, row, seat. They run in the reading direction.
  const gap = 20
  const cellW = (inner - gap * (words.cells.length - 1)) / words.cells.length
  const cellH = 178
  ctx.textAlign = 'center'
  words.cells.forEach((cell, k) => {
    const slot = look.rtl ? words.cells.length - 1 - k : k
    const x = MARGIN + slot * (cellW + gap)
    ctx.lineWidth = 4
    ctx.strokeStyle = INK
    ctx.strokeRect(x + 2, y + 2, cellW - 4, cellH - 4)
    ctx.fillStyle = SOFT
    ctx.font = `600 28px ${look.body}`
    ctx.fillText(cell.label, x + cellW / 2, y + 50, cellW - 24)
    ctx.fillStyle = INK
    ctx.font = `700 92px ${look.display}`
    ctx.fillText(cell.value, x + cellW / 2, y + 146, cellW - 24)
  })
  ctx.textAlign = 'start'
  y += cellH + 52

  // The smaller facts. The first two (the gate, and when it opens) share a line; the rest take one each.
  const fact = (row: { label: string; value: string }, x: number, width: number, top: number): number => {
    let at = top
    ctx.fillStyle = SOFT
    ctx.font = `600 26px ${look.body}`
    ctx.fillText(row.label, x, at, width)
    at += 42
    ctx.fillStyle = INK
    ctx.font = `600 36px ${look.body}`
    for (const line of wrap(ctx, row.value, width).slice(0, 2)) {
      ctx.fillText(line, x, at)
      at += 44
    }
    return at + 14
  }
  const rest = words.rows.slice()
  if (rest.length >= 2) {
    const [gate, opens] = rest.splice(0, 2)
    const narrow = inner * 0.32
    const wide = inner - narrow - 24
    const second = look.rtl ? start - narrow - 24 : start + narrow + 24
    y = Math.max(fact(gate, start, narrow, y), fact(opens, second, wide, y))
  }
  for (const row of rest) y = fact(row, start, inner, y)

  // The QR code takes what is left, with the quiet zone a scanner needs.
  const footer = 96
  const side = Math.max(260, Math.min(420, H - footer - y - 20))
  const top = H - footer - side - 8
  const module = Math.floor(side / (qr.size + 4))
  const drawn = module * qr.size
  const left = Math.round((W - drawn) / 2)
  const qrTop = Math.round(top + (side - drawn) / 2)
  ctx.fillStyle = '#000000'
  for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) if (qr.get(c, r)) ctx.fillRect(left + c * module, qrTop + r * module, module, module)

  ctx.textAlign = 'center'
  ctx.direction = 'ltr'
  ctx.fillStyle = INK
  ctx.font = `700 34px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  ctx.fillText(words.seatId, W / 2, H - footer + 34)
  ctx.direction = look.rtl ? 'rtl' : 'ltr'
  ctx.fillStyle = SOFT
  ctx.font = `500 24px ${look.body}`
  ctx.fillText(words.mock, W / 2, H - footer + 74, inner)
  return canvas
}

/** Saves a canvas as a PNG file through the browser's own download. */
export function downloadPass(canvas: HTMLCanvasElement, fileName: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    // The download has its own reference by now.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }, 'image/png')
}

/** Loads a picture for the pass; resolves to nothing when it cannot be loaded, and the pass is drawn without it. */
export function loadImage(src: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(undefined)
    img.src = src
  })
}
