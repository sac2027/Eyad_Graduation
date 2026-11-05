import { describe, expect, it } from 'vitest'
import { placesLeft, seatsLabel } from '@/i18n/plurals'

describe('seatsLabel', () => {
  it.each([
    [0, 'لا مقاعد'],
    [1, 'مقعد واحد'],
    [2, 'مقعدان'],
    [3, '3 مقاعد'],
    [10, '10 مقاعد'],
    [11, '11 مقعدًا'],
    [99, '99 مقعدًا'],
    [100, '100 مقعد'],
    [102, '102 مقعد'],
  ])('Arabic %s -> %s', (n, expected) => {
    expect(seatsLabel('ar', n)).toBe(expected)
  })
  it('English', () => {
    expect(seatsLabel('en', 1)).toBe('1 seat')
    expect(seatsLabel('en', 2)).toBe('2 seats')
    expect(seatsLabel('en', 11)).toBe('11 seats')
    expect(seatsLabel('en', 1300)).toBe('1,300 seats')
  })
  it('uses Western digits in Arabic', () => {
    expect(seatsLabel('ar', 1300)).toBe('1,300 مقعد')
    expect(/[٠-٩]/.test(seatsLabel('ar', 4321))).toBe(false)
  })
})

describe('placesLeft', () => {
  it('covers the Arabic forms', () => {
    expect(placesLeft('ar', 1)).toBe('مكان واحد متبقٍ')
    expect(placesLeft('ar', 2)).toBe('مكانان متبقيان')
    expect(placesLeft('ar', 5)).toBe('5 أماكن متبقية')
    expect(placesLeft('ar', 12)).toBe('12 مكانًا متبقيًا')
    expect(placesLeft('ar', 100)).toBe('100 مكان متبقٍ')
    expect(placesLeft('ar', 0)).toBe('ممتلئ')
  })
  it('covers English', () => {
    expect(placesLeft('en', 1)).toBe('one place left')
    expect(placesLeft('en', 7)).toBe('7 places left')
  })
})
