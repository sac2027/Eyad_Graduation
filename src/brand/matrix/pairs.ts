export type MatrixColor = 'turquoise' | 'green' | 'beige' | 'sand' | 'yellow' | 'blue' | 'gray' | 'white'

export const MATRIX_HEX: Record<MatrixColor, string> = {
  turquoise: '#115f66',
  green: '#009767',
  beige: '#ece0c7',
  sand: '#aa8c6d',
  yellow: '#f0ba4f',
  blue: '#71b8d4',
  gray: '#adacad',
  white: '#ffffff',
}

/**
 * Background -> allowed stripe colours. Transcribed from the KFUPM Brand Guidelines v1.2, page 78
 * ("the combinations displayed on this page are the only allowed options"). Verify against the PDF.
 */
export const ALLOWED_MATRIX_PAIRS: Record<MatrixColor, MatrixColor[]> = {
  turquoise: ['green', 'beige', 'white', 'yellow', 'sand', 'blue', 'gray'],
  green: ['turquoise', 'beige', 'white', 'yellow', 'blue', 'gray'],
  beige: ['turquoise', 'green', 'white', 'yellow', 'sand', 'blue', 'gray'],
  white: ['turquoise', 'green', 'beige', 'yellow', 'sand', 'blue', 'gray'],
  yellow: ['turquoise', 'green', 'beige', 'white'],
  blue: ['turquoise', 'green', 'beige', 'white'],
  sand: ['turquoise', 'beige', 'white'],
  gray: ['turquoise', 'green', 'beige', 'white'],
}

export function isAllowedPair(background: MatrixColor, stripes: MatrixColor): boolean {
  return ALLOWED_MATRIX_PAIRS[background].includes(stripes)
}

export function assertAllowedPair(background: MatrixColor, stripes: MatrixColor): void {
  if (!isAllowedPair(background, stripes)) {
    throw new Error(`Matrix colour pair not approved by the brand guideline: ${stripes} on ${background}`)
  }
}
