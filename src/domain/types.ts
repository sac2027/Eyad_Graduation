export type HonorTier = 'gold' | 'silver' | 'bronze'
export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E }
export const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value })
export const err = <E extends string>(error: E): { ok: false; error: E } => ({ ok: false, error })

export type CollegeId =
  | 'general-studies'
  | 'business'
  | 'design'
  | 'chemicals'
  | 'petroleum'
  | 'computing'
  | 'engineering'

/** College colours from the KFUPM guideline (section 6.3). */
export const COLLEGE_COLORS: Record<CollegeId, string> = {
  'general-studies': '#3d3c7f',
  business: '#004a81',
  design: '#8d5035',
  chemicals: '#f0ba4f',
  petroleum: '#a31f34',
  computing: '#6bbdbe',
  engineering: '#f58220',
}

export const COLLEGE_NAMES: Record<CollegeId, { ar: string; en: string }> = {
  'general-studies': { ar: 'الدراسات العامة', en: 'General Studies' },
  business: { ar: 'كلية إدارة الأعمال', en: 'Business School' },
  design: { ar: 'كلية التصميم والبيئة المبنية', en: 'Design & Built Environment' },
  chemicals: { ar: 'كلية الكيميائيات والمواد', en: 'Chemicals & Materials' },
  petroleum: { ar: 'كلية هندسة البترول والعلوم الجيولوجية', en: 'Petroleum Engineering & Geosciences' },
  computing: { ar: 'كلية الحاسبات والرياضيات', en: 'Computing & Mathematics' },
  engineering: { ar: 'كلية الهندسة والفيزياء', en: 'Engineering & Physics' },
}
