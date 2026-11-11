import { describe, expect, it } from 'vitest'
import { registerMessages, t, useLocale } from '@/i18n'

describe('registerMessages', () => {
  it('makes new keys translatable in both languages', () => {
    registerMessages({ ar: { 'test.reg.hello': 'مرحبا {name}' }, en: { 'test.reg.hello': 'Hello {name}' } })
    useLocale.getState().setLocale('en')
    expect(t('test.reg.hello', { name: 'Reem' })).toBe('Hello Reem')
    useLocale.getState().setLocale('ar')
    expect(t('test.reg.hello', { name: 'ريم' })).toBe('مرحبا ريم')
  })

  it('accepts the same strings twice', () => {
    const messages = { ar: { 'test.reg.twice': 'مرة' }, en: { 'test.reg.twice': 'Once' } }
    registerMessages(messages)
    expect(() => registerMessages(messages)).not.toThrow()
  })

  it('refuses to change what a key already says', () => {
    registerMessages({ ar: { 'test.reg.fixed': 'أ' }, en: { 'test.reg.fixed': 'A' } })
    expect(() => registerMessages({ ar: { 'test.reg.fixed': 'أ' }, en: { 'test.reg.fixed': 'B' } })).toThrow(/test\.reg\.fixed/)
    expect(() => registerMessages({ ar: {}, en: { 'nav.home': 'Start' } })).toThrow(/nav\.home/)
  })

  it('makes the stadium strings available once the stadium dictionary is imported', async () => {
    useLocale.getState().setLocale('en')
    expect(t('sv.back')).toBe('sv.back')
    await import('@/features/stadiview/i18n')
    expect(t('sv.back')).toBe('Back to stadium overview')
  })
})
