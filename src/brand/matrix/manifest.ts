import type { MatrixColor } from './pairs'

export interface MatrixLoopDef {
  id: string
  src: string
  background: MatrixColor
  stripes: MatrixColor
}

/**
 * Loops exported from the FAST Matrix Generator, recoloured to the exact brand values and encoded to 1080px VP9.
 * Source files were 3000x3000 (47 MB in total). Missing ids fall back to the generated placeholder.
 */
export const MATRIX_LOOPS: MatrixLoopDef[] = [
  { id: 'hero', src: '/matrix/hero.webm', background: 'turquoise', stripes: 'green' },
  { id: 'ascent', src: '/matrix/ascent.webm', background: 'turquoise', stripes: 'yellow' },
  { id: 'honors', src: '/matrix/ascent.webm', background: 'turquoise', stripes: 'yellow' },
  { id: 'completion', src: '/matrix/completion.webm', background: 'yellow', stripes: 'turquoise' },
  { id: 'afterglow', src: '/matrix/afterglow.webm', background: 'beige', stripes: 'turquoise' },
]
