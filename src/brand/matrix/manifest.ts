import type { MatrixColor } from './pairs'

export interface MatrixLoopDef {
  id: string
  src: string
  background: MatrixColor
  stripes: MatrixColor
}

/**
 * Loops exported from the FAST Matrix Generator (Record gives .webm). Put files in public/matrix/ and add them here.
 * Suggested ids used by the app: 'hero', 'ascent', 'completion', 'honors'. Missing ids fall back to the generated placeholder.
 */
export const MATRIX_LOOPS: MatrixLoopDef[] = []
