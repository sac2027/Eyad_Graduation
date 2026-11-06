import { formatNumber, plural, type Locale } from './format'

/** "1 seat", "2 seats", Arabic "مقعد واحد", "مقعدان", "3 مقاعد", "11 مقعدًا", "100 مقعد". */
export function seatsLabel(locale: Locale, n: number): string {
  const f = formatNumber(n, locale)
  return locale === 'ar'
    ? plural('ar', n, { zero: 'لا مقاعد', one: 'مقعد واحد', two: 'مقعدان', few: `${f} مقاعد`, many: `${f} مقعدًا`, other: `${f} مقعد` })
    : plural('en', n, { zero: 'no seats', one: '1 seat', other: `${f} seats` })
}

export function placesLeft(locale: Locale, n: number): string {
  const f = formatNumber(n, locale)
  return locale === 'ar'
    ? plural('ar', n, { zero: 'ممتلئ', one: 'مكان واحد متبقٍ', two: 'مكانان متبقيان', few: `${f} أماكن متبقية`, many: `${f} مكانًا متبقيًا`, other: `${f} مكان متبقٍ` })
    : plural('en', n, { zero: 'full', one: 'one place left', other: `${f} places left` })
}

/** "Tonight was the ceremony" style count of days since the ceremony, with correct Arabic/English number forms. */
export function daysSinceLabel(locale: Locale, n: number): string {
  const f = formatNumber(n, locale)
  return locale === 'ar'
    ? plural('ar', n, {
        zero: 'الحفل اليوم',
        one: 'مرّ يوم واحد على الحفل',
        two: 'مرّ يومان على الحفل',
        few: `مرّت ${f} أيام على الحفل`,
        many: `مرّ ${f} يومًا على الحفل`,
        other: `مرّ ${f} يوم على الحفل`,
      })
    : plural('en', n, { zero: 'The ceremony was today', one: '1 day since the ceremony', other: `${f} days since the ceremony` })
}
