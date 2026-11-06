import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Certificate } from '@/features/stadium/Certificate'
import { useLocale } from '@/i18n'

describe('Certificate', () => {
  it('is announced as your certificate in Arabic and English', () => {
    useLocale.getState().setLocale('ar')
    const { unmount } = render(<Certificate size={120} labelled />)
    expect(screen.getByRole('img', { name: 'شهادتك' })).toBeTruthy()
    expect(screen.getByText('شهادتك')).toBeTruthy()
    unmount()
    useLocale.getState().setLocale('en')
    render(<Certificate size={120} />)
    expect(screen.getByRole('img', { name: 'Your certificate' })).toBeTruthy()
    expect(screen.queryByText('Your certificate')).toBeNull()
  })
})
