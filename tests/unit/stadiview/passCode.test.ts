import { describe, expect, it } from 'vitest'
import { getDirectory } from '@/features/stadiview/data/graduateDirectory'
import { passCode, readPassCode } from '@/features/stadiview/data/passCode'
import { getVenue } from '@/features/stadiview/layout/venueLayout'

describe('the seat pass code', () => {
  const v = getVenue()
  const khaled = getDirectory().byPersona('grad-m-gold')!
  const seat = v.zones[khaled.zone].start + 11

  it('names the class, the seat and the student, and ends in a check value', () => {
    const code = passCode(khaled, seat)
    expect(code).toMatch(new RegExp(`^KFUPM57\\|SEAT\\|${v.idOf(seat)}\\|${khaled.studentId}\\|[A-Z2-9]{2}$`))
  })

  it('reads back what it wrote, for seats and for wheelchair bays', () => {
    for (const s of [seat, v.zones[0].start, 2986, 2997]) {
      const read = readPassCode(passCode(khaled, s))
      expect(read).toEqual({ ok: true, value: { seatId: v.idOf(s), studentId: khaled.studentId } })
    }
  })

  it('forgives spaces around the code', () => {
    expect(readPassCode(`  ${passCode(khaled, seat)}\n`).ok).toBe(true)
  })

  it('refuses a code with one character changed', () => {
    const code = passCode(khaled, seat)
    // Change one digit of the seat, keeping its shape.
    const at = code.indexOf('|', 13) - 1
    const other = code[at] === '1' ? '2' : '1'
    expect(readPassCode(code.slice(0, at) + other + code.slice(at + 1))).toEqual({ ok: false, error: 'check' })
    // And one digit of the student ID.
    const id = code.lastIndexOf('|') - 1
    const digit = code[id] === '1' ? '2' : '1'
    expect(readPassCode(code.slice(0, id) + digit + code.slice(id + 1))).toEqual({ ok: false, error: 'check' })
  })

  it('refuses a different check value', () => {
    const code = passCode(khaled, seat)
    const last = code.at(-1) === 'A' ? 'B' : 'A'
    expect(readPassCode(code.slice(0, -1) + last)).toEqual({ ok: false, error: 'check' })
  })

  it('refuses text that is not a seat pass', () => {
    for (const text of ['', 'hello', 'TICKET-G1-204', 'KFUPM57|SEAT|P3-12-07', 'KFUPM57|SEAT|S-02-084|201912340|K7', 'KFUPM56|SEAT|P3-12-07|201912340|K7', 'KFUPM57|SEAT|P3-12-07|2019|K7']) {
      expect(readPassCode(text), text).toEqual({ ok: false, error: 'format' })
    }
  })

  it('gives different graduates different codes for the same seat', () => {
    const reem = getDirectory().byPersona('grad-f-gold')!
    expect(passCode(khaled, seat)).not.toBe(passCode(reem, seat))
  })
})
