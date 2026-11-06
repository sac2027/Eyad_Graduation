export type Locale = 'ar' | 'en'

const TZ = 'Asia/Riyadh'

function tag(locale: Locale): string {
  return locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB-u-ca-gregory-nu-latn'
}

export function formatDate(ms: number, locale: Locale, opts: Intl.DateTimeFormatOptions = { dateStyle: 'long' }): string {
  return new Intl.DateTimeFormat(tag(locale), { timeZone: TZ, ...opts }).format(ms)
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(tag(locale)).format(n)
}

export interface PluralForms {
  zero?: string
  one: string
  two?: string
  few?: string
  many?: string
  other: string
}

export function plural(locale: Locale, n: number, forms: PluralForms): string {
  if (n === 0 && forms.zero !== undefined) return forms.zero
  const cat = new Intl.PluralRules(locale).select(n)
  return forms[cat] ?? forms.other
}

export function genderForm(_locale: Locale, gender: 'm' | 'f', forms: { m: string; f: string }): string {
  return forms[gender]
}
