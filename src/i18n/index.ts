import { create } from 'zustand'
import { ar } from './ar'
import { en } from './en'
import type { Locale } from './format'

export type { Locale } from './format'
export { formatDate, formatNumber, plural, genderForm } from './format'

const dictionaries: Record<Locale, Record<string, string>> = { ar, en }

function apply(locale: Locale) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
}

function initial(): Locale {
  try {
    const q = new URLSearchParams(window.location.search).get('lang')
    if (q === 'ar' || q === 'en') return q
  } catch {
    /* no window */
  }
  return 'ar'
}

interface LocaleState {
  locale: Locale
  dir: 'rtl' | 'ltr'
  setLocale(l: Locale): void
}

const start = initial()
apply(start)

export const useLocale = create<LocaleState>((set) => ({
  locale: start,
  dir: start === 'ar' ? 'rtl' : 'ltr',
  setLocale(l) {
    apply(l)
    set({ locale: l, dir: l === 'ar' ? 'rtl' : 'ltr' })
  },
}))

export type TFn = (key: string, params?: Record<string, string | number>) => string

function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const raw = dictionaries[locale][key] ?? dictionaries.en[key] ?? key
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`))
}

/** Non-reactive lookup. Prefer useT() inside components so they re-render on language change. */
export const t: TFn = (key, params) => translate(useLocale.getState().locale, key, params)

export function useT(): TFn {
  const locale = useLocale((s) => s.locale)
  return (key, params) => translate(locale, key, params)
}
