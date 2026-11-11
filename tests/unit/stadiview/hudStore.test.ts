import { beforeEach, describe, expect, it } from 'vitest'
import { getVenue } from '@/features/stadiview/layout/venueLayout'
import { filtersOff, seatMatches, useHud } from '@/features/stadiview/state/hudStore'

const v = getVenue()
const none = { college: null, degree: null, availableOnly: false, accessibleOnly: false }

describe('the HUD store', () => {
  beforeEach(() => useHud.getState().reset())

  it('starts as a guest with nothing inspected, no panel open and no filters', () => {
    const s = useHud.getState()
    expect(s).toMatchObject({ role: 'guest', inspected: -1, panel: 'none', filters: none, guest: { ticketSeat: -1, graduate: -1 } })
    expect(filtersOff(s.filters)).toBe(true)
  })

  it('inspects a seat, and treats anything that is not a seat number as nothing', () => {
    useHud.getState().inspect(42)
    expect(useHud.getState().inspected).toBe(42)
    useHud.getState().inspect(-1)
    expect(useHud.getState().inspected).toBe(-1)
    useHud.getState().inspect(Number.NaN)
    expect(useHud.getState().inspected).toBe(-1)
  })

  it('drops the inspected seat and the open panel when the role changes', () => {
    useHud.getState().inspect(42)
    useHud.getState().setPanel('inspector')
    useHud.getState().setRole('graduate')
    expect(useHud.getState()).toMatchObject({ role: 'graduate', inspected: -1, panel: 'none' })
    useHud.getState().inspect(7)
    useHud.getState().setRole('graduate')
    expect(useHud.getState().inspected).toBe(7)
  })

  it('merges filters and guest lookups a part at a time', () => {
    useHud.getState().setFilters({ college: 'CCM' })
    useHud.getState().setFilters({ availableOnly: true })
    expect(useHud.getState().filters).toEqual({ college: 'CCM', degree: null, availableOnly: true, accessibleOnly: false })
    expect(filtersOff(useHud.getState().filters)).toBe(false)
    useHud.getState().setGuest({ ticketSeat: 3000 })
    useHud.getState().setGuest({ graduate: 12 })
    expect(useHud.getState().guest).toEqual({ ticketSeat: 3000, graduate: 12, byCode: false })
  })
})

describe('seatMatches', () => {
  const pitch = v.indexOf('P3-12-07') // men, Computing & Mathematics, bachelor
  const bay = v.indexOf('P3-A1')
  const stand = v.indexOf('S-10-060')
  const platform = v.indexOf('ACC-02-020')

  it('passes everything when no filter is set', () => {
    for (const i of [pitch, bay, stand, platform]) expect(seatMatches(i, v, none, 'taken')).toBe(true)
  })

  it('filters graduate seats by college and degree; stands and bays have neither', () => {
    expect(seatMatches(pitch, v, { ...none, college: 'CCM' }, 'available')).toBe(true)
    expect(seatMatches(pitch, v, { ...none, college: 'CEP' }, 'available')).toBe(false)
    expect(seatMatches(pitch, v, { ...none, degree: 'B' }, 'available')).toBe(true)
    expect(seatMatches(pitch, v, { ...none, degree: 'G' }, 'available')).toBe(false)
    expect(seatMatches(stand, v, { ...none, college: 'CCM' }, 'available')).toBe(false)
    expect(seatMatches(bay, v, { ...none, degree: 'B' }, 'available')).toBe(false)
  })

  it('keeps only free graduate seats under "available only"', () => {
    const f = { ...none, availableOnly: true }
    expect(seatMatches(pitch, v, f, 'available')).toBe(true)
    expect(seatMatches(pitch, v, f, 'taken')).toBe(false)
    expect(seatMatches(pitch, v, f, 'mine')).toBe(false)
    expect(seatMatches(stand, v, f, 'available')).toBe(false)
  })

  it('keeps the bays and the accessibility platform under "wheelchair bays"', () => {
    const f = { ...none, accessibleOnly: true }
    expect(seatMatches(bay, v, f, 'available')).toBe(true)
    expect(seatMatches(platform, v, f, 'available')).toBe(true)
    expect(seatMatches(pitch, v, f, 'available')).toBe(false)
    expect(seatMatches(stand, v, f, 'available')).toBe(false)
  })
})

describe('panels, the seat card and the matrix', () => {
  beforeEach(() => useHud.getState().reset())
  const hud = () => useHud.getState()

  it('opens the guest tools when someone chooses Guest', () => {
    hud().setRole('graduate')
    expect(hud().panel).toBe('none')
    hud().setRole('guest')
    expect(hud().panel).toBe('guest')
  })

  it('gives the side panel\'s place to the inspector when a seat is inspected', () => {
    hud().setPanel('mine')
    hud().inspect(40)
    expect(hud()).toMatchObject({ inspected: 40, panel: 'none' })
  })

  it('keeps the panel open when the panel itself marks a seat', () => {
    hud().setPanel('guest')
    hud().inspect(3000, true)
    expect(hud()).toMatchObject({ inspected: 3000, panel: 'guest' })
    // Clearing the seat never closes a panel either.
    hud().inspect(-1)
    expect(hud()).toMatchObject({ inspected: -1, panel: 'guest' })
  })

  it('knows whether the seat card opened because of a booking', () => {
    hud().setCardOpen(true, true)
    expect(hud()).toMatchObject({ cardOpen: true, cardFresh: true })
    hud().setCardOpen(false)
    expect(hud()).toMatchObject({ cardOpen: false, cardFresh: false })
    hud().setCardOpen(true)
    expect(hud()).toMatchObject({ cardOpen: true, cardFresh: false })
  })

  it('closes the seat card when the role changes', () => {
    hud().setRole('graduate')
    hud().setCardOpen(true, true)
    hud().setRole('guest')
    expect(hud()).toMatchObject({ cardOpen: false, cardFresh: false })
  })

  it('gives every request to fit the matrix a new token, even for the same place', () => {
    const first = hud().matrixFit.token
    hud().fitMatrix({ zone: 2 })
    expect(hud().matrixFit).toEqual({ what: { zone: 2 }, token: first + 1 })
    hud().fitMatrix({ zone: 2 })
    expect(hud().matrixFit.token).toBe(first + 2)
  })

  it('remembers how a graduate was reached', () => {
    hud().setGuest({ graduate: 12, byCode: true })
    expect(hud().guest).toEqual({ ticketSeat: -1, graduate: 12, byCode: true })
    hud().reset()
    expect(hud().guest).toEqual({ ticketSeat: -1, graduate: -1, byCode: false })
  })
})
