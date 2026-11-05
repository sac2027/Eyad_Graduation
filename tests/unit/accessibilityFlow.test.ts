import { describe, expect, it } from 'vitest'
import { routeForParty } from '@/features/guest/AccessibilityFlow'

describe('routeForParty', () => {
  it('sends wheelchair and slow walkers to Gate 3 easy-access seating', () => {
    expect(routeForParty({ mobility: 'wheelchair', elderly: false })).toEqual({ gate: 'gate-3', zone: 'easy-access', parking: 'p3' })
    expect(routeForParty({ mobility: 'walks-slowly', elderly: false })).toMatchObject({ gate: 'gate-3', zone: 'easy-access' })
  })
  it('sends an elderly guest to Gate 3 even without a mobility need', () => {
    expect(routeForParty({ mobility: 'none', elderly: true })).toMatchObject({ gate: 'gate-3', zone: 'easy-access' })
  })
  it('sends everyone else to Gate 1 general seating', () => {
    expect(routeForParty({ mobility: 'none', elderly: false })).toEqual({ gate: 'gate-1', zone: 'general', parking: 'p1' })
  })
})
