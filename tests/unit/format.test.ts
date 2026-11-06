import { afterEach, describe, expect, it } from 'vitest'
import { formatDate, formatNumber, genderForm, plural } from '@/i18n/format'
import { useLocale } from '@/i18n'

const ceremony = Date.parse('2027-04-07T20:00:00+03:00')
const arabicIndic = /[٠-٩۰-۹]/

describe('formatters', () => {
  it('uses Western digits and Gregorian dates in Arabic', () => {
    const s = formatDate(ceremony, 'ar')
    expect(s).toContain('2027')
    expect(s).toMatch(/7/)
    expect(arabicIndic.test(s)).toBe(false)
    expect(arabicIndic.test(formatNumber(1234, 'ar'))).toBe(false)
  })
  it('formats in the Riyadh timezone', () => {
    expect(formatDate(ceremony, 'en', { hour: '2-digit', minute: '2-digit', hour12: false })).toContain('20:00')
  })
  it('selects Arabic plural forms', () => {
    const forms = { zero: 'لا مقاعد', one: 'مقعد', two: 'مقعدان', few: 'مقاعد', many: 'مقعدًا', other: 'مقعد' }
    expect(plural('ar', 1, forms)).toBe('مقعد')
    expect(plural('ar', 2, forms)).toBe('مقعدان')
    expect(plural('ar', 3, forms)).toBe('مقاعد')
    expect(plural('ar', 11, forms)).toBe('مقعدًا')
    expect(plural('ar', 100, forms)).toBe('مقعد')
    expect(plural('ar', 0, forms)).toBe('لا مقاعد')
  })
  it('selects English plural forms', () => {
    expect(plural('en', 1, { one: 'seat', other: 'seats' })).toBe('seat')
    expect(plural('en', 2, { one: 'seat', other: 'seats' })).toBe('seats')
  })
  it('selects gendered forms', () => {
    expect(genderForm('ar', 'f', { m: 'تخرجتَ', f: 'تخرجتِ' })).toBe('تخرجتِ')
    expect(genderForm('ar', 'm', { m: 'تخرجتَ', f: 'تخرجتِ' })).toBe('تخرجتَ')
  })
})

describe('locale', () => {
  afterEach(() => useLocale.getState().setLocale('ar'))
  it('flips direction and document attributes', () => {
    useLocale.getState().setLocale('en')
    expect(useLocale.getState().dir).toBe('ltr')
    expect(document.documentElement.dir).toBe('ltr')
    expect(document.documentElement.lang).toBe('en')
    useLocale.getState().setLocale('ar')
    expect(document.documentElement.dir).toBe('rtl')
  })
})
