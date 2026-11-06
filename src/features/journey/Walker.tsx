import { COLLEGE_COLORS, type CollegeId } from '@/domain/types'

interface WalkerProps {
  gender: 'm' | 'f'
  college?: CollegeId
  /** Pixel height of the figure. */
  size?: number
  className?: string
}

/** Flat 2.5D graduate: bisht for men, abaya and sash for women. Not mirrored by the Matrix rules, it is a figure. */
export function Walker({ gender, college = 'engineering', size = 64, className }: WalkerProps) {
  const trim = COLLEGE_COLORS[college]
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 40 80"
      width={(size * 40) / 80}
      height={size}
      data-walker={gender}
    >
      {gender === 'm' ? (
        <g>
          <ellipse cx="20" cy="77" rx="9" ry="2" fill="#0b2f33" opacity="0.35" />
          <path d="M11 34h18l3 40H8z" fill="#ffffff" />
          <path d="M8 34c2-4 6-6 12-6s10 2 12 6l3 36H5z" fill="#1a1a1a" />
          <path d="M20 30v44" stroke={trim} strokeWidth="2" />
          <path d="M8 34c2-4 6-6 12-6s10 2 12 6" fill="none" stroke={trim} strokeWidth="2" />
          <circle cx="20" cy="17" r="8" fill="#d9a77c" />
          <path d="M10 15c0-7 5-11 10-11s10 4 10 11v6c-2-2-3-6-3-9H13c0 3-1 7-3 9z" fill="#ffffff" />
          <rect x="11" y="9" width="18" height="3" rx="1.5" fill="#1a1a1a" />
        </g>
      ) : (
        <g>
          <ellipse cx="20" cy="77" rx="9" ry="2" fill="#0b2f33" opacity="0.35" />
          <path d="M20 26c-7 0-11 5-12 12l-2 38h28l-2-38c-1-7-5-12-12-12z" fill="#151515" />
          <path d="M12 30l16 22" stroke="#f0ba4f" strokeWidth="4" strokeLinecap="round" />
          <circle cx="20" cy="17" r="7" fill="#d9a77c" />
          <path d="M20 5c-7 0-11 5-11 12 0 6 2 11 4 13l7 3 7-3c2-2 4-7 4-13 0-7-4-12-11-12zm0 5c3 0 6 3 6 7s-3 6-6 6-6-2-6-6 3-7 6-7z" fill="#151515" fillRule="evenodd" />
        </g>
      )}
    </svg>
  )
}
