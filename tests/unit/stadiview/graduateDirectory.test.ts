import { describe, expect, it } from 'vitest'
import { PERSONAS } from '@/data/fixtures/graduates'
import { COLLEGE_ID } from '@/features/stadiview/config/venue'
import { getDirectory, maskStudentId, searchGraduates } from '@/features/stadiview/data/graduateDirectory'
import { normalise } from '@/features/stadiview/data/textSearch'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

const d = getDirectory()
const v = getVenue()

describe('the graduate directory', () => {
  it('has one graduate for every seat of every zone: 2,986 in all', () => {
    expect(d.count).toBe(2986)
    expect(d.all).toHaveLength(2986)
    v.zones.forEach((zone, z) => {
      expect(d.inZone(z), zone.id).toHaveLength(zone.count)
      expect(d.inZone(z).every((g) => g.zone === z && g.gender === zone.gender)).toBe(true)
    })
    expect(d.all.filter((g) => g.gender === 'f')).toHaveLength(629)
    expect(d.all.filter((g) => g.gender === 'm')).toHaveLength(2357)
    expect(d.all.every((g, i) => g.index === i)).toBe(true)
    expect(d.inZone(-1)).toEqual([])
    expect(d.inZone(99)).toEqual([])
  })

  it('gives everyone a unique nine-digit ID and a unique share code', () => {
    expect(new Set(d.all.map((g) => g.studentId)).size).toBe(2986)
    expect(new Set(d.all.map((g) => g.shareCode)).size).toBe(2986)
    for (const g of d.all) {
      expect(g.studentId).toMatch(/^20(19|20|21|22|23)\d{5}$/)
      expect(g.shareCode).toMatch(/^KF-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/)
      expect(g.name.ar.length).toBeGreaterThan(0)
      expect(g.name.en.length).toBeGreaterThan(0)
    }
  })

  it('places every graduate persona in a bachelor zone of its own college and gender, under its own name', () => {
    const personas = PERSONAS.filter((p) => p.role === 'graduate')
    expect(personas).toHaveLength(10)
    for (const p of personas) {
      const g = d.byPersona(p.id)
      expect(g, p.id).not.toBeNull()
      const zone = v.zones[g!.zone]
      expect(COLLEGE_ID[zone.college]).toBe(p.college)
      expect(zone.gender).toBe(p.gender)
      expect(zone.degree).toBe('B')
      expect(g!.name).toEqual(p.name)
    }
    expect(new Set(personas.map((p) => d.byPersona(p.id)!.index)).size).toBe(10)
    expect(d.byPersona('guest')).toBeNull()
    expect(d.byPersona('nobody')).toBeNull()
  })

  it('finds a graduate by ID and by share code, however the code is typed', () => {
    const g = d.all[1234]
    expect(d.byStudentId(g.studentId)).toBe(g)
    expect(d.byStudentId('000000000')).toBeNull()
    expect(d.byShareCode(g.shareCode)).toBe(g)
    expect(d.byShareCode(g.shareCode.toLowerCase().replace(/-/g, ' '))).toBe(g)
    expect(d.byShareCode('KF-0000-00')).toBeNull()
    expect(d.byShareCode('')).toBeNull()
  })
})

describe('normalise', () => {
  it('folds the ways one Arabic name can be written', () => {
    expect(normalise('أَحْمَد')).toBe(normalise('احمد'))
    expect(normalise('نورة')).toBe(normalise('نوره'))
    expect(normalise('مصطفى')).toBe(normalise('مصطفي'))
    expect(normalise('عبـــدالله')).toBe('عبدالله')
  })
  it('lower-cases, trims and reads any digits', () => {
    expect(normalise('  Al-Otaibi ')).toBe('al-otaibi')
    expect(normalise('٢٠١٩')).toBe('2019')
    expect(normalise('۲۰۱۹')).toBe('2019')
    expect(normalise('a   b')).toBe('a b')
  })
})

describe('searching', () => {
  it('finds exactly one graduate by a full ID, typed in Latin or Arabic digits', () => {
    const g = d.all[777]
    expect(searchGraduates(g.studentId)).toEqual({ matches: [g], total: 1 })
    const arabic = g.studentId.replace(/\d/g, (x) => String.fromCharCode(0x0660 + Number(x)))
    expect(searchGraduates(arabic).matches).toEqual([g])
  })

  it('finds a persona by either spelling of the name, and by part of it', () => {
    const khaled = d.byPersona('grad-m-gold')!
    expect(searchGraduates('Khaled Alotaibi').matches).toContain(khaled)
    expect(searchGraduates('خالد العتيبي').matches).toContain(khaled)
    expect(searchGraduates('alot kha').matches).toContain(khaled)
    expect(searchGraduates('KHALED ALOTAIBI').matches).toContain(khaled)
  })

  it('caps a long list and still says how many there are', () => {
    const r = searchGraduates('Alharbi')
    expect(r.total).toBeGreaterThan(8)
    expect(r.matches).toHaveLength(8)
    expect(searchGraduates('Alharbi', 3).matches).toHaveLength(3)
    expect(r.matches.every((g) => normalise(g.name.en).includes('alharbi'))).toBe(true)
  })

  it('asks for more than a keystroke: nothing for an empty query, one letter, or two digits', () => {
    for (const q of ['', '   ', 'a', 'ن', '20', '٢']) expect(searchGraduates(q)).toEqual({ matches: [], total: 0 })
    expect(searchGraduates('zzzzqq').total).toBe(0)
  })

  it('hides the middle of an ID', () => {
    expect(maskStudentId('201912340')).toBe('2019•••40')
    expect(maskStudentId('12')).toBe('12')
  })
})
