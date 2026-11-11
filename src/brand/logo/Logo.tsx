import horizontal from './horizontal.svg?url'
import horizontalNegative from './horizontal-negative.svg?url'
import stacked from './stacked.svg?url'
import stackedNegative from './stacked-negative.svg?url'

const FILES = {
  horizontal: { positive: horizontal, negative: horizontalNegative, ratio: 188.25 / 31.55 },
  stacked: { positive: stacked, negative: stackedNegative, ratio: 188.25 / 31.54 },
}

/** The white horizontal logo as a file, for code that draws it itself (a canvas cannot use the component). */
export const LOGO_NEGATIVE_FILE = { src: horizontalNegative, ratio: FILES.horizontal.ratio }

interface Props {
  variant?: 'horizontal' | 'stacked'
  /** "auto" follows the page header: colour logo on light, white logo on turquoise. */
  tone?: 'auto' | 'positive' | 'negative'
  height?: number
  className?: string
}

/** The official KFUPM logo, unmodified. Only the supplied colour and white versions are used. */
export function Logo({ variant = 'horizontal', tone = 'auto', height = 28, className = '' }: Props) {
  const f = FILES[variant]
  // Height can be overridden per breakpoint with the --logo-h custom property.
  const style = { height: `var(--logo-h, ${height}px)`, width: 'auto', aspectRatio: String(f.ratio) }
  const img = (src: string, cls: string) => <img src={src} alt="" aria-hidden style={style} className={`${cls} max-w-full`} draggable={false} />
  return (
    <span role="img" aria-label="KFUPM" className={`inline-flex ${className}`} dir="ltr">
      {tone !== 'negative' && img(f.positive, tone === 'auto' ? 'logo-on-light' : '')}
      {tone !== 'positive' && img(f.negative, tone === 'auto' ? 'logo-on-dark' : '')}
    </span>
  )
}
