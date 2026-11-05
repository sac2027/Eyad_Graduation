import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { adminService } from '@/data'
import { AdminPage } from '@/features/admin/AdminPage'
import { useSessionStore } from '@/session/sessionStore'
import { computeCapacity } from '@/domain/capacity'
import { useLocale } from '@/i18n'

afterEach(() => {
  useSessionStore.setState({ personaId: 'grad-m-gold' })
  useLocale.getState().setLocale('ar')
})

describe('admin edge cases', () => {
  it('shows an empty state when there are no exceptions', () => {
    useLocale.getState().setLocale('en')
    useSessionStore.setState({ personaId: 'admin' })
    const before = adminService.store.getState().exceptions
    adminService.store.setState({ exceptions: [] })
    render(<AdminPage />)
    expect(screen.getByText('No exceptional cases yet.')).toBeInTheDocument()
    adminService.store.setState({ exceptions: before })
  })
  it('copes with a very large class: guaranteed seats cap at the pool and nothing is negative', () => {
    const c = computeCapacity({ totalSeats: 5000, graduates: 250_000, reserved: { vip: 300, easyAccess: 300, ops: 100 } })
    expect(c.guaranteed).toBe(4300)
    expect(c.secondPool).toBe(0)
    expect(c.perGraduate).toBeGreaterThan(0)
    expect(c.breakEvenTakeUp).toBe(0)
  })
})
