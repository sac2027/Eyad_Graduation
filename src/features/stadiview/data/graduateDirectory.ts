import { PERSONAS } from '@/data/fixtures/graduates'
import { COLLEGE_ID } from '@/features/stadiview/config/venue'
import type { CollegeCode } from '@/features/stadiview/config/venue'
import { FAMILY_NAMES, FEMALE_NAMES, MALE_NAMES } from '@/features/stadiview/data/names'
import { normalise } from '@/features/stadiview/data/textSearch'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

/** One mock graduate. */
export interface Graduate {
  /** Position in the directory, 0 to count - 1. Graduates are listed zone by zone, in the venue's zone order. */
  index: number
  /** Nine digits: the entry year, then a serial number. */
  studentId: string
  name: { ar: string; en: string }
  gender: 'f' | 'm'
  /** Index into `getVenue().zones`: the college-and-degree group the graduate sits with. */
  zone: number
  /** The code a graduate gives their family so they can find the seat. Looks like KF-7Q2M-4X. */
  shareCode: string
  /** The demo persona this graduate is, or null for a generated one. */
  personaId: string | null
}

export interface Directory {
  count: number
  all: Graduate[]
  byPersona(id: string): Graduate | null
  byStudentId(id: string): Graduate | null
  byShareCode(code: string): Graduate | null
  inZone(zone: number): Graduate[]
}

/** Every mock graduate is generated from this number, so every visit meets the same people. */
const SEED = 57
const ENTRY_YEARS = [2019, 2020, 2021, 2022, 2023]
/** Letters and digits that cannot be mistaken for each other when read aloud or copied by hand: no 0, O, 1 or I. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A share code for the n-th graduate. Multiplying by an odd number modulo a power of two never repeats, so every code is different. */
function shareCodeFor(n: number): string {
  let x = (Math.imul(n + 1, 0x9e3779b1) ^ 0x2545f491) & 0x3fffffff // 30 bits: six letters of a 32-letter alphabet
  let letters = ''
  for (let k = 0; k < 6; k++) {
    letters += CODE_ALPHABET[x & 31]
    x >>>= 5
  }
  return `KF-${letters.slice(0, 4)}-${letters.slice(4)}`
}

function build(): Directory {
  const v = getVenue()
  const random = seeded(SEED)
  const all: Graduate[] = []
  const zoneStart: number[] = []
  const codeOf = Object.fromEntries(Object.entries(COLLEGE_ID).map(([code, id]) => [id, code])) as Record<string, CollegeCode>

  v.zones.forEach((zone, z) => {
    zoneStart.push(all.length)
    // The demo personas of this college, gender and degree sit first in their zone.
    const personas = zone.degree === 'B' ? PERSONAS.filter((p) => p.role === 'graduate' && p.gender === zone.gender && codeOf[p.college] === zone.college) : []
    for (let k = 0; k < zone.count; k++) {
      const index = all.length
      const persona = personas[k]
      const first = (zone.gender === 'f' ? FEMALE_NAMES : MALE_NAMES)[Math.floor(random() * (zone.gender === 'f' ? FEMALE_NAMES.length : MALE_NAMES.length))]
      const father = MALE_NAMES[Math.floor(random() * MALE_NAMES.length)]
      const family = FAMILY_NAMES[Math.floor(random() * FAMILY_NAMES.length)]
      const year = ENTRY_YEARS[Math.floor(random() * ENTRY_YEARS.length)]
      // 7919 shares no factor with 90,000, so these serials never repeat.
      const serial = 10000 + ((index * 7919) % 90000)
      all.push({
        index,
        studentId: `${year}${serial}`,
        name: persona ? persona.name : { ar: `${first.ar} ${father.ar} ${family.ar}`, en: `${first.en} ${father.en} ${family.en}` },
        gender: zone.gender,
        zone: z,
        shareCode: shareCodeFor(index),
        personaId: persona ? persona.id : null,
      })
    }
  })

  const byPersonaId = new Map<string, Graduate>()
  const byId = new Map<string, Graduate>()
  const byCode = new Map<string, Graduate>()
  for (const g of all) {
    if (g.personaId) byPersonaId.set(g.personaId, g)
    byId.set(g.studentId, g)
    byCode.set(g.shareCode.replace(/-/g, ''), g)
  }

  return {
    count: all.length,
    all,
    byPersona: (id) => byPersonaId.get(id) ?? null,
    byStudentId: (id) => byId.get(normalise(id).replace(/\s/g, '')) ?? null,
    // People type a code in any case, with or without its dashes.
    byShareCode: (code) => byCode.get(code.toUpperCase().replace(/[^A-Z0-9]/g, '')) ?? null,
    inZone: (zone) => (zone >= 0 && zone < v.zones.length ? all.slice(zoneStart[zone], zoneStart[zone] + v.zones[zone].count) : []),
  }
}

let directory: Directory | undefined

/** The directory of every graduate on the pitch, built once. */
export function getDirectory(): Directory {
  directory ??= build()
  return directory
}

let searchable: { g: Graduate; words: string[] }[] | undefined

/**
 * Finds graduates by student ID or by name.
 *
 * - Three or more digits search the IDs (anywhere in the number).
 * - Otherwise every word typed must begin a word of the name, in Arabic or in English. At least
 *   two letters are needed, so one keystroke does not list three thousand people.
 *
 * `matches` holds the first `limit`; `total` is how many there are in all. With a `college`, only its graduates are found.
 */
export function searchGraduates(query: string, limit = 8, college: CollegeCode | null = null): { matches: Graduate[]; total: number } {
  const q = normalise(query)
  const all = getDirectory().all
  let found: Graduate[]
  if (/^[\d\s]+$/.test(q)) {
    const digits = q.replace(/\s/g, '')
    if (digits.length < 3) return { matches: [], total: 0 }
    found = all.filter((g) => g.studentId.includes(digits))
  } else {
    const typed = q.split(' ').filter(Boolean)
    if (typed.join('').length < 2) return { matches: [], total: 0 }
    searchable ??= all.map((g) => ({ g, words: [...normalise(g.name.ar).split(' '), ...normalise(g.name.en).split(' ')] }))
    found = searchable.filter((s) => typed.every((w) => s.words.some((word) => word.startsWith(w)))).map((s) => s.g)
  }
  if (college) {
    const zones = getVenue().zones
    found = found.filter((g) => zones[g.zone].college === college)
  }
  return { matches: found.slice(0, limit), total: found.length }
}

/** A student ID with its middle hidden, for showing in a list a stranger can see: 201912340 becomes 2019•••40. */
export function maskStudentId(id: string): string {
  return id.length < 7 ? id : `${id.slice(0, 4)}${'•'.repeat(id.length - 6)}${id.slice(-2)}`
}
