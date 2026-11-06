import { describe, expect, it } from 'vitest'
import { ar } from '@/i18n/ar'
import { en } from '@/i18n/en'

describe('i18n parity', () => {
  it('has the same keys in Arabic and English', () => {
    const a = Object.keys(ar).sort()
    const e = Object.keys(en).sort()
    expect(a.filter((k) => !e.includes(k))).toEqual([])
    expect(e.filter((k) => !a.includes(k))).toEqual([])
  })
  it('pairs every masculine form with a feminine one', () => {
    for (const d of [ar, en] as Record<string, string>[]) {
      for (const k of Object.keys(d)) {
        if (k.startsWith('unit.')) continue // unit.m means minutes
        if (k.endsWith('.m')) expect(d, k).toHaveProperty(`${k.slice(0, -2)}.f`)
        if (k.endsWith('.f')) expect(d, k).toHaveProperty(`${k.slice(0, -2)}.m`)
      }
    }
  })
  it('keeps Latin letters out of Arabic copy, apart from names that stay in Latin', () => {
    const allowed = /KFUPM|QR|VIP|PDF|SMS|WhatsApp|English|\{[a-z]+\}/g
    const offenders = Object.entries(ar as Record<string, string>).filter(([, v]) => /[A-Za-z]/.test(v.replace(allowed, '')))
    expect(offenders.map(([k]) => k)).toEqual([])
  })
})
