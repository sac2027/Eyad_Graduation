import { err, ok } from '@/domain/types'
import type { Result } from '@/domain/types'
import type { Graduate } from '@/features/stadiview/data/graduateDirectory'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

/**
 * The text inside the QR code of a graduate's seat pass:
 *
 *     KFUPM57|SEAT|P3-12-07|201912340|K7
 *
 * The class, what the pass is for, the seat, the student ID, and a two-character check value over
 * the rest, so that a damaged or hand-edited code is refused at the gate instead of being read as
 * some other seat. A real pass would be signed by the server; this demo has none.
 */
const HEAD = 'KFUPM57|SEAT'
/** No 0, 1, I or O: nothing a steward could misread. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SEAT_ID = /^P\d+-(?:\d{2}-\d{2}|[A-Z]\d+)$/
const STUDENT_ID = /^\d{9}$/

function checkOf(body: string): string {
  // FNV-1a, 32 bits.
  let h = 0x811c9dc5
  for (let k = 0; k < body.length; k++) {
    h ^= body.charCodeAt(k)
    h = Math.imul(h, 0x01000193)
  }
  h >>>= 0
  return ALPHABET[h & 31] + ALPHABET[(h >>> 5) & 31]
}

export function passCode(graduate: Graduate, seat: number): string {
  const body = `${HEAD}|${getVenue().idOf(seat)}|${graduate.studentId}`
  return `${body}|${checkOf(body)}`
}

/**
 * Reads a pass back.
 * - 'format': not a seat pass at all
 * - 'check': shaped like one, but the check value does not match
 */
export function readPassCode(text: string): Result<{ seatId: string; studentId: string }, 'format' | 'check'> {
  const parts = text.trim().split('|')
  if (parts.length !== 5 || `${parts[0]}|${parts[1]}` !== HEAD) return err('format')
  const [, , seatId, studentId, check] = parts
  if (!SEAT_ID.test(seatId) || !STUDENT_ID.test(studentId) || check.length !== 2) return err('format')
  if (checkOf(`${HEAD}|${seatId}|${studentId}`) !== check) return err('check')
  return ok({ seatId, studentId })
}
